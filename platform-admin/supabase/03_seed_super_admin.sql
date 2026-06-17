-- ============================================================
-- 03_seed_super_admin.sql
-- إضافة حساب المسؤول الأول (super admin)
-- شغّل هذا الملف في Supabase SQL Editor
-- ============================================================

-- تفعيل امتداد pgcrypto لتشفير كلمة المرور
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- إضافة حساب super admin (يتجاهل إن كان موجوداً)
INSERT INTO public.users (
  id,
  username,
  password,
  full_name,
  role,
  status,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'admin',
  crypt('admin123', gen_salt('bf', 10)),
  'المسؤول الرئيسي',
  'super_admin',
  'approved',
  NOW(),
  NOW()
)
ON CONFLICT (username) DO NOTHING;

-- التحقق من الإضافة
SELECT id, username, full_name, role, status, created_at
FROM public.users
WHERE role = 'super_admin';
