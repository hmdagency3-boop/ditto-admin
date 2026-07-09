-- Log of every room an admin has listened to / talked in, so it persists as a history/audit trail.
CREATE TABLE IF NOT EXISTS public.listen_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      TEXT NOT NULL,
  room_name    TEXT,
  cover        TEXT,
  host_uid     TEXT,
  host_nick    TEXT,
  erban_no     TEXT,
  country_code TEXT,
  action       TEXT NOT NULL DEFAULT 'listen' CHECK (action IN ('listen', 'talk')),
  listened_by  UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listen_history_created_at_idx ON public.listen_history (created_at DESC);

ALTER TABLE public.listen_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listen_history_all" ON public.listen_history FOR ALL USING (true) WITH CHECK (true);

SELECT 'listen_history table added' AS status;
