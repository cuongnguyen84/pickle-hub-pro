-- Drop existing view and recreate with SECURITY DEFINER
DROP VIEW IF EXISTS public_livestreams;

-- Create view with SECURITY DEFINER to allow public access
CREATE VIEW public_livestreams WITH (security_invoker = false) AS
SELECT 
  id,
  organization_id,
  title,
  description,
  mux_live_stream_id,
  mux_playback_id,
  status,
  scheduled_start_at,
  started_at,
  ended_at,
  tournament_id,
  thumbnail_url,
  created_at
FROM livestreams;

-- Grant SELECT on view to anon and authenticated roles
GRANT SELECT ON public_livestreams TO anon;
GRANT SELECT ON public_livestreams TO authenticated;