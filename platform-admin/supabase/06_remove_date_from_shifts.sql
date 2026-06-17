-- ============================================================
-- 06_remove_date_from_shifts.sql
-- الشيفتات ثابتة أسبوعياً — إزالة عمود التاريخ
-- ============================================================

-- 1. إزالة القيود القديمة على الجدول
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_user_id_date_shift_number_key;
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_pkey CASCADE;

-- 2. إضافة primary key إذا لم تكن موجودة
ALTER TABLE public.shifts ADD PRIMARY KEY (id);

-- 3. حذف عمود التاريخ
ALTER TABLE public.shifts DROP COLUMN IF EXISTS date;

-- 4. قيد فريد: كل مشرف في شيفت واحد فقط
ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_user_id_shift_number_key;

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_user_id_shift_number_key
  UNIQUE (user_id, shift_number);

-- 5. التحقق من الجدول الجديد
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'shifts'
ORDER BY ordinal_position;
