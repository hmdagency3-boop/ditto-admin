/**
 * Ditto API routes — proxies to www.sayyouditto.com using stored session
 * Merged from Open-Environment project
 */
import { Router } from "express";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { request as httpsRequest } from "https";
import { gunzipSync } from "zlib";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { resolve } from "path";
import { storage } from "./storage";
import multer from "multer";

const router = Router();

const SESSION_FILE = resolve(process.cwd(), "ditto_session.json");
const DITTO_SESSION_TABLE = "ditto_sessions";
const DITTO_SESSION_NAME = "default";
const KEY = Buffer.from("a38e5f04f39b11ed", "ascii");
const IV  = Buffer.from("884e00163e02b26e", "ascii");
const flowUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

// ── Crypto ────────────────────────────────────────────────────────────────────
function encrypt(plain: string): string {
  const c = createCipheriv("aes-128-cbc", KEY, IV);
  return Buffer.concat([c.update(Buffer.from(plain, "utf8")), c.final()]).toString("base64");
}

function decrypt(b64: string): string {
  let s = b64.trim().replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const d = createDecipheriv("aes-128-cbc", KEY, IV);
  return Buffer.concat([d.update(Buffer.from(s, "base64")), d.final()]).toString("utf8");
}

// ── Session ───────────────────────────────────────────────────────────────────
type DittoSession = {
  uid?: string;
  access_token?: string;
  ticket?: string;
  ticket_saved_at?: number;
  access_token_saved_at?: number;
  netEaseToken?: string;
  deviceId?: string;
  nimAppKey?: string;
};

type DittoSessionRow = {
  session_name: string;
  uid: string | null;
  access_token_enc: string | null;
  ticket_enc: string | null;
  ticket_saved_at: string | number | null;
  access_token_saved_at: string | number | null;
  net_ease_token_enc: string | null;
  device_id_enc: string | null;
  nim_app_key_enc: string | null;
};

const dittoSessionColumns = [
  "session_name",
  "uid",
  "access_token_enc",
  "ticket_enc",
  "ticket_saved_at",
  "access_token_saved_at",
  "net_ease_token_enc",
  "device_id_enc",
  "nim_app_key_enc",
].join(", ");

function sessionEncryptionKey() {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("SESSION_SECRET or JWT_SECRET is required to protect Ditto session credentials");
  return createHash("sha256").update(`ditto-session:${secret}`).digest();
}

function encryptSessionSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64")).join(".");
}

function decryptSessionSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted Ditto session credential");
  const decipher = createDecipheriv("aes-256-gcm", sessionEncryptionKey(), Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function encryptOptional(value?: string) {
  return value?.trim() ? encryptSessionSecret(value.trim()) : null;
}

function decryptOptional(value: string | null) {
  return value ? decryptSessionSecret(value) : undefined;
}

function sessionFromRow(row: DittoSessionRow): DittoSession {
  return {
    uid: row.uid || undefined,
    access_token: decryptOptional(row.access_token_enc),
    ticket: decryptOptional(row.ticket_enc),
    ticket_saved_at: row.ticket_saved_at ? Number(row.ticket_saved_at) : undefined,
    access_token_saved_at: row.access_token_saved_at ? Number(row.access_token_saved_at) : undefined,
    netEaseToken: decryptOptional(row.net_ease_token_enc),
    deviceId: decryptOptional(row.device_id_enc),
    nimAppKey: decryptOptional(row.nim_app_key_enc),
  };
}

async function readDittoSessionFromDatabase() {
  const { data, error } = await storage.supabase
    .from(DITTO_SESSION_TABLE)
    .select(dittoSessionColumns)
    .eq("session_name", DITTO_SESSION_NAME)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") return { row: null, tableMissing: true };
    throw new Error(`تعذر قراءة جلسة Ditto من قاعدة البيانات: ${error.message}`);
  }
  return { row: data as DittoSessionRow | null, tableMissing: false };
}

async function saveDittoSession(session: DittoSession) {
  const { error } = await storage.supabase
    .from(DITTO_SESSION_TABLE)
    .upsert({
      session_name: DITTO_SESSION_NAME,
      uid: session.uid || null,
      access_token_enc: encryptOptional(session.access_token),
      ticket_enc: encryptOptional(session.ticket),
      ticket_saved_at: session.ticket_saved_at || null,
      access_token_saved_at: session.access_token_saved_at || null,
      net_ease_token_enc: encryptOptional(session.netEaseToken),
      device_id_enc: encryptOptional(session.deviceId),
      nim_app_key_enc: encryptOptional(session.nimAppKey),
      updated_at: new Date().toISOString(),
    }, { onConflict: "session_name" });

  if (error) {
    if (error.code === "42P01") {
      throw new Error("جدول جلسة Ditto غير موجود. شغّل migration رقم 29 في Supabase.");
    }
    throw new Error(`تعذر حفظ جلسة Ditto في قاعدة البيانات: ${error.message}`);
  }
}

type ExtractedFlowSession = {
  uid?: string;
  access_token?: string;
  ticket?: string;
  netEaseToken?: string;
  deviceId?: string;
  nimAppKey?: string;
};

const flowFieldNames: Record<keyof ExtractedFlowSession, Set<string>> = {
  uid: new Set(["uid", "userid", "useruid", "account", "nimaccount"]),
  access_token: new Set(["accesstoken", "oauthaccesstoken", "authtoken"]),
  ticket: new Set(["ticket", "sessionticket", "loginticket"]),
  netEaseToken: new Set(["neteasetoken", "nimtoken", "imtoken", "chatroomtoken"]),
  deviceId: new Set(["deviceid", "deviceidentifier"]),
  nimAppKey: new Set(["nimappkey", "nimkey", "appkey"]),
};

function normalizedFlowKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isUsefulFlowValue(value: unknown): value is string | number {
  return (typeof value === "string" || typeof value === "number")
    && String(value).trim().length > 0
    && String(value).length <= 4096;
}

function addFlowField(result: ExtractedFlowSession, key: string, value: unknown) {
  if (!isUsefulFlowValue(value)) return;
  const normalized = normalizedFlowKey(key);
  const stringValue = String(value).trim();
  for (const field of Object.keys(flowFieldNames) as (keyof ExtractedFlowSession)[]) {
    if (!flowFieldNames[field].has(normalized) || result[field]) continue;
    if (field === "uid" && !/^\d{3,20}$/.test(stringValue)) continue;
    result[field] = stringValue as never;
  }
}

function tryParseJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return undefined; }
}

function tryDecryptDittoValue(value: string): string | undefined {
  try {
    const decoded = decrypt(decodeURIComponent(value.trim()));
    return decoded.length <= 200000 ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function scanFlowString(value: string, result: ExtractedFlowSession, depth: number) {
  if (!value || depth > 5) return;
  const trimmed = value.trim();

  const parsed = tryParseJson(trimmed);
  if (parsed !== undefined) scanFlowValue(parsed, result, depth + 1);

  try {
    const params = new URLSearchParams(trimmed.startsWith("?") ? trimmed.slice(1) : trimmed);
    for (const [key, item] of params.entries()) {
      addFlowField(result, key, item);
      if (key.toLowerCase() === "ed") {
        const decrypted = tryDecryptDittoValue(item);
        if (decrypted) scanFlowString(decrypted, result, depth + 1);
      }
    }
  } catch {}

  const encodedValues = trimmed.match(/(?:^|[?&\s])ed=([^&\s"'<>}]+)/gi) ?? [];
  for (const match of encodedValues) {
    const encoded = match.replace(/^.*?ed=/i, "");
    const decrypted = tryDecryptDittoValue(encoded);
    if (decrypted) scanFlowString(decrypted, result, depth + 1);
  }

  const patterns: Array<[keyof ExtractedFlowSession, RegExp]> = [
    ["uid", /["']?(?:uid|userId|user_uid)["']?\s*[:=]\s*["']?(\d{3,20})/i],
    ["ticket", /["']?(?:ticket|sessionTicket|loginTicket)["']?\s*[:=]\s*["']?([a-z0-9._-]{16,256})/i],
    ["access_token", /["']?(?:access_token|accessToken|oauthAccessToken)["']?\s*[:=]\s*["']?([a-z0-9._-]{16,4096})/i],
    ["netEaseToken", /["']?(?:netEaseToken|nimToken|imToken)["']?\s*[:=]\s*["']?([a-z0-9._-]{16,4096})/i],
    ["deviceId", /["']?(?:deviceId|deviceIdentifier)["']?\s*[:=]\s*["']?([a-z0-9._-]{4,256})/i],
    ["nimAppKey", /["']?(?:nimAppKey|nimKey|appKey)["']?\s*[:=]\s*["']?([a-z0-9._-]{16,256})/i],
  ];
  for (const [field, pattern] of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) addFlowField(result, field, match[1]);
  }
}

function scanFlowValue(value: unknown, result: ExtractedFlowSession, depth = 0) {
  if (depth > 7 || value == null) return;
  if (typeof value === "string") {
    scanFlowString(value, result, depth);
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    addFlowField(result, key, child);
    if (key.toLowerCase() === "ed" && typeof child === "string") {
      const decrypted = tryDecryptDittoValue(child);
      if (decrypted) scanFlowString(decrypted, result, depth + 1);
    }
    scanFlowValue(child, result, depth + 1);
  }
}

function extractDittoSessionFromFlow(buffer: Buffer): ExtractedFlowSession {
  const result: ExtractedFlowSession = {};
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const parsed = tryParseJson(text);
  scanFlowValue(parsed ?? text, result);

  // Some Ditto captures are exported in the binary "flows" format rather
  // than JSON. Its response bodies are stored as a byte length followed by a
  // gzip member, for example: `content;415:<gzip bytes>`. Scan each body
  // after decompressing it. The buffer stays in memory for the duration of
  // this request and no credential values are logged.
  for (let offset = 0; offset + 3 <= buffer.length; offset += 1) {
    if (buffer[offset] !== 0x1f || buffer[offset + 1] !== 0x8b || buffer[offset + 2] !== 0x08) {
      continue;
    }

    const prefix = buffer.subarray(Math.max(0, offset - 48), offset).toString("latin1");
    const lengthMatch = prefix.match(/(\d+):$/);
    if (!lengthMatch) continue;

    const bodyLength = Number(lengthMatch[1]);
    if (!Number.isSafeInteger(bodyLength) || bodyLength <= 0 || offset + bodyLength > buffer.length) {
      continue;
    }

    try {
      const decompressed = gunzipSync(buffer.subarray(offset, offset + bodyLength));
      scanFlowString(decompressed.toString("utf8"), result, 0);
    } catch {
      // A random gzip marker or an incomplete body should not abort the
      // extraction of other responses in the same flow.
    }
  }

  return result;
}

function readLegacyDittoSession(): DittoSession | null {
  if (!existsSync(SESSION_FILE)) return null;
  try {
    return JSON.parse(readFileSync(SESSION_FILE, "utf8")) as DittoSession;
  } catch {
    return null;
  }
}

async function loadSession(): Promise<DittoSession> {
  const stored = await readDittoSessionFromDatabase();
  if (stored.row) return sessionFromRow(stored.row);

  const legacy = readLegacyDittoSession();
  if (!legacy) {
    if (stored.tableMissing) {
      throw new Error("جدول جلسة Ditto غير موجود. شغّل migration رقم 29 في Supabase.");
    }
    return {};
  }

  // One-time migration for the old local file. Future reads use Supabase only.
  if (!stored.tableMissing) {
    await saveDittoSession(legacy);
    try { unlinkSync(SESSION_FILE); } catch {}
  }
  return legacy;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function makeHeaders(): Record<string, string> {
  return {
    simulator: "physical", language: "1", appcode: "1030400",
    appversion: "1.3.4.0", os: "android", app: "ditto",
    model: "M1908C3JGG", channel: "google_play",
    systemlanguage: "en", osversion: "13",
    t: Date.now().toString(),
    sn: randomBytes(4).toString("hex").slice(0, 7),
    "accept-encoding": "gzip", "user-agent": "okhttp/4.12.0",
  };
}

function dittoRaw(path: string, body: string | null = null, method = "GET"): Promise<string> {
  return new Promise((resolve, reject) => {
    const extraH: Record<string, string> = body
      ? { "content-type": "application/x-www-form-urlencoded", "content-length": String(Buffer.byteLength(body)) }
      : {};
    const req = httpsRequest(
      { hostname: "www.sayyouditto.com", port: 443, path, method, headers: { ...makeHeaders(), ...extraH } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          let raw = Buffer.concat(chunks);
          if (res.headers["content-encoding"] === "gzip") {
            try { raw = gunzipSync(raw); } catch { /* not gzip */ }
          }
          resolve(raw.toString("utf8"));
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(new Error("Timeout")); });
    if (body) req.write(body);
    req.end();
  });
}

async function dittoCall(endpoint: string, params: Record<string, string>, method = "GET"): Promise<unknown> {
  const session = await loadSession();
  const merged = { ticket: session.ticket ?? "", uid: session.uid ?? "", deviceId: session.deviceId ?? "", simCountry: "eg", ...params };
  const plain = new URLSearchParams(merged).toString();
  const enc = encrypt(plain);

  let reqPath = endpoint;
  let body: string | null = null;
  if (method === "GET") {
    reqPath = endpoint + "?ed=" + encodeURIComponent(enc);
  } else {
    body = "ed=" + encodeURIComponent(enc);
  }

  const raw = await dittoRaw(reqPath, body, method);
  const json = JSON.parse(raw) as Record<string, unknown>;
  if (typeof json.ed === "string") return JSON.parse(decrypt(json.ed));
  return json;
}

// ── Public profile API (no auth, no geo-lock) ─────────────────────────────────
interface PublicProfile {
  nick: string | null; avatar: string | null; erbanNo: number | null;
  hasPrettyErbanNo: boolean; gender: number | null; onLine: boolean;
  age: number | null; country: string | null; countryGroup: string | null;
  countryGroupRank: string | null; defUser: number | null; fillType: number | null;
  usersAvatarStatus: number | null; chatGift: number | null; chatRange: number | null;
  growthLevel: number | null; growthLevelPic: string | null;
  experLevel: number | null; experLevelPic: string | null;
  charmLevel: number | null; charmLevelPic: string | null;
  noLv: number | null; carName: string | null; carUrl: string | null;
  carVideoUrl: string | null; headwearName: string | null; headwearUrl: string | null;
  ban: number | null; vipId: number | null; vipName: string | null;
  vipIcon: string | null; vipMedal: string | null;
  vipInfoDto: Record<string, unknown> | null; svipInfo: Record<string, unknown> | null;
  userMedalList: Record<string, unknown>[]; userRoles: number[];
  userWearPropList: unknown[];
}

async function fetchPublicProfile(uid: string | number): Promise<PublicProfile | null> {
  try {
    const raw = await new Promise<string>((resolve, reject) => {
      const req = httpsRequest(
        {
          hostname: "www.sayyouditto.com", port: 443,
          path: `/user/v5/get?uid=${uid}`, method: "GET",
          headers: { "user-agent": "okhttp/4.12.0", "accept-encoding": "gzip" },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            let buf = Buffer.concat(chunks);
            if (res.headers["content-encoding"] === "gzip") {
              try { buf = gunzipSync(buf); } catch { /* not gzip */ }
            }
            resolve(buf.toString("utf8"));
          });
        },
      );
      req.on("error", reject);
      req.setTimeout(8000, () => { req.destroy(new Error("Timeout")); });
      req.end();
    });
    const json = JSON.parse(raw) as Record<string, unknown>;
    if (json.code !== 200 || !json.data) return null;
    const d = json.data as Record<string, unknown>;
    const vip  = d.vipInfoDto       as Record<string, unknown> | null;
    const svip = d.userSVipInfoVO   as Record<string, unknown> | null;
    return {
      nick:             (d.nick    as string)  || null,
      avatar:           (d.avatar  as string)  || null,
      erbanNo:          (d.erbanNo as number)  || null,
      hasPrettyErbanNo: !!(d.hasPrettyErbanNo),
      gender:           d.gender   != null ? (d.gender as number) : null,
      onLine:           !!(d.onLine),
      age:              (d.age     as number)  ?? null,
      country:          (d.country as string)  || null,
      countryGroup:     (d.countryGroup as string) || null,
      countryGroupRank: (d.countryGroupRank as string) || null,
      defUser:          d.defUser   != null ? (d.defUser as number) : null,
      fillType:         d.fillType  != null ? (d.fillType as number) : null,
      usersAvatarStatus: d.usersAvatarStatus != null ? (d.usersAvatarStatus as number) : null,
      chatGift:         d.chatGift  != null ? (d.chatGift as number) : null,
      chatRange:        d.chatRange != null ? (d.chatRange as number) : null,
      growthLevel:      (d.growthLevel    as number) ?? null,
      growthLevelPic:   (d.growthLevelPic as string) || null,
      experLevel:       (d.experLevel     as number) ?? null,
      experLevelPic:    (d.experLevelPic  as string) || null,
      charmLevel:       (d.charmLevel     as number) ?? null,
      charmLevelPic:    (d.charmLevelPic  as string) || null,
      noLv:             (d.noLv as number) ?? null,
      carName:          (d.carName  as string) || null,
      carUrl:           (d.carUrl   as string) || null,
      carVideoUrl:      (d.carVideoUrl as string) || null,
      headwearName:     (d.headwearName as string) || null,
      headwearUrl:      (d.headwearUrl  as string) || null,
      ban:              (d.ban as number) ?? null,
      vipId:            vip ? (vip.vipId  as number) ?? null : (d.vipId as number) ?? null,
      vipName:          vip ? (vip.vipName as string) || null : (d.vipName as string) || null,
      vipIcon:          vip ? (vip.vipIcon as string) || null : (d.vipIcon as string) || null,
      vipMedal:         vip ? (vip.vipMedal as string) || null : (d.vipMedal as string) || null,
      vipInfoDto:       vip ?? null,
      svipInfo:         svip ?? null,
      userMedalList:    (d.userMedalList    as Record<string, unknown>[]) ?? [],
      userRoles:        (d.userRoles        as number[])                  ?? [],
      userWearPropList: (d.userWearPropList as unknown[])                 ?? [],
    };
  } catch { return null; }
}

// ── Room data parser ──────────────────────────────────────────────────────────
function parseRoom(r: Record<string, unknown>) {
  const country = r.countryInfo as Record<string, unknown> | null;
  const vip = r.vipInfoDto as Record<string, unknown> | null;
  return {
    roomId:      r.roomId   ?? r.id   ?? null,
    roomName:    r.title    ?? r.roomName ?? r.name ?? null,
    cover:       r.avatar   ?? r.cover ?? r.coverImage ?? null,
    onlineNum:   r.onlineNum ?? r.online ?? null,
    uid:         r.uid      ?? null,
    nick:        r.nick     ?? r.nickName ?? null,
    erbanNo:     r.erbanNo  ?? null,
    countryCode: country?.countryShort ?? null,
    countryName: country?.countryName  ?? null,
    countryIcon: country?.countryIcon  ?? null,
    vipLevel:    vip?.vipId ?? null,
    vipName:     vip?.vipName ?? null,
    gender:      r.gender   ?? null,
    roomDesc:    r.roomDesc ?? null,
    hotScore:    r.hotScore ?? null,
  };
}

// ── Scan rooms to find user by UID ────────────────────────────────────────────
async function findUserInRooms(targetUid: string): Promise<Record<string, unknown> | null> {
  const tabs = ["POPULAR", "EG", "SA", "AE", "ALL"];
  for (const tab of tabs) {
    try {
      const result = await dittoCall("/home/tab/room", { tab, pageNum: "1", pageSize: "50" }) as Record<string, unknown>;
      if (result?.code !== 200) continue;
      const data = result.data as Record<string, unknown>;
      const list = (data?.listRoom as Record<string, unknown>[]) ?? [];
      const found = list.find((r) => String(r.uid) === String(targetUid));
      if (found) return found;
    } catch { /* skip tab */ }
  }
  return null;
}

// ── Job queue ────────────────────────────────────────────────────────────────
let lastWorkerPollAt = 0;
export function markWorkerPoll() { lastWorkerPollAt = Date.now(); }

interface JobEntry {
  jobId: string; endpoint: string; params: Record<string, string>;
  created: number; result?: unknown; done: boolean;
}
declare const globalThis: {
  _dittoJobs?: Map<string, JobEntry>;
  _dittoWaiters?: Map<string, ((r: unknown) => void)[]>;
};
if (!globalThis._dittoJobs) globalThis._dittoJobs = new Map();
if (!globalThis._dittoWaiters) globalThis._dittoWaiters = new Map();

function makeJobId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function queueWorkerJob(endpoint: string, params: Record<string, string>, timeoutMs = 25000): Promise<{ result: unknown; timedOut: boolean }> {
  const jobId = makeJobId();
  globalThis._dittoJobs!.set(jobId, { jobId, endpoint, params, created: Date.now(), done: false });
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      globalThis._dittoWaiters!.delete(jobId);
      resolve({ result: null, timedOut: true });
    }, timeoutMs);
    const cb = (result: unknown) => { clearTimeout(timer); resolve({ result, timedOut: false }); };
    const list = globalThis._dittoWaiters!.get(jobId) ?? [];
    list.push(cb);
    globalThis._dittoWaiters!.set(jobId, list);
  });
}

// ── GET /api/ditto/lookup/erban/:no ──────────────────────────────────────────
router.get("/lookup/erban/:no", async (req, res) => {
  const { no } = req.params;
  if (!no || !/^\d+$/.test(no)) {
    res.status(400).json({ ok: false, error: "invalid erbanNo" }); return;
  }
  try {
    const raw = await new Promise<string>((resolve, reject) => {
      const r = httpsRequest(
        {
          hostname: "www.sayyouditto.com", port: 443,
          path: `/pay/payermax/getInfo?no=${encodeURIComponent(no)}`,
          method: "GET",
          headers: { "user-agent": "okhttp/4.12.0", "accept-encoding": "gzip" },
        },
        (resp) => {
          const chunks: Buffer[] = [];
          resp.on("data", (c: Buffer) => chunks.push(c));
          resp.on("end", () => {
            let buf = Buffer.concat(chunks);
            if (resp.headers["content-encoding"] === "gzip") {
              try { buf = gunzipSync(buf); } catch { /* not gzip */ }
            }
            resolve(buf.toString("utf8"));
          });
        },
      );
      r.on("error", reject);
      r.setTimeout(8000, () => { r.destroy(new Error("Timeout")); });
      r.end();
    });
    const json = JSON.parse(raw) as Record<string, unknown>;
    if (json.code !== 200 || !json.data) {
      res.status(404).json({ ok: false, error: "user not found" }); return;
    }
    const d = json.data as Record<string, unknown>;
    res.json({ ok: true, uid: d.uid ?? null, erbanNo: d.erbanNo ?? null, nick: d.nick ?? null, avatar: d.avatar ?? null, country: d.country ?? null });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── GET /api/ditto/session ────────────────────────────────────────────────────
router.get("/session", async (_req, res) => {
  try {
    const session = await loadSession();
    const now = Date.now();
    const savedAt = Number(session.ticket_saved_at) || 0;
    const ageMin = savedAt ? Math.round((now - savedAt) / 60000) : null;
    const validForMin = ageMin !== null ? 60 - ageMin : null;
    res.json({
      uid: session.uid ?? null,
      ticket_prefix: typeof session.ticket === "string" ? session.ticket.slice(0, 8) + "..." : null,
      ticket_age_min: ageMin,
      ticket_valid_for_min: validForMin,
      ticket_expired: validForMin !== null && validForMin <= 0,
    });
  } catch {
    res.json({ uid: null, ticket_prefix: null, ticket_age_min: null, ticket_valid_for_min: null, ticket_expired: true });
  }
});

// ── POST /api/ditto/session/inject ───────────────────────────────────────────
router.post("/session/inject", async (req, res) => {
  const { ticket, access_token, uid, deviceId, netEaseToken, nimAppKey } = req.body ?? {};
  if (!ticket || typeof ticket !== "string") { res.status(400).json({ ok: false, error: "ticket required" }); return; }
  if (!access_token || typeof access_token !== "string") { res.status(400).json({ ok: false, error: "access_token required" }); return; }
  if (!uid) { res.status(400).json({ ok: false, error: "uid required" }); return; }
  try {
    const session = await loadSession();
    const now = Date.now();
    session.ticket = ticket;
    session.access_token = access_token;
    session.uid = String(uid);
    session.ticket_saved_at = now;
    session.access_token_saved_at = now;
    if (typeof deviceId === "string" && deviceId.trim()) session.deviceId = deviceId.trim();
    if (typeof netEaseToken === "string" && netEaseToken.trim()) session.netEaseToken = netEaseToken.trim();
    if (typeof nimAppKey === "string" && nimAppKey.trim()) session.nimAppKey = nimAppKey.trim();
    await saveDittoSession(session);
    try { unlinkSync(SESSION_FILE); } catch {}
    res.json({ ok: true, uid: session.uid, ticket_prefix: ticket.slice(0, 8) + "...", hasNimToken: !!session.netEaseToken });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── POST /api/ditto/session/import-flow ──────────────────────────────────────
// The uploaded flow is processed in memory and is never written to disk.
router.post("/session/import-flow", flowUpload.single("flow"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ ok: false, error: "flow file required" });
    return;
  }

  try {
    const extracted = extractDittoSessionFromFlow(req.file.buffer);
    const missing = ["uid", "ticket", "access_token"].filter(field => !extracted[field as keyof ExtractedFlowSession]);
    if (missing.length > 0) {
      res.status(422).json({
        ok: false,
        error: "لم يتم العثور على بيانات جلسة Ditto مكتملة داخل الملف",
        missing,
        extracted: {
          uid: !!extracted.uid,
          ticket: !!extracted.ticket,
          access_token: !!extracted.access_token,
          netEaseToken: !!extracted.netEaseToken,
          deviceId: !!extracted.deviceId,
          nimAppKey: !!extracted.nimAppKey,
        },
      });
      return;
    }

    // A complete flow is self-contained. Do not make a stale/corrupt encrypted
    // row prevent importing the fresh credentials from the file.
    let existing: DittoSession = {};
    try {
      existing = await loadSession();
    } catch (error) {
      console.warn("[ditto] replacing unreadable stored session during flow import");
    }
    const nextSession: DittoSession = { ...existing };
    const now = Date.now();
    nextSession.uid = extracted.uid;
    nextSession.ticket = extracted.ticket;
    nextSession.ticket_saved_at = now;
    nextSession.access_token = extracted.access_token;
    nextSession.access_token_saved_at = now;
    if (extracted.netEaseToken) nextSession.netEaseToken = extracted.netEaseToken;
    if (extracted.deviceId) nextSession.deviceId = extracted.deviceId;
    if (extracted.nimAppKey) nextSession.nimAppKey = extracted.nimAppKey;

    await saveDittoSession(nextSession);
    try { unlinkSync(SESSION_FILE); } catch {}
    res.json({
      ok: true,
      uid: nextSession.uid,
      extracted: {
        uid: !!extracted.uid,
        ticket: !!extracted.ticket,
        access_token: !!extracted.access_token,
        netEaseToken: !!extracted.netEaseToken,
        deviceId: !!extracted.deviceId,
        nimAppKey: !!extracted.nimAppKey,
      },
      hasNimToken: !!nextSession.netEaseToken,
    });
  } catch (error) {
    console.error("[ditto] flow import failed:", error instanceof Error ? error.message : error);
    res.status(500).json({ ok: false, error: "تعذر تحليل ملف الـflow أو حفظ الجلسة" });
  }
});

// ── PATCH /api/ditto/session/ticket ──────────────────────────────────────────
router.patch("/session/ticket", async (req, res) => {
  const { ticket } = req.body ?? {};
  if (!ticket || typeof ticket !== "string" || !/^[0-9a-f]{24,64}$/i.test(ticket)) {
    res.status(400).json({ ok: false, error: "invalid ticket format" }); return;
  }
  try {
    const session = await loadSession();
    session.ticket = ticket;
    session.ticket_saved_at = Date.now();
    await saveDittoSession(session);
    try { unlinkSync(SESSION_FILE); } catch {}
    res.json({ ok: true, ticket_prefix: ticket.slice(0, 8) + "..." });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── POST /api/session/update (webhook for Frida) ─────────────────────────────
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";
router.post("/session/update", async (req, res) => {
  const candidate = req.headers["x-webhook-secret"] ?? req.body?.secret ?? req.query?.secret;
  if (!WEBHOOK_SECRET || typeof candidate !== "string" || candidate !== WEBHOOK_SECRET) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  const { ticket, uid, deviceId, access_token } = req.body ?? {};
  if (typeof ticket !== "string" || !/^[0-9a-fA-F]{32}$/.test(ticket)) {
    res.status(400).json({ error: "ticket must be a 32-char hex string" }); return;
  }
  try {
    const session = await loadSession();
    const now = Date.now();
    session.ticket = ticket;
    session.ticket_saved_at = now;
    if (typeof uid === "string" && uid.trim()) session.uid = uid.trim();
    if (typeof deviceId === "string" && deviceId.trim()) session.deviceId = deviceId.trim();
    if (typeof access_token === "string" && /^[0-9a-fA-F]{32}$/.test(access_token)) {
      session.access_token = access_token;
      session.access_token_saved_at = now;
    }
    await saveDittoSession(session);
    try { unlinkSync(SESSION_FILE); } catch {}
    res.json({ ok: true, uid: session.uid, ticket_prefix: ticket.slice(0, 8) + "...", saved_at: now });
  } catch (err) {
    res.status(500).json({ error: "Failed to save session" });
  }
});

// ── GET /api/ditto/nim-credentials ───────────────────────────────────────────
router.get("/nim-credentials", async (_req, res) => {
  try {
    const session = await loadSession();
    const nimAppKey = session.nimAppKey || "a1f28028ba4e22c11cfaffe0e37ae27b";
    const netEaseToken = session.netEaseToken;
    const uid = session.uid;
    res.json({ ok: true, nimAppKey, nimAccount: uid ?? null, nimToken: netEaseToken ?? null, hasToken: !!netEaseToken });
  } catch {
    res.json({ ok: false, nimAppKey: null, nimAccount: null, nimToken: null, hasToken: false });
  }
});

// ── GET /api/ditto/nim-addresses ─────────────────────────────────────────────
router.get("/nim-addresses", async (_req, res) => {
  try {
    const session = await loadSession();
    const appkey = session.nimAppKey || "a1f28028ba4e22c11cfaffe0e37ae27b";
    const uid = session.uid ?? "";
    const url = `https://lbs.netease.im/lbs/chatroom.id?appkey=${encodeURIComponent(appkey)}&nrtcg=&uid=${encodeURIComponent(uid)}`;
    const lbsData = await new Promise<string>((resolve, reject) => {
      httpsRequest(url, (r) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        r.on("error", reject);
      }).on("error", reject).end();
    });
    const lbs = JSON.parse(lbsData) as Record<string, unknown>;
    const addresses: string[] = Array.isArray(lbs.link) ? (lbs.link as string[]) : [];
    res.json({ ok: true, addresses, raw: lbs });
  } catch (e) {
    res.json({ ok: false, addresses: [], error: String(e) });
  }
});

// ── GET /api/ditto/room-members/:roomId ──────────────────────────────────────
router.get("/room-members/:roomId", async (req, res) => {
  const { roomId } = req.params;
  if (!roomId) { res.status(400).json({ ok: false, error: "roomId required" }); return; }
  try {
    const result = await dittoCall("/imsvr/v1/v3/fetchRoomMembers", { roomId, limit: "50", userScore: "", vipScore: "" }, "POST") as Record<string, unknown>;
    if (result?.code !== 200) { res.json({ ok: false, members: [], error: result?.message ?? "API error" }); return; }
    const data = result.data as Record<string, unknown>;
    const raw = (data?.vipMemberList as Record<string, unknown>[]) ?? [];
    const members = raw.map(m => ({
      uid: m.uid as number, nick: (m.nick as string) ?? "",
      avatar: (m.avatar as string) ?? null, gender: (m.gender as number) ?? null,
      isManager: (m.is_manager as boolean) ?? false, isCreator: (m.is_creator as boolean) ?? false,
      onMic: (m.onMic as boolean) ?? false, inRoom: (m.inRoomStatus as boolean) ?? false,
      growthLevel: (m.growthLevel as number) ?? 0, charmLevel: (m.charmLevel as number) ?? 0,
      carName: (m.car_name as string) ?? null, noLv: (m.noLv as number) ?? 0,
      erbanNo: (m.erban_no as number) ?? null,
    }));
    const needsEnrich = members.filter(m => !m.nick || !m.avatar || !m.erbanNo);
    if (needsEnrich.length > 0) {
      await Promise.allSettled(
        needsEnrich.map(async (member) => {
          const pub = await fetchPublicProfile(member.uid);
          if (!pub) return;
          if (!member.nick && pub.nick) member.nick = pub.nick;
          if (!member.avatar && pub.avatar) member.avatar = pub.avatar;
          if (!member.erbanNo && pub.erbanNo) member.erbanNo = pub.erbanNo;
          if (member.gender == null && pub.gender != null) member.gender = pub.gender;
        })
      );
    }
    res.json({ ok: true, members, total: members.length });
  } catch (e) {
    res.status(500).json({ ok: false, members: [], error: String(e) });
  }
});

// ── GET /api/ditto/balance ────────────────────────────────────────────────────
router.get("/balance", async (_req, res) => {
  try {
    const result = await dittoCall("/purse/query", {}) as Record<string, unknown>;
    if (result?.code === 200) {
      res.json({ ok: true, ...(result.data as Record<string, unknown>) });
    } else {
      res.json({ ok: false, error: result });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── GET /api/ditto/explore ────────────────────────────────────────────────────
router.get("/explore", async (_req, res) => {
  try {
    const result = await dittoCall("/explore/info", { pageNo: "1", pageSize: "20" }) as Record<string, unknown>;
    if (result?.code === 200) {
      res.json({ ok: true, raw: (result as Record<string, unknown>).data });
    } else {
      res.json({ ok: false, raw: result });
    }
  } catch (e) {
    res.status(500).json({ ok: false, raw: {}, error: String(e) });
  }
});

// ── GET /api/ditto/rooms ──────────────────────────────────────────────────────
router.get("/rooms", async (req, res) => {
  const tab      = (req.query.tab as string)      ?? "POPULAR";
  const pageNum  = (req.query.pageNum as string)  ?? "1";
  const pageSize = (req.query.pageSize as string) ?? "20";
  try {
    const result = await dittoCall("/home/tab/room", { tab, pageNum, pageSize }) as Record<string, unknown>;
    if (result?.code === 200) {
      const data = result.data as Record<string, unknown>;
      const list = (data?.listRoom as Record<string, unknown>[]) ?? (data?.list as Record<string, unknown>[]) ?? [];
      res.json({ ok: true, rooms: list.map(parseRoom), total: data?.total ?? list.length });
    } else {
      res.json({ ok: false, rooms: [], total: null, error: result });
    }
  } catch (e) {
    res.status(500).json({ ok: false, rooms: [], error: String(e) });
  }
});

// ── GET /api/ditto/rooms/search ───────────────────────────────────────────────
router.get("/rooms/search", async (req, res) => {
  const q = (req.query.q as string ?? "").trim().toLowerCase();
  if (!q) { res.status(400).json({ ok: false, rooms: [], error: "q required" }); return; }
  const TABS = ["POPULAR", "ALL", "EG", "SA", "AE", "IQ", "MA", "LY", "TN", "SD", "JO", "KW", "SY", "OM"];
  const isNumeric = /^\d+$/.test(q);
  try {
    const results = await Promise.allSettled(
      TABS.map(tab => dittoCall("/home/tab/room", { tab, pageNum: "1", pageSize: "50" }) as Promise<Record<string, unknown>>)
    );
    const seen = new Set<string>();
    const allRooms: ReturnType<typeof parseRoom>[] = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const result = r.value;
      if (result?.code !== 200) continue;
      const data = result.data as Record<string, unknown>;
      const list = ((data?.listRoom ?? data?.list ?? []) as Record<string, unknown>[]);
      for (const raw of list) {
        const room = parseRoom(raw);
        const key = String(room.roomId ?? "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        allRooms.push(room);
      }
    }
    const matches = allRooms.filter(room => {
      if (isNumeric) return String(room.roomId) === q || String(room.erbanNo) === q || String(room.uid) === q;
      const haystack = [room.roomName, room.nick, room.roomDesc, String(room.erbanNo ?? ""), String(room.roomId ?? "")]
        .filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
    res.json({ ok: true, rooms: matches, total: matches.length, scanned: allRooms.length });
  } catch (e) {
    res.status(500).json({ ok: false, rooms: [], error: String(e) });
  }
});

// ── POST /api/ditto/trtc-token ────────────────────────────────────────────────
router.post("/trtc-token", async (req, res) => {
  const { roomId, type = "1", channel = "1" } = req.body ?? {};
  if (!roomId || !/^\d+$/.test(String(roomId))) {
    res.status(400).json({ ok: false, error: "roomId (numeric) required" }); return;
  }
  try {
    const result = await dittoCall("/room/getTRtcToken", { roomId: String(roomId), type: String(type), channel: String(channel) }, "POST") as Record<string, unknown>;
    if (result?.code === 200) {
      res.json({ ok: true, ...(result.data as Record<string, unknown>) });
    } else {
      res.json({ ok: false, error: result });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── Saved rooms (persist rooms so they don't disappear when empty/closed) ─────
router.get("/saved-rooms", async (_req, res) => {
  try {
    const rooms = await storage.getSavedRooms();
    res.json({ ok: true, rooms });
  } catch (e) {
    res.status(500).json({ ok: false, rooms: [], error: String(e) });
  }
});

router.post("/saved-rooms", async (req, res) => {
  const { roomId, roomName, cover, hostUid, hostNick, erbanNo, countryCode, channel, note } = req.body ?? {};
  if (!roomId || !/^\d+$/.test(String(roomId))) {
    res.status(400).json({ ok: false, error: "roomId (numeric) required" }); return;
  }
  try {
    const saved = await storage.saveRoom({
      room_id: String(roomId),
      room_name: roomName ?? null,
      cover: cover ?? null,
      host_uid: hostUid != null ? String(hostUid) : null,
      host_nick: hostNick ?? null,
      erban_no: erbanNo != null ? String(erbanNo) : null,
      country_code: countryCode ?? null,
      channel: channel != null ? String(channel) : "1",
      note: note ?? null,
    });
    res.json({ ok: true, room: saved });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.delete("/saved-rooms/:roomId", async (req, res) => {
  const { roomId } = req.params;
  try {
    const success = await storage.deleteSavedRoom(roomId);
    res.json({ ok: success });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── Listen history (log of every room the admin has listened to) ──────────────
router.get("/listen-history", async (_req, res) => {
  try {
    const history = await storage.getListenHistory();
    res.json({ ok: true, history });
  } catch (e) {
    res.status(500).json({ ok: false, history: [], error: String(e) });
  }
});

router.post("/listen-history", async (req, res) => {
  const { roomId, roomName, cover, hostUid, hostNick, erbanNo, countryCode, action } = req.body ?? {};
  if (!roomId || !/^\d+$/.test(String(roomId))) {
    res.status(400).json({ ok: false, error: "roomId (numeric) required" }); return;
  }
  try {
    const entry = await storage.addListenHistory({
      room_id: String(roomId),
      room_name: roomName ?? null,
      cover: cover ?? null,
      host_uid: hostUid != null ? String(hostUid) : null,
      host_nick: hostNick ?? null,
      erban_no: erbanNo != null ? String(erbanNo) : null,
      country_code: countryCode ?? null,
      action: action === "talk" ? "talk" : "listen",
    });
    res.json({ ok: true, entry });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── GET /api/ditto/user/:uid ──────────────────────────────────────────────────
router.get("/user/:uid", async (req, res) => {
  const { uid } = req.params;
  if (!uid || !/^\d+$/.test(uid)) { res.status(400).json({ error: "uid must be numeric" }); return; }
  try {
    const giftsResult = await dittoCall("/giftwall/getUserHistoryReceives", { tgUid: uid }) as Record<string, unknown>;
    let topGifts: Record<string, unknown>[] = [];
    let totalNum: number | null = null;
    let totalTypes: number | null = null;
    if (giftsResult?.code === 200) {
      const data = giftsResult.data as Record<string, unknown>;
      const rawList = (data?.topList as Record<string, unknown>[]) ?? [];
      topGifts = rawList.map((g) => ({ giftId: g.giftId ?? null, giftName: g.giftName ?? null, num: g.num ?? null, icon: g.icon ?? null }));
      totalNum = (data?.totalNum as number) ?? null;
      totalTypes = (data?.totalTypeNum as number) ?? null;
    }
    res.json({ uid, totalGiftsNum: totalNum, totalGiftTypes: totalTypes, topGifts, profile: null, workerUsed: false, source: "direct" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /api/ditto/user/:uid/profile ─────────────────────────────────────────
router.get("/user/:uid/profile", async (req, res) => {
  const { uid } = req.params;
  if (!uid || !/^\d+$/.test(uid)) { res.status(400).json({ ok: false, uid, workerUsed: false, workerNeeded: false }); return; }
  try {
    const pub = await fetchPublicProfile(uid);
    if (pub && pub.nick) {
      return res.json({
        ok: true, uid, nickname: pub.nick, avatar: pub.avatar, signature: null,
        erbanNo: pub.erbanNo, hasPrettyErbanNo: pub.hasPrettyErbanNo, fansNum: null,
        followNum: null, level: null, diamond: null, online: pub.onLine,
        countryCode: pub.country, countryName: null, countryIcon: null,
        countryGroup: pub.countryGroup, countryGroupRank: pub.countryGroupRank,
        defUser: pub.defUser, fillType: pub.fillType, usersAvatarStatus: pub.usersAvatarStatus,
        chatGift: pub.chatGift, chatRange: pub.chatRange,
        vipLevel: pub.vipId, vipName: pub.vipName, vipIcon: pub.vipIcon,
        vipMedal: pub.vipMedal, vipInfoDto: pub.vipInfoDto, svipInfo: pub.svipInfo,
        gender: pub.gender, age: pub.age, growthLevel: pub.growthLevel,
        growthLevelPic: pub.growthLevelPic, experLevel: pub.experLevel,
        experLevelPic: pub.experLevelPic, charmLevel: pub.charmLevel,
        charmLevelPic: pub.charmLevelPic, noLv: pub.noLv, carName: pub.carName,
        carUrl: pub.carUrl, carVideoUrl: pub.carVideoUrl, headwearName: pub.headwearName,
        headwearUrl: pub.headwearUrl, ban: pub.ban, userMedalList: pub.userMedalList,
        userRoles: pub.userRoles, userWearPropList: pub.userWearPropList,
        source: "public_api_v5", workerUsed: false, workerNeeded: false, raw: null,
      });
    }
  } catch { /* fall through */ }
  try {
    const roomEntry = await findUserInRooms(uid);
    if (roomEntry) {
      const country = roomEntry.countryInfo as Record<string, unknown> | null;
      const vip = roomEntry.vipInfoDto as Record<string, unknown> | null;
      return res.json({
        ok: true, uid, nickname: roomEntry.nick ?? roomEntry.nickName ?? null,
        avatar: roomEntry.avatar ?? null, signature: roomEntry.roomDesc ?? null,
        erbanNo: roomEntry.erbanNo ?? null, fansNum: null, followNum: null,
        level: roomEntry.currRoomLevel ?? null, diamond: null, online: true,
        countryCode: country?.countryShort ?? null, countryName: country?.countryName ?? null,
        countryIcon: country?.countryIcon ?? null, vipLevel: vip?.vipId ?? null,
        vipName: vip?.vipName ?? null, gender: roomEntry.gender ?? null,
        source: "live_room", workerUsed: false, workerNeeded: false, raw: null,
      });
    }
  } catch { /* fall through */ }
  try {
    const result = await dittoCall("/user/v3/get", { queryUid: uid }) as Record<string, unknown>;
    if (result?.code === 200) return res.json(buildProfileResponse(uid, result.data as Record<string, unknown>, false, false));
  } catch { /* fall through */ }
  const workerConnected = lastWorkerPollAt && (Date.now() - lastWorkerPollAt) < 10000;
  if (workerConnected) {
    const { result, timedOut } = await queueWorkerJob("/user/v3/get", { queryUid: uid }, 25000);
    if (!timedOut && result) {
      const r = result as Record<string, unknown>;
      if (r.code === 200) return res.json(buildProfileResponse(uid, r.data as Record<string, unknown>, true, false));
    }
  }
  return res.json({
    ok: false, uid, nickname: null, avatar: null, signature: null, erbanNo: null,
    fansNum: null, followNum: null, level: null, diamond: null, online: false,
    countryCode: null, countryName: null, countryIcon: null, vipLevel: null,
    vipName: null, gender: null, source: "not_found", workerUsed: false,
    workerNeeded: !workerConnected, raw: null,
  });
});

function buildProfileResponse(uid: string, d: Record<string, unknown>, workerUsed: boolean, workerNeeded: boolean) {
  const country = d.countryInfo as Record<string, unknown> | null;
  const vip     = d.vipInfoDto  as Record<string, unknown> | null;
  return {
    ok: true, uid,
    nickname: d.nickName ?? d.nickname ?? null, avatar: d.avatar ?? d.headImg ?? null,
    signature: d.signature ?? d.sign ?? null, erbanNo: d.erbanNo ?? d.erbano ?? null,
    fansNum: d.fansNum ?? d.fans ?? null, followNum: d.followNum ?? d.follow ?? null,
    level: d.level ?? d.lv ?? null, diamond: d.diamond ?? d.diamondNum ?? null,
    online: d.online ?? null, countryCode: country?.countryShort ?? null,
    countryName: country?.countryName ?? null, countryIcon: country?.countryIcon ?? null,
    vipLevel: vip?.vipId ?? null, vipName: vip?.vipName ?? null,
    gender: d.gender ?? null, source: "api", workerUsed, workerNeeded, raw: d,
  };
}

// ── GET /api/ditto/search ─────────────────────────────────────────────────────
router.get("/search", async (req, res) => {
  const q = (req.query.q as string ?? "").trim();
  if (!q) { res.status(400).json({ ok: false, users: [], workerUsed: false, workerNeeded: false, error: "q required" }); return; }
  const workerConnected = lastWorkerPollAt && (Date.now() - lastWorkerPollAt) < 10000;
  try {
    const result = await dittoCall("/user/search", { keyword: q }) as Record<string, unknown>;
    if (result?.code === 200) return res.json({ ok: true, users: extractSearchList(result), workerUsed: false, workerNeeded: false });
  } catch { /* fall through */ }
  if (!workerConnected) return res.json({ ok: false, users: [], workerUsed: false, workerNeeded: true });
  const { result, timedOut } = await queueWorkerJob("/user/search", { keyword: q }, 25000);
  if (timedOut || !result) return res.json({ ok: false, users: [], workerUsed: true, workerNeeded: false, error: timedOut ? "Worker timeout" : "No result" });
  const r = result as Record<string, unknown>;
  if (r.code === 200) return res.json({ ok: true, users: extractSearchList(r), workerUsed: true, workerNeeded: false });
  return res.json({ ok: false, users: [], workerUsed: true, workerNeeded: false, error: `API code ${r.code}` });
});

function extractSearchList(result: Record<string, unknown>): Record<string, unknown>[] {
  const data = result.data as Record<string, unknown> ?? {};
  const raw = (data.list ?? data.userList ?? data.users ?? []) as Record<string, unknown>[];
  return raw.map((u) => ({
    uid: u.uid ?? null, nickname: u.nickName ?? u.nickname ?? null,
    avatar: u.avatar ?? u.headImg ?? null, erbanNo: u.erbanNo ?? null,
    fansNum: u.fansNum ?? null, level: u.level ?? u.lv ?? null,
  }));
}

// ── GET /api/ditto/worker/status ──────────────────────────────────────────────
router.get("/worker/status", (_req, res) => {
  const pendingJobs = [...(globalThis._dittoJobs?.values() ?? [])].filter(j => !j.done).length;
  const lastPollAgo = lastWorkerPollAt ? Math.round((Date.now() - lastWorkerPollAt) / 1000) : null;
  const connected = lastPollAgo !== null && lastPollAgo < 10;
  res.json({ connected, pendingJobs, lastPollAgo });
});

// ── Job queue routes ─────────────────────────────────────────────────────────
function authJob(secret: unknown): boolean {
  return typeof secret === "string" && secret === WEBHOOK_SECRET && WEBHOOK_SECRET !== "";
}
function makeId(): string { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

router.post("/jobs/create", (req, res) => {
  if (!authJob(req.headers["x-webhook-secret"] ?? req.body?.secret)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { endpoint, params = {} } = req.body ?? {};
  if (typeof endpoint !== "string") { res.status(400).json({ error: "endpoint required" }); return; }
  const jobId = makeId();
  globalThis._dittoJobs!.set(jobId, { jobId, endpoint, params, created: Date.now(), done: false });
  res.json({ jobId });
});

router.get("/jobs/pending", (req, res) => {
  if (!authJob(req.headers["x-webhook-secret"] ?? req.query.secret)) { res.status(401).json({ error: "Unauthorized" }); return; }
  for (const [, job] of globalThis._dittoJobs!) {
    if (!job.done) { res.json({ job }); return; }
  }
  res.json({ job: null });
});

router.post("/jobs/result", (req, res) => {
  if (!authJob(req.headers["x-webhook-secret"] ?? req.body?.secret)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { jobId, result } = req.body ?? {};
  const job = globalThis._dittoJobs!.get(jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  job.result = result;
  job.done = true;
  (globalThis._dittoWaiters!.get(jobId) ?? []).forEach(cb => cb(result));
  globalThis._dittoWaiters!.delete(jobId);
  res.json({ ok: true });
});

export default router;
