-- QA/QC Fix Security Definer Views v3
-- Convert SECURITY DEFINER views to SECURITY INVOKER

-- ================================================
-- FIX: Convert public_livestreams to SECURITY INVOKER
-- ================================================
DROP VIEW IF EXISTS public.public_livestreams;

-- Recreate without security definer (default is SECURITY INVOKER)
CREATE VIEW public.public_livestreams 
WITH (security_invoker = true)
AS
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
  created_at
FROM public.livestreams;

GRANT SELECT ON public.public_livestreams TO anon, authenticated;

-- ================================================
-- FIX: Convert public_profiles to SECURITY INVOKER
-- ================================================
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT 
  id,
  display_name,
  avatar_url,
  organization_id,
  created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Add RLS policy for anon to read profiles basic info
CREATE POLICY "Anon can view basic profile info"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (true);

-- ================================================
-- Comments for documentation
-- ================================================
COMMENT ON VIEW public.public_livestreams IS 'SECURITY INVOKER view of livestreams excluding sensitive mux_stream_key. Respects RLS of querying user.';
COMMENT ON VIEW public.public_profiles IS 'SECURITY INVOKER view of profiles excluding email. Respects RLS of querying user.';