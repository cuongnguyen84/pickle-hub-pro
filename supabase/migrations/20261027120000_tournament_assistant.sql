-- Trợ lý AI nổi quanh giải đấu (brief 27/10/2026, docs/floating-ai-chat-brief-2026-10-27.md).
--
-- 1. quick_table_chat_log nhận thêm cột cho trợ lý nổi: surface ('create' =
--    chat tạo giải cũ, 'assistant' = nút float), thread_id, context_label
--    ("Đang xem: Giải X — Bảng B") và action (loại, tham số, trước → sau,
--    kết quả). Vẫn chỉ service_role đọc/ghi, vẫn xoá sau 30 ngày.
--
-- 2. rebuild_quick_table_groups: bốc thăm lại / gán sân theo bảng / bỏ đội
--    SAU khi đã chia bảng. Trước đây không có đường nào làm việc này một
--    cách nguyên tử: setup_quick_table_roster_atomic chỉ chạy khi giải còn
--    'setup' và chưa có dòng con. Hàm này, trong MỘT giao dịch, xoá trận +
--    đội + bảng, đưa giải về 'setup' rồi gọi lại đúng setup_quick_table_roster_atomic
--    với danh sách đội hiện có. Lỗi ở bất kỳ bước nào → hoàn nguyên toàn bộ,
--    giải giữ nguyên như trước.
--    Đã có trận có kết quả → từ chối với HAS_RESULTS trừ khi p_allow_results
--    (người dùng đã xác nhận cảnh báo mất kết quả).

ALTER TABLE public.quick_table_chat_log
  ADD COLUMN IF NOT EXISTS surface text NOT NULL DEFAULT 'create',
  ADD COLUMN IF NOT EXISTS thread_id text,
  ADD COLUMN IF NOT EXISTS context_label text,
  ADD COLUMN IF NOT EXISTS action jsonb;

CREATE OR REPLACE FUNCTION public.rebuild_quick_table_groups(
  p_table_id uuid,
  p_group_count integer DEFAULT NULL,
  p_group_assignments jsonb DEFAULT NULL,
  p_group_courts jsonb DEFAULT NULL,
  p_drop_player_ids jsonb DEFAULT NULL,
  p_allow_results boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_table public.quick_tables;
  v_scored integer;
  v_drop uuid[] := ARRAY[]::uuid[];
  v_roster jsonb;
  v_kept jsonb;
  v_courts jsonb;
  v_result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_table FROM public.quick_tables WHERE id = p_table_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'TABLE_NOT_FOUND');
  END IF;
  IF v_table.creator_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;
  IF v_table.status <> 'group_stage'
     OR EXISTS (SELECT 1 FROM public.quick_table_matches WHERE table_id = p_table_id AND is_playoff) THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

  SELECT count(*) INTO v_scored
  FROM public.quick_table_matches
  WHERE table_id = p_table_id AND status = 'completed';
  IF v_scored > 0 AND NOT p_allow_results THEN
    RETURN json_build_object('success', false, 'error', 'HAS_RESULTS', 'completed_matches', v_scored);
  END IF;

  IF p_drop_player_ids IS NOT NULL THEN
    IF jsonb_typeof(p_drop_player_ids) <> 'array' THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_PAYLOAD');
    END IF;
    SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_drop
    FROM jsonb_array_elements_text(p_drop_player_ids);
  END IF;

  -- Danh sách đội giữ nguyên thứ tự hiện tại; v_kept = chỉ số bảng hiện tại
  -- của từng đội (dùng khi chỉ gán sân / bỏ đội mà không chia lại).
  WITH r AS (
    SELECT p.name, p.player1_name, p.player2_name, p.team, p.seed,
           row_number() OVER (ORDER BY p.display_order, p.created_at, p.id) AS rn,
           dense_rank() OVER (ORDER BY g.display_order, g.id) - 1 AS gi
    FROM public.quick_table_players p
    LEFT JOIN public.quick_table_groups g ON g.id = p.group_id
    WHERE p.table_id = p_table_id AND NOT (p.id = ANY (v_drop))
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'name', name, 'player1_name', player1_name, 'player2_name', player2_name,
           'team', team, 'seed', seed) ORDER BY rn), '[]'::jsonb),
         COALESCE(jsonb_agg(gi ORDER BY rn), '[]'::jsonb)
  INTO v_roster, v_kept
  FROM r;

  SELECT COALESCE(jsonb_agg(c::integer), '[]'::jsonb) INTO v_courts
  FROM unnest(COALESCE(v_table.courts, ARRAY[]::text[])) AS c
  WHERE c ~ '^[1-9][0-9]{0,2}$';

  BEGIN
    DELETE FROM public.quick_table_matches WHERE table_id = p_table_id;
    DELETE FROM public.quick_table_players WHERE table_id = p_table_id;
    DELETE FROM public.quick_table_groups WHERE table_id = p_table_id;
    UPDATE public.quick_tables
    SET status = 'setup',
        group_count = COALESCE(p_group_count, group_count),
        champion_player_id = NULL
    WHERE id = p_table_id;

    v_result := public.setup_quick_table_roster_atomic(
      p_table_id,
      v_roster,
      COALESCE(p_group_assignments, v_kept),
      v_courts,
      v_table.start_time,
      COALESCE(p_group_courts, v_table.group_courts)
    );
    IF (v_result->>'success')::boolean IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'REBUILD_FAILED:%', COALESCE(v_result->>'error', 'SETUP_FAILED');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Khối con hoàn nguyên mọi thao tác xoá ở trên; giải giữ nguyên.
    RETURN json_build_object(
      'success', false,
      'error', CASE WHEN SQLERRM LIKE 'REBUILD_FAILED:%' THEN substr(SQLERRM, 16) ELSE 'REBUILD_FAILED' END
    );
  END;

  RETURN json_build_object(
    'success', true,
    'players', jsonb_array_length(v_roster),
    'dropped', cardinality(v_drop),
    'results_cleared', v_scored
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_quick_table_groups(uuid, integer, jsonb, jsonb, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rebuild_quick_table_groups(uuid, integer, jsonb, jsonb, jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.rebuild_quick_table_groups(uuid, integer, jsonb, jsonb, jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION public.rebuild_quick_table_groups(uuid, integer, jsonb, jsonb, jsonb, boolean) IS
  'Atomically re-draws a group-stage QuickTable (optional new group count / assignments / group-court pins / dropped players) via setup_quick_table_roster_atomic. Refuses with HAS_RESULTS when completed matches exist unless p_allow_results.';
