-- Mỗi hạng một nhánh: nhất → Series A, nhì → B, ba → C, tối đa 8 nhánh.
-- Trần cũ (3 nhánh, division 0–2) chặn đúng thể thức anh đã duyệt.

ALTER TABLE public.quick_table_matches
  DROP CONSTRAINT IF EXISTS quick_table_matches_playoff_division_check;
ALTER TABLE public.quick_table_matches
  ADD CONSTRAINT quick_table_matches_playoff_division_check
  CHECK (playoff_division BETWEEN 0 AND 7);

ALTER TABLE public.quick_tables
  DROP CONSTRAINT IF EXISTS quick_tables_playoff_series_check;
ALTER TABLE public.quick_tables
  ADD CONSTRAINT quick_tables_playoff_series_check
  CHECK (playoff_series BETWEEN 1 AND 8);

ALTER TABLE public.quick_tables
  DROP CONSTRAINT IF EXISTS quick_tables_playoff_series_sizes_check;
ALTER TABLE public.quick_tables
  ADD CONSTRAINT quick_tables_playoff_series_sizes_check CHECK (
    playoff_series_sizes IS NULL OR (
      array_length(playoff_series_sizes, 1) BETWEEN 1 AND 8
      AND 2 <= ALL (playoff_series_sizes)
      AND 200 >= ALL (playoff_series_sizes)
    )
  );

CREATE OR REPLACE FUNCTION public.create_quick_table_playoff_atomic(p_table_id uuid, p_qualifiers jsonb, p_first_round jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_round_index integer;
  v_round_count integer;
  v_next_count integer;
  v_position integer;
  v_global_match_number integer := 0;
  v_total_matches integer := 0;
  v_div integer;
  v_div_count integer;
  v_div_first integer;
  v_div_final_done boolean;
  v_div_final_winner uuid;
  v_all_done boolean := true;
  v_final_done boolean := false;
  v_final_winner_id uuid;
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
     OR v_first_count < 1 OR v_first_count > 64 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_BRACKET_SIZE');
  END IF;

  DROP TABLE IF EXISTS pg_temp.qt_playoff_qualifiers;
  DROP TABLE IF EXISTS pg_temp.qt_playoff_first_round;
  DROP TABLE IF EXISTS pg_temp.qt_playoff_nodes;
  CREATE TEMP TABLE qt_playoff_qualifiers (
    player_id uuid PRIMARY KEY,
    playoff_seed integer NOT NULL,
    is_wildcard boolean NOT NULL,
    division integer NOT NULL
  ) ON COMMIT DROP;
  CREATE TEMP TABLE qt_playoff_first_round (
    division integer NOT NULL,
    position integer NOT NULL,
    match_number integer NOT NULL,
    bracket_position text NOT NULL,
    player1_id uuid,
    player2_id uuid,
    PRIMARY KEY (division, position),
    UNIQUE (division, match_number)
  ) ON COMMIT DROP;
  CREATE TEMP TABLE qt_playoff_nodes (
    division integer NOT NULL,
    round_index integer NOT NULL,
    position integer NOT NULL,
    match_id uuid NOT NULL,
    winner_id uuid,
    done boolean NOT NULL,
    PRIMARY KEY (division, round_index, position)
  ) ON COMMIT DROP;

  -- division (0 = Series A, rồi B, C… tối đa 8 nhánh, chỉ số 0–7) là trường tuỳ chọn trên
  -- từng phần tử; client cũ (iOS bản store) không gửi → 0 → hành vi cũ y nguyên.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_qualifiers)
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR COALESCE(v_item ->> 'player_id', '') = ''
       OR jsonb_typeof(v_item -> 'playoff_seed') <> 'number'
       OR (v_item ->> 'playoff_seed') !~ '^[0-9]+$'
       OR jsonb_typeof(v_item -> 'is_wildcard') <> 'boolean'
       OR (v_item ? 'division' AND (jsonb_typeof(v_item -> 'division') <> 'number'
           OR (v_item ->> 'division') !~ '^[0-7]$')) THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_QUALIFIER');
    END IF;
    v_player_id := (v_item ->> 'player_id')::uuid;
    v_seed := (v_item ->> 'playoff_seed')::integer;
    v_is_wildcard := (v_item ->> 'is_wildcard')::boolean;
    v_div := COALESCE((v_item ->> 'division')::integer, 0);
    IF v_seed < 1 OR v_seed > 10000 OR NOT EXISTS (
      SELECT 1 FROM public.quick_table_players
      WHERE id = v_player_id AND table_id = p_table_id
    ) THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_QUALIFIER');
    END IF;
    IF EXISTS (SELECT 1 FROM qt_playoff_qualifiers WHERE player_id = v_player_id) THEN
      RETURN json_build_object('success', false, 'error', 'DUPLICATE_QUALIFIER');
    END IF;
    INSERT INTO qt_playoff_qualifiers VALUES (v_player_id, v_seed, v_is_wildcard, v_div);
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_first_round)
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR jsonb_typeof(v_item -> 'match_number') <> 'number'
       OR (v_item ->> 'match_number') !~ '^[0-9]+$'
       OR (v_item ? 'division' AND (jsonb_typeof(v_item -> 'division') <> 'number'
           OR (v_item ->> 'division') !~ '^[0-7]$')) THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_FIRST_ROUND');
    END IF;
    v_match_number := (v_item ->> 'match_number')::integer;
    v_div := COALESCE((v_item ->> 'division')::integer, 0);
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
    -- Người chơi phải thuộc đúng nhánh của trận.
    IF (v_player1_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM qt_playoff_qualifiers WHERE player_id = v_player1_id AND division = v_div
        ))
       OR (v_player2_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM qt_playoff_qualifiers WHERE player_id = v_player2_id AND division = v_div
        )) THEN
      RETURN json_build_object('success', false, 'error', 'UNQUALIFIED_PARTICIPANT');
    END IF;
    INSERT INTO qt_playoff_first_round
      (division, position, match_number, bracket_position, player1_id, player2_id)
    VALUES (v_div, v_match_number - 1, v_match_number, v_bracket_position, v_player1_id, v_player2_id);
  END LOOP;

  -- Nhánh liền nhau từ 0; mỗi nhánh: số trận vòng 1 là luỹ thừa 2, đánh số 1..n.
  SELECT count(DISTINCT division) INTO v_div_count FROM qt_playoff_first_round;
  IF (SELECT max(division) FROM qt_playoff_first_round) <> v_div_count - 1
     OR EXISTS (
       SELECT 1 FROM (
         SELECT division, count(*) AS n, min(match_number) AS lo, max(match_number) AS hi
         FROM qt_playoff_first_round GROUP BY division
       ) d
       WHERE d.lo <> 1 OR d.hi <> d.n OR (d.n & (d.n - 1)) <> 0
     ) THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_BRACKET_SIZE');
  END IF;

  IF EXISTS (
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

  FOR v_div IN 0..v_div_count - 1
  LOOP
    SELECT count(*) INTO v_div_first FROM qt_playoff_first_round WHERE division = v_div;
    v_round_zero := CASE
      WHEN v_div_first <= 2 THEN 2
      WHEN v_div_first <= 4 THEN 1
      ELSE 0
    END;
    v_round_index := 0;

    FOR v_item IN
      SELECT jsonb_build_object(
        'position', position,
        'bracket_position', bracket_position,
        'player1_id', player1_id,
        'player2_id', player2_id
      )
      FROM qt_playoff_first_round
      WHERE division = v_div
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
        id, table_id, is_playoff, playoff_round, playoff_match_number, playoff_division,
        bracket_position, player1_id, player2_id, winner_id, status, display_order
      ) VALUES (
        v_match_id, p_table_id, true, v_round_zero, v_global_match_number, v_div,
        v_item ->> 'bracket_position', v_player1_id, v_player2_id, v_winner_id,
        CASE WHEN v_done THEN 'completed'::public.quick_match_status ELSE 'pending'::public.quick_match_status END,
        v_div * 10000 + v_position
      );
      INSERT INTO qt_playoff_nodes VALUES
        (v_div, 0, v_position, v_match_id, v_winner_id, v_done);
      v_total_matches := v_total_matches + 1;
    END LOOP;

    v_round_count := v_div_first;
    WHILE v_round_count > 1
    LOOP
      v_next_count := v_round_count / 2;
      v_round_index := v_round_index + 1;
      FOR v_position IN 0..v_next_count - 1
      LOOP
        SELECT match_id, winner_id, done
        INTO v_left_id, v_left_winner, v_left_done
        FROM qt_playoff_nodes
        WHERE division = v_div AND round_index = v_round_index - 1 AND position = v_position * 2;
        SELECT match_id, winner_id, done
        INTO v_right_id, v_right_winner, v_right_done
        FROM qt_playoff_nodes
        WHERE division = v_div AND round_index = v_round_index - 1 AND position = v_position * 2 + 1;

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
          id, table_id, is_playoff, playoff_round, playoff_match_number, playoff_division,
          bracket_position, player1_id, player2_id, winner_id, status, display_order
        ) VALUES (
          v_match_id, p_table_id, true, v_round_zero + v_round_index,
          v_global_match_number, v_div, v_bracket_position, v_player1_id, v_player2_id,
          v_winner_id,
          CASE WHEN v_done THEN 'completed'::public.quick_match_status ELSE 'pending'::public.quick_match_status END,
          v_div * 10000 + v_round_index * 100 + v_position
        );
        UPDATE public.quick_table_matches
        SET next_match_id = v_match_id, next_match_slot = 1
        WHERE id = v_left_id;
        UPDATE public.quick_table_matches
        SET next_match_id = v_match_id, next_match_slot = 2
        WHERE id = v_right_id;
        INSERT INTO qt_playoff_nodes VALUES
          (v_div, v_round_index, v_position, v_match_id, v_winner_id, v_done);
        v_total_matches := v_total_matches + 1;
      END LOOP;
      v_round_count := v_next_count;
    END LOOP;

    SELECT done, winner_id INTO v_div_final_done, v_div_final_winner
    FROM qt_playoff_nodes
    WHERE division = v_div AND round_index = v_round_index AND position = 0;
    v_all_done := v_all_done AND v_div_final_done;
    IF v_div = 0 THEN
      v_final_done := v_div_final_done;
      v_final_winner_id := v_div_final_winner;
    END IF;
  END LOOP;

  -- Vô địch giải = vô địch nhánh 0 (Series A / nhánh Vàng); giải chỉ "completed"
  -- khi mọi nhánh xong.
  UPDATE public.quick_tables
  SET status = CASE
    WHEN v_all_done THEN 'completed'::public.quick_table_status
    ELSE 'playoff'::public.quick_table_status
  END,
      champion_player_id = CASE WHEN v_final_done THEN v_final_winner_id ELSE NULL END,
      champion_name = CASE WHEN v_final_done THEN (
        SELECT p.name FROM public.quick_table_players p WHERE p.id = v_final_winner_id
      ) ELSE NULL END
  WHERE id = p_table_id;

  RETURN json_build_object(
    'success', true,
    'idempotent', false,
    'table_id', p_table_id,
    'matches_created', v_total_matches,
    'first_round', v_first_count,
    'divisions', v_div_count,
    'completed', v_all_done
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
$function$;


