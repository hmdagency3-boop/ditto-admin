-- Add photo URL columns to agencies and supporters
ALTER TABLE agencies   ADD COLUMN IF NOT EXISTS agent_photo     TEXT DEFAULT NULL;
ALTER TABLE supporters ADD COLUMN IF NOT EXISTS supporter_photo TEXT DEFAULT NULL;
