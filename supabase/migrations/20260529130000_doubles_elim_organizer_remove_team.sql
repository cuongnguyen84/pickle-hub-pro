-- ============================================================================
-- doubles_elim — Sprint E.4 organizer remove team
-- ----------------------------------------------------------------------------
-- 2026-05-29. Adds RPC organizer_remove_team_from_doubles_elimination so the
-- tournament creator can delete a registered team (e.g. wrong DUPR, duplicate
-- entry, ineligible player). Distinct from cancel_doubles_elimination_team_
-- registration which is self-service (caller must be on the team being
-- cancelled). The organizer endpoint requires creator_user_id match.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.organizer_remove_team_from_doubles_elimination(
  p_tournament_id uuid,
  p_team_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _t public.doubles_elimination_tournaments;
  _team_exists boolean;
  _deleted integer;
BEGIN
  IF _caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT * INTO _t FROM public.doubles_elimination_tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TOURNAMENT_NOT_FOUND');
  END IF;
  IF _t.creator_user_id <> _caller THEN
    RETURN json_build_object('success', false, 'error', 'NOT_OWNER');
  END IF;
  IF _t.status <> 'registration_open' THEN
    RETURN json_build_object('success', false, 'error', 'REGISTRATION_CLOSED', 'status', _t.status);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.doubles_elimination_teams
    WHERE id = p_team_id AND tournament_id = p_tournament_id
  ) INTO _team_exists;
  IF NOT _team_exists THEN
    RETURN json_build_object('success', false, 'error', 'TEAM_NOT_FOUND');
  END IF;

  DELETE FROM public.doubles_elimination_teams
  WHERE id = p_team_id AND tournament_id = p_tournament_id;
  GET DIAGNOSTICS _deleted = ROW_COUNT;

  RETURN json_build_object('success', true, 'deleted', _deleted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.organizer_remove_team_from_doubles_elimination(uuid, uuid) TO authenticated;
