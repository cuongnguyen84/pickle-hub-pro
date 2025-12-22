-- Create thumbnails storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for thumbnails bucket

-- Anyone can view thumbnails (public)
CREATE POLICY "Thumbnails are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');

-- Creators can upload thumbnails for their organization
CREATE POLICY "Creators can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'thumbnails' 
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin()
    OR (
      public.is_creator()
      AND (storage.foldername(name))[1] = 'org'
      AND (storage.foldername(name))[2] = public.get_user_organization_id(auth.uid())::text
    )
  )
);

-- Creators can update their org thumbnails
CREATE POLICY "Creators can update thumbnails"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'thumbnails' 
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin()
    OR (
      public.is_creator()
      AND (storage.foldername(name))[1] = 'org'
      AND (storage.foldername(name))[2] = public.get_user_organization_id(auth.uid())::text
    )
  )
);

-- Creators can delete their org thumbnails
CREATE POLICY "Creators can delete thumbnails"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'thumbnails' 
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin()
    OR (
      public.is_creator()
      AND (storage.foldername(name))[1] = 'org'
      AND (storage.foldername(name))[2] = public.get_user_organization_id(auth.uid())::text
    )
  )
);