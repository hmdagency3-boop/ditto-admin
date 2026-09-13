-- ============================================================
-- 30_fixed_salary_shifts.sql
-- مجموعات الشيفتات ذات الراتب الشهري الثابت
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fixed_salary_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  girl_one_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  girl_two_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  girl_one_shift INTEGER NOT NULL CHECK (girl_one_shift BETWEEN 1 AND 12),
  girl_two_shift INTEGER NOT NULL CHECK (girl_two_shift BETWEEN 1 AND 12),
  shared_shift INTEGER NOT NULL CHECK (shared_shift BETWEEN 1 AND 12),
  girl_one_salary NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (girl_one_salary >= 0),
  girl_two_salary NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (girl_two_salary >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fixed_salary_different_users CHECK (girl_one_id <> girl_two_id),
  CONSTRAINT fixed_salary_different_shifts CHECK (
    girl_one_shift <> girl_two_shift
    AND girl_one_shift <> shared_shift
    AND girl_two_shift <> shared_shift
  )
);

ALTER TABLE public.attendance
  ALTER COLUMN check_in DROP NOT NULL;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS shift_number INTEGER,
  ADD COLUMN IF NOT EXISTS scheduled_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS late_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fixed_salary_group_id UUID REFERENCES public.fixed_salary_groups(id) ON DELETE SET NULL;

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_shift_number_check;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_shift_number_check
  CHECK (shift_number IS NULL OR shift_number BETWEEN 1 AND 12);

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_scheduled_minutes_check;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_scheduled_minutes_check
  CHECK (scheduled_minutes IS NULL OR scheduled_minutes IN (60, 120));

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_late_minutes_check;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_late_minutes_check
  CHECK (late_minutes >= 0);

CREATE INDEX IF NOT EXISTS idx_fixed_salary_groups_active
  ON public.fixed_salary_groups(active);

CREATE INDEX IF NOT EXISTS idx_attendance_fixed_salary
  ON public.attendance(fixed_salary_group_id, date, user_id, shift_number);

ALTER TABLE public.fixed_salary_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fixed_salary_groups_server_access" ON public.fixed_salary_groups;
CREATE POLICY "fixed_salary_groups_server_access"
  ON public.fixed_salary_groups
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS fixed_salary_groups_updated_at ON public.fixed_salary_groups;
CREATE OR REPLACE FUNCTION public.fixed_salary_groups_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER fixed_salary_groups_updated_at
  BEFORE UPDATE ON public.fixed_salary_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.fixed_salary_groups_set_updated_at();

-- تسمح بحفظ مسودة ناقصة واستكمالها لاحقاً من شاشة الشيفتات.
ALTER TABLE public.fixed_salary_groups
  ALTER COLUMN girl_one_id DROP NOT NULL,
  ALTER COLUMN girl_two_id DROP NOT NULL,
  ALTER COLUMN girl_one_shift DROP NOT NULL,
  ALTER COLUMN girl_two_shift DROP NOT NULL,
  ALTER COLUMN shared_shift DROP NOT NULL,
  ALTER COLUMN girl_one_salary DROP NOT NULL,
  ALTER COLUMN girl_two_salary DROP NOT NULL;