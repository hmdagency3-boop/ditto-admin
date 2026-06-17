-- ============================================================
-- 04_add_username_password.sql
-- إضافة عمودي username و password للجدول الموجود
-- ============================================================

-- إضافة العمودين الناقصين
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;

-- تحديث cache
NOTIFY pgrst, 'reload schema';

-- التحقق
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;
