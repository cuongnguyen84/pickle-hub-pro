-- Task 4: Team Match schedule/bracket generation and reset lifecycle.
-- The previous implementations inserted matches, linked the tree, inserted
-- games and changed tournament/group state across many client requests.
-- These RPCs validate the complete input under one tournament lock and commit
-- each organizer action as one transaction.

CREATE OR REPLACE FUNCTION public.seed_team_match_games_locked(
  p_match_id uuid,
  p_randomize boolean
)
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
  v_rows integer := 0;
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
    SELECT game_type, scoring_type, display_name,
           row_number() OVER (
             ORDER BY CASE WHEN p_randomize THEN random() END, order_index, id
           )::integer - 1 AS slot
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
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_created := v_rows;

  IF COALESCE(v_has_dreambreaker, false) AND v_template_count % 2 = 0 THEN
    INSERT INTO public.team_match_games (
      match_id, order_index, game_type, scoring_type, display_name,
      is_dreambreaker, score_a, score_b, status
    ) VALUES (
      p_match_id, v_template_count, 'MS', 'rally21', 'Dreambreaker',
      true, 0, 0, 'pending'
    )
    ON CONFLICT (match_id, order_index) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_created := v_created + v_rows;
  END IF;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_team_match_games_locked(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_team_match_games_locked(uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.seed_team_match_games_locked(uuid, boolean) FROM authenticated;

-- Keep the scoring RPC's one-argument helper contract stable.
CREATE OR REPLACE FUNCTION public.seed_team_match_games_locked(p_match_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.seed_team_match_games_locked(p_match_id, false);
$$;
REVOKE ALL ON FUNCTION public.seed_team_match_games_locked(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_team_match_games_locked(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.seed_team_match_games_locked(uuid) FROM authenticated;


CREATE OR REPLACE FUNCTION public.generate_team_match_round_robin_atomic(
  p_tournament_id uuid,
  p_groups jsonb DEFAULT '[]'::jsonb,
  p_randomize_game_order boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.team_match_tournaments;
  v_group_mode boolean;
  v_group_count integer;
  v_approved_count integer;
  v_plan_count integer;
  v_group_index integer;
  v_group_id uuid;
  v_ids uuid[];
  v_size integer;
  v_round integer;
  v_i integer;
  v_j integer;
  v_last uuid;
  v_a uuid;
  v_b uuid;
  v_match_id uuid;
  v_display_order integer := 0;
  v_game_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF jsonb_typeof(coalesce(p_groups, 'null'::jsonb)) <> 'array' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_GROUP_PLAN');
  END IF;

  SELECT * INTO v_t
  FROM public.team_match_tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TOURNAMENT_NOT_FOUND');
  END IF;
  IF v_t.created_by <> auth.uid() AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  v_group_count := jsonb_array_length(p_groups);
  v_group_mode := v_group_count > 0;
  IF v_group_mode AND (v_t.format <> 'rr_playoff' OR v_group_count < 2 OR v_group_count > 26) THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_GROUP_PLAN');
  END IF;
  IF EXISTS (SELECT 1 FROM public.team_match_matches WHERE tournament_id = p_tournament_id)
     OR EXISTS (SELECT 1 FROM public.team_match_groups WHERE tournament_id = p_tournament_id) THEN
    IF v_group_mode
       AND EXISTS (SELECT 1 FROM public.team_match_groups WHERE tournament_id = p_tournament_id)
       AND EXISTS (SELECT 1 FROM public.team_match_matches
                   WHERE tournament_id = p_tournament_id AND NOT is_playoff) THEN
      RETURN json_build_object('success', true, 'idempotent', true, 'action', 'group_stage');
    ELSIF NOT v_group_mode
       AND NOT EXISTS (SELECT 1 FROM public.team_match_groups WHERE tournament_id = p_tournament_id)
       AND EXISTS (SELECT 1 FROM public.team_match_matches
                   WHERE tournament_id = p_tournament_id AND NOT is_playoff) THEN
      RETURN json_build_object('success', true, 'idempotent', true, 'action', 'round_robin');
    END IF;
    RETURN json_build_object('success', false, 'error', 'LIFECYCLE_ALREADY_STARTED');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_match_game_templates WHERE tournament_id = p_tournament_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'NO_TEMPLATES');
  END IF;

  SELECT count(*)::integer INTO v_approved_count
  FROM public.team_match_teams
  WHERE tournament_id = p_tournament_id AND status = 'approved';
  IF v_approved_count < 2 THEN
    RETURN json_build_object('success', false, 'error', 'TOO_FEW_TEAMS');
  END IF;

  DROP TABLE IF EXISTS pg_temp.tm_rr_plan;
  DROP TABLE IF EXISTS pg_temp.tm_rr_group_map;
  CREATE TEMP TABLE tm_rr_plan (
    group_index integer NOT NULL,
    team_order integer NOT NULL,
    team_id uuid NOT NULL,
    PRIMARY KEY (group_index, team_order),
    UNIQUE (team_id)
  ) ON COMMIT DROP;
  CREATE TEMP TABLE tm_rr_group_map (
    group_index integer PRIMARY KEY,
    group_id uuid NOT NULL UNIQUE
  ) ON COMMIT DROP;

  IF v_group_mode THEN
    INSERT INTO tm_rr_plan (group_index, team_order, team_id)
    SELECT (g_ord - 1)::integer, (t_ord - 1)::integer, team_text::uuid
    FROM jsonb_array_elements(p_groups) WITH ORDINALITY AS groups(group_json, g_ord)
    CROSS JOIN LATERAL jsonb_array_elements_text(group_json) WITH ORDINALITY
      AS teams(team_text, t_ord);

    IF EXISTS (
      SELECT 1 FROM generate_series(0, v_group_count - 1) AS wanted(group_index)
      LEFT JOIN (
        SELECT group_index, count(*) AS team_count
        FROM tm_rr_plan GROUP BY group_index
      ) actual USING (group_index)
      WHERE coalesce(actual.team_count, 0) < 2
    ) THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_GROUP_PLAN');
    END IF;
  ELSE
    INSERT INTO tm_rr_plan (group_index, team_order, team_id)
    SELECT -1, row_number() OVER (ORDER BY seed NULLS LAST, created_at, id)::integer - 1, id
    FROM public.team_match_teams
    WHERE tournament_id = p_tournament_id AND status = 'approved';
  END IF;

  SELECT count(*)::integer INTO v_plan_count FROM tm_rr_plan;
  IF v_plan_count <> v_approved_count
     OR EXISTS (
       SELECT 1 FROM tm_rr_plan p
       LEFT JOIN public.team_match_teams t ON t.id = p.team_id
       WHERE t.id IS NULL OR t.tournament_id <> p_tournament_id OR t.status <> 'approved'
     ) THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_GROUP_PLAN');
  END IF;

  IF v_group_mode THEN
    FOR v_group_index IN 0..v_group_count - 1
    LOOP
      v_group_id := gen_random_uuid();
      INSERT INTO tm_rr_group_map VALUES (v_group_index, v_group_id);
      INSERT INTO public.team_match_groups (id, tournament_id, name, display_order)
      VALUES (v_group_id, p_tournament_id,
              'Bảng ' || chr(65 + v_group_index), v_group_index);
    END LOOP;

    UPDATE public.team_match_teams t
    SET group_id = m.group_id
    FROM tm_rr_plan p
    JOIN tm_rr_group_map m USING (group_index)
    WHERE t.id = p.team_id;
  END IF;

  FOR v_group_index IN
    SELECT DISTINCT group_index FROM tm_rr_plan ORDER BY group_index
  LOOP
    SELECT array_agg(team_id ORDER BY team_order) INTO v_ids
    FROM tm_rr_plan WHERE group_index = v_group_index;
    v_size := cardinality(v_ids);
    IF v_size % 2 <> 0 THEN
      v_ids := array_append(v_ids, NULL::uuid);
      v_size := v_size + 1;
    END IF;
    IF v_group_index >= 0 THEN
      SELECT group_id INTO v_group_id
      FROM tm_rr_group_map WHERE group_index = v_group_index;
    ELSE
      v_group_id := NULL;
    END IF;

    FOR v_round IN 1..v_size - 1
    LOOP
      FOR v_i IN 1..v_size / 2
      LOOP
        v_a := v_ids[v_i];
        v_b := v_ids[v_size - v_i + 1];
        IF v_a IS NOT NULL AND v_b IS NOT NULL THEN
          INSERT INTO public.team_match_matches (
            tournament_id, group_id, team_a_id, team_b_id, round_number,
            is_playoff, status, display_order
          ) VALUES (
            p_tournament_id, v_group_id, v_a, v_b, v_round,
            false, 'pending', v_display_order
          ) RETURNING id INTO v_match_id;
          v_display_order := v_display_order + 1;
          v_game_count := v_game_count
            + public.seed_team_match_games_locked(v_match_id, p_randomize_game_order);
        END IF;
      END LOOP;
      v_last := v_ids[v_size];
      FOR v_j IN REVERSE v_size..3 LOOP
        v_ids[v_j] := v_ids[v_j - 1];
      END LOOP;
      v_ids[2] := v_last;
    END LOOP;
  END LOOP;

  IF v_group_mode THEN
    UPDATE public.team_match_tournaments
    SET group_count = v_group_count, status = 'ongoing'
    WHERE id = p_tournament_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'action', CASE WHEN v_group_mode THEN 'group_stage' ELSE 'round_robin' END,
    'group_count', CASE WHEN v_group_mode THEN v_group_count ELSE 0 END,
    'match_count', v_display_order,
    'game_count', v_game_count
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', CASE
        WHEN SQLSTATE IN ('22P02', '22023', '23505') THEN 'INVALID_GROUP_PLAN'
        ELSE 'LIFECYCLE_FAILED'
      END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_team_match_round_robin_atomic(uuid, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_team_match_round_robin_atomic(uuid, jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_team_match_round_robin_atomic(uuid, jsonb, boolean) TO authenticated;


CREATE OR REPLACE FUNCTION public.generate_team_match_brackets_atomic(
  p_tournament_id uuid,
  p_branches jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.team_match_tournaments;
  v_branch jsonb;
  v_branch_key text;
  v_is_repechage boolean;
  v_first_round jsonb;
  v_first_count integer;
  v_team_count integer;
  v_power integer;
  v_total_rounds integer;
  v_round integer;
  v_position integer;
  v_match_id uuid;
  v_next_id uuid;
  v_team_a uuid;
  v_team_b uuid;
  v_created_matches integer := 0;
  v_created_games integer := 0;
  v_created_branches integer := 0;
  v_requested integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF jsonb_typeof(coalesce(p_branches, 'null'::jsonb)) <> 'array' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_BRACKET_PLAN');
  END IF;
  v_requested := jsonb_array_length(p_branches);
  IF v_requested < 1 OR v_requested > 2 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_BRACKET_PLAN');
  END IF;

  SELECT * INTO v_t
  FROM public.team_match_tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TOURNAMENT_NOT_FOUND');
  END IF;
  IF v_t.created_by <> auth.uid() AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;
  IF v_t.format NOT IN ('single_elimination', 'rr_playoff') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_FORMAT');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_match_game_templates WHERE tournament_id = p_tournament_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'NO_TEMPLATES');
  END IF;
  IF v_t.format = 'rr_playoff' AND EXISTS (
    SELECT 1 FROM public.team_match_matches
    WHERE tournament_id = p_tournament_id AND NOT is_playoff AND status <> 'completed'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'GROUP_STAGE_INCOMPLETE');
  END IF;

  DROP TABLE IF EXISTS pg_temp.tm_branch_plan;
  DROP TABLE IF EXISTS pg_temp.tm_branch_teams;
  DROP TABLE IF EXISTS pg_temp.tm_bracket_nodes;
  CREATE TEMP TABLE tm_branch_plan (
    branch_key text PRIMARY KEY,
    is_repechage boolean NOT NULL UNIQUE,
    first_round jsonb NOT NULL,
    total_rounds integer NOT NULL,
    already_exists boolean NOT NULL DEFAULT false
  ) ON COMMIT DROP;
  CREATE TEMP TABLE tm_branch_teams (
    branch_key text NOT NULL,
    team_id uuid NOT NULL,
    PRIMARY KEY (branch_key, team_id)
  ) ON COMMIT DROP;
  CREATE TEMP TABLE tm_bracket_nodes (
    branch_key text NOT NULL,
    playoff_round integer NOT NULL,
    bracket_position integer NOT NULL,
    match_id uuid NOT NULL UNIQUE,
    PRIMARY KEY (branch_key, playoff_round, bracket_position)
  ) ON COMMIT DROP;

  FOR v_branch IN SELECT value FROM jsonb_array_elements(p_branches)
  LOOP
    IF jsonb_typeof(v_branch) <> 'object'
       OR jsonb_typeof(v_branch -> 'first_round') <> 'array' THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_BRACKET_PLAN');
    END IF;
    v_is_repechage := coalesce((v_branch ->> 'is_repechage')::boolean, false);
    v_branch_key := CASE WHEN v_is_repechage THEN 'repechage' ELSE 'main' END;
    v_first_round := v_branch -> 'first_round';
    v_first_count := jsonb_array_length(v_first_round);
    IF v_first_count < 1 OR (v_first_count & (v_first_count - 1)) <> 0 THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_BRACKET_SIZE');
    END IF;
    IF v_is_repechage AND (v_t.format <> 'rr_playoff' OR NOT coalesce(v_t.has_repechage, false)) THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_REPECHAGE');
    END IF;

    v_team_count := v_first_count * 2;
    v_power := 1;
    v_total_rounds := 0;
    WHILE v_power < v_team_count LOOP
      v_power := v_power * 2;
      v_total_rounds := v_total_rounds + 1;
    END LOOP;
    IF v_power <> v_team_count THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_BRACKET_SIZE');
    END IF;

    INSERT INTO tm_branch_plan (
      branch_key, is_repechage, first_round, total_rounds, already_exists
    ) VALUES (
      v_branch_key, v_is_repechage, v_first_round, v_total_rounds,
      EXISTS (
        SELECT 1 FROM public.team_match_matches
        WHERE tournament_id = p_tournament_id
          AND is_playoff AND NOT coalesce(is_third_place, false)
          AND coalesce(is_repechage, false) = v_is_repechage
      )
    );

    FOR v_position IN 0..v_first_count - 1
    LOOP
      IF jsonb_typeof(v_first_round -> v_position) <> 'object'
         OR coalesce(v_first_round -> v_position ->> 'team_a_id', '') = ''
         OR coalesce(v_first_round -> v_position ->> 'team_b_id', '') = '' THEN
        RETURN json_build_object('success', false, 'error', 'INVALID_BRACKET_PLAN');
      END IF;
      v_team_a := (v_first_round -> v_position ->> 'team_a_id')::uuid;
      v_team_b := (v_first_round -> v_position ->> 'team_b_id')::uuid;
      IF v_team_a = v_team_b THEN
        RETURN json_build_object('success', false, 'error', 'INVALID_BRACKET_PLAN');
      END IF;
      INSERT INTO tm_branch_teams VALUES (v_branch_key, v_team_a);
      INSERT INTO tm_branch_teams VALUES (v_branch_key, v_team_b);
    END LOOP;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM tm_branch_plan WHERE branch_key = 'main')
     AND NOT EXISTS (
       SELECT 1 FROM public.team_match_matches
       WHERE tournament_id = p_tournament_id AND is_playoff
         AND NOT coalesce(is_repechage, false)
         AND NOT coalesce(is_third_place, false)
     ) THEN
    RETURN json_build_object('success', false, 'error', 'MAIN_BRACKET_REQUIRED');
  END IF;
  IF EXISTS (
    SELECT 1 FROM tm_branch_teams p
    LEFT JOIN public.team_match_teams t ON t.id = p.team_id
    WHERE t.id IS NULL OR t.tournament_id <> p_tournament_id OR t.status <> 'approved'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_BRACKET_TEAM');
  END IF;
  IF EXISTS (
    SELECT team_id FROM tm_branch_teams GROUP BY team_id HAVING count(*) > 1
  ) THEN
    RETURN json_build_object('success', false, 'error', 'DUPLICATE_BRACKET_TEAM');
  END IF;
  IF EXISTS (
    SELECT 1
    FROM tm_branch_plan bp
    JOIN tm_branch_teams bt ON bt.branch_key = bp.branch_key
    JOIN public.team_match_matches m
      ON m.tournament_id = p_tournament_id
     AND m.is_playoff
     AND NOT coalesce(m.is_repechage, false)
     AND NOT coalesce(m.is_third_place, false)
     AND bt.team_id IN (m.team_a_id, m.team_b_id)
    WHERE bp.branch_key = 'repechage' AND NOT bp.already_exists
  ) THEN
    RETURN json_build_object('success', false, 'error', 'DUPLICATE_BRACKET_TEAM');
  END IF;
  -- Create only missing requested branches. This makes a lost-response retry
  -- idempotent and permits a repechage branch to be added later if qualification
  -- was not yet available when the main bracket was created.
  FOR v_branch_key, v_is_repechage, v_first_round, v_total_rounds IN
    SELECT branch_key, is_repechage, first_round, total_rounds
    FROM tm_branch_plan WHERE NOT already_exists
    ORDER BY is_repechage
  LOOP
    v_first_count := jsonb_array_length(v_first_round);
    FOR v_position IN 0..v_first_count - 1
    LOOP
      v_match_id := gen_random_uuid();
      v_team_a := (v_first_round -> v_position ->> 'team_a_id')::uuid;
      v_team_b := (v_first_round -> v_position ->> 'team_b_id')::uuid;
      INSERT INTO public.team_match_matches (
        id, tournament_id, team_a_id, team_b_id, status, is_playoff,
        is_repechage, playoff_round, bracket_position, display_order
      ) VALUES (
        v_match_id, p_tournament_id, v_team_a, v_team_b, 'pending', true,
        v_is_repechage, v_total_rounds, v_position,
        CASE WHEN v_is_repechage THEN 1000 ELSE 0 END + v_position
      );
      INSERT INTO tm_bracket_nodes VALUES (
        v_branch_key, v_total_rounds, v_position, v_match_id
      );
      v_created_matches := v_created_matches + 1;
      v_created_games := v_created_games
        + public.seed_team_match_games_locked(v_match_id, false);
    END LOOP;

    IF v_total_rounds > 1 THEN
      FOR v_round IN REVERSE v_total_rounds - 1..1
      LOOP
        FOR v_position IN 0..(power(2, v_round - 1)::integer - 1)
        LOOP
          v_match_id := gen_random_uuid();
          INSERT INTO public.team_match_matches (
            id, tournament_id, status, is_playoff, is_repechage,
            playoff_round, bracket_position, display_order
          ) VALUES (
            v_match_id, p_tournament_id, 'pending', true, v_is_repechage,
            v_round, v_position,
            CASE WHEN v_is_repechage THEN 1000 ELSE 0 END
              + 100 + (v_total_rounds - v_round) * 10 + v_position
          );
          INSERT INTO tm_bracket_nodes VALUES (
            v_branch_key, v_round, v_position, v_match_id
          );
          v_created_matches := v_created_matches + 1;
        END LOOP;
      END LOOP;

      FOR v_round IN REVERSE v_total_rounds..2
      LOOP
        FOR v_position IN 0..(power(2, v_round - 1)::integer - 1)
        LOOP
          SELECT match_id INTO v_next_id
          FROM tm_bracket_nodes
          WHERE branch_key = v_branch_key
            AND playoff_round = v_round - 1
            AND bracket_position = v_position / 2;
          UPDATE public.team_match_matches
          SET next_match_id = v_next_id,
              next_match_slot = (v_position % 2) + 1
          WHERE id = (
            SELECT match_id FROM tm_bracket_nodes
            WHERE branch_key = v_branch_key
              AND playoff_round = v_round
              AND bracket_position = v_position
          );
        END LOOP;
      END LOOP;
    END IF;

    IF v_branch_key = 'main' AND v_t.format = 'single_elimination'
       AND coalesce(v_t.has_third_place_match, false)
       AND v_first_count >= 2
       AND NOT EXISTS (
         SELECT 1 FROM public.team_match_matches
         WHERE tournament_id = p_tournament_id AND is_third_place
       ) THEN
      INSERT INTO public.team_match_matches (
        tournament_id, status, is_playoff, is_repechage, is_third_place,
        playoff_round, bracket_position, display_order
      ) VALUES (
        p_tournament_id, 'pending', true, false, true, 0, 0, 999
      );
      v_created_matches := v_created_matches + 1;
    END IF;
    v_created_branches := v_created_branches + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'idempotent', v_created_branches = 0,
    'branch_count', v_created_branches,
    'match_count', v_created_matches,
    'game_count', v_created_games
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', CASE
        WHEN SQLSTATE IN ('22P02', '22023', '23505') THEN 'INVALID_BRACKET_PLAN'
        ELSE 'LIFECYCLE_FAILED'
      END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_team_match_brackets_atomic(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_team_match_brackets_atomic(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_team_match_brackets_atomic(uuid, jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION public.reset_team_match_lifecycle_atomic(
  p_tournament_id uuid,
  p_scope text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.team_match_tournaments;
  v_matches integer := 0;
  v_groups integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF p_scope NOT IN ('schedule', 'group_stage') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_RESET_SCOPE');
  END IF;
  SELECT * INTO v_t
  FROM public.team_match_tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TOURNAMENT_NOT_FOUND');
  END IF;
  IF v_t.created_by <> auth.uid() AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  DELETE FROM public.team_match_matches WHERE tournament_id = p_tournament_id;
  GET DIAGNOSTICS v_matches = ROW_COUNT;
  IF p_scope = 'group_stage' THEN
    UPDATE public.team_match_teams SET group_id = NULL
    WHERE tournament_id = p_tournament_id;
    DELETE FROM public.team_match_groups WHERE tournament_id = p_tournament_id;
    GET DIAGNOSTICS v_groups = ROW_COUNT;
  END IF;
  UPDATE public.team_match_tournaments
  SET status = 'registration',
      group_count = CASE WHEN p_scope = 'group_stage' THEN NULL ELSE group_count END
  WHERE id = p_tournament_id;

  RETURN json_build_object(
    'success', true, 'matches_deleted', v_matches, 'groups_deleted', v_groups
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_team_match_lifecycle_atomic(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_team_match_lifecycle_atomic(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_team_match_lifecycle_atomic(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.start_team_match_round_atomic(
  p_tournament_id uuid,
  p_round_number integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.team_match_tournaments;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF p_round_number < 1 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_ROUND');
  END IF;
  SELECT * INTO v_t
  FROM public.team_match_tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TOURNAMENT_NOT_FOUND');
  END IF;
  IF v_t.created_by <> auth.uid() AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  UPDATE public.team_match_matches
  SET status = 'in_progress'
  WHERE tournament_id = p_tournament_id
    AND round_number = p_round_number
    AND NOT is_playoff
    AND status IN ('pending', 'lineup');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN json_build_object('success', true, 'updated', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.start_team_match_round_atomic(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_team_match_round_atomic(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_team_match_round_atomic(uuid, integer) TO authenticated;
