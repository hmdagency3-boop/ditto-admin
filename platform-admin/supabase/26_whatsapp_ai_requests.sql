-- Queue shared by the website and the external AI server.
--
-- Flow:
--   1) The website inserts an incoming WhatsApp message as `pending`.
--   2) The external worker calls claim_whatsapp_ai_requests(...) and receives
--      leased rows with status `processing`.
--   3) The external worker writes `response` and changes status to `ready`.
--   4) The website sends the response to WhatsApp and changes status to `sent`.
--
-- The external worker can use the Supabase REST API or the SQL RPC below.
-- Never store API keys or other credentials in request, response, or context.

CREATE TABLE IF NOT EXISTS public.whatsapp_ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_name text NOT NULL DEFAULT 'default',

  -- WhatsApp message identity and destination.
  whatsapp_message_id text NOT NULL,
  chat_jid text NOT NULL,
  sender_name text,
  sender_phone text,
  message_timestamp bigint,
  message_type text NOT NULL DEFAULT 'text',

  -- Shared request/response payload.
  request text NOT NULL,
  response text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Queue state.
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'sending', 'sent', 'failed', 'ignored')),
  worker_id text,
  external_request_id text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,

  requested_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  responded_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT whatsapp_ai_requests_message_key
    UNIQUE (owner_id, session_name, whatsapp_message_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_ai_requests_pending_idx
  ON public.whatsapp_ai_requests (status, requested_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS whatsapp_ai_requests_ready_idx
  ON public.whatsapp_ai_requests (owner_id, status, requested_at)
  WHERE status IN ('ready', 'sending');

CREATE INDEX IF NOT EXISTS whatsapp_ai_requests_chat_idx
  ON public.whatsapp_ai_requests (owner_id, chat_jid, requested_at DESC);

ALTER TABLE public.whatsapp_ai_requests ENABLE ROW LEVEL SECURITY;

-- The application and the external worker use Supabase server-side access.
-- Keep this policy only if both services use the project's existing anon key.
-- Prefer a service-role key on the external worker in production.
DROP POLICY IF EXISTS "whatsapp ai requests server access" ON public.whatsapp_ai_requests;
CREATE POLICY "whatsapp ai requests server access"
  ON public.whatsapp_ai_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.whatsapp_ai_requests_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS whatsapp_ai_requests_updated_at
  ON public.whatsapp_ai_requests;
CREATE TRIGGER whatsapp_ai_requests_updated_at
  BEFORE UPDATE ON public.whatsapp_ai_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsapp_ai_requests_set_updated_at();

-- Atomically claim work for an external worker. A stale processing lease can
-- be reclaimed after p_lease_seconds, so a crashed worker does not block rows.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_ai_requests(
  p_worker_id text,
  p_limit integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 120
)
RETURNS SETOF public.whatsapp_ai_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.whatsapp_ai_requests
    WHERE status = 'pending'
       OR (
         status = 'processing'
         AND claimed_at IS NOT NULL
         AND claimed_at < now() - make_interval(secs => greatest(p_lease_seconds, 1))
       )
    ORDER BY requested_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(least(p_limit, 100), 1)
  )
  UPDATE public.whatsapp_ai_requests AS request_row
  SET status = 'processing',
      worker_id = p_worker_id,
      claimed_at = now(),
      attempts = request_row.attempts + 1,
      last_error = NULL,
      updated_at = now()
  FROM candidates
  WHERE request_row.id = candidates.id
  RETURNING request_row.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_whatsapp_ai_requests(text, integer, integer)
  TO anon, authenticated;

/*
External server example:

  -- 1) Claim:
  SELECT * FROM public.claim_whatsapp_ai_requests('my-ai-worker', 10, 120);

  -- 2) After generating the answer:
  UPDATE public.whatsapp_ai_requests
  SET response = 'النص الذي سيرسل إلى واتساب',
      status = 'ready',
      external_request_id = 'optional-id-from-worker',
      responded_at = now()
  WHERE id = 'REQUEST_UUID'
    AND status = 'processing'
    AND worker_id = 'my-ai-worker';

The response must be plain text. The website ignores rows with an empty
response, and it will only send rows in status `ready`.
*/