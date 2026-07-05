-- ═══════════════════════════════════════════════════════
-- 18: Add agency_type column to agencies table
-- القيم المسموحة: 'voice' (صوتي) | 'live' (لايف) | NULL
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS agency_type TEXT
  CHECK (agency_type IN ('voice', 'live'));

-- تحقق
SELECT 'agency_type column added' AS result;
