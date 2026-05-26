-- ============================================================================
-- Social-event DUPR link + match log
-- ============================================================================
-- Mở rộng social-event registration thành cầu nối DUPR:
--
--   1. Cột mới `event_registrations.dupr_id` — DUPR player id mà người
--      chơi tự liên kết vào registration của họ. Khi log match, payload
--      gửi DUPR sẽ dùng id này (fall back về profiles.dupr_id khi NULL).
--
--   2. Cột mới `matches.social_event_id` — FK trỏ social_events. Cho
--      phép tái sử dụng table `matches` + match_participants để log
--      trận trong context của 1 social event (song song với club_id từ
--      migration 20260525120000).
--
--   3. RPCs liên kết DUPR cho registration:
--        * link_event_dupr_id_by_token(p_magic_token, p_dupr_id)
--            — guest path (phone OTP user). Auth qua magic_token được
--              lưu trong registration_secrets table.
--        * link_event_dupr_id_authed(p_event_id, p_dupr_id)
--            — authenticated path. auth.uid() = profile_id.
--
--   4. RPCs log/list match cho social event:
--        * log_social_event_match(...) — organizer hoặc player có mặt
--          trong 1 team đều log được. Players phải là registered
--          profile_id của event đó (giống pattern is_club_member).
--        * list_social_event_matches(p_event_id, p_limit) — public-readable,
--          render lịch sử match + roster mỗi team kèm dupr_id (ưu tiên
--          từ event_registrations rồi mới fallback profiles).
--
--   5. REPLACE `mark_match_ready_for_dupr` + `mark_match_submitted_to_dupr`
--      để chấp nhận match có `social_event_id` (organizer của event
--      tương đương is_club_organizer cho club match). API chữ ký không
--      đổi nên client cũ hoạt động bình thường.
--
-- IDEMPOTENT — replay-safe.
-- ============================================================================

-- ─── 1. event_registrations.dupr_id column ─────────────────────────────────

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS dupr_id TEXT;

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_dupr_id_format;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_dupr_id_format
  CHECK (
    dupr_id IS NULL
    OR (length(trim(dupr_id)) BETWEEN 2 AND 32 AND dupr_id ~ '^[A-Za-z0-9_-]+$')
  );

COMMENT ON COLUMN public.event_registrations.dupr_id IS
  'DUPR player id (alphanumeric/dash/underscore, 2-32 chars) mà người chơi tự liên kết khi đăng ký social event. Được dùng khi build payload submit DUPR; nếu NULL, fall back về profiles.dupr_id. See migration 20260526120100.';


-- ─── 2. matches.social_event_id column ────────────────────────────────────

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS social_event_id UUID
  REFERENCES public.social_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_matches_social_event_id
  ON public.matches (social_event_id, played_at DESC)
  WHERE social_event_id IS NOT NULL;

COMMENT ON COLUMN public.matches.social_event_id IS
  'Optional social_events link, populated khi log_social_event_match RPC chạy. Song song với matches.club_id (migration 20260525120000) — một match có thể được scoped vào CLB, vào social event, hoặc cả 2. See migration 20260526120100.';


-- ─── 3. Helper: kiểm tra organizer của social_event ─────────────────────

CREATE OR REPLACE FUNCTION public.is_social_event_organizer(
  p_event_id UUID,
  p_uid      UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.social_events e
    WHERE e.id = p_event_id
      AND e.created_by = p_uid
  );
$$;

REVOKE ALL ON FUNCTION public.is_social_event_organizer(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_social_event_organizer(UUID, UUID) TO anon;
GRANT  EXECUTE ON FUNCTION public.is_social_event_organizer(UUID, UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_social_event_organizer(UUID, UUID) TO service_role;


-- ─── 4. RPC: link DUPR id qua magic_token (guest path) ──────────────────

CREATE OR REPLACE FUNCTION public.link_event_dupr_id_by_token(
  p_magic_token UUID,
  p_dupr_id     TEXT
)
RETURNS TABLE (
  registration_id UUID,
  event_id        UUID,
  dupr_id         TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reg_id     UUID;
  v_event_id   UUID;
  v_clean_id   TEXT := NULLIF(trim(p_dupr_id), '');
BEGIN
  IF p_magic_token IS NULL THEN
    RAISE EXCEPTION 'magic_token_required' USING ERRCODE = '22023';
  END IF;

  -- Validate DUPR id shape (sync với CHECK constraint).
  IF v_clean_id IS NOT NULL THEN
    IF length(v_clean_id) NOT BETWEEN 2 AND 32 THEN
      RAISE EXCEPTION 'dupr_id_invalid_length' USING ERRCODE = '22023';
    END IF;
    IF v_clean_id !~ '^[A-Za-z0-9_-]+$' THEN
      RAISE EXCEPTION 'dupr_id_invalid_format' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- magic_token được issue ở phone-otp-verify, lưu vào registration_secrets
  -- (không public-readable). Lookup phải qua SECURITY DEFINER.
  SELECT s.registration_id, r.event_id
  INTO v_reg_id, v_event_id
  FROM public.registration_secrets s
  JOIN public.event_registrations r ON r.id = s.registration_id
  WHERE s.magic_token = p_magic_token
    AND r.status <> 'cancelled';

  IF v_reg_id IS NULL THEN
    RAISE EXCEPTION 'registration_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.event_registrations
  SET dupr_id = v_clean_id
  WHERE id = v_reg_id;

  RETURN QUERY
    SELECT v_reg_id, v_event_id, v_clean_id;
END;
$$;

REVOKE ALL ON FUNCTION public.link_event_dupr_id_by_token(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.link_event_dupr_id_by_token(UUID, TEXT) TO anon;
GRANT  EXECUTE ON FUNCTION public.link_event_dupr_id_by_token(UUID, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.link_event_dupr_id_by_token(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.link_event_dupr_id_by_token(UUID, TEXT) IS
  'Guest path: liên kết DUPR id vào registration qua magic_token (lưu localStorage). Refuse khi token không tồn tại hoặc registration đã cancelled. See migration 20260526120100.';


-- ─── 5. RPC: link DUPR id cho authenticated user ────────────────────────

CREATE OR REPLACE FUNCTION public.link_event_dupr_id_authed(
  p_event_id UUID,
  p_dupr_id  TEXT
)
RETURNS TABLE (
  registration_id UUID,
  event_id        UUID,
  dupr_id         TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_reg_id   UUID;
  v_clean_id TEXT := NULLIF(trim(p_dupr_id), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'event_id_required' USING ERRCODE = '22023';
  END IF;

  IF v_clean_id IS NOT NULL THEN
    IF length(v_clean_id) NOT BETWEEN 2 AND 32 THEN
      RAISE EXCEPTION 'dupr_id_invalid_length' USING ERRCODE = '22023';
    END IF;
    IF v_clean_id !~ '^[A-Za-z0-9_-]+$' THEN
      RAISE EXCEPTION 'dupr_id_invalid_format' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT id INTO v_reg_id
  FROM public.event_registrations
  WHERE event_id = p_event_id
    AND profile_id = v_uid
    AND status <> 'cancelled'
  LIMIT 1;

  IF v_reg_id IS NULL THEN
    RAISE EXCEPTION 'registration_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.event_registrations
  SET dupr_id = v_clean_id
  WHERE id = v_reg_id;

  RETURN QUERY
    SELECT v_reg_id, p_event_id, v_clean_id;
END;
$$;

REVOKE ALL ON FUNCTION public.link_event_dupr_id_authed(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_event_dupr_id_authed(UUID, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.link_event_dupr_id_authed(UUID, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.link_event_dupr_id_authed(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.link_event_dupr_id_authed(UUID, TEXT) IS
  'Authenticated path: liên kết DUPR id vào registration. auth.uid() phải match event_registrations.profile_id. See migration 20260526120100.';


-- ─── 5b. RPC: đọc dupr_id hiện tại của registration qua magic_token ───

CREATE OR REPLACE FUNCTION public.get_my_event_dupr_by_token(
  p_magic_token UUID
)
RETURNS TABLE (
  registration_id UUID,
  event_id        UUID,
  dupr_id         TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.id, r.event_id, r.dupr_id
  FROM public.registration_secrets s
  JOIN public.event_registrations r ON r.id = s.registration_id
  WHERE s.magic_token = p_magic_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_event_dupr_by_token(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_event_dupr_by_token(UUID) TO anon;
GRANT  EXECUTE ON FUNCTION public.get_my_event_dupr_by_token(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_my_event_dupr_by_token(UUID) TO service_role;

COMMENT ON FUNCTION public.get_my_event_dupr_by_token(UUID) IS
  'Guest path: đọc dupr_id hiện tại của registration qua magic_token. Public-readable (RPC SECURITY DEFINER) nhưng chỉ trả về row match token, vì vậy zero leakage. See migration 20260526120100.';


-- ─── 6. RPC: log một match trong context social event ──────────────────

CREATE OR REPLACE FUNCTION public.log_social_event_match(
  p_event_id        UUID,
  p_format          TEXT,         -- 'singles' | 'doubles' | 'mixed'
  p_played_at       TIMESTAMPTZ,
  p_team_a_score    INTEGER[],
  p_team_b_score    INTEGER[],
  p_team_a_players  UUID[],
  p_team_b_players  UUID[],
  p_notes           TEXT DEFAULT NULL,
  p_court_number    TEXT DEFAULT NULL,
  p_scoring_format  TEXT DEFAULT '11_rally'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid            UUID := auth.uid();
  v_is_organizer   BOOLEAN;
  v_is_participant BOOLEAN;
  v_match_id       UUID;
  v_slug           TEXT;
  v_winning_team   TEXT;
  v_score_a_total  INTEGER := 0;
  v_score_b_total  INTEGER := 0;
  v_player_id      UUID;
  v_team_a_size    INTEGER;
  v_team_b_size    INTEGER;
  v_expected_size  INTEGER;
  v_event_slug     TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  -- Format validation
  IF p_format NOT IN ('singles', 'doubles', 'mixed') THEN
    RAISE EXCEPTION 'invalid_format' USING ERRCODE = '22023';
  END IF;

  -- Team-size validation
  v_team_a_size   := COALESCE(array_length(p_team_a_players, 1), 0);
  v_team_b_size   := COALESCE(array_length(p_team_b_players, 1), 0);
  v_expected_size := CASE WHEN p_format = 'singles' THEN 1 ELSE 2 END;
  IF v_team_a_size <> v_expected_size OR v_team_b_size <> v_expected_size THEN
    RAISE EXCEPTION 'team_size_mismatch' USING ERRCODE = '22023';
  END IF;

  -- Score validation
  IF COALESCE(array_length(p_team_a_score, 1), 0)
       <> COALESCE(array_length(p_team_b_score, 1), 0)
     OR COALESCE(array_length(p_team_a_score, 1), 0) < 1
     OR COALESCE(array_length(p_team_a_score, 1), 0) > 5 THEN
    RAISE EXCEPTION 'score_length_invalid' USING ERRCODE = '22023';
  END IF;

  -- Lookup event
  SELECT slug INTO v_event_slug
  FROM public.social_events
  WHERE id = p_event_id;

  IF v_event_slug IS NULL THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Permission: organizer của event HOẶC một registered player của event
  -- mà đồng thời nằm trong team A hoặc team B của match này.
  v_is_organizer := public.is_social_event_organizer(p_event_id, v_uid);

  v_is_participant :=
    (v_uid = ANY(p_team_a_players) OR v_uid = ANY(p_team_b_players))
    AND EXISTS (
      SELECT 1 FROM public.event_registrations
      WHERE event_id = p_event_id
        AND profile_id = v_uid
        AND status <> 'cancelled'
    );

  IF NOT (v_is_organizer OR v_is_participant) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- Mọi player phải là registered profile_id của event này (cancelled
  -- registrations bị loại). Cho phép cả ghost profile của event đó
  -- (event_registrations.profile_id link tới ghost row).
  FOREACH v_player_id IN ARRAY (p_team_a_players || p_team_b_players)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.event_registrations
      WHERE event_id = p_event_id
        AND profile_id = v_player_id
        AND status <> 'cancelled'
    ) THEN
      RAISE EXCEPTION 'player_not_in_event' USING ERRCODE = '42501', DETAIL = v_player_id::text;
    END IF;
  END LOOP;

  -- Duplicate player check
  IF (
    SELECT COUNT(*) <> COUNT(DISTINCT pid)
    FROM unnest(p_team_a_players || p_team_b_players) pid
  ) THEN
    RAISE EXCEPTION 'duplicate_player' USING ERRCODE = '23505';
  END IF;

  -- Winning team theo số ván thắng
  SELECT SUM(CASE WHEN a > b THEN 1 ELSE 0 END),
         SUM(CASE WHEN b > a THEN 1 ELSE 0 END)
  INTO v_score_a_total, v_score_b_total
  FROM unnest(p_team_a_score, p_team_b_score) AS s(a, b);

  v_winning_team := CASE
    WHEN v_score_a_total > v_score_b_total THEN 'a'
    WHEN v_score_b_total > v_score_a_total THEN 'b'
    ELSE NULL
  END;

  -- Slug: ev-<event_slug>-<short uuid>
  v_slug := lower(
    'ev-' || v_event_slug || '-' ||
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
  );

  INSERT INTO public.matches (
    slug, format, match_type,
    social_event_id, played_at,
    team_a_score, team_b_score, winning_team, scoring_format,
    court_number, notes, recorded_by, is_public,
    verification_status
  )
  VALUES (
    v_slug, p_format, 'rec',
    p_event_id, p_played_at,
    p_team_a_score, p_team_b_score, v_winning_team,
    COALESCE(p_scoring_format, '11_rally'),
    NULLIF(p_court_number, ''), p_notes, v_uid, TRUE,
    CASE WHEN v_is_organizer THEN 'verified' ELSE 'pending' END
  )
  RETURNING id INTO v_match_id;

  -- Insert participants
  FOR i IN 1 .. v_team_a_size LOOP
    INSERT INTO public.match_participants (match_id, player_id, team, position)
    VALUES (v_match_id, p_team_a_players[i], 'a', i);
  END LOOP;
  FOR i IN 1 .. v_team_b_size LOOP
    INSERT INTO public.match_participants (match_id, player_id, team, position)
    VALUES (v_match_id, p_team_b_players[i], 'b', i);
  END LOOP;

  RETURN v_match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_social_event_match(
  UUID, TEXT, TIMESTAMPTZ, INTEGER[], INTEGER[], UUID[], UUID[], TEXT, TEXT, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_social_event_match(
  UUID, TEXT, TIMESTAMPTZ, INTEGER[], INTEGER[], UUID[], UUID[], TEXT, TEXT, TEXT
) FROM anon;
GRANT  EXECUTE ON FUNCTION public.log_social_event_match(
  UUID, TEXT, TIMESTAMPTZ, INTEGER[], INTEGER[], UUID[], UUID[], TEXT, TEXT, TEXT
) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.log_social_event_match(
  UUID, TEXT, TIMESTAMPTZ, INTEGER[], INTEGER[], UUID[], UUID[], TEXT, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.log_social_event_match(
  UUID, TEXT, TIMESTAMPTZ, INTEGER[], INTEGER[], UUID[], UUID[], TEXT, TEXT, TEXT
) IS
  'Log match trong context social event. Caller phải là organizer của event hoặc một player có mặt trong team A/B + có registration active. Players phải là registered (event_registrations.profile_id). Organizer-logged matches auto-verified, player-logged matches pending. See migration 20260526120100.';


-- ─── 7. RPC: list matches của một social event ─────────────────────────

CREATE OR REPLACE FUNCTION public.list_social_event_matches(
  p_event_id UUID,
  p_limit    INTEGER DEFAULT 50
)
RETURNS TABLE (
  id                UUID,
  slug              TEXT,
  played_at         TIMESTAMPTZ,
  format            TEXT,
  team_a_score      INTEGER[],
  team_b_score      INTEGER[],
  winning_team      TEXT,
  ready_for_dupr    BOOLEAN,
  submitted_to_dupr BOOLEAN,
  dupr_match_id     TEXT,
  notes             TEXT,
  recorded_by       UUID,
  team_a_players    JSONB,
  team_b_players    JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    m.id,
    m.slug,
    m.played_at,
    m.format,
    m.team_a_score,
    m.team_b_score,
    m.winning_team,
    m.ready_for_dupr,
    m.submitted_to_dupr,
    m.dupr_match_id,
    m.notes,
    m.recorded_by,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'profile_id', mp.player_id,
        'display_name', COALESCE(er.display_name, p.display_name),
        'avatar_url', p.avatar_url,
        -- Ưu tiên dupr_id link riêng vào event (event_registrations.dupr_id)
        -- rồi mới fallback DUPR id chính trên profiles.
        'dupr_id', COALESCE(er.dupr_id, p.dupr_id),
        'position', mp.position
      ) ORDER BY mp.position), '[]'::jsonb)
      FROM public.match_participants mp
      JOIN public.profiles p ON p.id = mp.player_id
      LEFT JOIN public.event_registrations er
        ON er.event_id = p_event_id AND er.profile_id = mp.player_id
      WHERE mp.match_id = m.id AND mp.team = 'a'
    ) AS team_a_players,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'profile_id', mp.player_id,
        'display_name', COALESCE(er.display_name, p.display_name),
        'avatar_url', p.avatar_url,
        'dupr_id', COALESCE(er.dupr_id, p.dupr_id),
        'position', mp.position
      ) ORDER BY mp.position), '[]'::jsonb)
      FROM public.match_participants mp
      JOIN public.profiles p ON p.id = mp.player_id
      LEFT JOIN public.event_registrations er
        ON er.event_id = p_event_id AND er.profile_id = mp.player_id
      WHERE mp.match_id = m.id AND mp.team = 'b'
    ) AS team_b_players
  FROM public.matches m
  WHERE m.social_event_id = p_event_id
  ORDER BY m.played_at DESC
  LIMIT COALESCE(p_limit, 50);
$$;

REVOKE ALL ON FUNCTION public.list_social_event_matches(UUID, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_social_event_matches(UUID, INTEGER) TO anon;
GRANT  EXECUTE ON FUNCTION public.list_social_event_matches(UUID, INTEGER) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.list_social_event_matches(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION public.list_social_event_matches(UUID, INTEGER) IS
  'Public-readable list of matches logged trong social event. team_*_players JSONB chứa display_name từ event_registrations (giữ đúng tên người đăng ký) và dupr_id ưu tiên từ event_registrations.dupr_id. See migration 20260526120100.';


-- ─── 8. REPLACE mark_match_ready_for_dupr — chấp nhận social_event_id ──

CREATE OR REPLACE FUNCTION public.mark_match_ready_for_dupr(
  p_match_id UUID,
  p_ready    BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid               UUID := auth.uid();
  v_club_id           UUID;
  v_social_event_id   UUID;
  v_submitted_to_dupr BOOLEAN;
  v_authorized        BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT club_id, social_event_id, submitted_to_dupr
  INTO v_club_id, v_social_event_id, v_submitted_to_dupr
  FROM public.matches
  WHERE id = p_match_id;

  IF v_club_id IS NULL AND v_social_event_id IS NULL THEN
    RAISE EXCEPTION 'match_not_in_club_or_event' USING ERRCODE = 'P0002';
  END IF;

  IF v_submitted_to_dupr IS TRUE THEN
    RAISE EXCEPTION 'already_submitted' USING ERRCODE = '23505';
  END IF;

  IF v_club_id IS NOT NULL
     AND public.is_club_organizer(v_club_id, v_uid) THEN
    v_authorized := TRUE;
  END IF;

  IF NOT v_authorized
     AND v_social_event_id IS NOT NULL
     AND public.is_social_event_organizer(v_social_event_id, v_uid) THEN
    v_authorized := TRUE;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.matches
  SET ready_for_dupr = p_ready,
      updated_at     = NOW()
  WHERE id = p_match_id;

  RETURN p_ready;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_match_ready_for_dupr(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_match_ready_for_dupr(UUID, BOOLEAN) FROM anon;
GRANT  EXECUTE ON FUNCTION public.mark_match_ready_for_dupr(UUID, BOOLEAN) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.mark_match_ready_for_dupr(UUID, BOOLEAN) TO service_role;

COMMENT ON FUNCTION public.mark_match_ready_for_dupr(UUID, BOOLEAN) IS
  'Toggle ready_for_dupr trên match có club_id HOẶC social_event_id. Organizer-gated (club hoặc event organizer). Refuse nếu đã submitted. See migration 20260526120100 (replaces 20260525120000).';


-- ─── 9. REPLACE mark_match_submitted_to_dupr — chấp nhận social_event_id ─

CREATE OR REPLACE FUNCTION public.mark_match_submitted_to_dupr(
  p_match_id      UUID,
  p_dupr_match_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid              UUID := auth.uid();
  v_club_id          UUID;
  v_social_event_id  UUID;
  v_already_submitted BOOLEAN;
  v_is_admin         BOOLEAN := FALSE;
  v_authorized       BOOLEAN := FALSE;
  v_dupr_code        TEXT := trim(coalesce(p_dupr_match_id, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  IF length(v_dupr_code) < 1 THEN
    RAISE EXCEPTION 'dupr_match_id_required' USING ERRCODE = '22023';
  END IF;
  IF length(v_dupr_code) > 64 THEN
    RAISE EXCEPTION 'dupr_match_id_too_long' USING ERRCODE = '22023';
  END IF;

  SELECT club_id, social_event_id, submitted_to_dupr
  INTO v_club_id, v_social_event_id, v_already_submitted
  FROM public.matches
  WHERE id = p_match_id;

  IF v_club_id IS NULL AND v_social_event_id IS NULL THEN
    RAISE EXCEPTION 'match_not_in_club_or_event' USING ERRCODE = 'P0002';
  END IF;

  IF v_already_submitted IS TRUE THEN
    RAISE EXCEPTION 'already_submitted' USING ERRCODE = '23505';
  END IF;

  -- Global admin bypass
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    v_authorized := TRUE;
  END IF;

  IF NOT v_authorized
     AND v_club_id IS NOT NULL
     AND public.is_club_organizer(v_club_id, v_uid) THEN
    v_authorized := TRUE;
  END IF;

  IF NOT v_authorized
     AND v_social_event_id IS NOT NULL
     AND public.is_social_event_organizer(v_social_event_id, v_uid) THEN
    v_authorized := TRUE;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.matches
  SET submitted_to_dupr = TRUE,
      dupr_match_id     = v_dupr_code,
      dupr_submitted_at = NOW(),
      ready_for_dupr    = FALSE,
      updated_at        = NOW()
  WHERE id = p_match_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_match_submitted_to_dupr(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_match_submitted_to_dupr(UUID, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.mark_match_submitted_to_dupr(UUID, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.mark_match_submitted_to_dupr(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.mark_match_submitted_to_dupr(UUID, TEXT) IS
  'Manual override: đánh dấu match (club HOẶC social event) đã submit DUPR với matchCode pasted từ DUPR dashboard. Organizer-gated (club hoặc event) hoặc global admin. Refuse nếu đã submitted. See migration 20260526120100 (replaces 20260525140000).';
