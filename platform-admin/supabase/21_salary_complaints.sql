-- Salary complaints submitted during the monthly 15th–17th window
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
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.salary_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary_complaints_all"
  ON public.salary_complaints
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS salary_complaints_month_idx
  ON public.salary_complaints(complaint_month);

CREATE INDEX IF NOT EXISTS salary_complaints_created_at_idx
  ON public.salary_complaints(created_at DESC);