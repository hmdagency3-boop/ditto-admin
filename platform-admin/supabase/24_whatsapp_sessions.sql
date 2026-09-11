-- WhatsApp sessions are owned by the platform user who linked them.
-- auth_blob is encrypted by the application before it is written.
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_name text NOT NULL DEFAULT 'default',
  phone_number text,
  status text NOT NULL DEFAULT 'disconnected',
  auth_blob text,
  last_connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_sessions_owner_session_key UNIQUE (owner_id, session_name)
);

CREATE INDEX IF NOT EXISTS whatsapp_sessions_owner_id_idx
  ON public.whatsapp_sessions(owner_id);

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp sessions server access" ON public.whatsapp_sessions;
CREATE POLICY "whatsapp sessions server access"
  ON public.whatsapp_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);