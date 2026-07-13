-- Absences & Tardiness Management Table
-- Policy: 10005 Operations Rules
-- Note: users.id is VARCHAR (not UUID), so we use plain VARCHAR for FK columns

CREATE TABLE IF NOT EXISTS absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  date TEXT NOT NULL,
  shift_number INTEGER,
  type TEXT NOT NULL CHECK (type IN ('tardiness', 'absence', 'emergency')),
  tardiness_minutes INTEGER,
  excuse TEXT,
  has_proof BOOLEAN DEFAULT FALSE,
  coverage_admin_id VARCHAR,
  penalty TEXT NOT NULL CHECK (penalty IN (
    'verbal_warning','compensatory','compensatory_plus_30',
    'double_shift','return_shift','none'
  )),
  penalty_extra_minutes INTEGER DEFAULT 0,
  penalty_applied BOOLEAN DEFAULT FALSE,
  penalty_scheduled_date TEXT,
  monthly_violation_count INTEGER DEFAULT 1,
  notes TEXT,
  recorded_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all" ON absences
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS absences_user_id_idx ON absences(user_id);
CREATE INDEX IF NOT EXISTS absences_date_idx ON absences(date);
CREATE INDEX IF NOT EXISTS absences_type_idx ON absences(type);
