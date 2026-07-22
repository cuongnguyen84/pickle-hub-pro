-- Task 4.3: optimistic, transactional scoring for Doubles Elimination and
-- QuickTable. Corrections may replace an unplayed downstream participant, but
-- are rejected with DOWNSTREAM_LOCKED after the dependent match has started.
-- This is the conservative product policy: never erase a played result.
--
-- Forward-only rollback reasoning: clients can be rolled back independently;
-- the RPCs and additive score_version columns remain safe. If the functions
-- themselves must be removed, DROP both signatures below after all clients
-- stop calling them. Existing data needs no reverse migration.

ALTER TABLE public.doubles_elimination_matches
  ADD COLUMN IF NOT EXISTS score_version bigint NOT NULL DEFAULT 0;

ALTER TABLE public.quick_table_matches
  ADD COLUMN IF NOT EXISTS score_version bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.doubles_elimination_matches.score_version IS
  'Optimistic concurrency token incremented by score_doubles_elimination_match_atomic.';
COMMENT ON COLUMN public.quick_table_matches.score_version IS
  'Optimistic concurrency token incremented by score_quick_table_match_atomic.';

-- ─── QuickTable score + group stats / playoff propagation ────────────────

CREATE OR REPLACE FUNCTION public.score_quick_table_match_atomic(
  p_match_id uuid,
  p_score1 integer,
  p_score2 integer,
  p_expected_version bigint
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match public.quick_table_matches;
  v_target public.quick_table_matches;
  v_table_id uuid;
  v_winner_id uuid;
  v_old_winner_id uuid;
  v_position integer;
  v_next_index integer;
  v_slot1 boolean;
  v_current_round_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  IF p_expected_version IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'VERSION_REQUIRED');
  END IF;

  IF p_score1 IS NULL OR p_score2 IS NULL
     OR p_score1 < 0 OR p_score2 < 0
     OR p_score1 > 99 OR p_score2 > 99
     OR p_score1 = p_score2 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_SCORE');
  END IF;

  SELECT table_id
  INTO v_table_id
  FROM public.quick_table_matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'MATCH_NOT_FOUND');
  END IF;

  IF NOT public.can_edit_quick_table_scores(v_table_id, auth.uid())
     AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  -- Serialize scoring and downstream advancement for the whole bracket.
  PERFORM 1 FROM public.quick_tables WHERE id = v_table_id FOR UPDATE;

  SELECT *
  INTO v_match
  FROM public.quick_table_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match.score_version <> p_expected_version THEN
    RETURN json_build_object(
      'success', false,
      'error', 'VERSION_CONFLICT',
      'current_version', v_match.score_version
    );
  END IF;

  IF v_match.player1_id IS NULL OR v_match.player2_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'PARTICIPANTS_MISSING');
  END IF;

  v_winner_id := CASE
    WHEN p_score1 > p_score2 THEN v_match.player1_id
    ELSE v_match.player2_id
  END;
  v_old_winner_id := v_match.winner_id;

  -- Exact retry using the current version is a no-op; network retries using an
  -- older version still receive VERSION_CONFLICT above.
  IF v_match.status = 'completed'
     AND v_match.score1 = p_score1
     AND v_match.score2 = p_score2
     AND v_match.winner_id = v_winner_id THEN
    RETURN json_build_object(
      'success', true,
      'idempotent', true,
      'version', v_match.score_version,
      'winner_id', v_winner_id
    );
  END IF;

  IF v_match.is_playoff
     AND v_match.playoff_round IS NOT NULL
     AND v_old_winner_id IS DISTINCT FROM v_winner_id THEN
    SELECT count(*)::integer
    INTO v_position
    FROM public.quick_table_matches m
    WHERE m.table_id = v_table_id
      AND m.is_playoff
      AND m.playoff_round = v_match.playoff_round
      AND (
        m.playoff_match_number < v_match.playoff_match_number
        OR (m.playoff_match_number = v_match.playoff_match_number AND m.id < v_match.id)
      );

    v_next_index := v_position / 2;
    v_slot1 := (v_position % 2 = 0);

    SELECT *
    INTO v_target
    FROM public.quick_table_matches m
    WHERE m.table_id = v_table_id
      AND m.is_playoff
      AND m.playoff_round = v_match.playoff_round + 1
    ORDER BY m.playoff_match_number, m.id
    OFFSET v_next_index
    LIMIT 1;

    IF FOUND THEN
      IF v_target.status <> 'pending'
         OR v_target.score1 IS NOT NULL
         OR v_target.score2 IS NOT NULL
         OR v_target.winner_id IS NOT NULL THEN
        RETURN json_build_object(
          'success', false,
          'error', 'DOWNSTREAM_LOCKED',
          'downstream_match_id', v_target.id
        );
      END IF;

      IF v_slot1 THEN
        IF v_target.player1_id IS NOT NULL
           AND v_target.player1_id IS DISTINCT FROM v_old_winner_id THEN
          RETURN json_build_object('success', false, 'error', 'BRACKET_CONFLICT');
        END IF;
        UPDATE public.quick_table_matches
        SET player1_id = v_winner_id
        WHERE id = v_target.id;
      ELSE
        IF v_target.player2_id IS NOT NULL
           AND v_target.player2_id IS DISTINCT FROM v_old_winner_id THEN
          RETURN json_build_object('success', false, 'error', 'BRACKET_CONFLICT');
        END IF;
        UPDATE public.quick_table_matches
        SET player2_id = v_winner_id
        WHERE id = v_target.id;
      END IF;
    END IF;
  END IF;

  UPDATE public.quick_table_matches
  SET score1 = p_score1,
      score2 = p_score2,
      winner_id = v_winner_id,
      status = 'completed',
      live_referee_id = NULL,
      score_version = score_version + 1
  WHERE id = p_match_id;

  IF NOT v_match.is_playoff AND v_match.group_id IS NOT NULL THEN
    -- Reset and rebuild every player in the affected group from committed
    -- completed matches. This used to be one REST update per player.
    UPDATE public.quick_table_players
    SET matches_played = 0,
        matches_won = 0,
        points_for = 0,
        points_against = 0
    WHERE group_id = v_match.group_id;

    WITH appearances AS (
      SELECT m.player1_id AS player_id,
             m.score1 AS points_for,
             m.score2 AS points_against,
             (m.winner_id = m.player1_id)::integer AS won
      FROM public.quick_table_matches m
      WHERE m.group_id = v_match.group_id
        AND m.status = 'completed'
        AND m.player1_id IS NOT NULL
        AND m.player2_id IS NOT NULL
        AND m.score1 IS NOT NULL
        AND m.score2 IS NOT NULL
      UNION ALL
      SELECT m.player2_id,
             m.score2,
             m.score1,
             (m.winner_id = m.player2_id)::integer
      FROM public.quick_table_matches m
      WHERE m.group_id = v_match.group_id
        AND m.status = 'completed'
        AND m.player1_id IS NOT NULL
        AND m.player2_id IS NOT NULL
        AND m.score1 IS NOT NULL
        AND m.score2 IS NOT NULL
    ),
    totals AS (
      SELECT player_id,
             count(*)::integer AS played,
             sum(won)::integer AS won,
             sum(points_for)::integer AS points_for,
             sum(points_against)::integer AS points_against
      FROM appearances
      GROUP BY player_id
    )
    UPDATE public.quick_table_players p
    SET matches_played = t.played,
        matches_won = t.won,
        points_for = t.points_for,
        points_against = t.points_against
    FROM totals t
    WHERE p.id = t.player_id
      AND p.group_id = v_match.group_id;
  ELSIF v_match.is_playoff AND v_match.playoff_round IS NOT NULL THEN
    SELECT count(*)::integer
    INTO v_current_round_count
    FROM public.quick_table_matches
    WHERE table_id = v_table_id
      AND is_playoff
      AND playoff_round = v_match.playoff_round;

    IF v_current_round_count = 1
       AND NOT EXISTS (
         SELECT 1
         FROM public.quick_table_matches
         WHERE table_id = v_table_id
           AND is_playoff
           AND playoff_round = v_match.playoff_round + 1
       ) THEN
      UPDATE public.quick_tables
      SET status = 'completed'
      WHERE id = v_table_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'idempotent', false,
    'version', v_match.score_version + 1,
    'winner_id', v_winner_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.score_quick_table_match_atomic(uuid, integer, integer, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.score_quick_table_match_atomic(uuid, integer, integer, bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.score_quick_table_match_atomic(uuid, integer, integer, bigint) TO authenticated;

COMMENT ON FUNCTION public.score_quick_table_match_atomic(uuid, integer, integer, bigint) IS
  'Atomically scores QuickTable, checks score_version, rebuilds group stats, and safely replaces an unplayed playoff downstream slot.';

-- ─── Doubles Elimination score + safe downstream correction ─────────────

CREATE OR REPLACE FUNCTION public.score_doubles_elimination_match_atomic(
  p_match_id uuid,
  p_score_a integer,
  p_score_b integer,
  p_games jsonb,
  p_expected_version bigint
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match public.doubles_elimination_matches;
  v_target public.doubles_elimination_matches;
  v_third public.doubles_elimination_matches;
  v_tournament_id uuid;
  v_games jsonb := '[]'::jsonb;
  v_game_count integer := 0;
  v_invalid_count integer := 0;
  v_wins_a integer := 0;
  v_wins_b integer := 0;
  v_needed integer;
  v_complete boolean;
  v_winner_id uuid;
  v_loser_id uuid;
  v_old_winner_id uuid;
  v_old_loser_id uuid;
  v_match_index integer;
  v_next_index integer;
  v_slot_a boolean;
  v_source_slot text;
  v_changed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  IF p_expected_version IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'VERSION_REQUIRED');
  END IF;

  SELECT tournament_id
  INTO v_tournament_id
  FROM public.doubles_elimination_matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'MATCH_NOT_FOUND');
  END IF;

  IF NOT public.can_edit_doubles_elimination_scores(v_tournament_id, auth.uid())
     AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  -- A tournament-wide lock gives every scorer the same propagation order and
  -- prevents two different matches from claiming the same downstream slot.
  PERFORM 1
  FROM public.doubles_elimination_tournaments
  WHERE id = v_tournament_id
  FOR UPDATE;

  SELECT *
  INTO v_match
  FROM public.doubles_elimination_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match.score_version <> p_expected_version THEN
    RETURN json_build_object(
      'success', false,
      'error', 'VERSION_CONFLICT',
      'current_version', v_match.score_version
    );
  END IF;

  IF v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'PARTICIPANTS_MISSING');
  END IF;

  IF v_match.is_bye THEN
    RETURN json_build_object('success', false, 'error', 'BYE_NOT_SCORABLE');
  END IF;

  IF v_match.best_of = 1 THEN
    IF p_score_a IS NULL OR p_score_b IS NULL
       OR p_score_a < 0 OR p_score_b < 0
       OR p_score_a > 99 OR p_score_b > 99
       OR p_score_a = p_score_b THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_SCORE');
    END IF;

    v_complete := true;
    v_winner_id := CASE WHEN p_score_a > p_score_b THEN v_match.team_a_id ELSE v_match.team_b_id END;
    v_loser_id := CASE WHEN p_score_a > p_score_b THEN v_match.team_b_id ELSE v_match.team_a_id END;
  ELSE
    IF p_games IS NULL OR jsonb_typeof(p_games) <> 'array' THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_GAMES');
    END IF;

    WITH parsed AS (
      SELECT ordinality::integer AS ord,
             CASE WHEN jsonb_typeof(game -> 'score_a') = 'number'
               THEN (game ->> 'score_a')::integer END AS score_a,
             CASE WHEN jsonb_typeof(game -> 'score_b') = 'number'
               THEN (game ->> 'score_b')::integer END AS score_b,
             CASE WHEN jsonb_typeof(game -> 'game') = 'number'
               THEN (game ->> 'game')::integer END AS game_number
      FROM jsonb_array_elements(p_games) WITH ORDINALITY AS e(game, ordinality)
    )
    SELECT
      count(*)::integer,
      count(*) FILTER (
        WHERE score_a IS NULL OR score_b IS NULL OR game_number <> ord
           OR score_a < 0 OR score_b < 0 OR score_a > 99 OR score_b > 99
           OR score_a = score_b
      )::integer,
      count(*) FILTER (WHERE score_a > score_b)::integer,
      count(*) FILTER (WHERE score_b > score_a)::integer,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'game', ord,
          'score_a', score_a,
          'score_b', score_b,
          'winner', CASE WHEN score_a > score_b THEN 'a' ELSE 'b' END
        ) ORDER BY ord
      ), '[]'::jsonb)
    INTO v_game_count, v_invalid_count, v_wins_a, v_wins_b, v_games
    FROM parsed;

    IF v_game_count < 1
       OR v_game_count > v_match.best_of
       OR v_invalid_count > 0 THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_GAMES');
    END IF;

    v_needed := (v_match.best_of + 1) / 2;
    v_complete := v_wins_a >= v_needed OR v_wins_b >= v_needed;
    v_winner_id := CASE
      WHEN v_wins_a >= v_needed THEN v_match.team_a_id
      WHEN v_wins_b >= v_needed THEN v_match.team_b_id
      ELSE NULL
    END;
    v_loser_id := CASE
      WHEN v_wins_a >= v_needed THEN v_match.team_b_id
      WHEN v_wins_b >= v_needed THEN v_match.team_a_id
      ELSE NULL
    END;
  END IF;

  IF v_match.status = 'completed' AND NOT v_complete THEN
    RETURN json_build_object('success', false, 'error', 'CANNOT_REOPEN_COMPLETED');
  END IF;

  v_old_winner_id := v_match.winner_id;
  v_old_loser_id := CASE
    WHEN v_old_winner_id = v_match.team_a_id THEN v_match.team_b_id
    WHEN v_old_winner_id = v_match.team_b_id THEN v_match.team_a_id
    ELSE NULL
  END;

  v_changed := v_match.score_a IS DISTINCT FROM coalesce(p_score_a, 0)
    OR v_match.score_b IS DISTINCT FROM coalesce(p_score_b, 0)
    OR v_match.games IS DISTINCT FROM v_games
    OR v_match.games_won_a IS DISTINCT FROM v_wins_a
    OR v_match.games_won_b IS DISTINCT FROM v_wins_b
    OR v_match.winner_id IS DISTINCT FROM v_winner_id
    OR v_match.status IS DISTINCT FROM CASE WHEN v_complete THEN 'completed' ELSE 'live' END;

  IF NOT v_changed THEN
    RETURN json_build_object(
      'success', true,
      'idempotent', true,
      'version', v_match.score_version,
      'winner_id', v_winner_id,
      'completed', v_complete
    );
  END IF;

  -- R1/R2 score differential participates in ranked R3 selection. Once R3
  -- has participants (or playoff exists), even a same-winner correction would
  -- require reseeding played dependencies, so fail closed.
  IF v_match.status = 'completed'
     AND v_match.round_number <= 2
     AND (
       EXISTS (
         SELECT 1
         FROM public.doubles_elimination_matches m
         WHERE m.tournament_id = v_tournament_id
           AND m.round_number = 3
           AND (m.team_a_id IS NOT NULL OR m.team_b_id IS NOT NULL OR m.status <> 'pending')
       )
       OR EXISTS (
         SELECT 1
         FROM public.doubles_elimination_matches m
         WHERE m.tournament_id = v_tournament_id
           AND m.round_number >= 4
       )
     ) THEN
    RETURN json_build_object('success', false, 'error', 'DOWNSTREAM_LOCKED');
  END IF;

  IF v_complete AND v_old_winner_id IS DISTINCT FROM v_winner_id THEN
    IF v_match.round_type = 'winner_r1' THEN
      v_match_index := v_match.match_number - 1;

      SELECT *
      INTO v_target
      FROM public.doubles_elimination_matches m
      WHERE m.tournament_id = v_tournament_id
        AND m.round_number = 2
        AND m.bracket_type = 'loser'
        AND (
          (m.source_a ->> 'type' = 'loser_of' AND m.source_a ->> 'match_index' = v_match_index::text)
          OR
          (m.source_b ->> 'type' = 'loser_of' AND m.source_b ->> 'match_index' = v_match_index::text)
        )
      ORDER BY m.match_number
      LIMIT 1;

      IF FOUND THEN
        IF v_target.status = 'live'
           OR (v_target.status = 'completed' AND NOT v_target.is_bye)
           OR coalesce(v_target.score_a, 0) <> 0
           OR coalesce(v_target.score_b, 0) <> 0
           OR jsonb_array_length(coalesce(v_target.games, '[]'::jsonb)) > 0 THEN
          RETURN json_build_object(
            'success', false,
            'error', 'DOWNSTREAM_LOCKED',
            'downstream_match_id', v_target.id
          );
        END IF;

        v_source_slot := CASE
          WHEN v_target.source_a ->> 'match_index' = v_match_index::text THEN 'a'
          ELSE 'b'
        END;

        IF v_source_slot = 'a' THEN
          IF v_target.team_a_id IS NOT NULL
             AND v_target.team_a_id IS DISTINCT FROM v_old_loser_id THEN
            RETURN json_build_object('success', false, 'error', 'BRACKET_CONFLICT');
          END IF;
          UPDATE public.doubles_elimination_matches
          SET team_a_id = v_loser_id,
              winner_id = CASE WHEN is_bye THEN v_loser_id ELSE winner_id END,
              status = CASE WHEN is_bye THEN 'completed' ELSE status END
          WHERE id = v_target.id;
        ELSE
          IF v_target.team_b_id IS NOT NULL
             AND v_target.team_b_id IS DISTINCT FROM v_old_loser_id THEN
            RETURN json_build_object('success', false, 'error', 'BRACKET_CONFLICT');
          END IF;
          UPDATE public.doubles_elimination_matches
          SET team_b_id = v_loser_id,
              winner_id = CASE WHEN is_bye THEN v_loser_id ELSE winner_id END,
              status = CASE WHEN is_bye THEN 'completed' ELSE status END
          WHERE id = v_target.id;
        END IF;
      END IF;
    ELSIF v_match.round_number = 3 THEN
      SELECT *
      INTO v_target
      FROM public.doubles_elimination_matches m
      WHERE m.tournament_id = v_tournament_id
        AND m.round_number = 4
        AND (m.team_a_id = v_old_winner_id OR m.team_b_id = v_old_winner_id)
      ORDER BY m.match_number
      LIMIT 1;

      IF FOUND THEN
        IF v_target.status <> 'pending'
           OR coalesce(v_target.score_a, 0) <> 0
           OR coalesce(v_target.score_b, 0) <> 0
           OR v_target.winner_id IS NOT NULL
           OR jsonb_array_length(coalesce(v_target.games, '[]'::jsonb)) > 0 THEN
          RETURN json_build_object(
            'success', false,
            'error', 'DOWNSTREAM_LOCKED',
            'downstream_match_id', v_target.id
          );
        END IF;

        IF v_target.team_a_id = v_old_winner_id THEN
          UPDATE public.doubles_elimination_matches SET team_a_id = v_winner_id WHERE id = v_target.id;
        ELSE
          UPDATE public.doubles_elimination_matches SET team_b_id = v_winner_id WHERE id = v_target.id;
        END IF;
      ELSIF EXISTS (
        SELECT 1 FROM public.doubles_elimination_matches
        WHERE tournament_id = v_tournament_id AND round_number = 4
      ) THEN
        RETURN json_build_object('success', false, 'error', 'BRACKET_CONFLICT');
      END IF;
    ELSIF v_match.round_number >= 4 AND v_match.round_type <> 'final' AND v_match.round_type <> 'third_place' THEN
      v_next_index := (v_match.match_number - 1) / 2;
      v_slot_a := ((v_match.match_number - 1) % 2 = 0);

      SELECT *
      INTO v_target
      FROM public.doubles_elimination_matches m
      WHERE m.tournament_id = v_tournament_id
        AND m.round_number = v_match.round_number + 1
        AND m.round_type <> 'third_place'
      ORDER BY m.match_number, m.id
      OFFSET v_next_index
      LIMIT 1;

      IF FOUND THEN
        IF v_target.status <> 'pending'
           OR coalesce(v_target.score_a, 0) <> 0
           OR coalesce(v_target.score_b, 0) <> 0
           OR v_target.winner_id IS NOT NULL
           OR jsonb_array_length(coalesce(v_target.games, '[]'::jsonb)) > 0 THEN
          RETURN json_build_object(
            'success', false,
            'error', 'DOWNSTREAM_LOCKED',
            'downstream_match_id', v_target.id
          );
        END IF;

        IF v_slot_a THEN
          IF v_target.team_a_id IS NOT NULL
             AND v_target.team_a_id IS DISTINCT FROM v_old_winner_id THEN
            RETURN json_build_object('success', false, 'error', 'BRACKET_CONFLICT');
          END IF;
          UPDATE public.doubles_elimination_matches SET team_a_id = v_winner_id WHERE id = v_target.id;
        ELSE
          IF v_target.team_b_id IS NOT NULL
             AND v_target.team_b_id IS DISTINCT FROM v_old_winner_id THEN
            RETURN json_build_object('success', false, 'error', 'BRACKET_CONFLICT');
          END IF;
          UPDATE public.doubles_elimination_matches SET team_b_id = v_winner_id WHERE id = v_target.id;
        END IF;
      END IF;
    END IF;

    -- A semifinal correction changes both the final participant and the loser
    -- seated in the optional third-place match.
    IF v_match.round_type = 'semifinal' THEN
      SELECT *
      INTO v_third
      FROM public.doubles_elimination_matches m
      WHERE m.tournament_id = v_tournament_id
        AND m.round_type = 'third_place'
      ORDER BY m.match_number, m.id
      LIMIT 1;

      IF FOUND THEN
        IF v_third.status <> 'pending'
           OR coalesce(v_third.score_a, 0) <> 0
           OR coalesce(v_third.score_b, 0) <> 0
           OR v_third.winner_id IS NOT NULL
           OR jsonb_array_length(coalesce(v_third.games, '[]'::jsonb)) > 0 THEN
          RETURN json_build_object(
            'success', false,
            'error', 'DOWNSTREAM_LOCKED',
            'downstream_match_id', v_third.id
          );
        END IF;

        IF v_match.match_number = 1 THEN
          IF v_third.team_a_id IS NOT NULL
             AND v_third.team_a_id IS DISTINCT FROM v_old_loser_id THEN
            RETURN json_build_object('success', false, 'error', 'BRACKET_CONFLICT');
          END IF;
          UPDATE public.doubles_elimination_matches SET team_a_id = v_loser_id WHERE id = v_third.id;
        ELSE
          IF v_third.team_b_id IS NOT NULL
             AND v_third.team_b_id IS DISTINCT FROM v_old_loser_id THEN
            RETURN json_build_object('success', false, 'error', 'BRACKET_CONFLICT');
          END IF;
          UPDATE public.doubles_elimination_matches SET team_b_id = v_loser_id WHERE id = v_third.id;
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_match.best_of = 1 THEN
    UPDATE public.doubles_elimination_matches
    SET score_a = p_score_a,
        score_b = p_score_b,
        games = '[]'::jsonb,
        games_won_a = 0,
        games_won_b = 0,
        winner_id = v_winner_id,
        status = 'completed',
        live_referee_id = NULL,
        score_version = score_version + 1
    WHERE id = p_match_id;
  ELSE
    UPDATE public.doubles_elimination_matches
    SET score_a = 0,
        score_b = 0,
        games = v_games,
        games_won_a = v_wins_a,
        games_won_b = v_wins_b,
        winner_id = v_winner_id,
        status = CASE WHEN v_complete THEN 'completed' ELSE 'live' END,
        live_referee_id = CASE WHEN v_complete THEN NULL ELSE live_referee_id END,
        score_version = score_version + 1
    WHERE id = p_match_id;
  END IF;

  IF v_complete AND v_match.round_type <> 'winner_r1' THEN
    IF v_old_loser_id IS NOT NULL AND v_old_loser_id IS DISTINCT FROM v_loser_id THEN
      UPDATE public.doubles_elimination_teams
      SET status = 'active', eliminated_at_round = NULL
      WHERE id = v_old_loser_id
        AND eliminated_at_round = v_match.round_number;
    END IF;

    UPDATE public.doubles_elimination_teams
    SET status = 'eliminated', eliminated_at_round = v_match.round_number
    WHERE id = v_loser_id;
  END IF;

  IF v_complete AND v_match.round_type = 'final' THEN
    UPDATE public.doubles_elimination_tournaments
    SET status = 'completed'
    WHERE id = v_tournament_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'idempotent', false,
    'version', v_match.score_version + 1,
    'winner_id', v_winner_id,
    'completed', v_complete
  );
END;
$$;

REVOKE ALL ON FUNCTION public.score_doubles_elimination_match_atomic(uuid, integer, integer, jsonb, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.score_doubles_elimination_match_atomic(uuid, integer, integer, jsonb, bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.score_doubles_elimination_match_atomic(uuid, integer, integer, jsonb, bigint) TO authenticated;

COMMENT ON FUNCTION public.score_doubles_elimination_match_atomic(uuid, integer, integer, jsonb, bigint) IS
  'Atomically validates/scores a DE match, checks score_version, propagates a corrected winner/loser into unplayed dependencies, and rejects played downstream rewrites.';

NOTIFY pgrst, 'reload schema';
