import { storage } from "./storage";

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