-- =====================================================
-- جدول الملاحظات السرية على ملفات المشرفين
-- شغّل هذا الملف في Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index للبحث السريع عن ملاحظات مشرف معين
CREATE INDEX IF NOT EXISTS idx_admin_notes_user_id ON admin_notes(user_id);

-- Row Level Security — السوبر أدمن فقط يرى ويكتب
ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;

-- السماح لأي شخص مسجّل دخول بالقراءة والكتابة
-- (الحماية الحقيقية على مستوى API في السيرفر)
CREATE POLICY "allow_all_for_authenticated" ON admin_notes
  FOR ALL
  USING (true)
  WITH CHECK (true);
