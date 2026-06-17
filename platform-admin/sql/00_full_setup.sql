-- ============================================================
-- 00_full_setup.sql
-- الإعداد الكامل دفعة واحدة
-- شغّل هذا الملف في Supabase SQL Editor
-- ============================================================
-- الترتيب:
-- 1. إنشاء الجداول
-- 2. الفهارس
-- 3. سياسات RLS
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- الجزء 1: إنشاء الجداول
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT        UNIQUE NOT NULL,
  password      TEXT        NOT NULL,
  full_name     TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'admin'
                            CHECK (role IN ('super_admin', 'admin')),
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected')),
  phone         TEXT,
  avatar_url    TEXT,
  device_fingerprint TEXT,
  ip_address    TEXT,
  approved_by   UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in      TIMESTAMPTZ NOT NULL,
  check_out     TIMESTAMPTZ,
  date          DATE        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'present'
                            CHECK (status IN ('present', 'late', 'absent')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shifts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          DATE        NOT NULL,
  shift_number  INTEGER     NOT NULL CHECK (shift_number BETWEEN 1 AND 12),
  created_by    UUID        REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date, shift_number)
);

CREATE TABLE IF NOT EXISTS ratings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score         INTEGER     NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment       TEXT,
  rated_by      UUID        REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warnings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  severity      TEXT        NOT NULL DEFAULT 'low'
                            CHECK (severity IN ('low', 'medium', 'high')),
  reason        TEXT        NOT NULL,
  issued_by     UUID        REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- الجزء 2: الفهارس
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_users_username       ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_status         ON users (status);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date      ON attendance (date DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_date_number   ON shifts (date, shift_number);
CREATE INDEX IF NOT EXISTS idx_ratings_user_id      ON ratings (user_id);
CREATE INDEX IF NOT EXISTS idx_warnings_user_id     ON warnings (user_id);

-- ══════════════════════════════════════════════════════════════
-- الجزء 3: سياسات RLS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE warnings    ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "users_all" ON users FOR ALL USING (true) WITH CHECK (true);

-- attendance
CREATE POLICY "attendance_all" ON attendance FOR ALL USING (true) WITH CHECK (true);

-- shifts
CREATE POLICY "shifts_all" ON shifts FOR ALL USING (true) WITH CHECK (true);

-- ratings
CREATE POLICY "ratings_all" ON ratings FOR ALL USING (true) WITH CHECK (true);

-- warnings
CREATE POLICY "warnings_all" ON warnings FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- التحقق من الإعداد
-- ══════════════════════════════════════════════════════════════

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users','attendance','shifts','ratings','warnings')
ORDER BY table_name;
