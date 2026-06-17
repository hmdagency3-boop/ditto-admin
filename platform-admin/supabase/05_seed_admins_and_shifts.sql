-- ============================================================
-- 05_seed_admins_and_shifts.sql
-- إضافة الأدمن وتعيين شيفتاتهم الثابتة
-- ملاحظة: شغّل 06_remove_date_from_shifts.sql أولاً
-- ============================================================
-- كلمة المرور الافتراضية: Admin123
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ══════════════════════════════════════════════════════════════
-- إضافة حسابات الأدمن
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.users (id, username, password, full_name, name, role, status, created_at, updated_at)
VALUES
  -- شيفت 4 (6-8 صباحاً)
  (gen_random_uuid(), 'ghazal',    crypt('Admin123', gen_salt('bf', 10)), 'غزل',        'غزل',        'admin', 'approved', NOW(), NOW()),

  -- شيفت 5 (8-10 صباحاً)
  (gen_random_uuid(), 'hams',      crypt('Admin123', gen_salt('bf', 10)), 'همس',        'همس',        'admin', 'approved', NOW(), NOW()),

  -- شيفت 6 (10-12 صباحاً)
  (gen_random_uuid(), 'farasha',   crypt('Admin123', gen_salt('bf', 10)), 'فراشة',      'فراشة',      'admin', 'approved', NOW(), NOW()),

  -- شيفت 7 (12-2 ظهراً)
  (gen_random_uuid(), 'amira',     crypt('Admin123', gen_salt('bf', 10)), 'أميرة',      'أميرة',      'admin', 'approved', NOW(), NOW()),
  (gen_random_uuid(), 'yazan',     crypt('Admin123', gen_salt('bf', 10)), 'يزن',        'يزن',        'admin', 'approved', NOW(), NOW()),

  -- شيفت 8 (2-4 عصراً)
  (gen_random_uuid(), 'nagham',    crypt('Admin123', gen_salt('bf', 10)), 'نغم',        'نغم',        'admin', 'approved', NOW(), NOW()),

  -- شيفت 9 (4-6 مساءً)
  (gen_random_uuid(), 'jowhara',   crypt('Admin123', gen_salt('bf', 10)), 'جوهرة شرق', 'جوهرة شرق', 'admin', 'approved', NOW(), NOW()),
  (gen_random_uuid(), 'samaka',    crypt('Admin123', gen_salt('bf', 10)), 'سمكة',       'سمكة',       'admin', 'approved', NOW(), NOW()),
  (gen_random_uuid(), 'muzika',    crypt('Admin123', gen_salt('bf', 10)), 'مزيكا',      'مزيكا',      'admin', 'approved', NOW(), NOW()),

  -- شيفت 10 (6-8 مساءً)
  (gen_random_uuid(), 'tota',      crypt('Admin123', gen_salt('bf', 10)), 'توتا',       'توتا',       'admin', 'approved', NOW(), NOW()),
  (gen_random_uuid(), 'ahmed',     crypt('Admin123', gen_salt('bf', 10)), 'أحمد',       'أحمد',       'admin', 'approved', NOW(), NOW()),

  -- شيفت 11 (8-10 مساءً)
  (gen_random_uuid(), 'warda',     crypt('Admin123', gen_salt('bf', 10)), 'وردة',       'وردة',       'admin', 'approved', NOW(), NOW()),
  (gen_random_uuid(), 'lolo',      crypt('Admin123', gen_salt('bf', 10)), 'لولو',       'لولو',       'admin', 'approved', NOW(), NOW()),

  -- شيفت 12 (10-12 ليلاً)
  (gen_random_uuid(), 'youssef',   crypt('Admin123', gen_salt('bf', 10)), 'يوسف',       'يوسف',       'admin', 'approved', NOW(), NOW()),

  -- شيفت 1 (12-2 ليلاً)
  (gen_random_uuid(), 'khuffash',  crypt('Admin123', gen_salt('bf', 10)), 'خفاش',       'خفاش',       'admin', 'approved', NOW(), NOW()),

  -- شيفت 2 (2-4 ليلاً)
  (gen_random_uuid(), 'russi',     crypt('Admin123', gen_salt('bf', 10)), 'روسي',       'روسي',       'admin', 'approved', NOW(), NOW()),

  -- شيفت 3 (4-6 صباحاً)
  (gen_random_uuid(), 'musa3deen', crypt('Admin123', gen_salt('bf', 10)), 'مساعدين',    'مساعدين',    'admin', 'approved', NOW(), NOW())

ON CONFLICT (username) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- تعيين الشيفتات الثابتة (بدون تاريخ)
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.shifts (id, user_id, shift_number, created_by)
SELECT
  gen_random_uuid(),
  u.id,
  s.shift_number,
  (SELECT id FROM public.users WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('ghazal',     4),
  ('hams',       5),
  ('farasha',    6),
  ('amira',      7),
  ('yazan',      7),
  ('nagham',     8),
  ('jowhara',    9),
  ('samaka',     9),
  ('muzika',     9),
  ('tota',      10),
  ('ahmed',     10),
  ('warda',     11),
  ('lolo',      11),
  ('youssef',   12),
  ('khuffash',   1),
  ('russi',      2),
  ('musa3deen',  3)
) AS s(username, shift_number)
JOIN public.users u ON u.username = s.username
ON CONFLICT (user_id, shift_number) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- التحقق
-- ══════════════════════════════════════════════════════════════
SELECT u.full_name, u.username, s.shift_number
FROM public.users u
JOIN public.shifts s ON s.user_id = u.id
WHERE u.role = 'admin'
ORDER BY s.shift_number;
