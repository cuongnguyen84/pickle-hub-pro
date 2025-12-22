-- Create a view for public livestream data that excludes sensitive fields
CREATE OR REPLACE VIEW public.public_livestreams AS
SELECT 
  id,
  organization_id,
  title,
  description,
  mux_live_stream_id,
  mux_playback_id,
  -- mux_stream_key is intentionally excluded for security
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

-- Add comment explaining the view purpose
COMMENT ON VIEW public.public_livestreams IS 'Public view of livestreams that excludes sensitive mux_stream_key field';