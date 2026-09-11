-- Per-account controls for WhatsApp's automatic AI replies.
CREATE TABLE IF NOT EXISTS public.whatsapp_ai_settings (
  owner_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  personality text NOT NULL DEFAULT 'ودود ومحترم ويتحدث بطريقة طبيعية',
  response_style text NOT NULL DEFAULT 'مختصر وواضح وبنفس لغة الشخص الذي يرسل الرسالة',
  caption text NOT NULL DEFAULT '',
  custom_instructions text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp ai settings server access" ON public.whatsapp_ai_settings;
CREATE POLICY "whatsapp ai settings server access"
  ON public.whatsapp_ai_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);