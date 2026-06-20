-- =====================================================
-- جدول الملاحظات السرية على ملفات المشرفين
-- شغّل هذا الملف في Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS public.admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index للبحث السريع عن ملاحظات مشرف معين
CREATE INDEX IF NOT EXISTS idx_admin_notes_user_id ON public.admin_notes(user_id);

-- Row Level Security
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_notes_all" ON public.admin_notes FOR ALL USING (true) WITH CHECK (true);
