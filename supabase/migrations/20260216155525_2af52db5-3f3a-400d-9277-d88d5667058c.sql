-- Add vod_url column to livestreams for Ant Media VoD recordings
ALTER TABLE public.livestreams ADD COLUMN IF NOT EXISTS vod_url TEXT;

-- Recreate public_livestreams view with same column order + vod_url
DROP VIEW IF EXISTS public.public_livestreams;
CREATE VIEW public.public_livestreams AS
SELECT 
  id, title, description, status, 
  scheduled_start_at, started_at, ended_at, 
  thumbnail_url, 
  mux_playback_id, mux_asset_id, mux_asset_playback_id,
  organization_id, tournament_id, created_at,
  streaming_provider, hls_url, vod_url
FROM public.livestreams;