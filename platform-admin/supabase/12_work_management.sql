-- ═══════════════════════════════════════════════════════
-- 12: Work Management (Agencies + Supporters) — Full Schema
-- ═══════════════════════════════════════════════════════

-- جدول الوكالات
CREATE TABLE IF NOT EXISTS public.agencies (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL,
  agency_name     TEXT,
  country         TEXT,
  agent_whatsapp  TEXT,
  source_platform TEXT,
  creation_date   DATE,
  opening_date    DATE,
  status          TEXT NOT NULL DEFAULT 'activated' CHECK (status IN ('activated', 'opened')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agencies_admin_idx   ON public.agencies(admin_id);
CREATE INDEX IF NOT EXISTS agencies_created_idx ON public.agencies(created_at);

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agencies_all" ON public.agencies;
CREATE POLICY "agencies_all" ON public.agencies FOR ALL USING (true) WITH CHECK (true);

-- ─── أضف الأعمدة الجديدة لو الجدول موجود مسبقاً (migration patch) ────────────
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS agent_id        TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS agency_name     TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS country         TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS agent_whatsapp  TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS source_platform TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS creation_date   DATE;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS opening_date    DATE;

-- انسخ البيانات القديمة من عمود 'code' إلى agent_id لو العمود موجود
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agencies' AND column_name = 'code'
  ) THEN
    UPDATE public.agencies SET agent_id = code WHERE agent_id IS NULL AND code IS NOT NULL;
  END IF;
END $$;

-- جدول الداعمين
CREATE TABLE IF NOT EXISTS public.supporters (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  supporter_id    TEXT NOT NULL,
  source_platform TEXT,
  level           TEXT,
  management      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supporters_admin_idx   ON public.supporters(admin_id);
CREATE INDEX IF NOT EXISTS supporters_created_idx ON public.supporters(created_at);

ALTER TABLE public.supporters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supporters_all" ON public.supporters;
CREATE POLICY "supporters_all" ON public.supporters FOR ALL USING (true) WITH CHECK (true);

-- ─── أضف الأعمدة الجديدة لو الجدول موجود مسبقاً ──────────────────────────────
ALTER TABLE public.supporters ADD COLUMN IF NOT EXISTS supporter_id    TEXT;
ALTER TABLE public.supporters ADD COLUMN IF NOT EXISTS source_platform TEXT;
ALTER TABLE public.supporters ADD COLUMN IF NOT EXISTS level           TEXT;
ALTER TABLE public.supporters ADD COLUMN IF NOT EXISTS management      TEXT;

-- انسخ البيانات القديمة من 'supporter_code' لو موجود
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'supporters' AND column_name = 'supporter_code'
  ) THEN
    UPDATE public.supporters SET supporter_id = supporter_code WHERE supporter_id IS NULL AND supporter_code IS NOT NULL;
  END IF;
END $$;

-- تحقق
SELECT 'agencies'  AS tbl, count(*) FROM public.agencies
UNION ALL
SELECT 'supporters', count(*) FROM public.supporters;
