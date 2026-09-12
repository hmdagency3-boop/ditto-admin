-- Image library for WhatsApp AI replies.
-- The database stores metadata and the object path; image bytes live in Supabase Storage.

CREATE TABLE IF NOT EXISTS public.whatsapp_ai_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  purpose text NOT NULL DEFAULT '',
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_ai_media_code_format CHECK (code ~ '^[A-Z0-9_-]{2,50}$'),
  CONSTRAINT whatsapp_ai_media_owner_code_key UNIQUE (owner_id, code)
);

CREATE INDEX IF NOT EXISTS whatsapp_ai_media_owner_active_idx
  ON public.whatsapp_ai_media (owner_id, active, code);

ALTER TABLE public.whatsapp_ai_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp ai media server access" ON public.whatsapp_ai_media;
CREATE POLICY "whatsapp ai media server access"
  ON public.whatsapp_ai_media
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.whatsapp_ai_media_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS whatsapp_ai_media_updated_at
  ON public.whatsapp_ai_media;
CREATE TRIGGER whatsapp_ai_media_updated_at
  BEFORE UPDATE ON public.whatsapp_ai_media
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsapp_ai_media_set_updated_at();

-- A private bucket keeps images inaccessible without the authenticated app API.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-ai-images',
  'whatsapp-ai-images',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "whatsapp ai image objects server access" ON storage.objects;
CREATE POLICY "whatsapp ai image objects server access"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'whatsapp-ai-images')
  WITH CHECK (bucket_id = 'whatsapp-ai-images');

-- Optional columns on the shared queue make the selected codes auditable.
ALTER TABLE public.whatsapp_ai_requests
  ADD COLUMN IF NOT EXISTS requested_media_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS response_media_codes text[] NOT NULL DEFAULT '{}';