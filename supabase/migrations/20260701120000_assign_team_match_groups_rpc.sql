-- ============================================================================
-- Atomic team→group assignment for MLP group setup.
-- ----------------------------------------------------------------------------
-- The client used to assign teams to groups with one awaited UPDATE per team
-- (24+ sequential round-trips from the browser). A single transient failure
-- left the draw half-applied (some groups filled, the rest empty, tournament
-- stuck in 'registration'). This does the whole assignment in ONE statement,
-- so it either fully applies or not at all.
--
-- SECURITY INVOKER → the caller's RLS still applies (the existing
-- "Captain or creator can update team" UPDATE policy governs every row).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_team_match_teams_to_groups(_pairs jsonb)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE public.team_match_teams t
  SET group_id = (p->>'group_id')::uuid
  FROM jsonb_array_elements(_pairs) p
  WHERE t.id = (p->>'team_id')::uuid;
$$;

GRANT EXECUTE ON FUNCTION public.assign_team_match_teams_to_groups(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
