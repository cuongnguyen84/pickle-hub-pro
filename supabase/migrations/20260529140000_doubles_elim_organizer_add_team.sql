-- ============================================================================
-- doubles_elim — Sprint E.5 organizer add team manually
-- ----------------------------------------------------------------------------
-- 2026-05-29. Adds RPC organizer_add_team_to_doubles_elimination so the
-- creator can manually register a team on behalf of two players (e.g.
-- offline sign-up, ghost partner without DUPR account that the BTC vouches
-- for, etc.). Distinct from register_team_for_doubles_elimination which
-- requires the caller to BE one of the two players. The organizer endpoint
-- accepts arbitrary p1/p2 ids; still enforces capacity, dedupe per
-- tournament, DUPR presence (both), and the optional DUPR range gate.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.organizer_add_team_to_doubles_elimination(
  p_tournament_id uuid,
  p_player1_user_id uuid,
  p_player2_user_id uuid,
  p_team_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _t public.doubles_elimination_tournaments;
  _current_count integer;
  _r1 numeric;
  _r2 numeric;
  _approx1 boolean;
  _approx2 boolean;
  _avg numeric;
  _seed_src text;
  _p1_name text;
  _p2_name text;
  _team_display text;
  _new_team_id uuid;
BEGIN
  IF _caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF p_player1_user_id IS NULL OR p_player2_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_PLAYERS');
  END IF;
  IF p_player1_user_id = p_player2_user_id THEN
    RETURN json_build_object('success', false, 'error', 'SAME_PLAYER');
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

  SELECT count(*) INTO _current_count
  FROM public.doubles_elimination_teams
  WHERE tournament_id = p_tournament_id;
  IF _current_count >= _t.team_count THEN
    RETURN json_build_object('success', false, 'error', 'TOURNAMENT_FULL',
      'count', _current_count, 'capacity', _t.team_count);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.doubles_elimination_teams
    WHERE tournament_id = p_tournament_id
      AND (player1_user_id IN (p_player1_user_id, p_player2_user_id)
        OR player2_user_id IN (p_player1_user_id, p_player2_user_id))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'ALREADY_REGISTERED');
  END IF;

  SELECT rating, is_approx INTO _r1, _approx1 FROM public.dupr_doubles_with_fallback(p_player1_user_id);
  SELECT rating, is_approx INTO _r2, _approx2 FROM public.dupr_doubles_with_fallback(p_player2_user_id);
  SELECT COALESCE(display_name, username, 'Player') INTO _p1_name FROM public.profiles WHERE id = p_player1_user_id;
  SELECT COALESCE(display_name, username, 'Player') INTO _p2_name FROM public.profiles WHERE id = p_player2_user_id;

  IF _r1 IS NULL OR _r2 IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'MISSING_DUPR',
      'player1_has_dupr', _r1 IS NOT NULL,
      'player2_has_dupr', _r2 IS NOT NULL);
  END IF;

  _avg := round(((_r1 + _r2) / 2)::numeric, 2);
  _seed_src := CASE WHEN _approx1 OR _approx2 THEN 'approx' ELSE 'exact' END;

  IF _t.min_dupr_rating IS NOT NULL AND _avg < _t.min_dupr_rating THEN
    RETURN json_build_object('success', false, 'error', 'OUT_OF_RANGE',
      'dupr_avg', _avg, 'min', _t.min_dupr_rating, 'max', _t.max_dupr_rating);
  END IF;
  IF _t.max_dupr_rating IS NOT NULL AND _avg > _t.max_dupr_rating THEN
    RETURN json_build_object('success', false, 'error', 'OUT_OF_RANGE',
      'dupr_avg', _avg, 'min', _t.min_dupr_rating, 'max', _t.max_dupr_rating);
  END IF;

  _team_display := COALESCE(NULLIF(trim(p_team_name), ''), _p1_name || ' / ' || _p2_name);

  INSERT INTO public.doubles_elimination_teams (
    tournament_id, team_name, player1_name, player2_name,
    player1_user_id, player2_user_id,
    dupr_avg_rating, dupr_seed_source
  ) VALUES (
    p_tournament_id, _team_display, _p1_name, _p2_name,
    p_player1_user_id, p_player2_user_id,
    _avg, _seed_src
  )
  RETURNING id INTO _new_team_id;

  RETURN json_build_object('success', true, 'team_id', _new_team_id,
    'dupr_avg', _avg, 'seed_source', _seed_src,
    'count', _current_count + 1, 'capacity', _t.team_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.organizer_add_team_to_doubles_elimination(uuid, uuid, uuid, text) TO authenticated;
