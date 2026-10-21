-- Series A/B/C (nhánh Vàng/Bạc/Đồng) sau vòng bảng — Cuong duyệt 2026-10-19.
--
-- Một giải chia bảng giờ có thể có nhiều nhánh playoff song song: nhánh 0 lấy
-- hạng 1–2 mỗi bảng, nhánh 1 lấy hạng 3–4, nhánh 2 lấy hạng 5–6. Mỗi nhánh là
-- một cây loại trực tiếp riêng; vô địch giải = vô địch nhánh 0.
--
-- Tương thích ngược: division là trường tuỳ chọn trong payload RPC (mặc định 0),
-- cột mới mặc định 0, nên app iOS bản đang trên store vẫn tạo/chấm 1 nhánh y cũ.
-- Mọi truy vấn "vòng sau / vị trí trong vòng / chung kết" giờ lọc theo nhánh.

ALTER TABLE public.quick_table_matches
  ADD COLUMN IF NOT EXISTS playoff_division smallint NOT NULL DEFAULT 0
    CHECK (playoff_division BETWEEN 0 AND 2);
COMMENT ON COLUMN public.quick_table_matches.playoff_division IS
  'Playoff series: 0 = A / Gold (group ranks 1-2), 1 = B / Silver (3-4), 2 = C / Bronze (5-6). Group-stage rows stay 0.';

ALTER TABLE public.quick_tables
  ADD COLUMN IF NOT EXISTS playoff_series smallint NOT NULL DEFAULT 1
    CHECK (playoff_series BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS playoff_series_style text NOT NULL DEFAULT 'series'
    CHECK (playoff_series_style IN ('series', 'medal'));
COMMENT ON COLUMN public.quick_tables.playoff_series IS
  'Planned number of playoff series (set at creation, e.g. by chat). The playoff RPC reads the payload, not this; it is the default the UI offers.';
COMMENT ON COLUMN public.quick_tables.playoff_series_style IS
  'Series naming: series = Series A/B/C, medal = Gold/Silver/Bronze (Nhánh Vàng/Bạc/Đồng).';

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

  -- division (0 = Series A / nhánh Vàng, 1 = B, 2 = C) là trường tuỳ chọn trên
  -- từng phần tử; client cũ (iOS bản store) không gửi → 0 → hành vi cũ y nguyên.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_qualifiers)
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR COALESCE(v_item ->> 'player_id', '') = ''
       OR jsonb_typeof(v_item -> 'playoff_seed') <> 'number'
       OR (v_item ->> 'playoff_seed') !~ '^[0-9]+$'
       OR jsonb_typeof(v_item -> 'is_wildcard') <> 'boolean'
       OR (v_item ? 'division' AND (jsonb_typeof(v_item -> 'division') <> 'number'
           OR (v_item ->> 'division') !~ '^[0-2]$')) THEN
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
           OR (v_item ->> 'division') !~ '^[0-2]$')) THEN
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


CREATE OR REPLACE FUNCTION public.score_quick_table_match_atomic(p_match_id uuid, p_score1 integer, p_score2 integer, p_expected_version bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      AND m.playoff_division = v_match.playoff_division
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
      AND m.playoff_division = v_match.playoff_division
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
      AND playoff_round = v_match.playoff_round
      AND playoff_division = v_match.playoff_division;

    -- Chung kết của một nhánh: nhánh 0 quyết vô địch giải; giải chỉ completed
    -- khi không còn trận playoff nào chưa xong ở mọi nhánh.
    IF v_current_round_count = 1
       AND NOT EXISTS (
         SELECT 1
         FROM public.quick_table_matches
         WHERE table_id = v_table_id
           AND is_playoff
           AND playoff_round = v_match.playoff_round + 1
           AND playoff_division = v_match.playoff_division
       ) THEN
      IF v_match.playoff_division = 0 THEN
        UPDATE public.quick_tables
        SET champion_player_id = v_winner_id,
            champion_name = (SELECT p.name FROM public.quick_table_players p WHERE p.id = v_winner_id)
        WHERE id = v_table_id;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.quick_table_matches
        WHERE table_id = v_table_id AND is_playoff AND status <> 'completed'
      ) THEN
        UPDATE public.quick_tables SET status = 'completed' WHERE id = v_table_id;
      END IF;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'idempotent', false,
    'version', v_match.score_version + 1,
    'winner_id', v_winner_id
  );
END;
$function$;

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

  -- Chỉ đổi trong cùng một nhánh (Series), ở vòng đầu của nhánh đó.
  IF v_a.playoff_division <> v_b.playoff_division THEN
    RETURN json_build_object('success', false, 'error', 'DIFFERENT_DIVISION');
  END IF;
  SELECT min(playoff_round) INTO v_first_round
  FROM public.quick_table_matches
  WHERE table_id = p_table_id AND is_playoff AND playoff_division = v_a.playoff_division;

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

CREATE OR REPLACE FUNCTION public.surface_quick_table_results(p_table_id uuid)
RETURNS TABLE(matches_inserted int, participants_inserted int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament       RECORD;
  v_max_round        int;
  v_match            RECORD;
  v_round_name       text;
  v_format           text;
  v_match_id         uuid;
  v_slug             text;
  v_winning_team     text;
  v_inserted_matches int := 0;
  v_inserted_parts   int := 0;
  v_name             text;
  v_team_names       text[];
  v_gid              uuid;
  v_idx              int;
  v_norm             text;
BEGIN
  SELECT * INTO v_tournament FROM public.quick_tables WHERE id = p_table_id;
  IF v_tournament IS NULL OR v_tournament.status <> 'completed' THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  SELECT MAX(playoff_round) INTO v_max_round
  FROM public.quick_table_matches
  WHERE table_id = p_table_id AND is_playoff = true AND status = 'completed'
    AND playoff_division = 0;
  IF v_max_round IS NULL OR v_max_round < 1 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  v_format := CASE WHEN v_tournament.is_doubles THEN 'doubles' ELSE 'singles' END;

  FOR v_match IN
    SELECT qm.id, qm.playoff_round, qm.score1, qm.score2, qm.updated_at,
           p1.name AS p1_name, p2.name AS p2_name
    FROM public.quick_table_matches qm
    LEFT JOIN public.quick_table_players p1 ON p1.id = qm.player1_id
    LEFT JOIN public.quick_table_players p2 ON p2.id = qm.player2_id
    WHERE qm.table_id = p_table_id
      AND qm.is_playoff = true
      AND qm.playoff_division = 0
      AND qm.status = 'completed'
      AND qm.playoff_round IN (v_max_round, v_max_round - 1)
      AND qm.score1 IS NOT NULL AND qm.score2 IS NOT NULL
  LOOP
    v_round_name := CASE
      WHEN v_match.playoff_round = v_max_round THEN 'Final'
      ELSE 'Semifinal'
    END;
    v_winning_team := CASE WHEN v_match.score1 > v_match.score2 THEN 'a' ELSE 'b' END;
    v_slug := 'qt-' || substr(p_table_id::text, 1, 8) || '-' || substr(v_match.id::text, 1, 8);
    v_match_id := gen_random_uuid();

    -- Insert match; skip + continue to participants backfill if slug exists.
    INSERT INTO public.matches (
      id, slug, format, match_type, played_at,
      team_a_score, team_b_score, winning_team,
      verification_status, is_public, recorded_by,
      tournament_name, round_name, external_match_id
    ) VALUES (
      v_match_id, v_slug, v_format, 'tournament', v_match.updated_at,
      ARRAY[v_match.score1], ARRAY[v_match.score2], v_winning_team,
      'verified', true, v_tournament.creator_user_id,
      v_tournament.name, v_round_name, v_match.id::text
    )
    ON CONFLICT (slug) DO NOTHING;

    -- If the slug existed, fetch its id so we can backfill participants
    -- in case the prior run crashed before adding them.
    IF NOT FOUND THEN
      SELECT id INTO v_match_id FROM public.matches WHERE slug = v_slug;
    ELSE
      v_inserted_matches := v_inserted_matches + 1;
    END IF;

    -- Reset team_names and rebuild for team A then team B.
    FOR v_idx IN 1..2 LOOP
      v_team_names := CASE v_idx
        WHEN 1 THEN _split_player_names(v_match.p1_name)
        ELSE      _split_player_names(v_match.p2_name)
      END;
      FOR i IN 1..COALESCE(array_length(v_team_names, 1), 0) LOOP
        v_name := v_team_names[i];
        IF v_name IS NULL OR length(trim(v_name)) = 0 THEN CONTINUE; END IF;
        -- Deterministic UUID per normalized name. We avoid uuid_generate_v5
        -- since it requires the uuid-ossp extension; md5()::uuid gives a
        -- stable 128-bit value per input which is enough for ghost dedup.
        v_norm := 'tphtg:' || lower(trim(v_name));
        v_gid  := md5(v_norm)::uuid;
        -- Ghost profile (id-based dedup; trigger fills profile_slug)
        INSERT INTO public.profiles (id, email, display_name, is_ghost)
        VALUES (v_gid, 'ghost-' || substr(v_gid::text, 1, 8) || '@picklehub.ghost', v_name, true)
        ON CONFLICT (id) DO NOTHING;
        -- Participant (skip if already there)
        INSERT INTO public.match_participants (match_id, player_id, team, position)
        VALUES (v_match_id, v_gid, CASE v_idx WHEN 1 THEN 'a' ELSE 'b' END, i)
        ON CONFLICT DO NOTHING;
        v_inserted_parts := v_inserted_parts + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_inserted_matches, v_inserted_parts;
END;
$$;

-- CREATE OR REPLACE giữ quyền cũ trên prod; lặp lại cho chắc ở DB dựng mới.
REVOKE ALL ON FUNCTION public.create_quick_table_playoff_atomic(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_quick_table_playoff_atomic(uuid, jsonb, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.score_quick_table_match_atomic(uuid, integer, integer, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.score_quick_table_match_atomic(uuid, integer, integer, bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.swap_quick_table_playoff_players(uuid, uuid, integer, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.swap_quick_table_playoff_players(uuid, uuid, integer, uuid, integer) TO authenticated;
