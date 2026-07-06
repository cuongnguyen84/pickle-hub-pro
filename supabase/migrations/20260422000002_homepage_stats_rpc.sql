-- Public homepage stats — callable by anon + authenticated
-- Replay-safety (auto): drop prod-seeded overload before signature-changing refresh.
DROP FUNCTION IF EXISTS public.get_homepage_stats();

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
    (SELECT COUNT(*) FROM public.profiles)    AS total_users,
    (SELECT COUNT(*) FROM public.tournaments) AS total_tournaments;
$$;

GRANT EXECUTE ON FUNCTION public.get_homepage_stats() TO anon, authenticated;
