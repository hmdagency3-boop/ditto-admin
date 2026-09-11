import fs from "node:fs/promises";
import path from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import makeWASocket, {
  Browsers,
  BufferJSON,
  DisconnectReason,
  initAuthCreds,
  proto,
  type AuthenticationState,
  type WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import { storage } from "./storage";

export type WhatsAppConnectionStatus =
  | "disconnected"
  | "connecting"
  | "qr"
  | "connected"
  | "logged_out"
  | "error";

export interface WhatsAppConnectionInfo {
  status: WhatsAppConnectionStatus;
  qr: string | null;
  phoneNumber: string | null;
  lastError: string | null;
}

export interface WhatsAppChat {
  jid: string;
  name: string;
  phoneNumber: string | null;
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: number;
}

export interface WhatsAppMessage {
  id: string;
  jid: string;
  text: string;
  fromMe: boolean;
  senderName: string;
  timestamp: number;
}

type SerializedAuthFiles = Record<string, string>;
type SessionRow = { auth_blob?: string | null };

interface WhatsAppRuntime {
  ownerId: string;
  socket: WASocket | null;
  starting: Promise<void> | null;
  state: WhatsAppConnectionInfo;
  chats: Map<string, WhatsAppChat>;
  messages: Map<string, WhatsAppMessage[]>;
  contacts: Map<string, any>;
}

const authDirectory = path.resolve(
  process.env.WHATSAPP_AUTH_DIR || path.join(process.cwd(), ".data", "whatsapp-auth"),
);
const runtimes = new Map<string, WhatsAppRuntime>();
const sessionTable = "whatsapp_sessions";
const sessionName = "default";

function getRuntime(ownerId: string): WhatsAppRuntime {
  const existing = runtimes.get(ownerId);
  if (existing) return existing;

  const runtime: WhatsAppRuntime = {
    ownerId,
    socket: null,
    starting: null,
    state: {
      status: "disconnected",
      qr: null,
      phoneNumber: null,
      lastError: null,
    },
    chats: new Map(),
    messages: new Map(),
    contacts: new Map(),
  };
  runtimes.set(ownerId, runtime);
  return runtime;
}

function updateState(runtime: WhatsAppRuntime, update: Partial<WhatsAppConnectionInfo>) {
  runtime.state = { ...runtime.state, ...update };
}

export function getWhatsAppConnection(ownerId: string): WhatsAppConnectionInfo {
  return { ...getRuntime(ownerId).state };
}

function sessionKey(): Buffer {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("SESSION_SECRET or JWT_SECRET is required to encrypt WhatsApp sessions");
  return createHash("sha256").update(secret).digest();
}

function encryptAuthBlob(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64")).join(".");
}

function decryptAuthBlob(value: string): string {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid WhatsApp auth blob");
  const decipher = createDecipheriv("aes-256-gcm", sessionKey(), Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function fixAuthFileName(file: string): string {
  return file.replace(/\//g, "__").replace(/:/g, "-");
}

async function readAuthFiles(directory: string): Promise<SerializedAuthFiles> {
  const files: SerializedAuthFiles = {};
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      files[entry.name] = await fs.readFile(path.join(directory, entry.name), "utf8");
    }
  } catch {
    // A missing auth directory means a new QR session is required.
  }
  return files;
}

async function getSessionRow(ownerId: string): Promise<SessionRow | null> {
  const { data, error } = await storage.supabase
    .from(sessionTable)
    .select("auth_blob")
    .eq("owner_id", ownerId)
    .eq("session_name", sessionName)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") return null;
    console.error("[whatsapp] session lookup failed:", error.message);
    return null;
  }
  return data as SessionRow | null;
}

async function saveSessionRecord(ownerId: string, update: Record<string, unknown>) {
  const { error } = await storage.supabase
    .from(sessionTable)
    .upsert(
      {
        owner_id: ownerId,
        session_name: sessionName,
        ...update,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,session_name" },
    );

  if (error && error.code !== "42P01") {
    console.error("[whatsapp] session save failed:", error.message);
  }
}

async function loadDatabaseAuthState(ownerId: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const row = await getSessionRow(ownerId);
  let files: SerializedAuthFiles = {};

  if (row?.auth_blob) {
    try {
      const parsed = JSON.parse(decryptAuthBlob(row.auth_blob)) as { files?: SerializedAuthFiles };
      files = parsed.files || {};
    } catch (error) {
      console.error("[whatsapp] could not decrypt stored session:", error);
    }
  }

  // Import the previous single-account file session once, before creating a QR.
  if (!files["creds.json"]) {
    files = await readAuthFiles(authDirectory);
  }

  const readData = (file: string) => {
    const raw = files[file];
    if (!raw) return null;
    try {
      return JSON.parse(raw, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const persist = async () => {
    const authBlob = encryptAuthBlob(JSON.stringify({ files }));
    await saveSessionRecord(ownerId, { auth_blob: authBlob });
  };

  const authState: AuthenticationState = {
    creds: readData("creds.json") || initAuthCreds(),
    keys: {
      get: async (type, ids) => {
        const data: Record<string, any> = {};
        await Promise.all(ids.map(async (id) => {
          let value = readData(fixAuthFileName(`${type}-${id}.json`));
          if (type === "app-state-sync-key" && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          data[id] = value;
        }));
        return data;
      },
      set: async (data) => {
        for (const category in data) {
          for (const id in data[category as keyof typeof data] || {}) {
            const value = data[category as keyof typeof data]?.[id];
            const file = fixAuthFileName(`${category}-${id}.json`);
            if (value) files[file] = JSON.stringify(value, BufferJSON.replacer);
            else delete files[file];
          }
        }
        await persist();
      },
    },
  };

  const saveCreds = async () => {
    files["creds.json"] = JSON.stringify(authState.creds, BufferJSON.replacer);
    await persist();
  };

  // Persist the imported/local state so the next process can use the DB row.
  if (!row?.auth_blob && files["creds.json"]) await persist();
  return { state: authState, saveCreds };
}

async function hasStoredSession(ownerId: string): Promise<boolean> {
  const row = await getSessionRow(ownerId);
  if (row?.auth_blob) return true;
  const legacyFiles = await readAuthFiles(authDirectory);
  return Boolean(legacyFiles["creds.json"]);
}

function messageTimestamp(message: any): number {
  const value = message?.messageTimestamp;
  if (typeof value === "number") return value * 1000;
  if (value?.toNumber) return value.toNumber() * 1000;
  return Date.now();
}

function messageText(message: any): string {
  const content = message?.message;
  if (!content) return "";
  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    (content.reactionMessage ? "❤️" : "") ||
    (content.stickerMessage ? "ملصق" : "") ||
    ""
  );
}

function phoneNumberFromJid(jid: string): string | null {
  const [value, server] = jid.split("@");
  if (!value || server === "g.us" || server === "broadcast" || server === "lid") return null;
  return server === "s.whatsapp.net" || server === "c.us" ? value : null;
}

function rememberContact(runtime: WhatsAppRuntime, contact: any) {
  if (!contact?.id) return;
  const merged = { ...(runtime.contacts.get(contact.id) || {}), ...contact };
  const aliases = [merged.id, merged.lid, merged.phoneNumber].filter(Boolean) as string[];
  for (const alias of aliases) runtime.contacts.set(alias, merged);
}

function findContact(runtime: WhatsAppRuntime, jid: string, fallbackPhoneNumber?: string | null) {
  return runtime.contacts.get(jid) ||
    (fallbackPhoneNumber ? runtime.contacts.get(fallbackPhoneNumber) : undefined);
}

function contactIdentity(runtime: WhatsAppRuntime, jid: string, fallbackName?: string, fallbackPhoneNumber?: string | null) {
  const contact = findContact(runtime, jid, fallbackPhoneNumber);
  const phoneNumber = contact?.phoneNumber || fallbackPhoneNumber || phoneNumberFromJid(jid);
  const name =
    contact?.name ||
    contact?.notify ||
    contact?.verifiedName ||
    fallbackName ||
    phoneNumber ||
    jid.split("@")[0] ||
    "WhatsApp";
  return {
    name: String(name),
    phoneNumber: phoneNumber
      ? String(phoneNumber).replace(/@.*$/, "").replace(/^\+/, "")
      : null,
  };
}

function refreshChatIdentity(runtime: WhatsAppRuntime, jid: string) {
  const current = runtime.chats.get(jid);
  if (!current) return;
  runtime.chats.set(jid, {
    ...current,
    ...contactIdentity(runtime, jid, current.name, current.phoneNumber),
  });
}

function upsertMessage(runtime: WhatsAppRuntime, message: any, fallbackName?: string) {
  const jid = message?.key?.remoteJid;
  if (!jid || jid === "status@broadcast" || jid.endsWith("@broadcast")) return;
  const text = messageText(message);
  if (!text && !message?.message) return;
  const timestamp = messageTimestamp(message);
  const item: WhatsAppMessage = {
    id: message.key.id || `${jid}-${timestamp}-${Math.random()}`,
    jid,
    text: text || "رسالة غير نصية",
    fromMe: Boolean(message.key.fromMe),
    senderName: message.pushName || fallbackName || jid.split("@")[0],
    timestamp,
  };
  const chatMessages = runtime.messages.get(jid) || [];
  if (!chatMessages.some((existing) => existing.id === item.id)) {
    chatMessages.push(item);
    chatMessages.sort((a, b) => a.timestamp - b.timestamp);
    runtime.messages.set(jid, chatMessages.slice(-200));
  }
  const existingChat = runtime.chats.get(jid);
  runtime.chats.set(jid, {
    jid,
    ...contactIdentity(runtime, jid, fallbackName || item.senderName, existingChat?.phoneNumber),
    unreadCount: existingChat?.unreadCount || 0,
    lastMessage: item.text,
    lastMessageAt: item.timestamp,
  });
}

export function getWhatsAppChats(ownerId: string): WhatsAppChat[] {
  return [...getRuntime(ownerId).chats.values()].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

export function getWhatsAppMessages(ownerId: string, jid: string): WhatsAppMessage[] {
  return [...(getRuntime(ownerId).messages.get(jid) || [])].sort((a, b) => a.timestamp - b.timestamp);
}

export async function sendWhatsAppMessage(ownerId: string, jid: string, text: string): Promise<WhatsAppMessage> {
  const runtime = getRuntime(ownerId);
  if (!runtime.socket || runtime.state.status !== "connected") {
    throw new Error("واتساب غير متصل");
  }
  const cleanText = text.trim();
  if (!cleanText) throw new Error("نص الرسالة مطلوب");
  const sent = await runtime.socket.sendMessage(jid, { text: cleanText });
  upsertMessage(
    runtime,
    {
      key: { ...sent?.key, remoteJid: jid, fromMe: true },
      message: { conversation: cleanText },
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
    runtime.chats.get(jid)?.name,
  );
  return getWhatsAppMessages(ownerId, jid).at(-1)!;
}

export async function resumeWhatsAppConnection(ownerId: string): Promise<WhatsAppConnectionInfo> {
  const runtime = getRuntime(ownerId);
  if (
    runtime.socket ||
    runtime.starting ||
    runtime.state.status === "connected" ||
    runtime.state.status === "connecting" ||
    runtime.state.status === "qr"
  ) {
    return { ...runtime.state };
  }
  if (runtime.state.status === "logged_out" || !(await hasStoredSession(ownerId))) {
    return { ...runtime.state };
  }
  return startWhatsAppConnection(ownerId);
}

export async function startWhatsAppConnection(ownerId: string): Promise<WhatsAppConnectionInfo> {
  const runtime = getRuntime(ownerId);
  if (runtime.starting) {
    await runtime.starting;
    return { ...runtime.state };
  }
  if (runtime.socket && runtime.state.status === "connected") return { ...runtime.state };

  runtime.starting = (async () => {
    try {
      const { state: authState, saveCreds } = await loadDatabaseAuthState(ownerId);
      await saveSessionRecord(ownerId, { status: "connecting" });
      updateState(runtime, { status: "connecting", qr: null, lastError: null });

      let reconnectScheduled = false;
      let createSocket: () => void;

      createSocket = () => {
        const nextSocket = makeWASocket({
          auth: authState,
          browser: Browsers.ubuntu("AdminDesk"),
          markOnlineOnConnect: false,
          syncFullHistory: false,
        });
        runtime.socket = nextSocket;
        nextSocket.ev.on("creds.update", saveCreds);
        nextSocket.ev.on("messaging-history.set", ({
          chats: historyChats,
          contacts: historyContacts,
          messages: historyMessages,
          lidPnMappings,
        }) => {
          for (const contact of historyContacts || []) rememberContact(runtime, contact);
          for (const mapping of lidPnMappings || []) {
            const contact = runtime.contacts.get(mapping.lid);
            rememberContact(runtime, {
              ...(contact || {}),
              id: mapping.lid,
              lid: mapping.lid,
              phoneNumber: mapping.pn,
            });
          }
          for (const chat of historyChats as any[]) {
            if (!chat.id || chat.id === "status@broadcast" || chat.id.endsWith("@broadcast")) continue;
            const last = getWhatsAppMessages(ownerId, chat.id).at(-1);
            const chatPhoneNumber = chat.pnJid || chat.phoneNumber || null;
            if (chatPhoneNumber) {
              rememberContact(runtime, { id: chat.id, phoneNumber: chatPhoneNumber, lid: chat.lidJid });
            }
            runtime.chats.set(chat.id, {
              jid: chat.id,
              ...contactIdentity(runtime, chat.id, chat.name || chat.displayName || chat.username, chatPhoneNumber),
              unreadCount: Number(chat.unreadCount || 0),
              lastMessage: last?.text || "",
              lastMessageAt: last?.timestamp || Number(chat.conversationTimestamp || 0) * 1000,
            });
          }
          for (const message of historyMessages as any[]) upsertMessage(runtime, message);
        });
        nextSocket.ev.on("contacts.upsert", (nextContacts) => {
          for (const contact of nextContacts as any[]) {
            rememberContact(runtime, contact);
            refreshChatIdentity(runtime, contact.id);
            if (contact.lid) refreshChatIdentity(runtime, contact.lid);
            if (contact.phoneNumber) refreshChatIdentity(runtime, contact.phoneNumber);
          }
        });
        nextSocket.ev.on("contacts.update", (updates) => {
          for (const update of updates as any[]) {
            if (!update?.id) continue;
            rememberContact(runtime, update);
            refreshChatIdentity(runtime, update.id);
          }
        });
        nextSocket.ev.on("lid-mapping.update", (mapping: any) => {
          if (!mapping?.lid || !mapping?.pn) return;
          const contact = runtime.contacts.get(mapping.lid) || runtime.contacts.get(mapping.pn);
          rememberContact(runtime, {
            ...(contact || {}),
            id: mapping.lid,
            lid: mapping.lid,
            phoneNumber: mapping.pn,
          });
          refreshChatIdentity(runtime, mapping.lid);
          refreshChatIdentity(runtime, mapping.pn);
        });
        nextSocket.ev.on("chats.upsert", (historyChats) => {
          for (const chat of historyChats as any[]) {
            if (!chat.id || chat.id.endsWith("@broadcast")) continue;
            const current = runtime.chats.get(chat.id);
            const chatPhoneNumber = chat.pnJid || chat.phoneNumber || current?.phoneNumber || null;
            if (chatPhoneNumber) {
              rememberContact(runtime, { id: chat.id, phoneNumber: chatPhoneNumber, lid: chat.lidJid });
            }
            runtime.chats.set(chat.id, {
              jid: chat.id,
              ...contactIdentity(runtime, chat.id, chat.name || chat.displayName || chat.username || current?.name, chatPhoneNumber),
              unreadCount: Number(chat.unreadCount ?? current?.unreadCount ?? 0),
              lastMessage: current?.lastMessage || "",
              lastMessageAt: current?.lastMessageAt || Number(chat.conversationTimestamp || 0) * 1000,
            });
          }
        });
        nextSocket.ev.on("messages.upsert", ({ messages: incomingMessages }) => {
          for (const message of incomingMessages as any[]) upsertMessage(runtime, message);
        });
        nextSocket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
          if (qr) {
            try {
              const qrDataUrl = await QRCode.toDataURL(qr, {
                margin: 2,
                width: 280,
                errorCorrectionLevel: "M",
              });
              updateState(runtime, { status: "qr", qr: qrDataUrl, lastError: null });
              await saveSessionRecord(ownerId, { status: "qr" });
            } catch (error) {
              updateState(runtime, {
                status: "error",
                lastError: error instanceof Error ? error.message : "تعذر إنشاء رمز QR",
              });
            }
          }
          if (connection === "open") {
            const phoneNumber = nextSocket.user?.id?.split(":")[0] || null;
            updateState(runtime, {
              status: "connected",
              qr: null,
              phoneNumber,
              lastError: null,
            });
            await saveSessionRecord(ownerId, {
              status: "connected",
              phone_number: phoneNumber,
              last_connected_at: new Date().toISOString(),
            });
          }
          if (connection === "close") {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
            const loggedOut = statusCode === DisconnectReason.loggedOut;
            const restartRequired = statusCode === DisconnectReason.restartRequired;
            if (restartRequired) {
              runtime.socket = null;
              updateState(runtime, { status: "connecting", qr: null, lastError: null });
              if (!reconnectScheduled) {
                reconnectScheduled = true;
                setTimeout(() => {
                  reconnectScheduled = false;
                  if (runtime.state.status === "connecting") createSocket();
                }, 500);
              }
              return;
            }
            runtime.socket = null;
            runtime.chats.clear();
            runtime.messages.clear();
            runtime.contacts.clear();
            updateState(runtime, {
              status: loggedOut ? "logged_out" : "disconnected",
              qr: null,
              phoneNumber: loggedOut ? null : runtime.state.phoneNumber,
              lastError: loggedOut
                ? "تم تسجيل خروج الحساب من واتساب"
                : "انقطع الاتصال. اضغط «بدء الربط» للمحاولة مرة أخرى.",
            });
            await saveSessionRecord(ownerId, {
              status: loggedOut ? "logged_out" : "disconnected",
              ...(loggedOut ? { auth_blob: null, phone_number: null } : {}),
            });
          }
        });
      };
      createSocket();
    } catch (error) {
      runtime.socket = null;
      updateState(runtime, {
        status: "error",
        qr: null,
        lastError: error instanceof Error ? error.message : "تعذر بدء اتصال واتساب",
      });
      await saveSessionRecord(ownerId, {
        status: "error",
        last_error: error instanceof Error ? error.message : "تعذر بدء اتصال واتساب",
      });
    }
  })();

  try {
    await runtime.starting;
  } finally {
    runtime.starting = null;
  }
  return { ...runtime.state };
}

export async function disconnectWhatsApp(ownerId: string): Promise<WhatsAppConnectionInfo> {
  const runtime = getRuntime(ownerId);
  const currentSocket = runtime.socket;
  runtime.socket = null;
  try {
    if (currentSocket) await currentSocket.logout();
  } catch (error) {
    console.warn("[whatsapp] logout failed:", error);
  } finally {
    runtime.chats.clear();
    runtime.messages.clear();
    runtime.contacts.clear();
    updateState(runtime, {
      status: "disconnected",
      qr: null,
      phoneNumber: null,
      lastError: null,
    });
    await saveSessionRecord(ownerId, {
      status: "disconnected",
      auth_blob: null,
      phone_number: null,
    });
  }
  return { ...runtime.state };
}