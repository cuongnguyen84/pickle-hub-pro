
-- Drop the view and recreate WITHOUT security_invoker so it runs as DEFINER (owner = postgres)
-- This means RLS on livestreams won't block the view, but the view itself excludes sensitive columns
DROP VIEW IF EXISTS public.public_livestreams;

CREATE VIEW public.public_livestreams AS
SELECT 
  id,
  title,
  description,
  status,
  scheduled_start_at,
  started_at,
  ended_at,
  thumbnail_url,
  mux_playback_id,
  mux_asset_id,
  mux_asset_playback_id,
  organization_id,
  tournament_id,
  created_at,
  streaming_provider,
  hls_url,
  vod_url
FROM public.livestreams;

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON public.public_livestreams TO anon, authenticated;
