-- ═══════════════════════════════════════════════════════
-- 14: Add period column to agencies and supporters
-- ═══════════════════════════════════════════════════════
-- المدة: 1 = الفترة الأولى (1-10)، 2 = الثانية (11-20)، 3 = الثالثة (21-آخر الشهر)

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS period INTEGER DEFAULT 1
  CHECK (period IN (1, 2, 3));

ALTER TABLE public.supporters
  ADD COLUMN IF NOT EXISTS period INTEGER DEFAULT 1
  CHECK (period IN (1, 2, 3));

-- مزامنة السجلات القديمة بناءً على تاريخ الإضافة
UPDATE public.agencies
SET period = CASE
  WHEN EXTRACT(DAY FROM created_at) <= 10 THEN 1
  WHEN EXTRACT(DAY FROM created_at) <= 20 THEN 2
  ELSE 3
END
WHERE period IS NULL;

UPDATE public.supporters
SET period = CASE
  WHEN EXTRACT(DAY FROM created_at) <= 10 THEN 1
  WHEN EXTRACT(DAY FROM created_at) <= 20 THEN 2
  ELSE 3
END
WHERE period IS NULL;

-- تحقق
SELECT 'agencies' AS tbl, period, count(*) FROM public.agencies GROUP BY period
UNION ALL
SELECT 'supporters', period, count(*) FROM public.supporters GROUP BY period
ORDER BY tbl, period;
