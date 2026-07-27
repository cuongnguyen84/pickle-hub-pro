-- champion-on-event-card G1 (Cuong duyệt 2026-07-27, proposal docs/proposals/champion-on-event-card/).
-- Denormalize nhà vô địch lên quick_tables, ghi server-side tại MỌI đường set
-- status='completed' qua RPC (score + lifecycle). auto-archive/đường lịch sử
-- không đi qua RPC => champion NULL => UI ẩn dòng (đúng thiết kế).
-- Cả hai body dưới đây lấy nguyên văn từ pg_get_functiondef trên prod
-- 2026-07-27 + đúng một mệnh đề champion mỗi hàm — không sửa logic nào khác.

ALTER TABLE public.quick_tables
  ADD COLUMN IF NOT EXISTS champion_player_id uuid REFERENCES public.quick_table_players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS champion_name text;

COMMENT ON COLUMN public.quick_tables.champion_player_id IS
  'Winner of the deciding playoff final. Written only by score/lifecycle RPCs; NULL = no derivable champion (multi-group round robin, archived mid-run).';
COMMENT ON COLUMN public.quick_tables.champion_name IS
  'Snapshot of quick_table_players.name at completion time so list/SSR surfaces read zero-join; champion_player_id is the repair key.';

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
      SET status = 'completed',
          champion_player_id = v_winner_id,
          champion_name = (SELECT p.name FROM public.quick_table_players p WHERE p.id = v_winner_id)
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
$function$;

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
  v_round_index integer := 0;
  v_round_count integer;
  v_next_count integer;
  v_position integer;
  v_global_match_number integer := 0;
  v_total_matches integer := 0;
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

  SELECT done, winner_id INTO v_final_done, v_final_winner_id
  FROM qt_playoff_nodes
  WHERE round_index = v_round_index AND position = 0;

  UPDATE public.quick_tables
  SET status = CASE
    WHEN v_final_done THEN 'completed'::public.quick_table_status
    ELSE 'playoff'::public.quick_table_status
  END,
      -- Rebuild bracket => champion theo bracket mới; chưa xong => NULL (ẩn dòng).
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
$function$;

-- Backfill: chỉ giải completed có ĐÚNG 1 trận ở vòng playoff cao nhất và trận
-- đó đã có winner (tái dùng guard v_current_round_count = 1 của score RPC).
-- Vòng cuối >1 trận = chung kết mơ hồ => giữ NULL (2 bảng trên prod 2026-07-27).
WITH top_round AS (
  SELECT table_id, max(playoff_round) AS r
  FROM public.quick_table_matches
  WHERE is_playoff
  GROUP BY table_id
),
finals AS (
  SELECT m.table_id,
         count(*) AS n_matches,
         (array_agg(m.winner_id))[1] AS winner_id
  FROM public.quick_table_matches m
  JOIN top_round t ON t.table_id = m.table_id AND m.playoff_round = t.r
  WHERE m.is_playoff
  GROUP BY m.table_id
)
UPDATE public.quick_tables qt
SET champion_player_id = f.winner_id,
    champion_name = (SELECT p.name FROM public.quick_table_players p WHERE p.id = f.winner_id)
FROM finals f
WHERE qt.id = f.table_id
  AND qt.status = 'completed'
  AND qt.champion_player_id IS NULL
  AND f.n_matches = 1
  AND f.winner_id IS NOT NULL;

-- Invariant tự kiểm ngay trong migration: không được tồn tại giải completed
-- có chung kết duy nhất đã quyết mà champion vẫn NULL (lớp lỗi final_placement
-- NULL 178/178 — bắt tại chỗ thay vì 3 tuần sau).
DO $do$
DECLARE v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad
  FROM public.quick_tables qt
  WHERE qt.status = 'completed'
    AND qt.champion_player_id IS NULL
    AND (
      SELECT count(*) = 1 AND bool_and(m.winner_id IS NOT NULL)
      FROM public.quick_table_matches m
      WHERE m.table_id = qt.id AND m.is_playoff
        AND m.playoff_round = (
          SELECT max(playoff_round) FROM public.quick_table_matches
          WHERE table_id = qt.id AND is_playoff
        )
    );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'champion backfill missed % completed tables with a decided final', v_bad;
  END IF;
END
$do$;
