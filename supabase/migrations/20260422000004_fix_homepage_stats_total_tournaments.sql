-- Fix: count total_tournaments across ALL tournament table types
-- Platform has multiple tournament formats each in its own table:
--   tournaments (Quick Table), doubles_elimination_tournaments,
--   flex_tournaments, team_match_tournaments, parent_tournaments
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
    (SELECT COUNT(*) FROM auth.users) AS total_users,
    (
      SELECT COUNT(*) FROM public.tournaments
    ) + (
      SELECT COUNT(*) FROM public.doubles_elimination_tournaments
    ) + (
      SELECT COUNT(*) FROM public.flex_tournaments
    ) + (
      SELECT COUNT(*) FROM public.team_match_tournaments
    ) + (
      SELECT COUNT(*) FROM public.parent_tournaments
    ) AS total_tournaments;
$$;

GRANT EXECUTE ON FUNCTION public.get_homepage_stats() TO anon, authenticated;
