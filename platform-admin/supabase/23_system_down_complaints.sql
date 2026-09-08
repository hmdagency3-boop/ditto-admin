-- Complaints for users who need to be removed from the system.
CREATE TABLE IF NOT EXISTS public.system_down_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_code TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  host_id TEXT NOT NULL,
  host_phone TEXT NOT NULL,
  complaint_type TEXT NOT NULL,
  down_reason TEXT NOT NULL,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_down_complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_down_complaints_all"
  ON public.system_down_complaints;

CREATE POLICY "system_down_complaints_all"
  ON public.system_down_complaints
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS system_down_complaints_created_at_idx
  ON public.system_down_complaints(created_at DESC);

CREATE INDEX IF NOT EXISTS system_down_complaints_agency_idx
  ON public.system_down_complaints(agency_code);