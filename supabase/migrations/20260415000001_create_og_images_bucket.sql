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

-- Allow anyone to read (public bucket)
CREATE POLICY IF NOT EXISTS "og_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'og-images');

-- Allow authenticated users to upload
CREATE POLICY IF NOT EXISTS "og_images_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'og-images');

-- Allow authenticated users to update/replace their uploads
CREATE POLICY IF NOT EXISTS "og_images_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'og-images');

-- Allow authenticated users to delete
CREATE POLICY IF NOT EXISTS "og_images_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'og-images');
