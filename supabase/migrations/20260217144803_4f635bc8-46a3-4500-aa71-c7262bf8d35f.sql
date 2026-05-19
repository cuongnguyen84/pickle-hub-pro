-- Fix: Recreate public_livestreams view with security_invoker = true
-- This ensures RLS policies of the querying user are enforced, not the view owner's
DROP VIEW IF EXISTS public_livestreams;

CREATE VIEW public_livestreams WITH (security_invoker = true) AS
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
FROM livestreams;