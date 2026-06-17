-- ============================================================
-- 07_add_platform_id.sql
-- إضافة عمود platform_id لربط كل أدمن بحسابه في المنصة
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS platform_id TEXT;

-- فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_users_platform_id ON public.users(platform_id);

-- التحقق
SELECT id, username, full_name, platform_id
FROM public.users
WHERE role = 'admin'
ORDER BY full_name;
