-- ============================================================
-- 02_add_missing_columns.sql
-- إضافة الأعمدة الناقصة لجدول users
-- شغّل هذا الملف في Supabase SQL Editor
-- ============================================================

-- إضافة الأعمدة الناقصة إن لم تكن موجودة
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name          TEXT        NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role               TEXT        NOT NULL DEFAULT 'admin';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status             TEXT        NOT NULL DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone              TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ip_address         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by        UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- إضافة القيود إن لم تكن موجودة
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('super_admin', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- إنشاء الجداول الأخرى إن لم تكن موجودة
CREATE TABLE IF NOT EXISTS attendance (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in   TIMESTAMPTZ NOT NULL,
  check_out  TIMESTAMPTZ,
  date       DATE        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'present'
                         CHECK (status IN ('present', 'late', 'absent')),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shifts (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         DATE    NOT NULL,
  shift_number INTEGER NOT NULL CHECK (shift_number BETWEEN 1 AND 12),
  created_by   UUID    REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date, shift_number)
);

CREATE TABLE IF NOT EXISTS ratings (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment    TEXT,
  rated_by   UUID    REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warnings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  severity   TEXT NOT NULL DEFAULT 'low'
                  CHECK (severity IN ('low', 'medium', 'high')),
  reason     TEXT NOT NULL,
  issued_by  UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- تفعيل RLS
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE warnings    ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول الكامل
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_all' AND tablename = 'users') THEN
    CREATE POLICY "users_all" ON users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'attendance_all' AND tablename = 'attendance') THEN
    CREATE POLICY "attendance_all" ON attendance FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'shifts_all' AND tablename = 'shifts') THEN
    CREATE POLICY "shifts_all" ON shifts FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ratings_all' AND tablename = 'ratings') THEN
    CREATE POLICY "ratings_all" ON ratings FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'warnings_all' AND tablename = 'warnings') THEN
    CREATE POLICY "warnings_all" ON warnings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- تحديث cache
NOTIFY pgrst, 'reload schema';

-- التحقق من النتيجة
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
