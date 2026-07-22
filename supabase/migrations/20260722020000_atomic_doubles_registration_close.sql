-- Task 4.2: close Doubles Elimination registration and create the complete
-- R1/R2/R3 preliminary graph in the same transaction.
--
-- Older clients may retry the RPC after a network timeout. generation_key is
-- nullable for legacy rows and unique only for newly generated nodes, so the
-- retry is idempotent without rewriting historical brackets.
--
-- Forward-only rollback reasoning: deploy the previous one-argument function
-- body if a client rollback is required. Keep generation_key and its partial
-- unique index; both are additive and protect already-created brackets.

ALTER TABLE public.doubles_elimination_matches
  ADD COLUMN IF NOT EXISTS generation_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_doubles_elimination_generated_match
  ON public.doubles_elimination_matches (tournament_id, generation_key)
  WHERE generation_key IS NOT NULL;

COMMENT ON COLUMN public.doubles_elimination_matches.generation_key IS
  'Stable idempotency key for server-generated bracket nodes; NULL on legacy/client-generated rows.';

DROP FUNCTION IF EXISTS public.close_doubles_elimination_registration(uuid);

CREATE OR REPLACE FUNCTION public.close_doubles_elimination_registration(
  p_tournament_id uuid,
  p_seeding_strategy text DEFAULT 'dupr'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_t public.doubles_elimination_tournaments;
  v_count integer;
  v_existing_count integer;
  v_team_ids uuid[];
  v_loser_order integer[];
  v_playable_r1 integer;
  v_r1_count integer;
  v_r2_count integer;
  v_candidate_count integer;
  v_playoff_size integer := 1;
  v_r3_count integer;
  v_early_best_of integer;
  v_display_order integer := 0;
  v_play_slot integer := 0;
  v_court integer;
  v_time text;
  v_i integer;
  v_first_source integer;
  v_second_source integer;
  v_has_second boolean;
BEGIN
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  IF p_seeding_strategy NOT IN ('manual', 'random', 'dupr') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_SEEDING_STRATEGY');
  END IF;

  SELECT *
  INTO v_t
  FROM public.doubles_elimination_tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TOURNAMENT_NOT_FOUND');
  END IF;

  IF v_t.creator_user_id <> v_caller AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_OWNER');
  END IF;

  SELECT count(*)::integer
  INTO v_existing_count
  FROM public.doubles_elimination_matches
  WHERE tournament_id = p_tournament_id;

  -- A successful response may have been lost on the wire. Do not generate a
  -- second graph; report the committed graph as the result of the retry.
  IF v_t.status IN ('ongoing', 'completed') AND v_existing_count > 0 THEN
    SELECT count(*)::integer
    INTO v_count
    FROM public.doubles_elimination_teams
    WHERE tournament_id = p_tournament_id;

    RETURN json_build_object(
      'success', true,
      'idempotent', true,
      'count', v_count,
      'match_count', v_existing_count
    );
  END IF;

  IF v_t.status <> 'registration_open' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'NOT_REGISTRATION_OPEN',
      'status', v_t.status
    );
  END IF;

  IF v_existing_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'BRACKET_ALREADY_EXISTS',
      'match_count', v_existing_count
    );
  END IF;

  SELECT count(*)::integer
  INTO v_count
  FROM public.doubles_elimination_teams
  WHERE tournament_id = p_tournament_id;

  IF v_count < v_t.team_count THEN
    RETURN json_build_object(
      'success', false,
      'error', 'NOT_FULL',
      'count', v_count,
      'capacity', v_t.team_count
    );
  END IF;

  IF v_count > v_t.team_count THEN
    RETURN json_build_object(
      'success', false,
      'error', 'TEAM_COUNT_MISMATCH',
      'count', v_count,
      'capacity', v_t.team_count
    );
  END IF;

  IF v_count < 2 THEN
    RETURN json_build_object('success', false, 'error', 'NOT_ENOUGH_TEAMS');
  END IF;

  -- Assign stable seeds first; the bracket reads the exact order written here.
  -- Public registration keeps the default DUPR order. Manual creation can
  -- preserve organizer seeds or request a deterministic per-tournament
  -- shuffle without making bracket construction a client-side transaction.
  WITH ordered AS (
    SELECT id,
      row_number() OVER (ORDER BY
        CASE WHEN p_seeding_strategy = 'manual' THEN
          CASE WHEN seed IS NULL THEN 1 ELSE 0 END
        END,
        CASE WHEN p_seeding_strategy = 'manual' THEN seed END ASC NULLS LAST,
        CASE WHEN p_seeding_strategy = 'dupr' THEN
          CASE WHEN dupr_avg_rating IS NULL THEN 1 ELSE 0 END
        END,
        CASE WHEN p_seeding_strategy = 'dupr' THEN dupr_avg_rating END DESC NULLS LAST,
        CASE WHEN p_seeding_strategy = 'random' THEN
          md5(p_tournament_id::text || ':' || id::text)
        END,
        team_name,
        id
      ) AS rn
    FROM public.doubles_elimination_teams
    WHERE tournament_id = p_tournament_id
  )
  UPDATE public.doubles_elimination_teams t
  SET seed = ordered.rn
  FROM ordered
  WHERE t.id = ordered.id;

  SELECT array_agg(id ORDER BY seed, team_name, id)
  INTO v_team_ids
  FROM public.doubles_elimination_teams
  WHERE tournament_id = p_tournament_id;

  v_playable_r1 := v_count / 2;
  v_r1_count := v_playable_r1 + (v_count % 2);
  v_r2_count := (v_playable_r1 + 1) / 2;
  v_candidate_count := v_r1_count + v_r2_count;

  WHILE v_playoff_size <= v_candidate_count / 2 LOOP
    v_playoff_size := v_playoff_size * 2;
  END LOOP;
  v_r3_count := v_candidate_count - v_playoff_size;

  v_early_best_of := CASE v_t.early_rounds_format
    WHEN 'bo5' THEN 5
    WHEN 'bo3' THEN 3
    ELSE 1
  END;

  -- Deterministic per-tournament shuffle preserves the old random-loser-pair
  -- intent while making retries and tests reproducible.
  SELECT array_agg(i ORDER BY md5(p_tournament_id::text || ':' || i::text))
  INTO v_loser_order
  FROM generate_series(0, v_playable_r1 - 1) AS s(i);

  -- Round 1: every team enters exactly once. An odd final team gets an
  -- explicit completed BYE node so no participant is implicit.
  FOR v_i IN 0..v_r1_count - 1 LOOP
    IF v_i < v_playable_r1 THEN
      v_court := (v_play_slot % greatest(v_t.court_count, 1)) + 1;
      v_time := CASE
        WHEN v_t.start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          THEN to_char(
            v_t.start_time::time
              + make_interval(mins => (v_play_slot / greatest(v_t.court_count, 1)) * 20),
            'HH24:MI'
          )
        ELSE NULL
      END;

      INSERT INTO public.doubles_elimination_matches (
        tournament_id, round_number, round_type, bracket_type, match_number,
        team_a_id, team_b_id, score_a, score_b, winner_id, best_of, games,
        games_won_a, games_won_b, source_a, source_b, dest_loser, is_bye,
        display_order, status, court_number, start_time, generation_key
      ) VALUES (
        p_tournament_id, 1, 'winner_r1', 'winner', v_i + 1,
        v_team_ids[v_i * 2 + 1], v_team_ids[v_i * 2 + 2], 0, 0, NULL,
        v_early_best_of, '[]'::jsonb, 0, 0,
        jsonb_build_object('type', 'team', 'team_id', v_team_ids[v_i * 2 + 1]),
        jsonb_build_object('type', 'team', 'team_id', v_team_ids[v_i * 2 + 2]),
        NULL, false, v_display_order, 'pending', v_court, v_time,
        'prelim:r1:' || (v_i + 1)::text
      );
      v_play_slot := v_play_slot + 1;
    ELSE
      INSERT INTO public.doubles_elimination_matches (
        tournament_id, round_number, round_type, bracket_type, match_number,
        team_a_id, team_b_id, score_a, score_b, winner_id, best_of, games,
        games_won_a, games_won_b, source_a, source_b, dest_loser, is_bye,
        display_order, status, generation_key
      ) VALUES (
        p_tournament_id, 1, 'winner_r1', 'winner', v_i + 1,
        v_team_ids[v_count], NULL, 0, 0, v_team_ids[v_count],
        v_early_best_of, '[]'::jsonb, 0, 0,
        jsonb_build_object('type', 'team', 'team_id', v_team_ids[v_count]),
        jsonb_build_object('type', 'bye'),
        NULL, true, v_display_order, 'completed',
        'prelim:r1:' || (v_i + 1)::text
      );
    END IF;
    v_display_order := v_display_order + 1;
  END LOOP;

  -- Round 2 consumes every playable R1 loser exactly once. An odd loser count
  -- receives an explicit BYE that auto-completes when its source resolves.
  FOR v_i IN 0..v_r2_count - 1 LOOP
    v_first_source := v_loser_order[v_i * 2 + 1];
    v_has_second := v_i * 2 + 2 <= coalesce(array_length(v_loser_order, 1), 0);
    v_second_source := CASE
      WHEN v_has_second THEN v_loser_order[v_i * 2 + 2]
      ELSE NULL
    END;

    IF v_has_second THEN
      v_court := (v_play_slot % greatest(v_t.court_count, 1)) + 1;
      v_time := CASE
        WHEN v_t.start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          THEN to_char(
            v_t.start_time::time
              + make_interval(mins => (v_play_slot / greatest(v_t.court_count, 1)) * 20),
            'HH24:MI'
          )
        ELSE NULL
      END;
      v_play_slot := v_play_slot + 1;
    ELSE
      v_court := NULL;
      v_time := NULL;
    END IF;

    INSERT INTO public.doubles_elimination_matches (
      tournament_id, round_number, round_type, bracket_type, match_number,
      score_a, score_b, winner_id, best_of, games, games_won_a, games_won_b,
      source_a, source_b, dest_loser, is_bye, display_order, status,
      court_number, start_time, generation_key
    ) VALUES (
      p_tournament_id, 2, 'loser_r2', 'loser', v_i + 1,
      0, 0, NULL, v_early_best_of, '[]'::jsonb, 0, 0,
      jsonb_build_object('type', 'loser_of', 'round', 1, 'match_index', v_first_source),
      CASE WHEN v_has_second
        THEN jsonb_build_object('type', 'loser_of', 'round', 1, 'match_index', v_second_source)
        ELSE jsonb_build_object('type', 'bye')
      END,
      jsonb_build_object('type', 'ELIMINATED'),
      NOT v_has_second, v_display_order, 'pending', v_court, v_time,
      'prelim:r2:' || (v_i + 1)::text
    );
    v_display_order := v_display_order + 1;
  END LOOP;

  -- Round 3 slots are selected later from the ranked R1/R2 winner pool. Zero
  -- R3 rows is valid when the candidate count is already a power of two.
  IF v_r3_count > 0 THEN
    FOR v_i IN 0..v_r3_count - 1 LOOP
      INSERT INTO public.doubles_elimination_matches (
        tournament_id, round_number, round_type, bracket_type, match_number,
        score_a, score_b, winner_id, best_of, games, games_won_a, games_won_b,
        source_a, source_b, dest_loser, is_bye, display_order, status,
        generation_key
      ) VALUES (
        p_tournament_id, 3, 'merge_r3', 'merged', v_i + 1,
        0, 0, NULL, v_early_best_of, '[]'::jsonb, 0, 0,
        jsonb_build_object('type', 'ranked_pool', 'position', v_i * 2),
        jsonb_build_object('type', 'ranked_pool', 'position', v_i * 2 + 1),
        jsonb_build_object('type', 'ELIMINATED'),
        false, v_display_order, 'pending',
        'prelim:r3:' || (v_i + 1)::text
      );
      v_display_order := v_display_order + 1;
    END LOOP;
  END IF;

  UPDATE public.doubles_elimination_tournaments
  SET status = 'ongoing', current_round = 1
  WHERE id = p_tournament_id;

  RETURN json_build_object(
    'success', true,
    'idempotent', false,
    'count', v_count,
    'match_count', v_display_order,
    'playoff_size', v_playoff_size,
    'r3_match_count', v_r3_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_doubles_elimination_registration(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_doubles_elimination_registration(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.close_doubles_elimination_registration(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.close_doubles_elimination_registration(uuid, text) IS
  'Atomically seeds a full roster using DUPR/manual/deterministic-random order, generates validated R1/R2/R3 nodes, and moves the tournament to ongoing; safe to retry.';

NOTIFY pgrst, 'reload schema';
