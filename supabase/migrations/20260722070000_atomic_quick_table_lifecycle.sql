-- Task 4: QuickTable roster setup and playoff creation are lifecycle
-- transitions, not collections of independent REST writes. These RPCs lock the
-- table row, validate the complete plan, and commit the related rows together.
--
-- Forward-only rollback: clients may safely roll back first; the RPCs are
-- additive. After every client stops calling them, revoke/drop the two function
-- signatures below. Rows already created by the RPCs need no data rollback.

CREATE OR REPLACE FUNCTION public.setup_quick_table_roster_atomic(
  p_table_id uuid,
  p_roster jsonb,
  p_group_assignments jsonb,
  p_courts jsonb DEFAULT '[]'::jsonb,
  p_start_time text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_table public.quick_tables;
  v_roster_count integer;
  v_group_count integer;
  v_groups_created integer := 0;
  v_item jsonb;
  v_index integer := 0;
  v_group_index integer;
  v_name text;
  v_player1_name text;
  v_player2_name text;
  v_team text;
  v_seed integer;
  v_group_id uuid;
  v_player_ids uuid[];
  v_circle uuid[];
  v_rotating uuid[];
  v_order uuid[];
  v_player1_id uuid;
  v_player2_id uuid;
  v_match_id uuid;
  v_round integer;
  v_pair integer;
  v_pair_index integer;
  v_player_total integer;
  v_rotation_count integer;
  v_display_order integer := 0;
  v_courts integer[] := ARRAY[]::integer[];
  v_court_texts text[] := ARRAY[]::text[];
  v_court_count integer := 0;
  v_home_count integer;
  v_candidates integer[];
  v_candidate integer;
  v_slot integer;
  v_best_slot integer;
  v_best_court integer;
  v_load integer;
  v_best_load integer;
  v_start_minutes integer;
  v_start_at text;
  v_scheduled integer := 0;
  v_match record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT *
  INTO v_table
  FROM public.quick_tables
  WHERE id = p_table_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TABLE_NOT_FOUND');
  END IF;

  IF v_table.creator_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  -- A successful retry after a lost response is a no-op. A table still in
  -- setup with child rows is instead treated as corrupt/legacy partial state.
  IF v_table.status <> 'setup' THEN
    IF EXISTS (SELECT 1 FROM public.quick_table_players WHERE table_id = p_table_id) THEN
      RETURN json_build_object('success', true, 'idempotent', true, 'table_id', p_table_id);
    END IF;
    RETURN json_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

  IF EXISTS (SELECT 1 FROM public.quick_table_players WHERE table_id = p_table_id)
     OR EXISTS (SELECT 1 FROM public.quick_table_groups WHERE table_id = p_table_id)
     OR EXISTS (SELECT 1 FROM public.quick_table_matches WHERE table_id = p_table_id) THEN
    RETURN json_build_object('success', false, 'error', 'PARTIAL_SETUP_EXISTS');
  END IF;

  IF v_table.format::text NOT IN ('round_robin', 'large_playoff') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_FORMAT');
  END IF;

  v_group_count := CASE
    WHEN v_table.format::text = 'round_robin' THEN v_table.group_count
    ELSE 1
  END;
  IF v_group_count IS NULL OR v_group_count < 1 OR v_group_count > 26 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_GROUP_COUNT');
  END IF;

  IF p_roster IS NULL OR jsonb_typeof(p_roster) <> 'array' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_ROSTER');
  END IF;
  v_roster_count := jsonb_array_length(p_roster);
  IF v_roster_count < 2 OR v_roster_count > 200 OR v_group_count > v_roster_count THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_ROSTER_COUNT');
  END IF;

  IF p_group_assignments IS NULL
     OR jsonb_typeof(p_group_assignments) <> 'array'
     OR jsonb_array_length(p_group_assignments) <> v_roster_count THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_ASSIGNMENTS');
  END IF;

  IF p_courts IS NULL OR jsonb_typeof(p_courts) <> 'array' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_COURTS');
  END IF;
  IF COALESCE(p_start_time, '') <> ''
     AND p_start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_START_TIME');
  END IF;

  DROP TABLE IF EXISTS pg_temp.qt_setup_player_map;
  DROP TABLE IF EXISTS pg_temp.qt_setup_group_map;
  DROP TABLE IF EXISTS pg_temp.qt_setup_schedule_courts;
  DROP TABLE IF EXISTS pg_temp.qt_setup_schedule_players;
  CREATE TEMP TABLE qt_setup_player_map (
    roster_index integer PRIMARY KEY,
    player_id uuid NOT NULL,
    name text NOT NULL,
    player1_name text,
    player2_name text,
    team text,
    seed integer,
    group_index integer NOT NULL
  ) ON COMMIT DROP;
  CREATE TEMP TABLE qt_setup_group_map (
    group_index integer PRIMARY KEY,
    group_id uuid NOT NULL
  ) ON COMMIT DROP;
  CREATE TEMP TABLE qt_setup_schedule_courts (
    court integer NOT NULL,
    slot integer NOT NULL,
    match_id uuid NOT NULL,
    PRIMARY KEY (court, slot)
  ) ON COMMIT DROP;
  CREATE TEMP TABLE qt_setup_schedule_players (
    player_id uuid NOT NULL,
    slot integer NOT NULL,
    PRIMARY KEY (player_id, slot)
  ) ON COMMIT DROP;
  -- Normalize and validate every roster row before touching persistent data.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_roster)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_ROSTER');
    END IF;

    v_name := btrim(COALESCE(v_item ->> 'name', ''));
    v_player1_name := NULLIF(btrim(COALESCE(v_item ->> 'player1_name', '')), '');
    v_player2_name := NULLIF(btrim(COALESCE(v_item ->> 'player2_name', '')), '');
    v_team := NULLIF(btrim(COALESCE(v_item ->> 'team', '')), '');

    IF v_name = '' OR length(v_name) > 100
       OR length(COALESCE(v_player1_name, '')) > 100
       OR length(COALESCE(v_player2_name, '')) > 100
       OR length(COALESCE(v_team, '')) > 100 THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_ROSTER');
    END IF;

    IF v_item ? 'seed' AND jsonb_typeof(v_item -> 'seed') <> 'null' THEN
      IF jsonb_typeof(v_item -> 'seed') <> 'number'
         OR (v_item ->> 'seed') !~ '^[0-9]+$' THEN
        RETURN json_build_object('success', false, 'error', 'INVALID_SEED');
      END IF;
      v_seed := (v_item ->> 'seed')::integer;
      IF v_seed < 1 OR v_seed > 10000 THEN
        RETURN json_build_object('success', false, 'error', 'INVALID_SEED');
      END IF;
    ELSE
      v_seed := NULL;
    END IF;

    v_item := p_group_assignments -> v_index;
    IF jsonb_typeof(v_item) <> 'number' OR (v_item #>> '{}') !~ '^[0-9]+$' THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_ASSIGNMENTS');
    END IF;
    v_group_index := (v_item #>> '{}')::integer;
    IF v_group_index < 0 OR v_group_index >= v_group_count THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_ASSIGNMENTS');
    END IF;

    INSERT INTO qt_setup_player_map
      (roster_index, player_id, name, player1_name, player2_name, team, seed, group_index)
    VALUES
      (v_index, gen_random_uuid(), v_name, v_player1_name, v_player2_name,
       v_team, v_seed, v_group_index);
    v_index := v_index + 1;
  END LOOP;

  -- A round-robin group must contain a playable pair. Large-playoff setup uses
  -- a synthetic assignment bucket only to validate roster coverage.
  IF v_table.format::text = 'round_robin' AND EXISTS (
    SELECT 1
    FROM generate_series(0, v_group_count - 1) AS wanted(group_index)
    WHERE (
      SELECT count(*) FROM qt_setup_player_map p
      WHERE p.group_index = wanted.group_index
    ) < 2
  ) THEN
    RETURN json_build_object('success', false, 'error', 'GROUP_TOO_SMALL');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_courts)
  LOOP
    IF jsonb_typeof(v_item) NOT IN ('string', 'number')
       OR (v_item #>> '{}') !~ '^[1-9][0-9]*$' THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_COURTS');
    END IF;
    v_candidate := (v_item #>> '{}')::integer;
    IF v_candidate = ANY(v_courts) THEN
      RETURN json_build_object('success', false, 'error', 'DUPLICATE_COURT');
    END IF;
    v_courts := array_append(v_courts, v_candidate);
    v_court_texts := array_append(v_court_texts, v_candidate::text);
  END LOOP;
  v_court_count := cardinality(v_courts);

  IF v_table.format::text = 'round_robin' THEN
    FOR v_group_index IN 0..v_group_count - 1
    LOOP
      v_group_id := gen_random_uuid();
      INSERT INTO qt_setup_group_map VALUES (v_group_index, v_group_id);
      INSERT INTO public.quick_table_groups (id, table_id, name, display_order)
      VALUES (v_group_id, p_table_id, chr(65 + v_group_index), v_group_index);
      v_groups_created := v_groups_created + 1;
    END LOOP;

    INSERT INTO public.quick_table_players (
      id, table_id, group_id, name, player1_name, player2_name,
      team, seed, display_order
    )
    SELECT p.player_id, p_table_id, g.group_id, p.name, p.player1_name,
           p.player2_name, p.team, p.seed, p.roster_index
    FROM qt_setup_player_map p
    JOIN qt_setup_group_map g USING (group_index)
    ORDER BY p.roster_index;

    -- Circle method (Berger tables), generated under the same table lock.
    FOR v_group_index IN 0..v_group_count - 1
    LOOP
    SELECT array_agg(player_id ORDER BY roster_index)
    INTO v_player_ids
    FROM qt_setup_player_map
    WHERE group_index = v_group_index;

    v_player_total := cardinality(v_player_ids);
    IF v_player_total < 2 THEN
      CONTINUE;
    END IF;
    v_circle := v_player_ids;
    IF v_player_total % 2 = 1 THEN
      v_circle := array_append(v_circle, NULL::uuid);
    END IF;
    v_player_total := cardinality(v_circle);
    v_rotating := v_circle[2:v_player_total];
    SELECT group_id INTO v_group_id
    FROM qt_setup_group_map WHERE group_index = v_group_index;

    FOR v_round IN 1..v_player_total - 1
    LOOP
      v_order := ARRAY[v_circle[1]]::uuid[] || v_rotating;
      v_pair_index := 0;
      FOR v_pair IN 1..v_player_total / 2
      LOOP
        v_player1_id := v_order[v_pair];
        v_player2_id := v_order[v_player_total + 1 - v_pair];
        IF v_player1_id IS NOT NULL AND v_player2_id IS NOT NULL THEN
          v_match_id := gen_random_uuid();
          INSERT INTO public.quick_table_matches (
            id, table_id, group_id, is_playoff, player1_id, player2_id,
            display_order, rr_round_number, rr_match_index
          ) VALUES (
            v_match_id, p_table_id, v_group_id, false, v_player1_id,
            v_player2_id, v_display_order, v_round, v_pair_index
          );
          v_display_order := v_display_order + 1;
          v_pair_index := v_pair_index + 1;
        END IF;
      END LOOP;

      v_rotation_count := cardinality(v_rotating);
      IF v_rotation_count > 1 THEN
        v_rotating := ARRAY[v_rotating[v_rotation_count]]::uuid[]
          || v_rotating[1:v_rotation_count - 1];
      END IF;
    END LOOP;
    END LOOP;
  ELSE
    INSERT INTO public.quick_table_players (
      id, table_id, name, player1_name, player2_name, team, seed, display_order
    )
    SELECT player_id, p_table_id, name, player1_name, player2_name,
           team, seed, roster_index
    FROM qt_setup_player_map
    ORDER BY roster_index;
  END IF;

  -- Pair-aware greedy schedule. Matches are processed by RR round and group;
  -- each court/player has at most one match per slot and no player gets a third
  -- consecutive slot when a later slot is available.
  IF v_court_count > 0 THEN
    v_home_count := LEAST(v_group_count, v_court_count);
    IF COALESCE(p_start_time, '') <> '' THEN
      v_start_minutes := split_part(p_start_time, ':', 1)::integer * 60
        + split_part(p_start_time, ':', 2)::integer;
    END IF;

    FOR v_match IN
      SELECT m.id, m.player1_id, m.player2_id, g.display_order AS group_index
      FROM public.quick_table_matches m
      JOIN public.quick_table_groups g ON g.id = m.group_id
      WHERE m.table_id = p_table_id AND NOT m.is_playoff
      ORDER BY m.rr_round_number, g.display_order, m.rr_match_index, m.id
    LOOP
      IF v_match.group_index < v_home_count THEN
        v_candidates := ARRAY[v_courts[v_match.group_index + 1]]::integer[];
        IF v_court_count > v_home_count THEN
          v_candidates := v_candidates || v_courts[v_home_count + 1:v_court_count];
        END IF;
      ELSE
        v_candidates := v_courts;
      END IF;

      v_best_slot := NULL;
      v_best_court := NULL;
      v_best_load := NULL;
      FOREACH v_candidate IN ARRAY v_candidates
      LOOP
        v_slot := 0;
        LOOP
          EXIT WHEN NOT EXISTS (
              SELECT 1 FROM qt_setup_schedule_courts
              WHERE court = v_candidate AND slot = v_slot
            )
            AND NOT EXISTS (
              SELECT 1 FROM qt_setup_schedule_players
              WHERE player_id IN (v_match.player1_id, v_match.player2_id)
                AND slot = v_slot
            )
            AND NOT EXISTS (
              SELECT 1
              FROM (VALUES (v_match.player1_id), (v_match.player2_id)) AS players(player_id)
              WHERE player_id IS NOT NULL
                AND (
                  (EXISTS (SELECT 1 FROM qt_setup_schedule_players s WHERE s.player_id = players.player_id AND s.slot = v_slot - 1)
                   AND EXISTS (SELECT 1 FROM qt_setup_schedule_players s WHERE s.player_id = players.player_id AND s.slot = v_slot - 2))
                  OR
                  (EXISTS (SELECT 1 FROM qt_setup_schedule_players s WHERE s.player_id = players.player_id AND s.slot = v_slot - 1)
                   AND EXISTS (SELECT 1 FROM qt_setup_schedule_players s WHERE s.player_id = players.player_id AND s.slot = v_slot + 1))
                  OR
                  (EXISTS (SELECT 1 FROM qt_setup_schedule_players s WHERE s.player_id = players.player_id AND s.slot = v_slot + 1)
                   AND EXISTS (SELECT 1 FROM qt_setup_schedule_players s WHERE s.player_id = players.player_id AND s.slot = v_slot + 2))
                )
            );
          v_slot := v_slot + 1;
        END LOOP;

        SELECT count(*)::integer INTO v_load
        FROM qt_setup_schedule_courts WHERE court = v_candidate;
        IF v_best_slot IS NULL OR v_slot < v_best_slot
           OR (v_slot = v_best_slot AND v_load < v_best_load) THEN
          v_best_slot := v_slot;
          v_best_court := v_candidate;
          v_best_load := v_load;
        END IF;
      END LOOP;

      INSERT INTO qt_setup_schedule_courts VALUES (v_best_court, v_best_slot, v_match.id);
      INSERT INTO qt_setup_schedule_players (player_id, slot)
      VALUES (v_match.player1_id, v_best_slot), (v_match.player2_id, v_best_slot);

      IF v_start_minutes IS NOT NULL THEN
        v_start_at := lpad((((v_start_minutes + v_best_slot * 20) / 60) % 24)::text, 2, '0')
          || ':' || lpad(((v_start_minutes + v_best_slot * 20) % 60)::text, 2, '0');
      ELSE
        v_start_at := NULL;
      END IF;
      UPDATE public.quick_table_matches
      SET court_id = v_best_court, start_at = v_start_at
      WHERE id = v_match.id;
      v_scheduled := v_scheduled + 1;
    END LOOP;

    WITH ordered AS (
      SELECT match_id,
             row_number() OVER (ORDER BY slot, court, match_id)::integer - 1 AS display_order
      FROM qt_setup_schedule_courts
    )
    UPDATE public.quick_table_matches m
    SET display_order = o.display_order
    FROM ordered o
    WHERE m.id = o.match_id;
  END IF;

  UPDATE public.quick_tables
  SET player_count = v_roster_count,
      courts = v_court_texts,
      start_time = NULLIF(p_start_time, ''),
      status = 'group_stage'
  WHERE id = p_table_id;

  RETURN json_build_object(
    'success', true,
    'idempotent', false,
    'table_id', p_table_id,
    'players_created', v_roster_count,
    'groups_created', v_groups_created,
    'matches_created', v_display_order,
    'matches_scheduled', v_scheduled
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', CASE
        WHEN SQLSTATE IN ('22P02', '22003') THEN 'INVALID_PAYLOAD'
        ELSE 'SETUP_FAILED'
      END,
      'detail', SQLERRM
    );
END;
$$;

REVOKE ALL ON FUNCTION public.setup_quick_table_roster_atomic(uuid, jsonb, jsonb, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.setup_quick_table_roster_atomic(uuid, jsonb, jsonb, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.setup_quick_table_roster_atomic(uuid, jsonb, jsonb, jsonb, text) TO authenticated;

COMMENT ON FUNCTION public.setup_quick_table_roster_atomic(uuid, jsonb, jsonb, jsonb, text) IS
  'Atomically validates and creates a QuickTable roster, groups, complete round-robin schedule, court allocation, and group-stage transition.';


CREATE OR REPLACE FUNCTION public.create_quick_table_playoff_atomic(
  p_table_id uuid,
  p_qualifiers jsonb,
  p_first_round jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_table public.quick_tables;
  v_item jsonb;
  v_player_id uuid;
  v_player1_id uuid;
  v_player2_id uuid;
  v_winner_id uuid;
  v_match_id uuid;
  v_left_id uuid;
  v_right_id uuid;
  v_left_winner uuid;
  v_right_winner uuid;
  v_left_done boolean;
  v_right_done boolean;
  v_done boolean;
  v_seed integer;
  v_is_wildcard boolean;
  v_match_number integer;
  v_bracket_position text;
  v_first_count integer;
  v_qualifier_count integer;
  v_round_zero integer;
  v_round_index integer := 0;
  v_round_count integer;
  v_next_count integer;
  v_position integer;
  v_global_match_number integer := 0;
  v_total_matches integer := 0;
  v_final_done boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT *
  INTO v_table
  FROM public.quick_tables
  WHERE id = p_table_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TABLE_NOT_FOUND');
  END IF;

  IF v_table.creator_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quick_table_matches
    WHERE table_id = p_table_id AND is_playoff
  ) THEN
    IF v_table.status IN ('playoff', 'completed') THEN
      RETURN json_build_object('success', true, 'idempotent', true, 'table_id', p_table_id);
    END IF;
    RETURN json_build_object('success', false, 'error', 'PLAYOFF_ALREADY_EXISTS');
  END IF;

  IF v_table.status <> 'group_stage' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.quick_table_matches
    WHERE table_id = p_table_id AND NOT is_playoff
  ) OR EXISTS (
    SELECT 1 FROM public.quick_table_matches
    WHERE table_id = p_table_id AND NOT is_playoff AND status <> 'completed'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'GROUP_STAGE_INCOMPLETE');
  END IF;

  IF p_qualifiers IS NULL OR jsonb_typeof(p_qualifiers) <> 'array'
     OR p_first_round IS NULL OR jsonb_typeof(p_first_round) <> 'array' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_PLAYOFF_PAYLOAD');
  END IF;

  v_qualifier_count := jsonb_array_length(p_qualifiers);
  v_first_count := jsonb_array_length(p_first_round);
  IF v_qualifier_count < 2 OR v_qualifier_count > 128
     OR v_first_count < 1 OR v_first_count > 64
     OR (v_first_count & (v_first_count - 1)) <> 0 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_BRACKET_SIZE');
  END IF;

  DROP TABLE IF EXISTS pg_temp.qt_playoff_qualifiers;
  DROP TABLE IF EXISTS pg_temp.qt_playoff_first_round;
  DROP TABLE IF EXISTS pg_temp.qt_playoff_nodes;
  CREATE TEMP TABLE qt_playoff_qualifiers (
    player_id uuid PRIMARY KEY,
    playoff_seed integer NOT NULL,
    is_wildcard boolean NOT NULL
  ) ON COMMIT DROP;
  CREATE TEMP TABLE qt_playoff_first_round (
    position integer PRIMARY KEY,
    match_number integer NOT NULL UNIQUE,
    bracket_position text NOT NULL,
    player1_id uuid,
    player2_id uuid
  ) ON COMMIT DROP;
  CREATE TEMP TABLE qt_playoff_nodes (
    round_index integer NOT NULL,
    position integer NOT NULL,
    match_id uuid NOT NULL,
    winner_id uuid,
    done boolean NOT NULL,
    PRIMARY KEY (round_index, position)
  ) ON COMMIT DROP;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_qualifiers)
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR COALESCE(v_item ->> 'player_id', '') = ''
       OR jsonb_typeof(v_item -> 'playoff_seed') <> 'number'
       OR (v_item ->> 'playoff_seed') !~ '^[0-9]+$'
       OR jsonb_typeof(v_item -> 'is_wildcard') <> 'boolean' THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_QUALIFIER');
    END IF;
    v_player_id := (v_item ->> 'player_id')::uuid;
    v_seed := (v_item ->> 'playoff_seed')::integer;
    v_is_wildcard := (v_item ->> 'is_wildcard')::boolean;
    IF v_seed < 1 OR v_seed > 10000 OR NOT EXISTS (
      SELECT 1 FROM public.quick_table_players
      WHERE id = v_player_id AND table_id = p_table_id
    ) THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_QUALIFIER');
    END IF;
    IF EXISTS (SELECT 1 FROM qt_playoff_qualifiers WHERE player_id = v_player_id) THEN
      RETURN json_build_object('success', false, 'error', 'DUPLICATE_QUALIFIER');
    END IF;
    INSERT INTO qt_playoff_qualifiers VALUES (v_player_id, v_seed, v_is_wildcard);
  END LOOP;

  v_position := 0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_first_round)
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR jsonb_typeof(v_item -> 'match_number') <> 'number'
       OR (v_item ->> 'match_number') !~ '^[0-9]+$' THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_FIRST_ROUND');
    END IF;
    v_match_number := (v_item ->> 'match_number')::integer;
    v_bracket_position := lower(COALESCE(NULLIF(v_item ->> 'bracket_position', ''), 'upper'));
    IF v_bracket_position NOT IN ('upper', 'lower', 'final') THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_FIRST_ROUND');
    END IF;
    v_player1_id := CASE
      WHEN COALESCE(v_item ->> 'player1_id', '') = '' THEN NULL
      ELSE (v_item ->> 'player1_id')::uuid
    END;
    v_player2_id := CASE
      WHEN COALESCE(v_item ->> 'player2_id', '') = '' THEN NULL
      ELSE (v_item ->> 'player2_id')::uuid
    END;
    IF v_player1_id IS NULL AND v_player2_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'EMPTY_FIRST_ROUND_MATCH');
    END IF;
    IF (v_player1_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM qt_playoff_qualifiers WHERE player_id = v_player1_id
        ))
       OR (v_player2_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM qt_playoff_qualifiers WHERE player_id = v_player2_id
        )) THEN
      RETURN json_build_object('success', false, 'error', 'UNQUALIFIED_PARTICIPANT');
    END IF;
    INSERT INTO qt_playoff_first_round
      (position, match_number, bracket_position, player1_id, player2_id)
    VALUES (v_match_number - 1, v_match_number, v_bracket_position, v_player1_id, v_player2_id);
    v_position := v_position + 1;
  END LOOP;

  IF (SELECT min(match_number) FROM qt_playoff_first_round) <> 1
     OR (SELECT max(match_number) FROM qt_playoff_first_round) <> v_first_count
     OR EXISTS (
       SELECT player_id
       FROM (
         SELECT player1_id AS player_id FROM qt_playoff_first_round
         UNION ALL
         SELECT player2_id FROM qt_playoff_first_round
       ) participants
       WHERE player_id IS NOT NULL
       GROUP BY player_id
       HAVING count(*) <> 1
     )
     OR (SELECT count(*) FROM (
       SELECT player1_id AS player_id FROM qt_playoff_first_round WHERE player1_id IS NOT NULL
       UNION ALL
       SELECT player2_id FROM qt_playoff_first_round WHERE player2_id IS NOT NULL
     ) participants) <> v_qualifier_count THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_FIRST_ROUND');
  END IF;

  UPDATE public.quick_table_players
  SET is_qualified = false, is_wildcard = false, playoff_seed = NULL
  WHERE table_id = p_table_id;
  UPDATE public.quick_table_players p
  SET is_qualified = true,
      is_wildcard = q.is_wildcard,
      playoff_seed = q.playoff_seed
  FROM qt_playoff_qualifiers q
  WHERE p.id = q.player_id;

  v_round_zero := CASE
    WHEN v_first_count <= 2 THEN 2
    WHEN v_first_count <= 4 THEN 1
    ELSE 0
  END;

  FOR v_item IN
    SELECT jsonb_build_object(
      'position', position,
      'match_number', match_number,
      'bracket_position', bracket_position,
      'player1_id', player1_id,
      'player2_id', player2_id
    )
    FROM qt_playoff_first_round
    ORDER BY match_number
  LOOP
    v_position := (v_item ->> 'position')::integer;
    v_player1_id := NULLIF(v_item ->> 'player1_id', '')::uuid;
    v_player2_id := NULLIF(v_item ->> 'player2_id', '')::uuid;
    v_done := (v_player1_id IS NULL) <> (v_player2_id IS NULL);
    v_winner_id := CASE WHEN v_done THEN COALESCE(v_player1_id, v_player2_id) ELSE NULL END;
    v_match_id := gen_random_uuid();
    v_global_match_number := v_global_match_number + 1;
    INSERT INTO public.quick_table_matches (
      id, table_id, is_playoff, playoff_round, playoff_match_number,
      bracket_position, player1_id, player2_id, winner_id, status, display_order
    ) VALUES (
      v_match_id, p_table_id, true, v_round_zero, v_global_match_number,
      v_item ->> 'bracket_position', v_player1_id, v_player2_id, v_winner_id,
      CASE WHEN v_done THEN 'completed'::public.quick_match_status ELSE 'pending'::public.quick_match_status END,
      v_position
    );
    INSERT INTO qt_playoff_nodes VALUES
      (0, v_position, v_match_id, v_winner_id, v_done);
    v_total_matches := v_total_matches + 1;
  END LOOP;

  v_round_count := v_first_count;
  WHILE v_round_count > 1
  LOOP
    v_next_count := v_round_count / 2;
    v_round_index := v_round_index + 1;
    FOR v_position IN 0..v_next_count - 1
    LOOP
      SELECT match_id, winner_id, done
      INTO v_left_id, v_left_winner, v_left_done
      FROM qt_playoff_nodes
      WHERE round_index = v_round_index - 1 AND position = v_position * 2;
      SELECT match_id, winner_id, done
      INTO v_right_id, v_right_winner, v_right_done
      FROM qt_playoff_nodes
      WHERE round_index = v_round_index - 1 AND position = v_position * 2 + 1;

      v_player1_id := CASE WHEN v_left_done THEN v_left_winner ELSE NULL END;
      v_player2_id := CASE WHEN v_right_done THEN v_right_winner ELSE NULL END;
      v_done := v_left_done AND v_right_done
        AND ((v_player1_id IS NULL) <> (v_player2_id IS NULL));
      v_winner_id := CASE WHEN v_done THEN COALESCE(v_player1_id, v_player2_id) ELSE NULL END;
      v_match_id := gen_random_uuid();
      v_global_match_number := v_global_match_number + 1;
      v_bracket_position := CASE
        WHEN v_next_count = 1 THEN 'final'
        WHEN v_position < (v_next_count + 1) / 2 THEN 'upper'
        ELSE 'lower'
      END;

      INSERT INTO public.quick_table_matches (
        id, table_id, is_playoff, playoff_round, playoff_match_number,
        bracket_position, player1_id, player2_id, winner_id, status, display_order
      ) VALUES (
        v_match_id, p_table_id, true, v_round_zero + v_round_index,
        v_global_match_number, v_bracket_position, v_player1_id, v_player2_id,
        v_winner_id,
        CASE WHEN v_done THEN 'completed'::public.quick_match_status ELSE 'pending'::public.quick_match_status END,
        v_round_index * 100 + v_position
      );
      UPDATE public.quick_table_matches
      SET next_match_id = v_match_id, next_match_slot = 1
      WHERE id = v_left_id;
      UPDATE public.quick_table_matches
      SET next_match_id = v_match_id, next_match_slot = 2
      WHERE id = v_right_id;
      INSERT INTO qt_playoff_nodes VALUES
        (v_round_index, v_position, v_match_id, v_winner_id, v_done);
      v_total_matches := v_total_matches + 1;
    END LOOP;
    v_round_count := v_next_count;
  END LOOP;

  SELECT done INTO v_final_done
  FROM qt_playoff_nodes
  WHERE round_index = v_round_index AND position = 0;

  UPDATE public.quick_tables
  SET status = CASE
    WHEN v_final_done THEN 'completed'::public.quick_table_status
    ELSE 'playoff'::public.quick_table_status
  END
  WHERE id = p_table_id;

  RETURN json_build_object(
    'success', true,
    'idempotent', false,
    'table_id', p_table_id,
    'matches_created', v_total_matches,
    'first_round', v_first_count,
    'completed', v_final_done
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', CASE
        WHEN SQLSTATE IN ('22P02', '22003') THEN 'INVALID_PLAYOFF_PAYLOAD'
        ELSE 'PLAYOFF_CREATE_FAILED'
      END,
      'detail', SQLERRM
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_quick_table_playoff_atomic(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_quick_table_playoff_atomic(uuid, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_quick_table_playoff_atomic(uuid, jsonb, jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_quick_table_playoff_atomic(uuid, jsonb, jsonb) IS
  'Atomically validates qualifiers, marks them, pre-creates the full QuickTable playoff tree with BYE propagation, and changes lifecycle status.';
