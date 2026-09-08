-- Private storage for salary payment evidence.
-- The server returns short-lived signed URLs only to super admins.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'salary-payment-proofs',
  'salary-payment-proofs',
  false,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'];

DROP POLICY IF EXISTS "salary_payment_proofs_upload" ON storage.objects;
CREATE POLICY "salary_payment_proofs_upload"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'salary-payment-proofs');

DROP POLICY IF EXISTS "salary_payment_proofs_read" ON storage.objects;
CREATE POLICY "salary_payment_proofs_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'salary-payment-proofs');

DROP POLICY IF EXISTS "salary_payment_proofs_delete" ON storage.objects;
CREATE POLICY "salary_payment_proofs_delete"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'salary-payment-proofs');