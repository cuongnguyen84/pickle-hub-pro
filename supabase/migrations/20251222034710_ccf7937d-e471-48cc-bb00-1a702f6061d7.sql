-- Drop the security definer view and recreate as regular view with INVOKER security
DROP VIEW IF EXISTS public.public_livestreams;

-- Recreate view with SQL SECURITY INVOKER (which is the default, but being explicit)
CREATE VIEW public.public_livestreams 
WITH (security_invoker = true)
AS
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
FROM public.livestreams;

-- Grant access to the view
GRANT SELECT ON public.public_livestreams TO anon, authenticated;

-- Add comment explaining the view purpose
COMMENT ON VIEW public.public_livestreams IS 'Public view of livestreams that excludes sensitive mux_stream_key field. Uses SECURITY INVOKER to respect RLS policies.';