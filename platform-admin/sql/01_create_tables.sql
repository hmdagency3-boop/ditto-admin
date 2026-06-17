-- ============================================================
-- 01_create_tables.sql
-- إنشاء جداول قاعدة البيانات
-- ============================================================

-- ── جدول المستخدمين ──────────────────────────────────────────
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
  approved_by   UUID        REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── جدول الحضور ──────────────────────────────────────────────
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

-- ── جدول الشيفتات ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          DATE        NOT NULL,
  shift_number  INTEGER     NOT NULL CHECK (shift_number BETWEEN 1 AND 12),
  created_by    UUID        REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date, shift_number)
);

-- ── جدول التقييمات ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score         INTEGER     NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment       TEXT,
  rated_by      UUID        REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── جدول الإنذارات ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warnings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  severity      TEXT        NOT NULL DEFAULT 'low'
                            CHECK (severity IN ('low', 'medium', 'high')),
  reason        TEXT        NOT NULL,
  issued_by     UUID        REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
