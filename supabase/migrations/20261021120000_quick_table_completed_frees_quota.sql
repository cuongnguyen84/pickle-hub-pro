-- Ending a quick table (status = completed) frees a slot in the shared
-- create quota. count_user_tournaments used to count every row the user
-- ever created, so "Kết thúc giải" could not make room for a new one.
-- Flex, doubles elimination and team match still count every row.
-- Apply this on production by hand; merging the PR does not run it.

CREATE OR REPLACE FUNCTION public.count_user_tournaments(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.quick_tables
      WHERE creator_user_id = _user_id AND status IS DISTINCT FROM 'completed')
    + (SELECT COUNT(*) FROM public.flex_tournaments WHERE creator_user_id = _user_id)
    + (SELECT COUNT(*) FROM public.doubles_elimination_tournaments WHERE creator_user_id = _user_id)
    + (SELECT COUNT(*) FROM public.team_match_tournaments WHERE created_by = _user_id)
$$;
