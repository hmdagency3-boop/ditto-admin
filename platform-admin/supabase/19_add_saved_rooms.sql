-- ═══════════════════════════════════════════════════════
-- 19: Add saved_rooms table
-- لحفظ الرومات اللي المستخدم يختارها يدويًا، تفضل موجودة
-- حتى لو الروم اتقفل أو بقى فاضي (لأنها بتختفي من قايمة اللايف API)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.saved_rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      TEXT NOT NULL UNIQUE,
  room_name    TEXT,
  cover        TEXT,
  host_uid     TEXT,
  host_nick    TEXT,
  erban_no     TEXT,
  country_code TEXT,
  channel      TEXT DEFAULT '1',
  note         TEXT,
  saved_by     UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.saved_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_rooms_all" ON public.saved_rooms FOR ALL USING (true) WITH CHECK (true);

-- تحقق
SELECT 'saved_rooms table added' AS result;
