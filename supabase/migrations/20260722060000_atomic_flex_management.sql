-- Task 4 follow-up: server-owned Flex creation limits and standings-affecting
-- configuration. Client-provided counts and client-side delete/reinsert stats
-- are no longer authoritative.
--
-- Forward-only rollback reasoning: clients may be pointed back to direct CRUD
-- after dropping the four public RPCs and the limit triggers. Keep the helper
-- and score_version column; both are additive. Existing rows require no rewrite.

CREATE OR REPLACE FUNCTION public.rebuild_flex_group_stats_locked(
  p_group_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_include_doubles boolean;
BEGIN
  SELECT include_doubles_in_singles
  INTO v_include_doubles
  FROM public.flex_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'FLEX_GROUP_NOT_FOUND';
  END IF;

  DELETE FROM public.flex_player_stats WHERE group_id = p_group_id;
  DELETE FROM public.flex_pair_stats WHERE group_id = p_group_id;

  WITH group_players AS (
    SELECT gi.player_id
    FROM public.flex_group_items gi
    WHERE gi.group_id = p_group_id
      AND gi.item_type = 'player'
      AND gi.player_id IS NOT NULL
    UNION
    SELECT tm.player_id
    FROM public.flex_group_items gi
    JOIN public.flex_team_members tm ON tm.team_id = gi.team_id
    WHERE gi.group_id = p_group_id
      AND gi.item_type = 'team'
      AND gi.team_id IS NOT NULL
  ),
  match_players AS (
    SELECT m.winner_side, abs(m.score_a - m.score_b) AS diff,
           'a'::text AS side, m.slot_a1_player_id AS player_id
    FROM public.flex_matches m
    WHERE m.group_id = p_group_id
      AND m.counts_for_standings
      AND m.winner_side IS NOT NULL
      AND (m.match_type <> 'doubles' OR v_include_doubles)
    UNION ALL
    SELECT m.winner_side, abs(m.score_a - m.score_b),
           'a'::text, m.slot_a2_player_id
    FROM public.flex_matches m
    WHERE m.group_id = p_group_id
      AND m.counts_for_standings
      AND m.winner_side IS NOT NULL
      AND (m.match_type <> 'doubles' OR v_include_doubles)
    UNION ALL
    SELECT m.winner_side, abs(m.score_a - m.score_b),
           'b'::text, m.slot_b1_player_id
    FROM public.flex_matches m
    WHERE m.group_id = p_group_id
      AND m.counts_for_standings
      AND m.winner_side IS NOT NULL
      AND (m.match_type <> 'doubles' OR v_include_doubles)
    UNION ALL
    SELECT m.winner_side, abs(m.score_a - m.score_b),
           'b'::text, m.slot_b2_player_id
    FROM public.flex_matches m
    WHERE m.group_id = p_group_id
      AND m.counts_for_standings
      AND m.winner_side IS NOT NULL
      AND (m.match_type <> 'doubles' OR v_include_doubles)
  )
  INSERT INTO public.flex_player_stats (
    group_id, player_id, wins, losses, point_diff
  )
  SELECT
    p_group_id,
    mp.player_id,
    count(*) FILTER (WHERE mp.side = mp.winner_side)::integer,
    count(*) FILTER (WHERE mp.side <> mp.winner_side)::integer,
    sum(CASE WHEN mp.side = mp.winner_side THEN mp.diff ELSE -mp.diff END)::integer
  FROM match_players mp
  JOIN group_players gp ON gp.player_id = mp.player_id
  WHERE mp.player_id IS NOT NULL
  GROUP BY mp.player_id;

  WITH group_players AS (
    SELECT gi.player_id
    FROM public.flex_group_items gi
    WHERE gi.group_id = p_group_id
      AND gi.item_type = 'player'
      AND gi.player_id IS NOT NULL
    UNION
    SELECT tm.player_id
    FROM public.flex_group_items gi
    JOIN public.flex_team_members tm ON tm.team_id = gi.team_id
    WHERE gi.group_id = p_group_id
      AND gi.item_type = 'team'
      AND gi.team_id IS NOT NULL
  ),
  match_pairs AS (
    SELECT m.winner_side, abs(m.score_a - m.score_b) AS diff,
           'a'::text AS side,
           least(m.slot_a1_player_id, m.slot_a2_player_id) AS player1_id,
           greatest(m.slot_a1_player_id, m.slot_a2_player_id) AS player2_id
    FROM public.flex_matches m
    WHERE m.group_id = p_group_id
      AND m.match_type = 'doubles'
      AND m.counts_for_standings
      AND m.winner_side IS NOT NULL
      AND m.slot_a1_player_id IS NOT NULL
      AND m.slot_a2_player_id IS NOT NULL
    UNION ALL
    SELECT m.winner_side, abs(m.score_a - m.score_b),
           'b'::text,
           least(m.slot_b1_player_id, m.slot_b2_player_id),
           greatest(m.slot_b1_player_id, m.slot_b2_player_id)
    FROM public.flex_matches m
    WHERE m.group_id = p_group_id
      AND m.match_type = 'doubles'
      AND m.counts_for_standings
      AND m.winner_side IS NOT NULL
      AND m.slot_b1_player_id IS NOT NULL
      AND m.slot_b2_player_id IS NOT NULL
  )
  INSERT INTO public.flex_pair_stats (
    group_id, player1_id, player2_id, wins, losses, point_diff
  )
  SELECT
    p_group_id,
    mp.player1_id,
    mp.player2_id,
    count(*) FILTER (WHERE mp.side = mp.winner_side)::integer,
    count(*) FILTER (WHERE mp.side <> mp.winner_side)::integer,
    sum(CASE WHEN mp.side = mp.winner_side THEN mp.diff ELSE -mp.diff END)::integer
  FROM match_pairs mp
  WHERE EXISTS (
    SELECT 1
    FROM group_players gp
    WHERE gp.player_id IN (mp.player1_id, mp.player2_id)
  )
  GROUP BY mp.player1_id, mp.player2_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_flex_group_stats_locked(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rebuild_flex_group_stats_locked(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.rebuild_flex_group_stats_locked(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.create_flex_tournament_atomic(
  p_name text,
  p_is_public boolean,
  p_player_names jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_create json;
  v_tournament_id uuid;
  v_name text;
  v_player_count integer;
BEGIN
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  v_name := left(btrim(coalesce(p_name, '')), 100);
  IF v_name = '' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_NAME');
  END IF;

  IF jsonb_typeof(coalesce(p_player_names, 'null'::jsonb)) <> 'array' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_PLAYER_PAYLOAD');
  END IF;

  SELECT count(*)::integer
  INTO v_player_count
  FROM jsonb_array_elements_text(p_player_names) AS names(name)
  WHERE btrim(name) <> '';

  IF v_player_count > 200 THEN
    RETURN json_build_object('success', false, 'error', 'PLAYER_LIMIT', 'limit', 200);
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('flex-create-quota:' || v_caller::text, 0)
  );

  v_create := public.create_flex_tournament_with_quota(v_name, p_is_public);
  IF coalesce((v_create ->> 'success')::boolean, false) IS NOT TRUE THEN
    RETURN v_create;
  END IF;

  v_tournament_id := (v_create #>> '{tournament,id}')::uuid;

  INSERT INTO public.flex_players (tournament_id, name, display_order)
  SELECT
    v_tournament_id,
    left(btrim(value), 100),
    row_number() OVER (ORDER BY ordinality)::integer - 1
  FROM jsonb_array_elements_text(p_player_names) WITH ORDINALITY AS names(value, ordinality)
  WHERE btrim(value) <> '';

  INSERT INTO public.flex_groups (tournament_id, name, display_order)
  VALUES (v_tournament_id, 'Group A', 0);

  INSERT INTO public.flex_matches (
    tournament_id, name, match_type, display_order
  ) VALUES
    (v_tournament_id, 'Singles Match 1', 'singles', 0),
    (v_tournament_id, 'Doubles Match 1', 'doubles', 1);

  RETURN v_create;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'CREATE_FAILED', 'detail', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.create_flex_tournament_atomic(text, boolean, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_flex_tournament_atomic(text, boolean, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_flex_tournament_atomic(text, boolean, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_flex_entity_atomic(
  p_tournament_id uuid,
  p_entity_type text,
  p_name text,
  p_display_order integer,
  p_match_type text,
  p_group_id uuid,
  p_parent_match_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.flex_tournaments;
  v_count integer;
  v_name text;
  v_player public.flex_players;
  v_team public.flex_teams;
  v_group public.flex_groups;
  v_match public.flex_matches;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_t
  FROM public.flex_tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TOURNAMENT_NOT_FOUND');
  END IF;
  IF v_t.creator_user_id <> auth.uid() AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  v_name := left(btrim(coalesce(p_name, '')), 100);
  IF v_name = '' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_NAME');
  END IF;

  CASE p_entity_type
    WHEN 'player' THEN
      SELECT count(*)::integer INTO v_count
      FROM public.flex_players WHERE tournament_id = p_tournament_id;
      IF v_count >= 200 THEN
        RETURN json_build_object('success', false, 'error', 'PLAYER_LIMIT', 'limit', 200);
      END IF;
      INSERT INTO public.flex_players (tournament_id, name, display_order)
      VALUES (p_tournament_id, v_name, p_display_order)
      RETURNING * INTO v_player;
      RETURN json_build_object('success', true, 'entity', row_to_json(v_player), 'count', v_count + 1);

    WHEN 'team' THEN
      SELECT count(*)::integer INTO v_count
      FROM public.flex_teams WHERE tournament_id = p_tournament_id;
      IF v_count >= 20 THEN
        RETURN json_build_object('success', false, 'error', 'TEAM_LIMIT', 'limit', 20);
      END IF;
      INSERT INTO public.flex_teams (tournament_id, name, display_order)
      VALUES (p_tournament_id, v_name, p_display_order)
      RETURNING * INTO v_team;
      RETURN json_build_object('success', true, 'entity', row_to_json(v_team), 'count', v_count + 1);

    WHEN 'group' THEN
      SELECT count(*)::integer INTO v_count
      FROM public.flex_groups WHERE tournament_id = p_tournament_id;
      IF v_count >= 20 THEN
        RETURN json_build_object('success', false, 'error', 'GROUP_LIMIT', 'limit', 20);
      END IF;
      INSERT INTO public.flex_groups (tournament_id, name, display_order)
      VALUES (p_tournament_id, v_name, p_display_order)
      RETURNING * INTO v_group;
      RETURN json_build_object('success', true, 'entity', row_to_json(v_group), 'count', v_count + 1);

    WHEN 'match' THEN
      IF p_match_type NOT IN ('singles', 'doubles') THEN
        RETURN json_build_object('success', false, 'error', 'INVALID_MATCH_TYPE');
      END IF;

      IF p_group_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.flex_groups
        WHERE id = p_group_id AND tournament_id = p_tournament_id
      ) THEN
        RETURN json_build_object('success', false, 'error', 'GROUP_MISMATCH');
      END IF;
      IF p_parent_match_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.flex_matches
        WHERE id = p_parent_match_id AND tournament_id = p_tournament_id
      ) THEN
        RETURN json_build_object('success', false, 'error', 'PARENT_MISMATCH');
      END IF;

      SELECT count(*)::integer INTO v_count
      FROM public.flex_matches WHERE tournament_id = p_tournament_id;
      IF v_count >= 100 THEN
        RETURN json_build_object('success', false, 'error', 'MATCH_LIMIT', 'limit', 100);
      END IF;

      INSERT INTO public.flex_matches (
        tournament_id, name, match_type, group_id, display_order, parent_match_id
      ) VALUES (
        p_tournament_id, v_name, p_match_type, p_group_id,
        p_display_order, p_parent_match_id
      )
      RETURNING * INTO v_match;
      RETURN json_build_object('success', true, 'entity', row_to_json(v_match), 'count', v_count + 1);

    ELSE
      RETURN json_build_object('success', false, 'error', 'INVALID_ENTITY_TYPE');
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_flex_entity_atomic(uuid, text, text, integer, text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_flex_entity_atomic(uuid, text, text, integer, text, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_flex_entity_atomic(uuid, text, text, integer, text, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_flex_match_standings_atomic(
  p_match_id uuid,
  p_counts_for_standings boolean,
  p_group_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match public.flex_matches;
  v_current public.flex_matches;
  v_old_group_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_match
  FROM public.flex_matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'MATCH_NOT_FOUND');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.flex_tournaments t
    WHERE t.id = v_match.tournament_id
      AND (t.creator_user_id = auth.uid() OR public.is_admin())
  ) THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  IF p_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.flex_groups
    WHERE id = p_group_id AND tournament_id = v_match.tournament_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'GROUP_MISMATCH');
  END IF;

  v_old_group_id := v_match.group_id;

  -- Lock both affected groups in UUID order so concurrent moves cannot
  -- deadlock while each rebuilds the old and new standings snapshots.
  PERFORM id
  FROM public.flex_groups
  WHERE id IN (v_old_group_id, p_group_id)
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO v_current
  FROM public.flex_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_current.group_id IS DISTINCT FROM v_old_group_id THEN
    RETURN json_build_object('success', false, 'error', 'CONFIG_CONFLICT');
  END IF;

  UPDATE public.flex_matches
  SET counts_for_standings = p_counts_for_standings,
      group_id = p_group_id
  WHERE id = p_match_id;

  IF v_old_group_id IS NOT NULL THEN
    PERFORM public.rebuild_flex_group_stats_locked(v_old_group_id);
  END IF;
  IF p_group_id IS NOT NULL AND p_group_id IS DISTINCT FROM v_old_group_id THEN
    PERFORM public.rebuild_flex_group_stats_locked(p_group_id);
  END IF;

  RETURN json_build_object(
    'success', true,
    'old_group_id', v_old_group_id,
    'group_id', p_group_id,
    'counts_for_standings', p_counts_for_standings
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_flex_match_standings_atomic(uuid, boolean, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_flex_match_standings_atomic(uuid, boolean, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_flex_match_standings_atomic(uuid, boolean, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_flex_group_standings_atomic(
  p_group_id uuid,
  p_include_doubles boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group public.flex_groups;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_group
  FROM public.flex_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'GROUP_NOT_FOUND');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.flex_tournaments t
    WHERE t.id = v_group.tournament_id
      AND (t.creator_user_id = auth.uid() OR public.is_admin())
  ) THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  UPDATE public.flex_groups
  SET include_doubles_in_singles = p_include_doubles
  WHERE id = p_group_id;

  PERFORM public.rebuild_flex_group_stats_locked(p_group_id);

  RETURN json_build_object(
    'success', true,
    'group_id', p_group_id,
    'include_doubles_in_singles', p_include_doubles
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_flex_group_standings_atomic(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_flex_group_standings_atomic(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_flex_group_standings_atomic(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
