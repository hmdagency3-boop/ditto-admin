import fs from "node:fs/promises";
import path from "node:path";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";

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

const authDirectory = path.resolve(
  process.env.WHATSAPP_AUTH_DIR || path.join(process.cwd(), ".data", "whatsapp-auth"),
);

let socket: WASocket | null = null;
let starting: Promise<void> | null = null;
let state: WhatsAppConnectionInfo = {
  status: "disconnected",
  qr: null,
  phoneNumber: null,
  lastError: null,
};
const chats = new Map<string, WhatsAppChat>();
const messages = new Map<string, WhatsAppMessage[]>();
const contacts = new Map<string, any>();

function updateState(update: Partial<WhatsAppConnectionInfo>) {
  state = { ...state, ...update };
}

export function getWhatsAppConnection(): WhatsAppConnectionInfo {
  return { ...state };
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

function rememberContact(contact: any) {
  if (!contact?.id) return;
  const merged = { ...(contacts.get(contact.id) || {}), ...contact };
  const aliases = [merged.id, merged.lid, merged.phoneNumber].filter(Boolean) as string[];
  for (const alias of aliases) contacts.set(alias, merged);
}

function findContact(jid: string, fallbackPhoneNumber?: string | null) {
  return contacts.get(jid) || (fallbackPhoneNumber ? contacts.get(fallbackPhoneNumber) : undefined);
}

function contactIdentity(jid: string, fallbackName?: string, fallbackPhoneNumber?: string | null) {
  const contact = findContact(jid, fallbackPhoneNumber);
  const phoneNumber =
    contact?.phoneNumber ||
    fallbackPhoneNumber ||
    phoneNumberFromJid(jid);
  const name =
    contact?.name ||
    contact?.notify ||
    contact?.verifiedName ||
    fallbackName ||
    phoneNumber ||
    jid.split("@")[0] ||
    "WhatsApp";
  return { name: String(name), phoneNumber: phoneNumber ? String(phoneNumber).replace(/@.*$/, "").replace(/^\+/, "") : null };
}

function refreshChatIdentity(jid: string) {
  const current = chats.get(jid);
  if (!current) return;
  const identity = contactIdentity(jid, current.name, current.phoneNumber);
  chats.set(jid, { ...current, ...identity });
}

function upsertMessage(message: any, fallbackName?: string) {
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
  const chatMessages = messages.get(jid) || [];
  if (!chatMessages.some((existing) => existing.id === item.id)) {
    chatMessages.push(item);
    chatMessages.sort((a, b) => a.timestamp - b.timestamp);
    messages.set(jid, chatMessages.slice(-200));
  }
  const existingChat = chats.get(jid);
  const identity = contactIdentity(jid, fallbackName || item.senderName, existingChat?.phoneNumber);
  chats.set(jid, {
    jid,
    ...identity,
    unreadCount: existingChat?.unreadCount || 0,
    lastMessage: item.text,
    lastMessageAt: item.timestamp,
  });
}

export function getWhatsAppChats(): WhatsAppChat[] {
  return [...chats.values()].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

export function getWhatsAppMessages(jid: string): WhatsAppMessage[] {
  return [...(messages.get(jid) || [])].sort((a, b) => a.timestamp - b.timestamp);
}

export async function sendWhatsAppMessage(jid: string, text: string): Promise<WhatsAppMessage> {
  if (!socket || state.status !== "connected") {
    throw new Error("واتساب غير متصل");
  }
  const cleanText = text.trim();
  if (!cleanText) throw new Error("نص الرسالة مطلوب");
  const sent = await socket.sendMessage(jid, { text: cleanText });
  upsertMessage(
    {
      key: { ...sent?.key, remoteJid: jid, fromMe: true },
      message: { conversation: cleanText },
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
    chats.get(jid)?.name,
  );
  return getWhatsAppMessages(jid).at(-1)!;
}

export async function startWhatsAppConnection(): Promise<WhatsAppConnectionInfo> {
  if (starting) {
    await starting;
    return getWhatsAppConnection();
  }

  if (socket && state.status === "connected") {
    return getWhatsAppConnection();
  }

  starting = (async () => {
    try {
      await fs.mkdir(authDirectory, { recursive: true });
      const { state: authState, saveCreds } = await useMultiFileAuthState(authDirectory);

      updateState({ status: "connecting", qr: null, lastError: null });

      let reconnectScheduled = false;
      let createSocket: () => void;

      createSocket = () => {
        const nextSocket = makeWASocket({
          auth: authState,
          browser: Browsers.ubuntu("AdminDesk"),
          markOnlineOnConnect: false,
          syncFullHistory: false,
        });

        socket = nextSocket;
        nextSocket.ev.on("creds.update", saveCreds);
        nextSocket.ev.on("messaging-history.set", ({ chats: historyChats, contacts: historyContacts, messages: historyMessages, lidPnMappings }) => {
          for (const contact of historyContacts || []) rememberContact(contact);
          for (const mapping of lidPnMappings || []) {
            const contact = contacts.get(mapping.lid);
            rememberContact({
              ...(contact || {}),
              id: mapping.lid,
              lid: mapping.lid,
              phoneNumber: mapping.pn,
            });
          }
          for (const chat of historyChats as any[]) {
            if (!chat.id || chat.id === "status@broadcast" || chat.id.endsWith("@broadcast")) continue;
            const last = getWhatsAppMessages(chat.id).at(-1);
            const chatPhoneNumber = chat.pnJid || chat.phoneNumber || null;
            if (chatPhoneNumber) {
              rememberContact({ id: chat.id, phoneNumber: chatPhoneNumber, lid: chat.lidJid });
            }
            const identity = contactIdentity(chat.id, chat.name || chat.displayName || chat.username, chatPhoneNumber);
            chats.set(chat.id, {
              jid: chat.id,
              ...identity,
              unreadCount: Number(chat.unreadCount || 0),
              lastMessage: last?.text || "",
              lastMessageAt: last?.timestamp || Number(chat.conversationTimestamp || 0) * 1000,
            });
          }
          for (const message of historyMessages as any[]) {
            upsertMessage(message);
          }
        });
        nextSocket.ev.on("contacts.upsert", (nextContacts) => {
          for (const contact of nextContacts as any[]) {
            rememberContact(contact);
            refreshChatIdentity(contact.id);
            if (contact.lid) refreshChatIdentity(contact.lid);
            if (contact.phoneNumber) refreshChatIdentity(contact.phoneNumber);
          }
        });
        nextSocket.ev.on("contacts.update", (updates) => {
          for (const update of updates as any[]) {
            if (!update?.id) continue;
            rememberContact(update);
            refreshChatIdentity(update.id);
          }
        });
        nextSocket.ev.on("lid-mapping.update", (mapping: any) => {
          if (!mapping?.lid || !mapping?.pn) return;
          const contact = contacts.get(mapping.lid) || contacts.get(mapping.pn);
          rememberContact({
            ...(contact || {}),
            id: mapping.lid,
            lid: mapping.lid,
            phoneNumber: mapping.pn,
          });
          refreshChatIdentity(mapping.lid);
          refreshChatIdentity(mapping.pn);
        });
        nextSocket.ev.on("chats.upsert", (historyChats) => {
          for (const chat of historyChats as any[]) {
            if (!chat.id || chat.id.endsWith("@broadcast")) continue;
            const current = chats.get(chat.id);
            const chatPhoneNumber = chat.pnJid || chat.phoneNumber || current?.phoneNumber || null;
            if (chatPhoneNumber) {
              rememberContact({ id: chat.id, phoneNumber: chatPhoneNumber, lid: chat.lidJid });
            }
            const identity = contactIdentity(chat.id, chat.name || chat.displayName || chat.username || current?.name, chatPhoneNumber);
            chats.set(chat.id, {
              jid: chat.id,
              ...identity,
              unreadCount: Number(chat.unreadCount ?? current?.unreadCount ?? 0),
              lastMessage: current?.lastMessage || "",
              lastMessageAt: current?.lastMessageAt || Number(chat.conversationTimestamp || 0) * 1000,
            });
          }
        });
        nextSocket.ev.on("messages.upsert", ({ messages: incomingMessages }) => {
          for (const message of incomingMessages as any[]) upsertMessage(message);
        });
        nextSocket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
          if (qr) {
            try {
              const qrDataUrl = await QRCode.toDataURL(qr, {
                margin: 2,
                width: 280,
                errorCorrectionLevel: "M",
              });
              updateState({ status: "qr", qr: qrDataUrl, lastError: null });
            } catch (error) {
              updateState({
                status: "error",
                lastError: error instanceof Error ? error.message : "تعذر إنشاء رمز QR",
              });
            }
          }

          if (connection === "open") {
            updateState({
              status: "connected",
              qr: null,
              phoneNumber: nextSocket.user?.id?.split(":")[0] || null,
              lastError: null,
            });
          }

          if (connection === "close") {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
            const loggedOut = statusCode === DisconnectReason.loggedOut;
            const restartRequired = statusCode === DisconnectReason.restartRequired;

            if (restartRequired) {
              // WhatsApp intentionally closes the pairing socket with 515 after
              // the QR is accepted. The saved auth state must be reused.
              socket = null;
              updateState({ status: "connecting", qr: null, lastError: null });
              if (!reconnectScheduled) {
                reconnectScheduled = true;
                setTimeout(() => {
                  reconnectScheduled = false;
                  if (state.status === "connecting") createSocket();
                }, 500);
              }
              return;
            }

            socket = null;
            chats.clear();
            messages.clear();
            contacts.clear();
            updateState({
              status: loggedOut ? "logged_out" : "disconnected",
              qr: null,
              phoneNumber: loggedOut ? null : state.phoneNumber,
              lastError: loggedOut
                ? "تم تسجيل خروج الحساب من واتساب"
                : "انقطع الاتصال. اضغط «بدء الربط» للمحاولة مرة أخرى.",
            });

            if (loggedOut) {
              await fs.rm(authDirectory, { recursive: true, force: true });
            }
          }
        });
      };

      createSocket();
    } catch (error) {
      socket = null;
      updateState({
        status: "error",
        qr: null,
        lastError: error instanceof Error ? error.message : "تعذر بدء اتصال واتساب",
      });
    }
  })();

  try {
    await starting;
  } finally {
    starting = null;
  }

  return getWhatsAppConnection();
}

export async function disconnectWhatsApp(): Promise<WhatsAppConnectionInfo> {
  const currentSocket = socket;
  socket = null;

  try {
    if (currentSocket) {
      await currentSocket.logout();
    }
  } catch (error) {
    console.warn("[whatsapp] logout failed:", error);
  } finally {
    await fs.rm(authDirectory, { recursive: true, force: true });
    updateState({
      status: "disconnected",
      qr: null,
      phoneNumber: null,
      lastError: null,
    });
  }

  return getWhatsAppConnection();
}