-- Create public og-images bucket for blog post cover images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'og-images',
  'og-images',
  true,
  2097152,  -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Storage policies for og-images bucket
-- PostgreSQL does not support `CREATE POLICY IF NOT EXISTS` — use the
-- DROP IF EXISTS + CREATE pattern for idempotency. Required by Supabase
-- Branch deploys which replay the migrations folder on a fresh DB.
-- ============================================================================

-- Allow anyone to read (public bucket)
DROP POLICY IF EXISTS "og_images_public_read" ON storage.objects;
CREATE POLICY "og_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'og-images');

-- Allow authenticated users to upload
DROP POLICY IF EXISTS "og_images_auth_insert" ON storage.objects;
CREATE POLICY "og_images_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'og-images');

-- Allow authenticated users to update/replace their uploads
DROP POLICY IF EXISTS "og_images_auth_update" ON storage.objects;
CREATE POLICY "og_images_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'og-images');

-- Allow authenticated users to delete
DROP POLICY IF EXISTS "og_images_auth_delete" ON storage.objects;
CREATE POLICY "og_images_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'og-images');
