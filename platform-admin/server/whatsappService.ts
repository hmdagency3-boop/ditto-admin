import fs from "node:fs/promises";
import path from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import makeWASocket, {
  Browsers,
  BufferJSON,
  DisconnectReason,
  downloadMediaMessage,
  initAuthCreds,
  normalizeMessageContent,
  proto,
  type AuthenticationState,
  type WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import { storage } from "./storage";
import {
  claimWhatsAppAIReply,
  enqueueWhatsAppAIRequest,
  getReadyWhatsAppAIRequests,
  getWhatsAppAISettings,
  deleteWhatsAppAIIncomingImage,
  downloadWhatsAppAIMedia,
  uploadWhatsAppAIIncomingImage,
  markWhatsAppAIReplyFailed,
  markWhatsAppAIReplySent,
  parseWhatsAppAIResponse,
  recordWhatsAppAIReplyMediaCodes,
} from "./whatsappAiService";

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
  mediaType: "text" | "image" | "video" | "audio" | "document" | "sticker";
  mediaUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  duration: number | null;
}

interface WhatsAppMediaFile {
  filePath: string;
  mimeType: string;
  fileName: string | null;
}

type SerializedAuthFiles = Record<string, string>;
type SessionRow = { auth_blob?: string | null };
type StoredSessionRow = {
  owner_id: string;
  auth_blob?: string | null;
  status?: string | null;
};

interface WhatsAppRuntime {
  ownerId: string;
  socket: WASocket | null;
  starting: Promise<void> | null;
  state: WhatsAppConnectionInfo;
  chats: Map<string, WhatsAppChat>;
  messages: Map<string, WhatsAppMessage[]>;
  contacts: Map<string, any>;
  autoReplyInFlight: Set<string>;
  replyPoller: ReturnType<typeof setInterval> | null;
  replyPollInFlight: boolean;
  mediaFiles: Map<string, WhatsAppMediaFile>;
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
    autoReplyInFlight: new Set(),
    replyPoller: null,
    replyPollInFlight: false,
    mediaFiles: new Map(),
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

function sessionSecrets(): string[] {
  return [...new Set([process.env.SESSION_SECRET, process.env.JWT_SECRET].filter(
    (secret): secret is string => Boolean(secret),
  ))];
}

function sessionKey(secret = sessionSecrets()[0]): Buffer {
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

  let lastError: unknown;
  for (const secret of sessionSecrets()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", sessionKey(secret), Buffer.from(ivValue, "base64"));
      decipher.setAuthTag(Buffer.from(tagValue, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No session secret is available to decrypt the WhatsApp auth blob");
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
      throw new Error("تعذر فك تشفير جلسة واتساب المخزنة. تحقق من SESSION_SECRET أو JWT_SECRET.");
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

export async function restoreStoredWhatsAppSessions(): Promise<void> {
  const { data, error } = await storage.supabase
    .from(sessionTable)
    .select("owner_id, auth_blob, status")
    .not("auth_blob", "is", null);

  if (error) {
    if (error.code !== "42P01") {
      console.error("[whatsapp] could not list stored sessions:", error.message);
    }
    return;
  }

  const sessions = (data || []) as StoredSessionRow[];
  if (sessions.length === 0) return;

  const restorableSessions = sessions.filter(
    (session) => session.owner_id && session.status !== "logged_out",
  );
  console.log(`[whatsapp] restoring ${restorableSessions.length} stored session(s)`);
  await Promise.all(
    restorableSessions
      .map(async (session) => {
        try {
          const state = await resumeWhatsAppConnection(session.owner_id);
          console.log(`[whatsapp] session restore for ${session.owner_id}: ${state.status}`);
        } catch (restoreError) {
          console.error(`[whatsapp] could not restore session for ${session.owner_id}:`, restoreError);
        }
      }),
  );
}

function messageTimestamp(message: any): number {
  const value = message?.messageTimestamp;
  if (typeof value === "number") return value * 1000;
  if (value?.toNumber) return value.toNumber() * 1000;
  return Date.now();
}

type WhatsAppMediaType = Exclude<WhatsAppMessage["mediaType"], "text">;

interface WhatsAppMediaDescriptor {
  mediaType: WhatsAppMediaType;
  mimeType: string;
  fileName: string | null;
  duration: number | null;
  caption: string;
}

interface DownloadedIncomingMedia {
  buffer: Buffer;
  mimeType: string;
  fileName: string | null;
  caption: string;
}

function normalizedMessageContent(message: any) {
  return normalizeMessageContent(message?.message) || message?.message || null;
}

function messageMedia(message: any): WhatsAppMediaDescriptor | null {
  const content = normalizedMessageContent(message);
  if (!content) return null;

  if (content.imageMessage) {
    return {
      mediaType: "image",
      mimeType: String(content.imageMessage.mimetype || "image/jpeg"),
      fileName: null,
      duration: null,
      caption: String(content.imageMessage.caption || ""),
    };
  }
  if (content.videoMessage) {
    return {
      mediaType: "video",
      mimeType: String(content.videoMessage.mimetype || "video/mp4"),
      fileName: null,
      duration: Number(content.videoMessage.seconds || 0) || null,
      caption: String(content.videoMessage.caption || ""),
    };
  }
  if (content.audioMessage) {
    return {
      mediaType: "audio",
      mimeType: String(content.audioMessage.mimetype || "audio/ogg"),
      fileName: null,
      duration: Number(content.audioMessage.seconds || 0) || null,
      caption: "",
    };
  }
  if (content.documentMessage) {
    return {
      mediaType: "document",
      mimeType: String(content.documentMessage.mimetype || "application/octet-stream"),
      fileName: content.documentMessage.fileName ? String(content.documentMessage.fileName) : null,
      duration: null,
      caption: String(content.documentMessage.caption || ""),
    };
  }
  if (content.stickerMessage) {
    return {
      mediaType: "sticker",
      mimeType: String(content.stickerMessage.mimetype || "image/webp"),
      fileName: null,
      duration: null,
      caption: "",
    };
  }
  return null;
}

function messageText(message: any): string {
  const content = normalizedMessageContent(message);
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

function mediaKey(runtime: WhatsAppRuntime, messageId: string) {
  return createHash("sha256").update(`${runtime.ownerId}:${messageId}`).digest("hex");
}

function extensionForMimeType(mimeType: string, fileName?: string | null) {
  const originalExtension = fileName?.split(".").pop()?.toLowerCase();
  if (originalExtension && /^[a-z0-9]{1,8}$/.test(originalExtension)) return originalExtension;
  const mimeExtension = mimeType.split("/")[1]?.split(";")[0]?.toLowerCase();
  return mimeExtension === "jpeg" ? "jpg" : mimeExtension || "bin";
}

function mediaUrl(runtime: WhatsAppRuntime, messageId: string) {
  return `/api/whatsapp/media/${mediaKey(runtime, messageId)}`;
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

function upsertMessage(
  runtime: WhatsAppRuntime,
  message: any,
  fallbackName?: string,
  mediaOverride?: Partial<WhatsAppMessage>,
) {
  const jid = message?.key?.remoteJid;
  if (!jid || jid === "status@broadcast" || jid.endsWith("@broadcast")) return;
  const text = messageText(message);
  if (!text && !message?.message) return;
  const timestamp = messageTimestamp(message);
  const descriptor = messageMedia(message);
  const item: WhatsAppMessage = {
    id: message.key.id || `${jid}-${timestamp}-${Math.random()}`,
    jid,
    text: text || "رسالة غير نصية",
    fromMe: Boolean(message.key.fromMe),
    senderName: message.pushName || fallbackName || jid.split("@")[0],
    timestamp,
    mediaType: descriptor?.mediaType || "text",
    mediaUrl: null,
    mimeType: descriptor?.mimeType || null,
    fileName: descriptor?.fileName || null,
    duration: descriptor?.duration || null,
    ...mediaOverride,
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

async function saveMediaBuffer(
  runtime: WhatsAppRuntime,
  messageId: string,
  buffer: Buffer,
  mimeType: string,
  fileName: string | null,
) {
  const key = mediaKey(runtime, messageId);
  const mediaDirectory = path.resolve(process.cwd(), ".data", "whatsapp-media");
  const extension = extensionForMimeType(mimeType, fileName);
  const filePath = path.join(mediaDirectory, `${key}.${extension}`);
  await fs.mkdir(mediaDirectory, { recursive: true });
  await fs.writeFile(filePath, buffer);
  runtime.mediaFiles.set(key, { filePath, mimeType, fileName });
  return mediaUrl(runtime, messageId);
}

function updateMessageMedia(
  runtime: WhatsAppRuntime,
  jid: string,
  messageId: string,
  mediaUrlValue: string,
) {
  const chatMessages = runtime.messages.get(jid) || [];
  const index = chatMessages.findIndex((item) => item.id === messageId);
  if (index === -1) return;
  chatMessages[index] = { ...chatMessages[index], mediaUrl: mediaUrlValue };
  runtime.messages.set(jid, chatMessages);
}

async function downloadIncomingMedia(runtime: WhatsAppRuntime, message: any): Promise<DownloadedIncomingMedia | null> {
  const messageId = message?.key?.id;
  const jid = message?.key?.remoteJid;
  const descriptor = messageMedia(message);
  const socket = runtime.socket;
  if (!messageId || !jid || !descriptor || !socket) return null;

  try {
    const buffer = await downloadMediaMessage(
      message,
      "buffer",
      {},
      {
        logger: console as any,
        reuploadRequest: (mediaMessage) => socket.updateMediaMessage(mediaMessage),
      },
    );
    const savedUrl = await saveMediaBuffer(
      runtime,
      messageId,
      buffer,
      descriptor.mimeType,
      descriptor.fileName,
    );
    updateMessageMedia(runtime, jid, messageId, savedUrl);
    return {
      buffer,
      mimeType: descriptor.mimeType,
      fileName: descriptor.fileName,
      caption: descriptor.caption,
    };
  } catch (error) {
    console.error(`[whatsapp] could not download media message ${messageId}:`, error);
    return null;
  }
}

export async function getWhatsAppMedia(ownerId: string, key: string) {
  const file = getRuntime(ownerId).mediaFiles.get(key);
  if (!file) return null;
  try {
    return {
      buffer: await fs.readFile(file.filePath),
      mimeType: file.mimeType,
      fileName: file.fileName,
    };
  } catch {
    return null;
  }
}

async function enqueueAIRequest(
  runtime: WhatsAppRuntime,
  message: any,
  incomingMediaPromise?: Promise<DownloadedIncomingMedia | null>,
) {
  const jid = message?.key?.remoteJid;
  const messageId = message?.key?.id;
  if (
    !jid ||
    !messageId ||
    message?.key?.fromMe ||
    jid === "status@broadcast" ||
    jid.endsWith("@g.us") ||
    jid.endsWith("@broadcast")
  ) {
    return;
  }

  const incomingText = messageText(message).trim();
  const descriptor = messageMedia(message);
  const isImageMessage = descriptor?.mediaType === "image";
  if ((!incomingText && !isImageMessage) || runtime.autoReplyInFlight.has(messageId)) return;
  runtime.autoReplyInFlight.add(messageId);

  try {
    const settings = await getWhatsAppAISettings(runtime.ownerId);
    if (!settings.enabled) return;

    const chat = runtime.chats.get(jid);
    const senderName = chat?.name || message.pushName || phoneNumberFromJid(jid) || "صديق";
    const downloadedMedia = isImageMessage
      ? await (incomingMediaPromise || downloadIncomingMedia(runtime, message))
      : null;
    if (isImageMessage && !downloadedMedia) {
      throw new Error("تعذر تنزيل الصورة لإرسالها إلى الذكاء الاصطناعي");
    }

    const incomingImages = downloadedMedia
      ? [{
        ...(await uploadWhatsAppAIIncomingImage(runtime.ownerId, {
          fileName: downloadedMedia.fileName,
          mimeType: downloadedMedia.mimeType,
          buffer: downloadedMedia.buffer,
        })),
        caption: downloadedMedia.caption,
      }]
      : [];
    const queued = await enqueueWhatsAppAIRequest({
      ownerId: runtime.ownerId,
      messageId,
      jid,
      senderName,
      senderPhone: chat?.phoneNumber || phoneNumberFromJid(jid),
      timestamp: messageTimestamp(message),
      request: incomingText || "أرسل صورة بدون نص",
      messageType: isImageMessage ? "image" : "text",
      incomingImages,
      conversation: getWhatsAppMessages(runtime.ownerId, jid).map((item) => ({
        fromMe: item.fromMe,
        text: item.text,
      })),
      settings,
    });
    console.log(`[whatsapp-ai] request queued: ${queued?.id || "already queued"}`);
  } catch (error) {
    console.error("[whatsapp-ai] could not queue incoming message:", error);
  } finally {
    runtime.autoReplyInFlight.delete(messageId);
  }
}

async function deliverReadyAIReplies(runtime: WhatsAppRuntime) {
  if (
    runtime.replyPollInFlight ||
    !runtime.socket ||
    runtime.state.status !== "connected"
  ) {
    return;
  }

  runtime.replyPollInFlight = true;
  try {
    const readyRequests = await getReadyWhatsAppAIRequests(runtime.ownerId);
    for (const request of readyRequests) {
      if (!runtime.socket || runtime.state.status !== "connected") break;

      const claimed = await claimWhatsAppAIReply(runtime.ownerId, request.id);
      if (!claimed) continue;

      try {
        const rawResponse = claimed.response?.trim();
        if (!rawResponse) throw new Error("السيرفر الخارجي وضع ردًا فارغًا");
        const parsedResponse = parseWhatsAppAIResponse(rawResponse);
        const media = await downloadWhatsAppAIMedia(runtime.ownerId, parsedResponse.mediaCodes);
        const foundCodes = new Set(media.map((item) => item.code));
        const missingCodes = parsedResponse.mediaCodes.filter((code) => !foundCodes.has(code));
        if (missingCodes.length > 0) {
          console.warn(`[whatsapp-ai] image codes not found: ${missingCodes.join(", ")}`);
        }
        await recordWhatsAppAIReplyMediaCodes(runtime.ownerId, claimed.id, parsedResponse.mediaCodes);
        if (!parsedResponse.text && media.length === 0) {
          throw new Error("رد الذكاء الاصطناعي لا يحتوي على نص أو صورة صالحة");
        }

        const sendAndRemember = async (
          content: any,
          messageText: string,
          mediaType?: WhatsAppMessage["mediaType"],
          mediaFile?: { buffer: Buffer; mimeType: string; fileName: string },
        ) => {
          const sent = await runtime.socket!.sendMessage(claimed.chat_jid, content);
          const messageId = sent?.key?.id || `whatsapp-ai-${claimed.id}-${Date.now()}`;
          upsertMessage(
            runtime,
            {
              key: {
                ...(sent?.key || {}),
                id: messageId,
                remoteJid: claimed.chat_jid,
                fromMe: true,
              },
              message: mediaType
                ? { [`${mediaType}Message`]: { mimetype: content.mimetype, caption: messageText || undefined } }
                : { conversation: messageText },
              messageTimestamp: Math.floor(Date.now() / 1000),
            },
            claimed.sender_name || undefined,
          );
          if (mediaFile) {
            const savedUrl = await saveMediaBuffer(
              runtime,
              messageId,
              mediaFile.buffer,
              mediaFile.mimeType,
              mediaFile.fileName,
            );
            updateMessageMedia(runtime, claimed.chat_jid, messageId, savedUrl);
          }
        };

        if (media.length > 0) {
          for (const [index, asset] of media.entries()) {
            await sendAndRemember(
              {
                image: asset.buffer,
                mimetype: asset.mimeType,
                ...(index === 0 && parsedResponse.text ? { caption: parsedResponse.text } : {}),
              },
              index === 0 ? parsedResponse.text : "",
              "image",
              {
                buffer: asset.buffer,
                mimeType: asset.mimeType,
                fileName: asset.fileName,
              },
            );
          }
        } else {
          await sendAndRemember({ text: parsedResponse.text }, parsedResponse.text);
        }
        await markWhatsAppAIReplySent(runtime.ownerId, claimed.id);
        const incomingImages = claimed.context?.incoming_images || [];
        await Promise.all(incomingImages.map((image) => deleteWhatsAppAIIncomingImage(image.storage_path)));
        console.log(`[whatsapp-ai] response sent: ${claimed.id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "تعذر إرسال رد الذكاء الاصطناعي";
        await markWhatsAppAIReplyFailed(runtime.ownerId, claimed.id, message);
        console.error(`[whatsapp-ai] response delivery failed: ${claimed.id}`, error);
      }
    }
  } catch (error) {
    console.error("[whatsapp-ai] ready response polling failed:", error);
  } finally {
    runtime.replyPollInFlight = false;
  }
}

function startAIReplyPoller(runtime: WhatsAppRuntime) {
  if (runtime.replyPoller) return;
  void deliverReadyAIReplies(runtime);
  runtime.replyPoller = setInterval(() => {
    void deliverReadyAIReplies(runtime);
  }, 3000);
}

function stopAIReplyPoller(runtime: WhatsAppRuntime) {
  if (!runtime.replyPoller) return;
  clearInterval(runtime.replyPoller);
  runtime.replyPoller = null;
}

export function getWhatsAppChats(ownerId: string): WhatsAppChat[] {
  return [...getRuntime(ownerId).chats.values()].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

export function getWhatsAppMessages(ownerId: string, jid: string): WhatsAppMessage[] {
  return [...(getRuntime(ownerId).messages.get(jid) || [])].sort((a, b) => a.timestamp - b.timestamp);
}

export interface WhatsAppOutgoingMedia {
  buffer: Buffer;
  mimeType: string;
  fileName: string | null;
}

export async function sendWhatsAppMessage(
  ownerId: string,
  jid: string,
  text: string,
  media?: WhatsAppOutgoingMedia,
): Promise<WhatsAppMessage> {
  const runtime = getRuntime(ownerId);
  if (!runtime.socket || runtime.state.status !== "connected") {
    throw new Error("واتساب غير متصل");
  }
  const cleanText = text.trim();
  if (!cleanText && !media) throw new Error("نص الرسالة أو الملف مطلوب");

  const mediaType = media?.mimeType.startsWith("image/")
    ? "image"
    : media?.mimeType.startsWith("video/")
      ? "video"
      : media?.mimeType.startsWith("audio/")
        ? "audio"
        : null;
  if (media && !mediaType) {
    throw new Error("نوع الملف غير مدعوم. استخدم صورة أو فيديو أو ملفًا صوتيًا.");
  }

  const messageContent = mediaType === "image"
    ? { image: media!.buffer, ...(cleanText ? { caption: cleanText } : {}) }
    : mediaType === "video"
      ? { video: media!.buffer, ...(cleanText ? { caption: cleanText } : {}) }
      : mediaType === "audio"
        ? { audio: media!.buffer, mimetype: media!.mimeType, ptt: true }
        : { text: cleanText };
  const sent = await runtime.socket.sendMessage(jid, messageContent as any);
  const messageId = sent?.key?.id || `outgoing-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  upsertMessage(
    runtime,
    {
      key: { ...sent?.key, id: messageId, remoteJid: jid, fromMe: true },
      message: mediaType
        ? {
            [`${mediaType}Message`]: {
              mimetype: media!.mimeType,
              caption: cleanText || undefined,
              fileName: media!.fileName || undefined,
            },
          }
        : { conversation: cleanText },
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
    runtime.chats.get(jid)?.name,
  );
  if (media && mediaType) {
    const savedUrl = await saveMediaBuffer(runtime, messageId, media.buffer, media.mimeType, media.fileName);
    updateMessageMedia(runtime, jid, messageId, savedUrl);
  }
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
          for (const message of historyMessages as any[]) {
            upsertMessage(runtime, message);
            if (messageMedia(message)) void downloadIncomingMedia(runtime, message);
          }
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
        nextSocket.ev.on("messages.upsert", ({ messages: incomingMessages, type }) => {
          for (const message of incomingMessages as any[]) {
            upsertMessage(runtime, message);
            const descriptor = messageMedia(message);
            const shouldSendImageToAI = type === "notify" && descriptor?.mediaType === "image";
            if (shouldSendImageToAI) {
              const incomingMediaPromise = downloadIncomingMedia(runtime, message);
              void enqueueAIRequest(runtime, message, incomingMediaPromise);
            } else {
              if (descriptor) void downloadIncomingMedia(runtime, message);
              if (type === "notify") void enqueueAIRequest(runtime, message);
            }
          }
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
            startAIReplyPoller(runtime);
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
            stopAIReplyPoller(runtime);
            runtime.chats.clear();
            runtime.messages.clear();
            runtime.contacts.clear();
            runtime.autoReplyInFlight.clear();
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
    stopAIReplyPoller(runtime);
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