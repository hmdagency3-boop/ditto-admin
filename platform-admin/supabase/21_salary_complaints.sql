-- Salary complaints submitted during the monthly 15th–17th window,
-- with audited urgent exceptions allowed outside the window.
CREATE TABLE IF NOT EXISTS public.salary_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_code TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  host_id TEXT NOT NULL,
  cash_number TEXT NOT NULL,
  host_phone TEXT NOT NULL,
  country TEXT NOT NULL,
  complaint_month TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  complaint_type TEXT NOT NULL,
  is_exceptional BOOLEAN NOT NULL DEFAULT FALSE,
  exceptional_reason TEXT,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.salary_complaints ENABLE ROW LEVEL SECURITY;

-- Keep this migration safe if the original table was already created.
ALTER TABLE public.salary_complaints
  ADD COLUMN IF NOT EXISTS is_exceptional BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.salary_complaints
  ADD COLUMN IF NOT EXISTS exceptional_reason TEXT;

CREATE POLICY "salary_complaints_all"
  ON public.salary_complaints
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS salary_complaints_month_idx
  ON public.salary_complaints(complaint_month);

CREATE INDEX IF NOT EXISTS salary_complaints_created_at_idx
  ON public.salary_complaints(created_at DESC);