-- Add platform_extra JSONB column to store additional profile data
-- (noble rank, VIP status, charm level, exp level, fans count, country)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS platform_extra JSONB DEFAULT '{}'::jsonb;
