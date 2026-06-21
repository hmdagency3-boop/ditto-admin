-- ═══════════════════════════════════════════════════════
-- 12: Work Management (Agencies + Supporters)
-- ═══════════════════════════════════════════════════════

-- جدول الوكالات
CREATE TABLE IF NOT EXISTS public.agencies (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code        TEXT NOT NULL,
  admin_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'activated' CHECK (status IN ('activated', 'opened')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agencies_admin_idx ON public.agencies(admin_id);
CREATE INDEX IF NOT EXISTS agencies_created_idx ON public.agencies(created_at);

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agencies_all" ON public.agencies;
CREATE POLICY "agencies_all" ON public.agencies FOR ALL USING (true) WITH CHECK (true);

-- جدول الداعمين
CREATE TABLE IF NOT EXISTS public.supporters (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supporter_code TEXT NOT NULL,
  admin_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supporters_admin_idx ON public.supporters(admin_id);
CREATE INDEX IF NOT EXISTS supporters_created_idx ON public.supporters(created_at);

ALTER TABLE public.supporters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supporters_all" ON public.supporters;
CREATE POLICY "supporters_all" ON public.supporters FOR ALL USING (true) WITH CHECK (true);

-- تحقق
SELECT 'agencies' AS table_name, count(*) FROM public.agencies
UNION ALL
SELECT 'supporters', count(*) FROM public.supporters;
