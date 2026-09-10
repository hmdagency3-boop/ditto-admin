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

function updateState(update: Partial<WhatsAppConnectionInfo>) {
  state = { ...state, ...update };
}

export function getWhatsAppConnection(): WhatsAppConnectionInfo {
  return { ...state };
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

      const nextSocket = makeWASocket({
        auth: authState,
        browser: Browsers.ubuntu("AdminDesk"),
        markOnlineOnConnect: false,
        syncFullHistory: false,
      });

      socket = nextSocket;
      nextSocket.ev.on("creds.update", saveCreds);
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

          socket = null;
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