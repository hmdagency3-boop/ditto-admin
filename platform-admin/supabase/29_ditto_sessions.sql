-- Persistent Ditto center session credentials.
-- Credential values are encrypted by the application before storage.
-- The table keeps one shared Ditto session for the command center.

CREATE TABLE IF NOT EXISTS public.ditto_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name TEXT NOT NULL DEFAULT 'default',
  uid TEXT,
  access_token_enc TEXT,
  ticket_enc TEXT,
  ticket_saved_at BIGINT,
  access_token_saved_at BIGINT,
  net_ease_token_enc TEXT,
  device_id_enc TEXT,
  nim_app_key_enc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ditto_sessions_name_key UNIQUE (session_name)
);

CREATE INDEX IF NOT EXISTS ditto_sessions_name_idx
  ON public.ditto_sessions(session_name);

ALTER TABLE public.ditto_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ditto sessions server access" ON public.ditto_sessions;
CREATE POLICY "ditto sessions server access"
  ON public.ditto_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.ditto_sessions_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ditto_sessions_updated_at
  ON public.ditto_sessions;
CREATE TRIGGER ditto_sessions_updated_at
  BEFORE UPDATE ON public.ditto_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.ditto_sessions_set_updated_at();