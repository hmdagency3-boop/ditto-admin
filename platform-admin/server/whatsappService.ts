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
  chats.set(jid, {
    jid,
    name: existingChat?.name || fallbackName || item.senderName,
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
        nextSocket.ev.on("messaging-history.set", ({ chats: historyChats, messages: historyMessages }) => {
          for (const chat of historyChats as any[]) {
            if (!chat.id || chat.id === "status@broadcast" || chat.id.endsWith("@broadcast")) continue;
            const last = getWhatsAppMessages(chat.id).at(-1);
            chats.set(chat.id, {
              jid: chat.id,
              name: chat.name || chat.id.split("@")[0],
              unreadCount: Number(chat.unreadCount || 0),
              lastMessage: last?.text || "",
              lastMessageAt: last?.timestamp || Number(chat.conversationTimestamp || 0) * 1000,
            });
          }
          for (const message of historyMessages as any[]) {
            upsertMessage(message);
          }
        });
        nextSocket.ev.on("chats.upsert", (historyChats) => {
          for (const chat of historyChats as any[]) {
            if (!chat.id || chat.id.endsWith("@broadcast")) continue;
            const current = chats.get(chat.id);
            chats.set(chat.id, {
              jid: chat.id,
              name: chat.name || current?.name || chat.id.split("@")[0],
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