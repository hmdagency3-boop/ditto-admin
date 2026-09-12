import crypto from "node:crypto";
import { storage } from "./storage";

const imageCodePattern = /\[\[\s*(?:WA_)?IMAGE\s*:\s*([A-Z0-9_-]{2,50})\s*\]\]/gi;
const mediaBucket = "whatsapp-ai-images";

export interface WhatsAppAISettings {
  enabled: boolean;
  personality: string;
  responseStyle: string;
  caption: string;
  customInstructions: string;
}

export const defaultWhatsAppAISettings: WhatsAppAISettings = {
  enabled: false,
  personality: "ودود ومحترم ويتحدث بطريقة طبيعية",
  responseStyle: "مختصر وواضح وبنفس لغة الشخص الذي يرسل الرسالة",
  caption: "",
  customInstructions: "",
};

export interface WhatsAppAIMediaAsset {
  id: string;
  owner_id: string;
  code: string;
  title: string;
  purpose: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const mediaColumns = [
  "id",
  "owner_id",
  "code",
  "title",
  "purpose",
  "storage_path",
  "file_name",
  "mime_type",
  "file_size",
  "active",
  "created_at",
  "updated_at",
].join(", ");

function normalizeMediaCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_").slice(0, 50);
}

export function parseWhatsAppAIResponse(response: string) {
  const mediaCodes: string[] = [];
  const text = response
    .replace(imageCodePattern, (_match, code: string) => {
      mediaCodes.push(normalizeMediaCode(code));
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    text,
    mediaCodes: [...new Set(mediaCodes.filter(Boolean))],
  };
}

export async function listWhatsAppAIMedia(ownerId: string): Promise<WhatsAppAIMediaAsset[]> {
  const { data, error } = await storage.supabase
    .from("whatsapp_ai_media")
    .select(mediaColumns)
    .eq("owner_id", ownerId)
    .order("code", { ascending: true });

  if (error) {
    if (error.code === "42P01") {
      throw new Error("جدول صور الرد الذكي غير موجود. شغّل migration رقم 27 في Supabase.");
    }
    throw new Error(`تعذر تحميل مكتبة صور الرد الذكي: ${error.message}`);
  }
  return (data || []) as unknown as WhatsAppAIMediaAsset[];
}

export async function listActiveWhatsAppAIMedia(ownerId: string) {
  const { data, error } = await storage.supabase
    .from("whatsapp_ai_media")
    .select("code, title, purpose, storage_path")
    .eq("owner_id", ownerId)
    .eq("active", true)
    .order("code", { ascending: true });

  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(`تعذر تحميل أكواد صور الرد الذكي: ${error.message}`);
  }
  const assets = (data || []) as Array<{ code: string; title: string; purpose: string; storage_path: string }>;
  return Promise.all(assets.map(async (asset) => {
    const signed = await storage.supabase.storage
      .from(mediaBucket)
      .createSignedUrl(asset.storage_path, 60 * 60);
    return {
      code: asset.code,
      title: asset.title,
      purpose: asset.purpose,
      image_url: signed.data?.signedUrl || null,
    };
  }));
}

export async function createWhatsAppAIMedia(
  ownerId: string,
  input: {
    code: string;
    title: string;
    purpose: string;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  },
) {
  const code = normalizeMediaCode(input.code);
  const title = input.title.trim().slice(0, 160);
  const purpose = input.purpose.trim().slice(0, 1000);
  if (!/^[A-Z0-9_-]{2,50}$/.test(code)) {
    throw new Error("كود الصورة يجب أن يحتوي على حرفين أو أكثر من A-Z أو الأرقام أو _ أو -");
  }
  if (!title) throw new Error("اسم الصورة مطلوب");
  if (!input.mimeType.startsWith("image/")) throw new Error("يسمح برفع الصور فقط");
  if (input.buffer.length > 10 * 1024 * 1024) throw new Error("حجم الصورة يجب ألا يتجاوز 10 ميجابايت");

  const extension = input.fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "img";
  const storagePath = `${ownerId}/${crypto.randomUUID()}.${extension}`;
  const upload = await storage.supabase.storage
    .from(mediaBucket)
    .upload(storagePath, input.buffer, { contentType: input.mimeType, upsert: false });
  if (upload.error) {
    throw new Error(`تعذر رفع الصورة إلى التخزين: ${upload.error.message}`);
  }

  const { data, error } = await storage.supabase
    .from("whatsapp_ai_media")
    .insert({
      owner_id: ownerId,
      code,
      title,
      purpose,
      storage_path: storagePath,
      file_name: input.fileName.slice(0, 255),
      mime_type: input.mimeType,
      file_size: input.buffer.length,
    })
    .select(mediaColumns)
    .single();

  if (error) {
    await storage.supabase.storage.from(mediaBucket).remove([storagePath]);
    if (error.code === "23505") throw new Error("كود الصورة مستخدم بالفعل لهذا الحساب");
    if (error.code === "42P01") {
      throw new Error("جدول صور الرد الذكي غير موجود. شغّل migration رقم 27 في Supabase.");
    }
    throw new Error(`تعذر حفظ بيانات الصورة: ${error.message}`);
  }
  return data as unknown as WhatsAppAIMediaAsset;
}

export async function deleteWhatsAppAIMedia(ownerId: string, id: string) {
  const { data, error } = await storage.supabase
    .from("whatsapp_ai_media")
    .select("storage_path")
    .eq("owner_id", ownerId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`تعذر العثور على الصورة: ${error.message}`);
  if (!data) throw new Error("الصورة غير موجودة");

  const remove = await storage.supabase.storage.from(mediaBucket).remove([String(data.storage_path)]);
  if (remove.error) throw new Error(`تعذر حذف ملف الصورة: ${remove.error.message}`);

  const deleted = await storage.supabase
    .from("whatsapp_ai_media")
    .delete()
    .eq("owner_id", ownerId)
    .eq("id", id);
  if (deleted.error) throw new Error(`تعذر حذف بيانات الصورة: ${deleted.error.message}`);
}

export async function downloadWhatsAppAIMedia(ownerId: string, codes: string[]) {
  const normalizedCodes = [...new Set(codes.map(normalizeMediaCode).filter(Boolean))];
  if (normalizedCodes.length === 0) return [];

  const { data, error } = await storage.supabase
    .from("whatsapp_ai_media")
    .select("code, title, storage_path, file_name, mime_type")
    .eq("owner_id", ownerId)
    .eq("active", true)
    .in("code", normalizedCodes);
  if (error) throw new Error(`تعذر قراءة صور الرد الذكي: ${error.message}`);

  const byCode = new Map((data || []).map((asset) => [String(asset.code), asset]));
  const result = [];
  for (const code of normalizedCodes) {
    const asset = byCode.get(code);
    if (!asset) continue;
    const downloaded = await storage.supabase.storage.from(mediaBucket).download(String(asset.storage_path));
    if (downloaded.error) throw new Error(`تعذر تنزيل الصورة ${code}: ${downloaded.error.message}`);
    result.push({
      code,
      title: String(asset.title),
      fileName: String(asset.file_name),
      mimeType: String(asset.mime_type),
      buffer: Buffer.from(await downloaded.data.arrayBuffer()),
    });
  }
  return result;
}

const tableName = "whatsapp_ai_settings";

function normalizeSettings(row?: Record<string, unknown> | null): WhatsAppAISettings {
  return {
    enabled: Boolean(row?.enabled),
    personality: String(row?.personality || defaultWhatsAppAISettings.personality),
    responseStyle: String(row?.response_style || defaultWhatsAppAISettings.responseStyle),
    caption: String(row?.caption || ""),
    customInstructions: String(row?.custom_instructions || ""),
  };
}

export async function getWhatsAppAISettings(ownerId: string): Promise<WhatsAppAISettings> {
  const { data, error } = await storage.supabase
    .from(tableName)
    .select("enabled, personality, response_style, caption, custom_instructions")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") return { ...defaultWhatsAppAISettings };
    throw new Error(`تعذر تحميل إعدادات الرد الذكي: ${error.message}`);
  }
  return normalizeSettings(data as Record<string, unknown> | null);
}

export async function saveWhatsAppAISettings(
  ownerId: string,
  settings: WhatsAppAISettings,
): Promise<WhatsAppAISettings> {
  const payload = {
    owner_id: ownerId,
    enabled: settings.enabled,
    personality: settings.personality.trim(),
    response_style: settings.responseStyle.trim(),
    caption: settings.caption.trim(),
    custom_instructions: settings.customInstructions.trim(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await storage.supabase
    .from(tableName)
    .upsert(payload, { onConflict: "owner_id" })
    .select("enabled, personality, response_style, caption, custom_instructions")
    .single();

  if (error) {
    if (error.code === "42P01") {
      throw new Error("جدول إعدادات الرد الذكي غير موجود. شغّل migration رقم 25 في Supabase.");
    }
    throw new Error(`تعذر حفظ إعدادات الرد الذكي: ${error.message}`);
  }
  return normalizeSettings(data as Record<string, unknown>);
}

export interface WhatsAppAIQueueRequest {
  id: string;
  owner_id: string;
  session_name: string;
  whatsapp_message_id: string;
  chat_jid: string;
  sender_name: string | null;
  sender_phone: string | null;
  message_timestamp: number | null;
  message_type: string;
  request: string;
  response: string | null;
  requested_media_codes: string[];
  response_media_codes: string[];
  status: "pending" | "processing" | "ready" | "sending" | "sent" | "failed" | "ignored";
  worker_id: string | null;
  external_request_id: string | null;
  attempts: number;
  last_error: string | null;
  requested_at: string;
  claimed_at: string | null;
  responded_at: string | null;
  sent_at: string | null;
}

interface EnqueueWhatsAppAIRequestOptions {
  ownerId: string;
  messageId: string;
  jid: string;
  senderName: string;
  senderPhone: string | null;
  timestamp: number;
  request: string;
  conversation: Array<{ fromMe: boolean; text: string }>;
  settings: WhatsAppAISettings;
}

const queueColumns = [
  "id",
  "owner_id",
  "session_name",
  "whatsapp_message_id",
  "chat_jid",
  "sender_name",
  "sender_phone",
  "message_timestamp",
  "message_type",
  "request",
  "response",
  "requested_media_codes",
  "response_media_codes",
  "status",
  "worker_id",
  "external_request_id",
  "attempts",
  "last_error",
  "requested_at",
  "claimed_at",
  "responded_at",
  "sent_at",
].join(", ");

export async function enqueueWhatsAppAIRequest({
  ownerId,
  messageId,
  jid,
  senderName,
  senderPhone,
  timestamp,
  request,
  conversation,
  settings,
}: EnqueueWhatsAppAIRequestOptions): Promise<WhatsAppAIQueueRequest | null> {
  const availableMedia = await listActiveWhatsAppAIMedia(ownerId);
  const { data, error } = await storage.supabase
    .from("whatsapp_ai_requests")
    .upsert(
      {
        owner_id: ownerId,
        session_name: "default",
        whatsapp_message_id: messageId,
        chat_jid: jid,
        sender_name: senderName || null,
        sender_phone: senderPhone,
        message_timestamp: timestamp,
        message_type: "text",
        request,
         requested_media_codes: availableMedia.map((media) => media.code),
        context: {
          conversation: conversation.slice(-20),
          ai_settings: settings,
           available_images: availableMedia,
        },
      },
      {
        onConflict: "owner_id,session_name,whatsapp_message_id",
        ignoreDuplicates: true,
      },
    )
    .select(queueColumns)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      throw new Error("جدول whatsapp_ai_requests غير موجود. شغّل migration رقم 26 في Supabase.");
    }
    throw new Error(`تعذر إضافة رسالة واتساب إلى طابور الذكاء الاصطناعي: ${error.message}`);
  }
  return data as WhatsAppAIQueueRequest | null;
}

export async function getReadyWhatsAppAIRequests(ownerId: string): Promise<WhatsAppAIQueueRequest[]> {
  const { data, error } = await storage.supabase
    .from("whatsapp_ai_requests")
    .select(queueColumns)
    .eq("owner_id", ownerId)
    .eq("session_name", "default")
    .eq("status", "ready")
    .not("response", "is", null)
    .order("responded_at", { ascending: true })
    .limit(10);

  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(`تعذر قراءة ردود الذكاء الاصطناعي الجاهزة: ${error.message}`);
  }
  return (data || []) as unknown as WhatsAppAIQueueRequest[];
}

export async function claimWhatsAppAIReply(
  ownerId: string,
  requestId: string,
): Promise<WhatsAppAIQueueRequest | null> {
  const { data, error } = await storage.supabase
    .from("whatsapp_ai_requests")
    .update({ status: "sending", last_error: null })
    .eq("id", requestId)
    .eq("owner_id", ownerId)
    .eq("status", "ready")
    .not("response", "is", null)
    .select(queueColumns)
    .maybeSingle();

  if (error) throw new Error(`تعذر حجز رد واتساب للإرسال: ${error.message}`);
  return data as WhatsAppAIQueueRequest | null;
}

export async function markWhatsAppAIReplySent(ownerId: string, requestId: string) {
  const { error } = await storage.supabase
    .from("whatsapp_ai_requests")
    .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
    .eq("id", requestId)
    .eq("owner_id", ownerId)
    .eq("status", "sending");

  if (error) throw new Error(`تعذر تحديث حالة رد واتساب بعد الإرسال: ${error.message}`);
}

export async function recordWhatsAppAIReplyMediaCodes(
  ownerId: string,
  requestId: string,
  mediaCodes: string[],
) {
  const { error } = await storage.supabase
    .from("whatsapp_ai_requests")
    .update({ response_media_codes: mediaCodes })
    .eq("id", requestId)
    .eq("owner_id", ownerId)
    .eq("status", "sending");
  if (error && error.code !== "42703") {
    console.error("[whatsapp-ai] failed to record response image codes:", error.message);
  }
}

export async function markWhatsAppAIReplyFailed(
  ownerId: string,
  requestId: string,
  errorMessage: string,
) {
  const { error } = await storage.supabase
    .from("whatsapp_ai_requests")
    .update({
      status: "failed",
      last_error: errorMessage.slice(0, 2000),
    })
    .eq("id", requestId)
    .eq("owner_id", ownerId)
    .eq("status", "sending");

  if (error) {
    console.error("[whatsapp-ai] failed to record delivery error:", error.message);
  }
}

interface GenerateReplyOptions {
  settings: WhatsAppAISettings;
  contactName: string;
  incomingText: string;
  conversation: Array<{ fromMe: boolean; text: string }>;
}

export async function generateWhatsAppReply({
  settings,
  contactName,
  incomingText,
  conversation,
}: GenerateReplyOptions): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY غير مضبوط في Secrets");

  const systemPrompt = [
    "أنت مساعد يكتب ردود واتساب نيابة عن صاحب الحساب.",
    "اكتب الرد فقط بدون مقدمات أو علامات اقتباس أو شرح لعملية التفكير.",
    "لا تقل إنك ذكاء اصطناعي ولا تذكر أنك مساعد آلي.",
    "لا تخترع مواعيد أو أسعارًا أو وعودًا غير موجودة في المحادثة.",
    "إذا كان السؤال يحتاج معلومة غير متاحة، اطلب من الشخص توضيحًا أو قل إن صاحب الحساب سيراجع الأمر.",
    "لإرسال صورة من مكتبة الصور، أضف الكود وحده بهذا الشكل في الرد: [[IMAGE:CODE]]. لا تكتب هذا الكود للمستخدم ولا تغيّر حروفه.",
    `الشخصية: ${settings.personality || defaultWhatsAppAISettings.personality}`,
    `أسلوب الرد: ${settings.responseStyle || defaultWhatsAppAISettings.responseStyle}`,
    settings.customInstructions ? `تعليمات إضافية: ${settings.customInstructions}` : "",
    settings.caption
      ? `أضف هذا الكابشن/التوقيع في نهاية الرد مرة واحدة فقط: ${settings.caption}`
      : "",
  ].filter(Boolean).join("\n");

  const context = conversation
    .slice(-12)
    .map((message) => `${message.fromMe ? "صاحب الحساب" : contactName}: ${message.text}`)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 450,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            `اسم الشخص: ${contactName || "غير معروف"}`,
            context ? `سياق المحادثة:\n${context}` : "",
            `الرسالة الجديدة:\n${incomingText}`,
            "اكتب الرد المناسب الآن.",
          ].filter(Boolean).join("\n\n"),
        },
      ],
    }),
  });

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(data.error?.message || `فشل نموذج الذكاء الاصطناعي (${response.status})`);
  }

  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("نموذج الذكاء الاصطناعي لم يُرجع ردًا");
  return reply;
}