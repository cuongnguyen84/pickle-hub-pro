-- Add columns to store Mux asset information for replay
ALTER TABLE public.livestreams 
ADD COLUMN IF NOT EXISTS mux_asset_id TEXT,
ADD COLUMN IF NOT EXISTS mux_asset_playback_id TEXT;

-- Drop and recreate the public_livestreams view with new columns
DROP VIEW IF EXISTS public.public_livestreams;

CREATE VIEW public.public_livestreams AS
SELECT 
  id,
  organization_id,
  title,
  description,
  mux_playback_id,
  mux_asset_playback_id,
  status,
  scheduled_start_at,
  started_at,
  ended_at,
  tournament_id,
  thumbnail_url,
  created_at
FROM public.livestreams;

-- Grant access to the view
GRANT SELECT ON public.public_livestreams TO anon, authenticated;