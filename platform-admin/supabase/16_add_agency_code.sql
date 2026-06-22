-- Add agency_code column to agencies table
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS agency_code TEXT DEFAULT NULL;
