-- Add source column to videos table to distinguish storage vs mux
ALTER TABLE public.videos 
ADD COLUMN source text NOT NULL DEFAULT 'storage' CHECK (source IN ('storage', 'mux'));

-- Add storage_path column for file path in storage
ALTER TABLE public.videos 
ADD COLUMN storage_path text;

-- Create videos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos', 
  'videos', 
  true, 
  524288000, -- 500MB limit
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
);

-- Policy: Anyone can read published videos
CREATE POLICY "Public read access for published videos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'videos'
);

-- Policy: Creators can upload videos to their org folder
CREATE POLICY "Creators can upload videos to their org folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'videos' 
  AND (storage.foldername(name))[1] = 'org'
  AND (storage.foldername(name))[2] = (public.get_user_organization_id(auth.uid()))::text
  AND (public.is_creator() OR public.is_admin())
);

-- Policy: Creators can update videos in their org folder
CREATE POLICY "Creators can update videos in their org folder"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'videos' 
  AND (storage.foldername(name))[1] = 'org'
  AND (storage.foldername(name))[2] = (public.get_user_organization_id(auth.uid()))::text
  AND (public.is_creator() OR public.is_admin())
);

-- Policy: Creators can delete videos from their org folder
CREATE POLICY "Creators can delete videos from their org folder"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'videos' 
  AND (storage.foldername(name))[1] = 'org'
  AND (storage.foldername(name))[2] = (public.get_user_organization_id(auth.uid()))::text
  AND (public.is_creator() OR public.is_admin())
);

-- Update existing videos to have source='mux' if they have mux_playback_id
UPDATE public.videos 
SET source = 'mux' 
WHERE mux_playback_id IS NOT NULL;