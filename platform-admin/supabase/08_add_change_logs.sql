-- Add platform tracking columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS platform_uid TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS platform_nick TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS platform_avatar TEXT;

-- Create change_logs table
CREATE TABLE IF NOT EXISTS public.change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  user_full_name TEXT NOT NULL DEFAULT '',
  change_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_logs_user_id ON public.change_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_detected_at ON public.change_logs(detected_at DESC);
