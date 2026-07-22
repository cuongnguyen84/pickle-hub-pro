-- Task 4 follow-up: keep Doubles Elimination R3 assignment and playoff
-- generation in the same database transaction as the score that unlocks them.
--
-- The lifecycle function is also exposed as an idempotent recovery RPC for
-- legacy brackets. The trigger makes normal atomic scoring self-advancing, so
-- clients no longer need to race each other with check-then-insert requests.
--
-- Forward-only rollback reasoning: drop the trigger to stop automatic
-- advancement, then restore the client lifecycle calls if a rollback is
-- required. Keep the functions and generation_key values already written;
-- they are additive and continue to protect existing brackets from duplicates.

CREATE OR REPLACE FUNCTION public.doubles_elimination_seed_positions(
  p_size integer
)
RETURNS integer[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_half integer[];
  v_positions integer[] := ARRAY[]::integer[];
  v_position integer;
BEGIN
  CASE p_size
    WHEN 2 THEN RETURN ARRAY[0, 1];
    WHEN 4 THEN RETURN ARRAY[0, 3, 2, 1];
    WHEN 8 THEN RETURN ARRAY[0, 7, 4, 3, 2, 5, 6, 1];
    WHEN 16 THEN RETURN ARRAY[0, 15, 8, 7, 4, 11, 12, 3, 2, 13, 10, 5, 6, 9, 14, 1];
    WHEN 32 THEN RETURN ARRAY[
      0, 31, 16, 15, 8, 23, 24, 7,
      4, 27, 20, 11, 12, 19, 28, 3,
      2, 29, 18, 13, 10, 21, 26, 5,
      6, 25, 22, 9, 14, 17, 30, 1
    ];
    ELSE
      IF p_size < 2 OR p_size % 2 <> 0 THEN
        RETURN NULL;
      END IF;

      v_half := public.doubles_elimination_seed_positions(p_size / 2);
      IF v_half IS NULL THEN
        RETURN NULL;
      END IF;

      FOREACH v_position IN ARRAY v_half LOOP
        v_positions := array_append(v_positions, v_position * 2);
        v_positions := array_append(v_positions, p_size - 1 - v_position * 2);
      END LOOP;
      RETURN v_positions;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.doubles_elimination_seed_positions(integer) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.advance_doubles_elimination_lifecycle(
  p_tournament_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.doubles_elimination_tournaments;
  v_r1_count integer;
  v_r2_count integer;
  v_r3_count integer;
  v_r3_assigned_slots integer;
  v_candidate_count integer;
  v_candidate_ids uuid[];
  v_playoff_size integer := 1;
  v_expected_r3 integer;
  v_teams_for_r4 integer;
  v_r3_ids uuid[];
  v_existing_playoff integer;
  v_entrant_ids uuid[];
  v_entrant_count integer;
  v_seeded_ids uuid[];
  v_unseeded_ids uuid[];
  v_seed_positions integer[];
  v_positions uuid[];
  v_unseeded_index integer := 1;
  v_display_order integer;
  v_round integer;
  v_teams_in_round integer;
  v_matches_in_round integer;
  v_round_type text;
  v_best_of integer;
  v_i integer;
  v_slot integer;
  v_court_count integer;
  v_base_time time;
  v_court integer;
  v_start_time text;
  v_match record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT *
  INTO v_t
  FROM public.doubles_elimination_tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TOURNAMENT_NOT_FOUND');
  END IF;

  IF NOT public.can_edit_doubles_elimination_scores(p_tournament_id, auth.uid())
     AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  IF v_t.status <> 'ongoing' THEN
    RETURN json_build_object(
      'success', true,
      'idempotent', true,
      'action', 'none',
      'reason', 'TOURNAMENT_NOT_ONGOING'
    );
  END IF;

  SELECT count(*)::integer
  INTO v_existing_playoff
  FROM public.doubles_elimination_matches
  WHERE tournament_id = p_tournament_id
    AND round_number >= 4;

  IF v_existing_playoff > 0 THEN
    RETURN json_build_object(
      'success', true,
      'idempotent', true,
      'action', 'none',
      'reason', 'PLAYOFF_ALREADY_EXISTS',
      'playoff_match_count', v_existing_playoff
    );
  END IF;

  SELECT
    count(*) FILTER (WHERE round_number = 1)::integer,
    count(*) FILTER (WHERE round_number = 2)::integer,
    count(*) FILTER (WHERE round_number = 3)::integer,
    coalesce(sum(
      (team_a_id IS NOT NULL)::integer + (team_b_id IS NOT NULL)::integer
    ) FILTER (WHERE round_number = 3), 0)::integer
  INTO v_r1_count, v_r2_count, v_r3_count, v_r3_assigned_slots
  FROM public.doubles_elimination_matches
  WHERE tournament_id = p_tournament_id
    AND round_number <= 3;

  IF v_r1_count = 0 OR v_r2_count = 0 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_PRELIMINARY_GRAPH');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.doubles_elimination_matches
    WHERE tournament_id = p_tournament_id
      AND round_number IN (1, 2)
      AND status <> 'completed'
  ) THEN
    RETURN json_build_object(
      'success', true,
      'idempotent', true,
      'action', 'none',
      'reason', 'PRELIMINARY_INCOMPLETE'
    );
  END IF;

  SELECT array_agg(winner_id ORDER BY point_diff DESC, tie_breaker, match_id)
  INTO v_candidate_ids
  FROM (
    SELECT
      id AS match_id,
      winner_id,
      CASE
        WHEN winner_id = team_a_id THEN score_a - score_b
        ELSE score_b - score_a
      END AS point_diff,
      md5(p_tournament_id::text || ':' || winner_id::text) AS tie_breaker
    FROM public.doubles_elimination_matches
    WHERE tournament_id = p_tournament_id
      AND round_number IN (1, 2)
      AND status = 'completed'
      AND winner_id IS NOT NULL
  ) ranked;

  v_candidate_count := coalesce(cardinality(v_candidate_ids), 0);
  IF v_candidate_count <> v_r1_count + v_r2_count
     OR (
       SELECT count(DISTINCT candidate_id)
       FROM unnest(coalesce(v_candidate_ids, ARRAY[]::uuid[])) AS candidate(candidate_id)
     ) <> v_candidate_count THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_CANDIDATE_POOL');
  END IF;

  WHILE v_playoff_size * 2 <= v_candidate_count LOOP
    v_playoff_size := v_playoff_size * 2;
  END LOOP;
  v_expected_r3 := v_candidate_count - v_playoff_size;

  IF v_playoff_size < 2 OR v_r3_count <> v_expected_r3 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INVALID_R3_GRAPH',
      'expected_r3_match_count', v_expected_r3,
      'actual_r3_match_count', v_r3_count
    );
  END IF;

  IF v_r3_count > 0 THEN
    IF v_r3_assigned_slots NOT IN (0, v_r3_count * 2) THEN
      RETURN json_build_object('success', false, 'error', 'R3_PARTIALLY_ASSIGNED');
    END IF;

    IF v_r3_assigned_slots = 0 THEN
      v_teams_for_r4 := v_playoff_size - v_r3_count;
      v_r3_ids := v_candidate_ids[v_teams_for_r4 + 1:v_candidate_count];

      IF cardinality(v_r3_ids) <> v_r3_count * 2 THEN
        RETURN json_build_object('success', false, 'error', 'INVALID_R3_CANDIDATES');
      END IF;

      v_court_count := greatest(coalesce(v_t.court_count, 1), 1);
      v_base_time := localtime + interval '15 minutes';

      FOR v_match IN
        SELECT id, row_number() OVER (ORDER BY match_number, id)::integer AS slot_number
        FROM public.doubles_elimination_matches
        WHERE tournament_id = p_tournament_id
          AND round_number = 3
        ORDER BY match_number, id
      LOOP
        v_court := ((v_match.slot_number - 1) % v_court_count) + 1;
        v_start_time := to_char(
          v_base_time
            + make_interval(mins => ((v_match.slot_number - 1) / v_court_count) * 20),
          'HH24:MI'
        );

        UPDATE public.doubles_elimination_matches
        SET team_a_id = v_r3_ids[(v_match.slot_number - 1) * 2 + 1],
            team_b_id = v_r3_ids[(v_match.slot_number - 1) * 2 + 2],
            court_number = v_court,
            start_time = v_start_time
        WHERE id = v_match.id;
      END LOOP;

      RETURN json_build_object(
        'success', true,
        'idempotent', false,
        'action', 'r3_assigned',
        'r3_match_count', v_r3_count,
        'playoff_size', v_playoff_size
      );
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.doubles_elimination_matches
      WHERE tournament_id = p_tournament_id
        AND round_number = 3
        AND status <> 'completed'
    ) THEN
      RETURN json_build_object(
        'success', true,
        'idempotent', true,
        'action', 'none',
        'reason', 'R3_INCOMPLETE'
      );
    END IF;
  END IF;

  -- The committed match graph, not client-maintained team status, is the source
  -- of truth for playoff membership. This lets the trigger run immediately
  -- after the decisive match update while the scoring RPC is still applying
  -- the loser's denormalized team status later in the same transaction.
  WITH r3_participants AS (
    SELECT team_a_id AS team_id
    FROM public.doubles_elimination_matches
    WHERE tournament_id = p_tournament_id AND round_number = 3
    UNION
    SELECT team_b_id
    FROM public.doubles_elimination_matches
    WHERE tournament_id = p_tournament_id AND round_number = 3
  ), entrants AS (
    SELECT winner_id AS team_id
    FROM public.doubles_elimination_matches
    WHERE tournament_id = p_tournament_id
      AND round_number IN (1, 2)
      AND status = 'completed'
      AND winner_id IS NOT NULL
      AND winner_id NOT IN (
        SELECT team_id FROM r3_participants WHERE team_id IS NOT NULL
      )
    UNION
    SELECT winner_id
    FROM public.doubles_elimination_matches
    WHERE tournament_id = p_tournament_id
      AND round_number = 3
      AND status = 'completed'
      AND winner_id IS NOT NULL
  )
  SELECT array_agg(team_id ORDER BY team_id)
  INTO v_entrant_ids
  FROM entrants;

  v_entrant_count := coalesce(cardinality(v_entrant_ids), 0);
  IF v_entrant_count <> v_playoff_size THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INVALID_PLAYOFF_POOL',
      'expected_count', v_playoff_size,
      'actual_count', v_entrant_count
    );
  END IF;

  SELECT
    array_agg(id ORDER BY seed, team_name, id) FILTER (WHERE seed IS NOT NULL),
    array_agg(id ORDER BY md5(p_tournament_id::text || ':' || id::text), team_name, id)
      FILTER (WHERE seed IS NULL)
  INTO v_seeded_ids, v_unseeded_ids
  FROM public.doubles_elimination_teams
  WHERE tournament_id = p_tournament_id
    AND id = ANY(v_entrant_ids);

  v_seed_positions := public.doubles_elimination_seed_positions(v_entrant_count);
  IF v_seed_positions IS NULL OR cardinality(v_seed_positions) <> v_entrant_count THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_PLAYOFF_SIZE');
  END IF;

  v_positions := array_fill(NULL::uuid, ARRAY[v_entrant_count]);
  IF coalesce(cardinality(v_seeded_ids), 0) > 0 THEN
    FOR v_i IN 1..cardinality(v_seeded_ids) LOOP
      v_positions[v_seed_positions[v_i] + 1] := v_seeded_ids[v_i];
    END LOOP;
  END IF;

  FOR v_slot IN 1..v_entrant_count LOOP
    IF v_positions[v_slot] IS NULL THEN
      IF v_unseeded_ids IS NULL OR v_unseeded_index > cardinality(v_unseeded_ids) THEN
        RETURN json_build_object('success', false, 'error', 'INVALID_SEEDING_POOL');
      END IF;
      v_positions[v_slot] := v_unseeded_ids[v_unseeded_index];
      v_unseeded_index := v_unseeded_index + 1;
    END IF;
  END LOOP;

  SELECT coalesce(max(display_order), -1) + 1
  INTO v_display_order
  FROM public.doubles_elimination_matches
  WHERE tournament_id = p_tournament_id;

  v_round := 4;
  v_teams_in_round := v_entrant_count;
  v_court_count := greatest(coalesce(v_t.court_count, 1), 1);
  v_base_time := localtime + interval '15 minutes';

  WHILE v_teams_in_round > 1 LOOP
    v_matches_in_round := v_teams_in_round / 2;
    v_round_type := CASE
      WHEN v_teams_in_round = 8 THEN 'quarterfinal'
      WHEN v_teams_in_round = 4 THEN 'semifinal'
      WHEN v_teams_in_round = 2 THEN 'final'
      ELSE 'elimination'
    END;
    v_best_of := CASE
      WHEN v_round_type = 'final' THEN
        CASE v_t.finals_format WHEN 'bo5' THEN 5 WHEN 'bo3' THEN 3 ELSE 1 END
      WHEN v_round_type = 'semifinal' THEN
        CASE coalesce(v_t.semifinals_format, 'bo3') WHEN 'bo5' THEN 5 WHEN 'bo3' THEN 3 ELSE 1 END
      ELSE
        CASE v_t.early_rounds_format WHEN 'bo5' THEN 5 WHEN 'bo3' THEN 3 ELSE 1 END
    END;

    FOR v_i IN 0..v_matches_in_round - 1 LOOP
      IF v_round = 4 THEN
        v_court := (v_i % v_court_count) + 1;
        v_start_time := to_char(
          v_base_time + make_interval(mins => (v_i / v_court_count) * 20),
          'HH24:MI'
        );
      ELSE
        v_court := NULL;
        v_start_time := NULL;
      END IF;

      INSERT INTO public.doubles_elimination_matches (
        tournament_id, round_number, round_type, bracket_type, match_number,
        team_a_id, team_b_id, score_a, score_b, winner_id, best_of, games,
        games_won_a, games_won_b, source_a, source_b, dest_winner,
        dest_loser, is_bye, display_order, status, court_number, start_time,
        generation_key
      ) VALUES (
        p_tournament_id, v_round, v_round_type, 'single', v_i + 1,
        CASE WHEN v_round = 4 THEN v_positions[v_i * 2 + 1] ELSE NULL END,
        CASE WHEN v_round = 4 THEN v_positions[v_i * 2 + 2] ELSE NULL END,
        0, 0, NULL, v_best_of, '[]'::jsonb, 0, 0,
        CASE WHEN v_round = 4
          THEN jsonb_build_object('type', 'bracket_position', 'position', v_i * 2)
          ELSE jsonb_build_object('type', 'winner_of', 'round', v_round - 1, 'match_index', v_i * 2)
        END,
        CASE WHEN v_round = 4
          THEN jsonb_build_object('type', 'bracket_position', 'position', v_i * 2 + 1)
          ELSE jsonb_build_object('type', 'winner_of', 'round', v_round - 1, 'match_index', v_i * 2 + 1)
        END,
        CASE WHEN v_teams_in_round = 2 THEN jsonb_build_object('type', 'CHAMPION') ELSE NULL END,
        jsonb_build_object('type', 'ELIMINATED'),
        false, v_display_order, 'pending', v_court, v_start_time,
        'playoff:r' || v_round::text || ':' || (v_i + 1)::text
      );
      v_display_order := v_display_order + 1;
    END LOOP;

    v_teams_in_round := v_matches_in_round;
    v_round := v_round + 1;
  END LOOP;

  IF v_t.has_third_place_match AND v_entrant_count >= 4 THEN
    v_best_of := CASE v_t.finals_format
      WHEN 'bo5' THEN 5
      WHEN 'bo3' THEN 3
      ELSE 1
    END;

    INSERT INTO public.doubles_elimination_matches (
      tournament_id, round_number, round_type, bracket_type, match_number,
      score_a, score_b, winner_id, best_of, games, games_won_a, games_won_b,
      source_a, source_b, is_bye, display_order, status, generation_key
    ) VALUES (
      p_tournament_id, v_round - 1, 'third_place', 'single', 1,
      0, 0, NULL, v_best_of, '[]'::jsonb, 0, 0,
      jsonb_build_object('type', 'loser_of', 'round_type', 'semifinal', 'match_index', 0),
      jsonb_build_object('type', 'loser_of', 'round_type', 'semifinal', 'match_index', 1),
      false, v_display_order, 'pending', 'playoff:third_place'
    );
    v_display_order := v_display_order + 1;
  END IF;

  RETURN json_build_object(
    'success', true,
    'idempotent', false,
    'action', 'playoff_generated',
    'playoff_size', v_entrant_count,
    'playoff_match_count', v_display_order - (v_r1_count + v_r2_count + v_r3_count)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.advance_doubles_elimination_lifecycle(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advance_doubles_elimination_lifecycle(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.advance_doubles_elimination_lifecycle(uuid) TO authenticated;

COMMENT ON FUNCTION public.advance_doubles_elimination_lifecycle(uuid) IS
  'Idempotently assigns ranked R3 participants or generates the seeded playoff under a tournament lock.';

CREATE OR REPLACE FUNCTION public.clear_doubles_elimination_live_draft_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    NEW.referee_live_state := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_doubles_elimination_live_draft_on_completion() FROM PUBLIC;

DROP TRIGGER IF EXISTS clear_doubles_elimination_live_draft_on_completion
  ON public.doubles_elimination_matches;
CREATE TRIGGER clear_doubles_elimination_live_draft_on_completion
  BEFORE UPDATE OF status
  ON public.doubles_elimination_matches
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public.clear_doubles_elimination_live_draft_on_completion();

CREATE OR REPLACE FUNCTION public.trigger_advance_doubles_elimination_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result json;
BEGIN
  v_result := public.advance_doubles_elimination_lifecycle(NEW.tournament_id);

  IF coalesce((v_result ->> 'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'DE_LIFECYCLE_' || coalesce(v_result ->> 'error', 'UNKNOWN');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_advance_doubles_elimination_lifecycle() FROM PUBLIC;

DROP TRIGGER IF EXISTS advance_doubles_elimination_after_score
  ON public.doubles_elimination_matches;
CREATE TRIGGER advance_doubles_elimination_after_score
  AFTER UPDATE OF status, winner_id
  ON public.doubles_elimination_matches
  FOR EACH ROW
  WHEN (
    NEW.status = 'completed'
    AND (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD.winner_id IS DISTINCT FROM NEW.winner_id
    )
  )
  EXECUTE FUNCTION public.trigger_advance_doubles_elimination_lifecycle();

NOTIFY pgrst, 'reload schema';
