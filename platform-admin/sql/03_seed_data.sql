-- ============================================================
-- 03_seed_data.sql
-- بيانات تجريبية أولية
-- ⚠️ شغّل هذا الملف بعد 01_create_tables.sql فقط
-- ============================================================

-- ملاحظة: كلمة المرور admin123 مشفّرة بـ bcrypt (cost 10)
-- السيرفر بيعمل هذا تلقائياً عند أول تشغيل

-- يمكنك إضافة بيانات تجريبية يدوياً:

-- مثال: إضافة مشرف تجريبي (بعد موافقة super_admin)
-- INSERT INTO users (username, password, full_name, role, status)
-- VALUES (
--   '12345',
--   '$2a$10$EXAMPLE_HASHED_PASSWORD',  -- استبدل بـ hash حقيقي
--   'مشرف تجريبي',
--   'admin',
--   'approved'
-- );

-- ── التحقق من الإعداد ─────────────────────────────────────────
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = t.table_name AND table_schema = 'public') AS columns_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('users', 'attendance', 'shifts', 'ratings', 'warnings')
ORDER BY table_name;
