-- Huỷ playoff vừa tạo (chọn nhầm cách chia nhánh) → quay về vòng bảng.
-- Chỉ chủ giải / admin, chỉ khi CHƯA có trận playoff nào được nhập điểm hay
-- đang có trọng tài chấm (trận BYE tự hoàn thành không tính). Tỉ số vòng bảng giữ nguyên.
CREATE OR REPLACE FUNCTION public.cancel_quick_table_playoff(p_table_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_table public.quick_tables;
  v_deleted integer;
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
  IF v_table.status <> 'playoff' THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.quick_table_matches
    WHERE table_id = p_table_id AND is_playoff
      AND (score1 IS NOT NULL OR score2 IS NOT NULL OR live_referee_id IS NOT NULL)
  ) THEN
    RETURN json_build_object('success', false, 'error', 'PLAYOFF_STARTED');
  END IF;

  DELETE FROM public.quick_table_matches WHERE table_id = p_table_id AND is_playoff;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  UPDATE public.quick_table_players
  SET is_qualified = false, is_wildcard = false, playoff_seed = NULL
  WHERE table_id = p_table_id;

  UPDATE public.quick_tables
  SET status = 'group_stage'::public.quick_table_status,
      champion_player_id = NULL,
      champion_name = NULL
  WHERE id = p_table_id;

  RETURN json_build_object('success', true, 'deleted_matches', v_deleted);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_quick_table_playoff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_quick_table_playoff(uuid) TO authenticated;
