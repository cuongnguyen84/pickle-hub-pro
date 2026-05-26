-- ============================================================================
-- Merge ghost profile into auth profile by phone match
-- ============================================================================
-- Khi guest đăng ký social event qua phone OTP (phone-otp-verify), một
-- "ghost profile" được tạo trên public.profiles với is_ghost = TRUE và
-- không có dòng tương ứng trong auth.users. Nếu sau đó cùng người đó
-- signup bằng Google/Email và cuối cùng verify lại số điện thoại đó, ta
-- muốn:
--
--   1. Chuyển toàn bộ event_registrations, match_participants,
--      matches.recorded_by, social_event_matches.team_*_player*_id từ
--      ghost profile sang auth profile.
--   2. Copy các thuộc tính identity còn trống trên auth profile
--      (display_name, phone, self_rating, avatar_url) từ ghost nếu auth
--      profile chưa có.
--   3. DELETE ghost profile để không còn orphan rows ở UI / analytics.
--
-- Hai entry-point được expose:
--
--   * public.merge_my_ghost_by_phone(p_phone TEXT)
--       — Authenticated user gọi sau khi verify phone OTP (hoặc tự nhập
--         phone trong Settings). auth.uid() = target profile id.
--
--   * public.merge_ghost_into_profile(p_target_profile_id UUID,
--                                     p_phone TEXT)
--       — Service-role / SECURITY DEFINER internal helper, dùng từ
--         handle_new_user trigger khi auth.users vừa được tạo có
--         NEW.phone (Supabase phone-auth path).
--
-- Permission model:
--   * Both functions: phải có authenticated session (hoặc service_role).
--   * merge_my_ghost_by_phone tự gắn auth.uid() làm target — user không
--     thể merge giùm người khác.
--   * Chỉ merge khi ghost profile có is_ghost = TRUE và phone match
--     chính xác (đã normalize qua phone-otp-verify nên format luôn là
--     E.164 +84xxxxxxxxx).
--   * Refuse nếu target profile ALSO has is_ghost = TRUE (cả 2 đều
--     ghost → không có authenticated identity để merge vào).
--   * NO-OP (return NULL) nếu không tìm thấy ghost match — không phải lỗi.
--
-- Conflict handling cho UNIQUE constraints:
--   * event_registrations có UNIQUE (event_id, profile_id): nếu cả ghost
--     và target đều đăng ký cùng 1 event, DELETE ghost row trước (target
--     giữ lại vì authenticated).
--
-- IDEMPOTENT — replay-safe (CREATE OR REPLACE).
-- ============================================================================

-- ─── 1. Core merge function (SECURITY DEFINER) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.merge_ghost_into_profile(
  p_target_profile_id UUID,
  p_phone             TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ghost_id      UUID;
  v_ghost_name    TEXT;
  v_ghost_avatar  TEXT;
  v_ghost_rating  NUMERIC(4,2);
  v_target_is_ghost BOOLEAN;
BEGIN
  -- Validate input shape. Phone phải là E.164 (giống constraint trên
  -- event_registrations + otp_codes); nếu không match thì coi như không
  -- có ghost — silent no-op để caller không phải catch exception.
  IF p_phone IS NULL OR p_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    RETURN NULL;
  END IF;

  IF p_target_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Refuse khi target cũng là ghost — không có lợi gì để merge 2 ghost,
  -- và mất identity authoritative.
  SELECT is_ghost INTO v_target_is_ghost
  FROM public.profiles
  WHERE id = p_target_profile_id;

  IF v_target_is_ghost IS TRUE THEN
    RAISE EXCEPTION 'target_is_ghost' USING ERRCODE = '42501';
  END IF;

  -- Tìm ghost profile match phone. Chỉ pick row có is_ghost = TRUE để
  -- tránh merge nhầm sang profile authenticated khác cùng phone (case
  -- hiếm nhưng có thể xảy ra do legacy data).
  SELECT id, display_name, avatar_url, self_rating
  INTO v_ghost_id, v_ghost_name, v_ghost_avatar, v_ghost_rating
  FROM public.profiles
  WHERE phone = p_phone
    AND is_ghost = TRUE
    AND id <> p_target_profile_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_ghost_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- ─── 2. Backfill identity trên target profile nếu còn trống ─────────────
  -- KHÔNG overwrite — auth profile là source of truth khi đã có giá trị.
  UPDATE public.profiles
  SET
    display_name = COALESCE(display_name, v_ghost_name),
    avatar_url   = COALESCE(avatar_url, v_ghost_avatar),
    self_rating  = COALESCE(self_rating, v_ghost_rating),
    phone        = COALESCE(phone, p_phone),
    updated_at   = NOW()
  WHERE id = p_target_profile_id;

  -- ─── 3. event_registrations — UNIQUE (event_id, profile_id) ─────────────
  -- Nếu target đã đăng ký cùng event, DELETE ghost row trước khi UPDATE.
  -- Giữ registration của target vì đó là identity authoritative.
  DELETE FROM public.event_registrations
  WHERE profile_id = v_ghost_id
    AND event_id IN (
      SELECT event_id FROM public.event_registrations
      WHERE profile_id = p_target_profile_id
    );

  UPDATE public.event_registrations
  SET profile_id = p_target_profile_id
  WHERE profile_id = v_ghost_id;

  -- ─── 4. matches.recorded_by — không có UNIQUE, UPDATE thẳng ─────────────
  UPDATE public.matches
  SET recorded_by = p_target_profile_id,
      updated_at  = NOW()
  WHERE recorded_by = v_ghost_id;

  -- ─── 5. match_participants — không có UNIQUE per player, UPDATE thẳng ──
  -- Nếu bảng không tồn tại trên môi trường nào đó, EXCEPTION được nuốt
  -- vào DO block riêng để không break migration.
  BEGIN
    UPDATE public.match_participants
    SET player_id = p_target_profile_id
    WHERE player_id = v_ghost_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- ─── 6. social_event_matches — 4 cột player FK ──────────────────────────
  BEGIN
    UPDATE public.social_event_matches
    SET team_a_player1_id = p_target_profile_id
    WHERE team_a_player1_id = v_ghost_id;

    UPDATE public.social_event_matches
    SET team_a_player2_id = p_target_profile_id
    WHERE team_a_player2_id = v_ghost_id;

    UPDATE public.social_event_matches
    SET team_b_player1_id = p_target_profile_id
    WHERE team_b_player1_id = v_ghost_id;

    UPDATE public.social_event_matches
    SET team_b_player2_id = p_target_profile_id
    WHERE team_b_player2_id = v_ghost_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- ─── 7. club_members — UNIQUE (club_id, profile_id), dedup ──────────────
  BEGIN
    DELETE FROM public.club_members
    WHERE profile_id = v_ghost_id
      AND club_id IN (
        SELECT club_id FROM public.club_members
        WHERE profile_id = p_target_profile_id
      );

    UPDATE public.club_members
    SET profile_id = p_target_profile_id
    WHERE profile_id = v_ghost_id;

    UPDATE public.club_members
    SET added_by = p_target_profile_id
    WHERE added_by = v_ghost_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- ─── 8. club_managers — UNIQUE (club_id, profile_id), dedup ─────────────
  BEGIN
    DELETE FROM public.club_managers
    WHERE profile_id = v_ghost_id
      AND club_id IN (
        SELECT club_id FROM public.club_managers
        WHERE profile_id = p_target_profile_id
      );

    UPDATE public.club_managers
    SET profile_id = p_target_profile_id
    WHERE profile_id = v_ghost_id;

    UPDATE public.club_managers
    SET added_by = p_target_profile_id
    WHERE added_by = v_ghost_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- ─── 9. DELETE ghost profile ────────────────────────────────────────────
  -- Tới đây mọi FK đã được chuyển. Nếu vẫn có FK còn lại (table không
  -- handle ở trên), foreign key sẽ raise — caller phải mở rộng function
  -- này thay vì silent fail.
  DELETE FROM public.profiles
  WHERE id = v_ghost_id
    AND is_ghost = TRUE;

  RETURN v_ghost_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_ghost_into_profile(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_ghost_into_profile(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.merge_ghost_into_profile(UUID, TEXT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.merge_ghost_into_profile(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.merge_ghost_into_profile(UUID, TEXT) IS
  'Internal SECURITY DEFINER helper: chuyển mọi reference của ghost profile (is_ghost=true, phone match) sang p_target_profile_id rồi DELETE ghost. Service-role only — UI gọi merge_my_ghost_by_phone thay thế. See migration 20260526120000.';


-- ─── 2. Authenticated-caller wrapper ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.merge_my_ghost_by_phone(
  p_phone TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_ghost_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  -- Caller chỉ có thể merge ghost vào CHÍNH HỌ — không có cách nào set
  -- target khác. Phone format validation handled trong helper.
  v_ghost_id := public.merge_ghost_into_profile(v_uid, p_phone);

  RETURN v_ghost_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_my_ghost_by_phone(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_my_ghost_by_phone(TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.merge_my_ghost_by_phone(TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.merge_my_ghost_by_phone(TEXT) TO service_role;

COMMENT ON FUNCTION public.merge_my_ghost_by_phone(TEXT) IS
  'Authenticated wrapper: caller (auth.uid()) merge ghost profile có phone = p_phone vào chính họ. Trả về ghost id đã merge, hoặc NULL nếu không có ghost match. Dùng từ Settings page (sau khi user verify phone OTP) hoặc tự động ở client sau khi đăng ký social event bằng auth user. See migration 20260526120000.';


-- ─── 3. Update handle_new_user trigger ─────────────────────────────────────
-- Khi auth.users INSERT (signup), nếu raw_user_meta_data hoặc auth.users
-- có phone (Supabase Phone Auth path), thử merge ghost luôn.
--
-- LƯU Ý: Google OAuth thường KHÔNG cung cấp phone — flow đó user phải
-- vào Settings verify phone rồi gọi merge_my_ghost_by_phone từ client.
-- Trigger này chỉ catch trường hợp signup bằng Phone Auth của Supabase.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)
    )
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');

  -- Phone có thể đến từ 2 chỗ: NEW.phone (Supabase Phone Auth) hoặc
  -- NEW.raw_user_meta_data ->> 'phone' (custom signup form). Lấy cái
  -- nào có trước.
  v_phone := COALESCE(
    NULLIF(trim(NEW.phone), ''),
    NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), '')
  );

  -- Phone từ auth.users.phone của Supabase được lưu KHÔNG có dấu '+'
  -- (ví dụ: '84912345678'). Chuẩn hoá về E.164 trước khi merge.
  IF v_phone IS NOT NULL AND v_phone !~ '^\+' AND v_phone ~ '^[1-9][0-9]{7,14}$' THEN
    v_phone := '+' || v_phone;
  END IF;

  IF v_phone IS NOT NULL AND v_phone ~ '^\+[1-9][0-9]{7,14}$' THEN
    -- Merge silently — không fail signup nếu merge lỗi.
    BEGIN
      PERFORM public.merge_ghost_into_profile(NEW.id, v_phone);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: merge_ghost_into_profile failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Trigger fired AFTER INSERT auth.users — tạo profiles row, gán role viewer, và (mới: PR 20260526120000) thử merge ghost profile cùng phone nếu có.';
