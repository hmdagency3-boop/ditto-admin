-- Temporary incoming images for the external WhatsApp AI worker.
-- Image bytes live in Supabase Storage; the queue context contains a
-- time-limited signed URL in context.incoming_images.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-ai-incoming',
  'whatsapp-ai-incoming',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "whatsapp ai incoming image objects server access" ON storage.objects;
CREATE POLICY "whatsapp ai incoming image objects server access"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'whatsapp-ai-incoming')
  WITH CHECK (bucket_id = 'whatsapp-ai-incoming');

/*
External worker contract:

  request.message_type = 'image'
  request.request = 'أرسل صورة بدون نص' or the image caption
  request.context.incoming_images = [
    {
      "image_url": "temporary signed URL",
      "mime_type": "image/jpeg",
      "file_name": "photo.jpg",
      "caption": "optional WhatsApp caption"
    }
  ]

Use image_url as a vision input to the model. The signed URL is valid for
two hours and the website removes the object after the reply is sent.
*/