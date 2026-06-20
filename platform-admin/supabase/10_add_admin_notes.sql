-- Create admin_notes table (safe to re-run)
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notes_user_id ON public.admin_notes(user_id);

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_notes_all" ON public.admin_notes;
CREATE POLICY "admin_notes_all" ON public.admin_notes FOR ALL USING (true) WITH CHECK (true);
