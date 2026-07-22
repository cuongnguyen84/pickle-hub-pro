-- Task 4: Team Match game scoring, match aggregation, playoff seating and game
-- seeding are one business mutation. The previous check-then-insert path was
-- protected from duplicates by a UNIQUE constraint, but could still fail or
-- leave match/advancement writes split across requests.
--
-- Forward-only rollback: old clients can coexist with these additive RPCs and
-- score_version. Roll clients back first; only then revoke/drop the RPCs. The
-- column and slot uniqueness constraint remain safe to keep permanently.

ALTER TABLE public.team_match_games
  ADD COLUMN IF NOT EXISTS score_version bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.team_match_games.score_version IS
  'Optimistic concurrency token incremented by score_team_match_games_atomic.';

-- Internal helper. Callers must hold the tournament/match lifecycle lock and
-- perform authorization before invoking it.
CREATE OR REPLACE FUNCTION public.seed_team_match_games_locked(p_match_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tournament_id uuid;
  v_team_a_id uuid;
  v_team_b_id uuid;
  v_has_dreambreaker boolean;
  v_template_count integer;
  v_created integer := 0;
  v_regular_created integer := 0;
BEGIN
  SELECT m.tournament_id, m.team_a_id, m.team_b_id, t.has_dreambreaker
  INTO v_tournament_id, v_team_a_id, v_team_b_id, v_has_dreambreaker
  FROM public.team_match_matches m
  JOIN public.team_match_tournaments t ON t.id = m.tournament_id
  WHERE m.id = p_match_id;

  IF NOT FOUND OR v_team_a_id IS NULL OR v_team_b_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT count(*)::integer INTO v_template_count
  FROM public.team_match_game_templates
  WHERE tournament_id = v_tournament_id;
  IF v_template_count = 0 THEN
    RETURN 0;
  END IF;

  WITH templates AS (
    SELECT game_type,
           scoring_type,
           display_name,
           row_number() OVER (ORDER BY order_index, id)::integer - 1 AS slot
    FROM public.team_match_game_templates
    WHERE tournament_id = v_tournament_id
  )
  INSERT INTO public.team_match_games (
    match_id, order_index, game_type, scoring_type, display_name,
    is_dreambreaker, score_a, score_b, status
  )
  SELECT p_match_id, slot, game_type, scoring_type, display_name,
         false, 0, 0, 'pending'
  FROM templates
  ON CONFLICT (match_id, order_index) DO NOTHING;
  GET DIAGNOSTICS v_regular_created = ROW_COUNT;
  v_created := v_regular_created;

  IF COALESCE(v_has_dreambreaker, false) AND v_template_count % 2 = 0 THEN
    INSERT INTO public.team_match_games (
      match_id, order_index, game_type, scoring_type, display_name,
      is_dreambreaker, score_a, score_b, status
    ) VALUES (
      p_match_id, v_template_count, 'MS', 'rally21', 'Dreambreaker',
      true, 0, 0, 'pending'
    )
    ON CONFLICT (match_id, order_index) DO NOTHING;
    GET DIAGNOSTICS v_regular_created = ROW_COUNT;
    v_created := v_created + v_regular_created;
  END IF;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_team_match_games_locked(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_team_match_games_locked(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.seed_team_match_games_locked(uuid) FROM authenticated;


CREATE OR REPLACE FUNCTION public.ensure_team_match_games_atomic(p_match_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match public.team_match_matches;
  v_tournament_id uuid;
  v_created integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT tournament_id INTO v_tournament_id
  FROM public.team_match_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'MATCH_NOT_FOUND');
  END IF;

  PERFORM 1 FROM public.team_match_tournaments
  WHERE id = v_tournament_id FOR UPDATE;
  SELECT * INTO v_match
  FROM public.team_match_matches WHERE id = p_match_id FOR UPDATE;

  IF NOT public.can_edit_team_match_scores(v_tournament_id, auth.uid())
     AND NOT public.is_team_captain(v_match.team_a_id, auth.uid())
     AND NOT public.is_team_captain(v_match.team_b_id, auth.uid())
     AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  IF v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL THEN
    RETURN json_build_object('success', true, 'ready', false, 'created', 0);
  END IF;

  v_created := public.seed_team_match_games_locked(p_match_id);
  RETURN json_build_object(
    'success', true,
    'ready', true,
    'created', v_created,
    'idempotent', v_created = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_team_match_games_atomic(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_team_match_games_atomic(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_team_match_games_atomic(uuid) TO authenticated;

COMMENT ON FUNCTION public.ensure_team_match_games_atomic(uuid) IS
  'Count-locked, idempotent Team Match game seeding from tournament templates.';


CREATE OR REPLACE FUNCTION public.score_team_match_games_atomic(
  p_match_id uuid,
  p_scores jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match public.team_match_matches;
  v_target public.team_match_matches;
  v_third public.team_match_matches;
  v_tournament public.team_match_tournaments;
  v_item jsonb;
  v_game_id uuid;
  v_score_a integer;
  v_score_b integer;
  v_expected_version bigint;
  v_payload_count integer;
  v_game_count integer;
  v_games_won_a integer;
  v_games_won_b integer;
  v_total_points_a integer;
  v_total_points_b integer;
  v_undecided integer;
  v_required integer;
  v_new_winner uuid;
  v_old_winner uuid;
  v_new_loser uuid;
  v_old_loser uuid;
  v_tournament_id uuid;
  v_target_id uuid;
  v_third_id uuid;
  v_target_started boolean;
  v_third_started boolean;
  v_slot integer;
  v_versions jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF p_scores IS NULL OR jsonb_typeof(p_scores) <> 'array' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_SCORE_PAYLOAD');
  END IF;
  v_payload_count := jsonb_array_length(p_scores);
  IF v_payload_count < 1 OR v_payload_count > 50 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_SCORE_PAYLOAD');
  END IF;

  SELECT tournament_id INTO v_tournament_id
  FROM public.team_match_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'MATCH_NOT_FOUND');
  END IF;

  SELECT * INTO v_tournament
  FROM public.team_match_tournaments
  WHERE id = v_tournament_id
  FOR UPDATE;
  SELECT * INTO v_match
  FROM public.team_match_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT public.can_edit_team_match_scores(v_match.tournament_id, auth.uid())
     AND NOT public.is_team_captain(v_match.team_a_id, auth.uid())
     AND NOT public.is_team_captain(v_match.team_b_id, auth.uid())
     AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;
  IF v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'PARTICIPANTS_MISSING');
  END IF;

  DROP TABLE IF EXISTS pg_temp.tm_score_payload;
  CREATE TEMP TABLE tm_score_payload (
    game_id uuid PRIMARY KEY,
    score_a integer NOT NULL,
    score_b integer NOT NULL,
    expected_version bigint NOT NULL
  ) ON COMMIT DROP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_scores)
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR COALESCE(v_item ->> 'game_id', '') = ''
       OR jsonb_typeof(v_item -> 'score_a') <> 'number'
       OR jsonb_typeof(v_item -> 'score_b') <> 'number'
       OR jsonb_typeof(v_item -> 'expected_version') <> 'number'
       OR (v_item ->> 'score_a') !~ '^[0-9]+$'
       OR (v_item ->> 'score_b') !~ '^[0-9]+$'
       OR (v_item ->> 'expected_version') !~ '^[0-9]+$' THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_SCORE_PAYLOAD');
    END IF;
    v_game_id := (v_item ->> 'game_id')::uuid;
    v_score_a := (v_item ->> 'score_a')::integer;
    v_score_b := (v_item ->> 'score_b')::integer;
    v_expected_version := (v_item ->> 'expected_version')::bigint;
    IF v_score_a > 999 OR v_score_b > 999 THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_SCORE');
    END IF;
    IF EXISTS (SELECT 1 FROM tm_score_payload WHERE game_id = v_game_id) THEN
      RETURN json_build_object('success', false, 'error', 'DUPLICATE_GAME');
    END IF;
    INSERT INTO tm_score_payload VALUES
      (v_game_id, v_score_a, v_score_b, v_expected_version);
  END LOOP;

  -- Lock every game in stable order before validating any version or changing
  -- downstream participants.
  PERFORM 1
  FROM public.team_match_games
  WHERE match_id = p_match_id
  ORDER BY id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM tm_score_payload p
    LEFT JOIN public.team_match_games g
      ON g.id = p.game_id AND g.match_id = p_match_id
    WHERE g.id IS NULL
  ) THEN
    RETURN json_build_object('success', false, 'error', 'GAME_NOT_FOUND');
  END IF;
  IF EXISTS (
    SELECT 1 FROM tm_score_payload p
    JOIN public.team_match_games g ON g.id = p.game_id
    WHERE g.score_version <> p.expected_version
  ) THEN
    RETURN json_build_object('success', false, 'error', 'VERSION_CONFLICT');
  END IF;

  WITH projected AS (
    SELECT g.id,
           COALESCE(p.score_a, g.score_a, 0) AS score_a,
           COALESCE(p.score_b, g.score_b, 0) AS score_b
    FROM public.team_match_games g
    LEFT JOIN tm_score_payload p ON p.game_id = g.id
    WHERE g.match_id = p_match_id
  )
  SELECT count(*)::integer,
         count(*) FILTER (WHERE score_a > score_b)::integer,
         count(*) FILTER (WHERE score_b > score_a)::integer,
         COALESCE(sum(score_a), 0)::integer,
         COALESCE(sum(score_b), 0)::integer,
         count(*) FILTER (WHERE score_a = score_b)::integer
  INTO v_game_count, v_games_won_a, v_games_won_b,
       v_total_points_a, v_total_points_b, v_undecided
  FROM projected;

  IF v_game_count = 0 THEN
    RETURN json_build_object('success', false, 'error', 'NO_GAMES');
  END IF;

  v_new_winner := NULL;
  IF COALESCE(v_tournament.total_score_mode, false) THEN
    IF v_undecided = 0 THEN
      IF v_total_points_a > v_total_points_b THEN
        v_new_winner := v_match.team_a_id;
      ELSIF v_total_points_b > v_total_points_a THEN
        v_new_winner := v_match.team_b_id;
      END IF;
    END IF;
  ELSE
    v_required := (v_game_count + 1) / 2;
    IF v_games_won_a >= v_required THEN
      v_new_winner := v_match.team_a_id;
    ELSIF v_games_won_b >= v_required THEN
      v_new_winner := v_match.team_b_id;
    END IF;
  END IF;

  v_old_winner := v_match.winner_team_id;
  v_old_loser := CASE
    WHEN v_old_winner = v_match.team_a_id THEN v_match.team_b_id
    WHEN v_old_winner = v_match.team_b_id THEN v_match.team_a_id
    ELSE NULL
  END;
  v_new_loser := CASE
    WHEN v_new_winner = v_match.team_a_id THEN v_match.team_b_id
    WHEN v_new_winner = v_match.team_b_id THEN v_match.team_a_id
    ELSE NULL
  END;

  -- Lock and validate every affected downstream match before updating the game
  -- row, so a rejected correction changes nothing at all.
  IF v_match.is_playoff
     AND v_old_winner IS DISTINCT FROM v_new_winner
     AND v_match.next_match_id IS NOT NULL THEN
    SELECT * INTO v_target
    FROM public.team_match_matches
    WHERE id = v_match.next_match_id
    FOR UPDATE;
    v_target_id := v_target.id;
    SELECT
      v_target.status IN ('in_progress', 'completed')
      OR COALESCE(v_target.lineup_a_submitted, false)
      OR COALESCE(v_target.lineup_b_submitted, false)
      OR EXISTS (
        SELECT 1 FROM public.team_match_games g
        WHERE g.match_id = v_target.id
          AND (
            g.status IN ('in_progress', 'completed')
            OR COALESCE(g.score_a, 0) <> 0
            OR COALESCE(g.score_b, 0) <> 0
            OR cardinality(COALESCE(g.lineup_team_a, ARRAY[]::uuid[])) > 0
            OR cardinality(COALESCE(g.lineup_team_b, ARRAY[]::uuid[])) > 0
          )
      )
    INTO v_target_started;
    IF v_target_started THEN
      RETURN json_build_object(
        'success', false, 'error', 'DOWNSTREAM_LOCKED',
        'downstream_match_id', v_target.id
      );
    END IF;
  END IF;

  IF v_match.is_playoff
     AND v_match.playoff_round = 2
     AND NOT COALESCE(v_match.is_repechage, false)
     AND v_old_loser IS DISTINCT FROM v_new_loser THEN
    SELECT id INTO v_third_id
    FROM public.team_match_matches
    WHERE tournament_id = v_match.tournament_id AND is_third_place
    LIMIT 1;
    IF v_third_id IS NOT NULL THEN
      SELECT * INTO v_third
      FROM public.team_match_matches WHERE id = v_third_id FOR UPDATE;
      SELECT
        v_third.status IN ('in_progress', 'completed')
        OR COALESCE(v_third.lineup_a_submitted, false)
        OR COALESCE(v_third.lineup_b_submitted, false)
        OR EXISTS (
          SELECT 1 FROM public.team_match_games g
          WHERE g.match_id = v_third.id
            AND (
              g.status IN ('in_progress', 'completed')
              OR COALESCE(g.score_a, 0) <> 0
              OR COALESCE(g.score_b, 0) <> 0
              OR cardinality(COALESCE(g.lineup_team_a, ARRAY[]::uuid[])) > 0
              OR cardinality(COALESCE(g.lineup_team_b, ARRAY[]::uuid[])) > 0
            )
        )
      INTO v_third_started;
      IF v_third_started THEN
        RETURN json_build_object(
          'success', false, 'error', 'DOWNSTREAM_LOCKED',
          'downstream_match_id', v_third.id
        );
      END IF;
    END IF;
  END IF;

  UPDATE public.team_match_games g
  SET score_a = p.score_a,
      score_b = p.score_b,
      winner_team_id = CASE
        WHEN p.score_a > p.score_b THEN v_match.team_a_id
        WHEN p.score_b > p.score_a THEN v_match.team_b_id
        ELSE NULL
      END,
      status = CASE WHEN p.score_a = p.score_b THEN 'in_progress' ELSE 'completed' END,
      live_referee_id = CASE WHEN p.score_a = p.score_b THEN g.live_referee_id ELSE NULL END,
      referee_live_state = CASE WHEN p.score_a = p.score_b THEN g.referee_live_state ELSE NULL END,
      score_version = g.score_version + 1
  FROM tm_score_payload p
  WHERE g.id = p.game_id;

  UPDATE public.team_match_matches
  SET games_won_a = v_games_won_a,
      games_won_b = v_games_won_b,
      total_points_a = v_total_points_a,
      total_points_b = v_total_points_b,
      winner_team_id = v_new_winner,
      status = CASE
        WHEN v_new_winner IS NULL THEN 'in_progress'::public.team_match_match_status
        ELSE 'completed'::public.team_match_match_status
      END
  WHERE id = p_match_id;

  IF v_target_id IS NOT NULL THEN
    v_slot := v_match.next_match_slot;
    IF v_slot = 1 THEN
      IF v_target.team_a_id IS NOT NULL
         AND v_target.team_a_id IS DISTINCT FROM v_old_winner
         AND v_target.team_a_id IS DISTINCT FROM v_new_winner THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BRACKET_CONFLICT';
      END IF;
      UPDATE public.team_match_matches SET team_a_id = v_new_winner
      WHERE id = v_target_id;
    ELSIF v_slot = 2 THEN
      IF v_target.team_b_id IS NOT NULL
         AND v_target.team_b_id IS DISTINCT FROM v_old_winner
         AND v_target.team_b_id IS DISTINCT FROM v_new_winner THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BRACKET_CONFLICT';
      END IF;
      UPDATE public.team_match_matches SET team_b_id = v_new_winner
      WHERE id = v_target_id;
    ELSE
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_NEXT_SLOT';
    END IF;
    PERFORM public.seed_team_match_games_locked(v_target_id);
  END IF;

  IF v_third_id IS NOT NULL THEN
    IF v_old_loser IS NOT NULL THEN
      IF v_third.team_a_id = v_old_loser THEN
        UPDATE public.team_match_matches SET team_a_id = v_new_loser WHERE id = v_third_id;
      ELSIF v_third.team_b_id = v_old_loser THEN
        UPDATE public.team_match_matches SET team_b_id = v_new_loser WHERE id = v_third_id;
      ELSIF v_new_loser IS NULL
         OR v_third.team_a_id = v_new_loser
         OR v_third.team_b_id = v_new_loser THEN
        NULL;
      ELSE
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'THIRD_PLACE_CONFLICT';
      END IF;
    ELSIF v_new_loser IS NOT NULL
       AND v_third.team_a_id IS DISTINCT FROM v_new_loser
       AND v_third.team_b_id IS DISTINCT FROM v_new_loser THEN
      IF v_third.team_a_id IS NULL THEN
        UPDATE public.team_match_matches SET team_a_id = v_new_loser WHERE id = v_third_id;
      ELSIF v_third.team_b_id IS NULL THEN
        UPDATE public.team_match_matches SET team_b_id = v_new_loser WHERE id = v_third_id;
      ELSE
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'THIRD_PLACE_CONFLICT';
      END IF;
    END IF;
    PERFORM public.seed_team_match_games_locked(v_third_id);
  END IF;

  SELECT jsonb_object_agg(id::text, score_version)
  INTO v_versions
  FROM public.team_match_games
  WHERE id IN (SELECT game_id FROM tm_score_payload);

  RETURN json_build_object(
    'success', true,
    'winner_id', v_new_winner,
    'games_won_a', v_games_won_a,
    'games_won_b', v_games_won_b,
    'total_points_a', v_total_points_a,
    'total_points_b', v_total_points_b,
    'versions', COALESCE(v_versions, '{}'::jsonb)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', CASE
        WHEN SQLSTATE IN ('22P02', '22003') THEN 'INVALID_SCORE_PAYLOAD'
        WHEN SQLERRM IN ('BRACKET_CONFLICT', 'INVALID_NEXT_SLOT', 'THIRD_PLACE_CONFLICT') THEN SQLERRM
        ELSE 'SCORE_FAILED'
      END,
      'detail', SQLERRM
    );
END;
$$;

REVOKE ALL ON FUNCTION public.score_team_match_games_atomic(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.score_team_match_games_atomic(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.score_team_match_games_atomic(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.score_team_match_games_atomic(uuid, jsonb) IS
  'Atomically version-checks one or more Team Match games, recomputes the match, safely propagates playoff winner/loser corrections, and idempotently seeds downstream games.';
