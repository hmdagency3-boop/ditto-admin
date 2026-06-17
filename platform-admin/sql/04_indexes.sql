-- ============================================================
-- 04_indexes.sql
-- فهارس لتحسين أداء الاستعلامات
-- شغّل بعد 01_create_tables.sql
-- ============================================================

-- ── فهارس users ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_status   ON users (status);

-- ── فهارس attendance ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance (user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date    ON attendance (date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_status  ON attendance (status);
-- فهرس مركّب لاستعلامات اليوم/الأسبوع
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance (user_id, date DESC);

-- ── فهارس shifts ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts (user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date    ON shifts (date);
CREATE INDEX IF NOT EXISTS idx_shifts_date_number ON shifts (date, shift_number);

-- ── فهارس ratings ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON ratings (user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_score   ON ratings (score);

-- ── فهارس warnings ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_warnings_user_id  ON warnings (user_id);
CREATE INDEX IF NOT EXISTS idx_warnings_severity ON warnings (severity);
