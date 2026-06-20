-- ============================================================
-- 11_add_tasks_events.sql
-- إضافة جداول المهام والإيفنتات + Storage Bucket للصور
-- شغّل هذا الملف في Supabase SQL Editor
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- 1. جدول المهام (tasks)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tasks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  description TEXT,
  assigned_to UUID        REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  due_date    TIMESTAMPTZ,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'in_progress', 'completed')),
  priority    TEXT        NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low', 'medium', 'high')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON public.tasks(status);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_all" ON public.tasks;
CREATE POLICY "tasks_all" ON public.tasks FOR ALL USING (true) WITH CHECK (true);


-- ══════════════════════════════════════════════════════════════
-- 2. جدول الإيفنتات (events)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  description TEXT,
  color       TEXT        NOT NULL DEFAULT 'blue'
                          CHECK (color IN ('blue','green','purple','orange','red','yellow','pink')),
  image_url   TEXT,
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_by  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_active     ON public.events(is_active);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON public.events(start_date);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_all" ON public.events;
CREATE POLICY "events_all" ON public.events FOR ALL USING (true) WITH CHECK (true);


-- ══════════════════════════════════════════════════════════════
-- 3. إضافة عمود image_url لو الجدول موجود مسبقاً
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_url TEXT;


-- ══════════════════════════════════════════════════════════════
-- 4. Storage Bucket لصور الإيفنتات
-- ══════════════════════════════════════════════════════════════

-- إنشاء الـ bucket (public = يقدر أي أحد يشوف الصور)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images',
  true,
  5242880,   -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public            = true,
  file_size_limit   = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'];

-- سياسة رفع الصور (أي مستخدم authenticated أو anon يقدر يرفع)
DROP POLICY IF EXISTS "event_images_upload" ON storage.objects;
CREATE POLICY "event_images_upload"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'event-images');

-- سياسة قراءة الصور (عامة)
DROP POLICY IF EXISTS "event_images_read" ON storage.objects;
CREATE POLICY "event_images_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'event-images');

-- سياسة حذف الصور (super admin فقط — التحقق في السيرفر)
DROP POLICY IF EXISTS "event_images_delete" ON storage.objects;
CREATE POLICY "event_images_delete"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'event-images');


-- ══════════════════════════════════════════════════════════════
-- 5. التحقق من الإعداد
-- ══════════════════════════════════════════════════════════════

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('tasks', 'events')
ORDER BY table_name;
