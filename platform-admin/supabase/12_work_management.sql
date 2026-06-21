-- ═══════════════════════════════════════════════════════
-- 12: Work Management — Agencies + Supporters
-- ═══════════════════════════════════════════════════════
-- الخطوة 1: أنشئ الجداول لو مش موجودة

CREATE TABLE IF NOT EXISTS public.agencies (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status          TEXT NOT NULL DEFAULT 'activated' CHECK (status IN ('activated', 'opened')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supporters (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- الخطوة 2: أضف كل الأعمدة (IF NOT EXISTS يضمن عدم الخطأ لو موجودة)

ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS admin_id        UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS agent_id        TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS agency_name     TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS country         TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS agent_whatsapp  TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS source_platform TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS creation_date   DATE;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS opening_date    DATE;

ALTER TABLE public.supporters ADD COLUMN IF NOT EXISTS admin_id        UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.supporters ADD COLUMN IF NOT EXISTS supporter_id    TEXT;
ALTER TABLE public.supporters ADD COLUMN IF NOT EXISTS source_platform TEXT;
ALTER TABLE public.supporters ADD COLUMN IF NOT EXISTS level           TEXT;
ALTER TABLE public.supporters ADD COLUMN IF NOT EXISTS management      TEXT;

-- الخطوة 3: انسخ البيانات القديمة لو الأعمدة القديمة موجودة

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='agencies' AND column_name='code') THEN
    UPDATE public.agencies SET agent_id = code WHERE agent_id IS NULL AND code IS NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supporters' AND column_name='supporter_code') THEN
    UPDATE public.supporters SET supporter_id = supporter_code WHERE supporter_id IS NULL AND supporter_code IS NOT NULL;
  END IF;
END $$;

-- الخطوة 4: أنشئ الـ indexes بعد التأكد إن الأعمدة موجودة

CREATE INDEX IF NOT EXISTS agencies_admin_idx    ON public.agencies(admin_id);
CREATE INDEX IF NOT EXISTS agencies_created_idx  ON public.agencies(created_at);
CREATE INDEX IF NOT EXISTS supporters_admin_idx  ON public.supporters(admin_id);
CREATE INDEX IF NOT EXISTS supporters_created_idx ON public.supporters(created_at);

-- الخطوة 5: RLS policies

ALTER TABLE public.agencies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supporters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agencies_all"   ON public.agencies;
DROP POLICY IF EXISTS "supporters_all" ON public.supporters;

CREATE POLICY "agencies_all"   ON public.agencies   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "supporters_all" ON public.supporters FOR ALL USING (true) WITH CHECK (true);

-- تحقق
SELECT 'agencies'  AS tbl, count(*) FROM public.agencies
UNION ALL
SELECT 'supporters', count(*) FROM public.supporters;
