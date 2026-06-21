-- ═══════════════════════════════════════════════════════
-- 13: Fix agencies table schema
-- ═══════════════════════════════════════════════════════
-- المشكلة: الجدول كان موجوداً قبل migration 12،
-- فـ CREATE TABLE IF NOT EXISTS تجاهل الـ constraint الصحيحة.
-- الحل: إصلاح الـ constraint ومزامنة الأعمدة.

-- 1. إصلاح الـ status constraint
ALTER TABLE public.agencies
  DROP CONSTRAINT IF EXISTS agencies_status_check;

ALTER TABLE public.agencies
  ADD CONSTRAINT agencies_status_check
  CHECK (status IN ('activated', 'opened'));

-- 2. تأكد من وجود عمود agency_name
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS agency_name TEXT;

-- 3. لو الجدول عنده عمود "name" (NOT NULL قديم) — اجعله nullable ومزامنته مع agency_name
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'agencies'
      AND column_name  = 'name'
  ) THEN
    -- اجعل عمود name nullable عشان ما يكسرش الـ insert
    ALTER TABLE public.agencies ALTER COLUMN name DROP NOT NULL;
    -- مزامنة agency_name → name لأي صف فارغ
    UPDATE public.agencies SET name = agency_name WHERE name IS NULL AND agency_name IS NOT NULL;
    UPDATE public.agencies SET agency_name = name WHERE agency_name IS NULL AND name IS NOT NULL;
  END IF;
END $$;

-- 4. تأكد من باقي الأعمدة
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS admin_id        UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS agent_id        TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS country         TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS agent_whatsapp  TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS source_platform TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS creation_date   DATE;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS opening_date    DATE;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS notes           TEXT;

-- تحقق
SELECT conname, pg_get_constraintdef(oid)
FROM   pg_constraint
WHERE  conrelid = 'public.agencies'::regclass
  AND  contype  = 'c';
