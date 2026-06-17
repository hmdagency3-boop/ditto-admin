-- ============================================================
-- 02_rls_policies.sql
-- سياسات Row Level Security
-- شغّل هذا الملف بعد 01_create_tables.sql
-- ============================================================

-- تفعيل RLS على كل الجداول
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE warnings    ENABLE ROW LEVEL SECURITY;

-- ── سياسات جدول users ────────────────────────────────────────
-- السماح بالقراءة للجميع (السيرفر يتحقق بـ JWT)
CREATE POLICY "allow_all_users_select"
  ON users FOR SELECT USING (true);

CREATE POLICY "allow_all_users_insert"
  ON users FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_all_users_update"
  ON users FOR UPDATE USING (true);

CREATE POLICY "allow_all_users_delete"
  ON users FOR DELETE USING (true);

-- ── سياسات جدول attendance ────────────────────────────────────
CREATE POLICY "allow_all_attendance_select"
  ON attendance FOR SELECT USING (true);

CREATE POLICY "allow_all_attendance_insert"
  ON attendance FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_all_attendance_update"
  ON attendance FOR UPDATE USING (true);

CREATE POLICY "allow_all_attendance_delete"
  ON attendance FOR DELETE USING (true);

-- ── سياسات جدول shifts ────────────────────────────────────────
CREATE POLICY "allow_all_shifts_select"
  ON shifts FOR SELECT USING (true);

CREATE POLICY "allow_all_shifts_insert"
  ON shifts FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_all_shifts_delete"
  ON shifts FOR DELETE USING (true);

-- ── سياسات جدول ratings ───────────────────────────────────────
CREATE POLICY "allow_all_ratings_select"
  ON ratings FOR SELECT USING (true);

CREATE POLICY "allow_all_ratings_insert"
  ON ratings FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_all_ratings_delete"
  ON ratings FOR DELETE USING (true);

-- ── سياسات جدول warnings ──────────────────────────────────────
CREATE POLICY "allow_all_warnings_select"
  ON warnings FOR SELECT USING (true);

CREATE POLICY "allow_all_warnings_insert"
  ON warnings FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_all_warnings_delete"
  ON warnings FOR DELETE USING (true);
