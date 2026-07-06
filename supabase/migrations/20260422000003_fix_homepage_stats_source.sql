-- Fix: count total_users from auth.users (authoritative) not public.profiles
-- profiles can be missing for some auth accounts (trigger failures, etc.)
CREATE OR REPLACE FUNCTION public.get_homepage_stats()
RETURNS TABLE (
  total_users bigint,
  total_tournaments bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM auth.users)        AS total_users,
    (SELECT COUNT(*) FROM public.tournaments) AS total_tournaments;
$$;

GRANT EXECUTE ON FUNCTION public.get_homepage_stats() TO anon, authenticated;
