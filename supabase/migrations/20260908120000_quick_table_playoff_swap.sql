-- Owner/admin can swap two players between first-round playoff matches that
-- have not started yet (fix a wrong bracket in the UI instead of via SQL).
-- Both matches must be pending, unscored, not live, and hold real players
-- (BYE walkovers are already completed so they are rejected by the status check).

CREATE OR REPLACE FUNCTION public.swap_quick_table_playoff_players(
  p_table_id uuid,
  p_match_a uuid,
  p_slot_a integer,
  p_match_b uuid,
  p_slot_b integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_table public.quick_tables;
  v_a public.quick_table_matches;
  v_b public.quick_table_matches;
  v_first_round integer;
  v_player_a uuid;
  v_player_b uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF p_slot_a NOT IN (1, 2) OR p_slot_b NOT IN (1, 2) THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_SLOT');
  END IF;
  IF p_match_a = p_match_b THEN
    RETURN json_build_object('success', false, 'error', 'SAME_MATCH');
  END IF;

  SELECT * INTO v_table FROM public.quick_tables WHERE id = p_table_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TABLE_NOT_FOUND');
  END IF;
  IF v_table.creator_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;
  IF v_table.status <> 'playoff' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

  SELECT min(playoff_round) INTO v_first_round
  FROM public.quick_table_matches
  WHERE table_id = p_table_id AND is_playoff;

  SELECT * INTO v_a FROM public.quick_table_matches
  WHERE id = p_match_a AND table_id = p_table_id AND is_playoff FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'MATCH_NOT_FOUND');
  END IF;
  SELECT * INTO v_b FROM public.quick_table_matches
  WHERE id = p_match_b AND table_id = p_table_id AND is_playoff FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'MATCH_NOT_FOUND');
  END IF;

  IF v_a.playoff_round IS DISTINCT FROM v_first_round
     OR v_b.playoff_round IS DISTINCT FROM v_first_round THEN
    RETURN json_build_object('success', false, 'error', 'NOT_FIRST_ROUND');
  END IF;
  IF v_a.status <> 'pending' OR v_b.status <> 'pending'
     OR v_a.score1 IS NOT NULL OR v_a.score2 IS NOT NULL OR v_a.winner_id IS NOT NULL
     OR v_b.score1 IS NOT NULL OR v_b.score2 IS NOT NULL OR v_b.winner_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'MATCH_ALREADY_SCORED');
  END IF;
  IF v_a.live_referee_id IS NOT NULL OR v_b.live_referee_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'MATCH_LIVE');
  END IF;

  v_player_a := CASE WHEN p_slot_a = 1 THEN v_a.player1_id ELSE v_a.player2_id END;
  v_player_b := CASE WHEN p_slot_b = 1 THEN v_b.player1_id ELSE v_b.player2_id END;
  IF v_player_a IS NULL OR v_player_b IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'EMPTY_SLOT');
  END IF;

  IF p_slot_a = 1 THEN
    UPDATE public.quick_table_matches SET player1_id = v_player_b WHERE id = p_match_a;
  ELSE
    UPDATE public.quick_table_matches SET player2_id = v_player_b WHERE id = p_match_a;
  END IF;
  IF p_slot_b = 1 THEN
    UPDATE public.quick_table_matches SET player1_id = v_player_a WHERE id = p_match_b;
  ELSE
    UPDATE public.quick_table_matches SET player2_id = v_player_a WHERE id = p_match_b;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.swap_quick_table_playoff_players(uuid, uuid, integer, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.swap_quick_table_playoff_players(uuid, uuid, integer, uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.swap_quick_table_playoff_players(uuid, uuid, integer, uuid, integer) TO authenticated;
