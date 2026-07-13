-- Absences & Tardiness Management Table
-- Policy: 10005 Operations Rules

CREATE TABLE IF NOT EXISTS absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- When & Which shift
  date TEXT NOT NULL,                        -- YYYY-MM-DD
  shift_number INTEGER,                      -- 1-12, which shift was affected

  -- Type of violation
  type TEXT NOT NULL CHECK (type IN ('tardiness', 'absence', 'emergency')),
  -- tardiness  → late to shift
  -- absence    → full no-show without excuse
  -- emergency  → absence with valid excuse

  -- Tardiness details
  tardiness_minutes INTEGER,                 -- only for type='tardiness'

  -- Emergency details
  excuse TEXT,                               -- only for type='emergency'
  has_proof BOOLEAN DEFAULT FALSE,           -- did they submit proof?
  coverage_admin_id VARCHAR REFERENCES users(id), -- who covered the shift

  -- Penalty (auto or manually set)
  penalty TEXT NOT NULL CHECK (penalty IN (
    'verbal_warning',        -- tardiness < 15 min
    'compensatory',          -- tardiness > 15 min: same duration added on top
    'compensatory_plus_30',  -- 2nd tardiness same week: + 30 extra minutes
    'double_shift',          -- full absence: must compensate + extra shift
    'return_shift',          -- emergency: must return shift to coverage admin
    'none'                   -- no penalty (used for emergencies with valid proof)
  )),
  penalty_extra_minutes INTEGER DEFAULT 0,   -- for compensatory calculations
  penalty_applied BOOLEAN DEFAULT FALSE,     -- has the penalty been executed?
  penalty_scheduled_date TEXT,               -- when penalty shift is scheduled

  -- Violation count tracking (for threshold checks)
  monthly_violation_count INTEGER DEFAULT 1, -- violations in current month

  -- Meta
  notes TEXT,
  recorded_by VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "super_admin_all" ON absences
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS absences_user_id_idx ON absences(user_id);
CREATE INDEX IF NOT EXISTS absences_date_idx ON absences(date);
CREATE INDEX IF NOT EXISTS absences_type_idx ON absences(type);
