-- Add the assistant role and per-user permissions.
-- Run this file in the Supabase SQL Editor.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'admin', 'assistant'));

UPDATE public.users
SET permissions = '[]'::jsonb
WHERE permissions IS NULL;