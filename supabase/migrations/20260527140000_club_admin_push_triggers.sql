-- ============================================================================
-- CLB admin push notifications — broadcast every CLB-scoped event
-- ============================================================================
-- Đẩy thông báo (bell badge + FCM push) cho admin CLB (creator +
-- managers) khi:
--
--   1. club_members INSERT — có người mới yêu cầu join (status='pending')
--      hoặc được organizer mời thẳng (status='active'). Skip actor.
--   2. club_members UPDATE status='pending' → 'active' — báo cho
--      người vừa được approve "Anh đã được duyệt vào CLB".
--   3. club_members DELETE — báo admins khi có member rời hoặc bị
--      remove (skip self-leave actor).
--   4. social_events INSERT (club_id IS NOT NULL) — báo các admin khác
--      khi 1 admin tạo event mới trong CLB.
--   5. matches INSERT (club_id IS NOT NULL) — báo admins khi 1 match
--      được log trong CLB.
--
-- Pattern reuse từ tg_notify_organizers_on_registration (migration
-- 20260522150000): insert social_notifications row + fire FCM push qua
-- send-push-notification edge function (auth bằng vault internal_anon_key).
-- Push lỗi → swallow, bell badge vẫn còn.
--
-- IDEMPOTENT — replay-safe (DROP TRIGGER + CREATE OR REPLACE FUNCTION).
-- ============================================================================

-- ─── 0. Helper: enumerate club admin user_ids (creator + managers) ───────

CREATE OR REPLACE FUNCTION public.get_club_admin_ids(
  p_club_id  UUID,
  p_exclude  UUID DEFAULT NULL
)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH ids AS (
    SELECT created_by AS uid FROM public.clubs WHERE id = p_club_id
    UNION
    SELECT profile_id AS uid FROM public.club_managers WHERE club_id = p_club_id
  )
  SELECT COALESCE(array_agg(DISTINCT uid), ARRAY[]::UUID[])
  FROM ids
  WHERE uid IS NOT NULL
    AND (p_exclude IS NULL OR uid <> p_exclude);
$$;

GRANT EXECUTE ON FUNCTION public.get_club_admin_ids(UUID, UUID) TO service_role;


-- ─── 0b. Shared push dispatcher ──────────────────────────────────────────
-- Inline-able PL/pgSQL block hard to factor; instead define a function
-- that wraps insert into social_notifications + pg_net call to push edge
-- function. Triggers call this with prepared args.

CREATE OR REPLACE FUNCTION public.dispatch_club_admin_push(
  p_recipients  UUID[],
  p_type        TEXT,
  p_title       TEXT,
  p_body        TEXT,
  p_link_url    TEXT,
  p_payload     JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_anon_key TEXT;
BEGIN
  IF p_recipients IS NULL OR array_length(p_recipients, 1) IS NULL THEN
    RETURN;
  END IF;

  -- 1) Bell-badge row per recipient
  INSERT INTO public.social_notifications
    (user_id, type, title, body, link_url, payload)
  SELECT r, p_type, p_title, p_body, p_link_url, p_payload
  FROM unnest(p_recipients) AS r;

  -- 2) FCM push qua edge function (best effort, lỗi không break trigger)
  BEGIN
    SELECT decrypted_secret INTO v_anon_key
    FROM vault.decrypted_secrets
    WHERE name = 'internal_anon_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_anon_key := NULL;
  END;

  IF v_anon_key IS NOT NULL THEN
    BEGIN
      PERFORM net.http_post(
        url     := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key,
          'apikey', v_anon_key
        ),
        body    := jsonb_build_object(
          'user_ids', to_jsonb(p_recipients),
          'title',   p_title,
          'body',    COALESCE(p_body, ''),
          'data',    COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object('type', p_type, 'link_url', COALESCE(p_link_url, ''))
        ),
        timeout_milliseconds := 5000
      );
    EXCEPTION WHEN OTHERS THEN
      -- Push lỗi không quan trọng — bell-badge row đã insert.
      NULL;
    END;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_club_admin_push(UUID[], TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_club_admin_push(UUID[], TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.dispatch_club_admin_push(UUID[], TEXT, TEXT, TEXT, TEXT, JSONB) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.dispatch_club_admin_push(UUID[], TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION public.dispatch_club_admin_push(UUID[], TEXT, TEXT, TEXT, TEXT, JSONB) IS
  'Internal helper: insert social_notifications + fire FCM push qua send-push-notification edge function. Push best-effort, swallow exception. See migration 20260527140000.';


-- ─── 1. Trigger: club_members INSERT (new join request / direct invite) ──

CREATE OR REPLACE FUNCTION public.tg_notify_club_admins_on_member_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_club       RECORD;
  v_actor_name TEXT;
  v_recipients UUID[];
  v_title      TEXT;
  v_body       TEXT;
BEGIN
  SELECT id, slug, name, created_by
  INTO v_club
  FROM public.clubs
  WHERE id = NEW.club_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Actor = the new member themselves (self-request) hoặc the inviter
  -- (NEW.added_by). Loại actor khỏi recipients.
  v_recipients := public.get_club_admin_ids(NEW.club_id, NEW.profile_id);

  IF v_recipients IS NULL OR array_length(v_recipients, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(trim(display_name), ''),
                  NULLIF(trim(split_part(email, '@', 1)), ''),
                  '(không tên)')
  INTO v_actor_name
  FROM public.profiles
  WHERE id = NEW.profile_id;

  IF NEW.status = 'pending' THEN
    v_title := 'Yêu cầu join CLB';
    v_body  := v_actor_name || ' muốn tham gia ' || v_club.name;
  ELSE
    -- Direct invite (organizer thêm thẳng) — status='active' ngay từ đầu.
    v_title := 'Thành viên mới';
    v_body  := v_actor_name || ' vừa được thêm vào ' || v_club.name;
  END IF;

  PERFORM public.dispatch_club_admin_push(
    v_recipients,
    'club_member_request',
    v_title,
    v_body,
    '/clb/' || v_club.slug || '/quan-ly',
    jsonb_build_object(
      'club_id',       v_club.id,
      'club_slug',     v_club.slug,
      'club_name',     v_club.name,
      'member_id',     NEW.profile_id,
      'member_name',   v_actor_name,
      'member_status', NEW.status
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_club_admins_on_member_insert ON public.club_members;
CREATE TRIGGER notify_club_admins_on_member_insert
  AFTER INSERT ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notify_club_admins_on_member_insert();


-- ─── 2. Trigger: club_members UPDATE pending → active (approval) ─────────

CREATE OR REPLACE FUNCTION public.tg_notify_member_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_club RECORD;
BEGIN
  -- Chỉ fire khi flip pending → active
  IF OLD.status = 'pending' AND NEW.status = 'active' THEN
    SELECT id, slug, name INTO v_club FROM public.clubs WHERE id = NEW.club_id;
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    PERFORM public.dispatch_club_admin_push(
      ARRAY[NEW.profile_id]::UUID[],
      'club_member_approved',
      'Đã được duyệt vào CLB',
      'Anh được duyệt thành viên ' || v_club.name,
      '/clb/' || v_club.slug,
      jsonb_build_object(
        'club_id',   v_club.id,
        'club_slug', v_club.slug,
        'club_name', v_club.name
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_member_on_approval ON public.club_members;
CREATE TRIGGER notify_member_on_approval
  AFTER UPDATE ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notify_member_on_approval();


-- ─── 3. Trigger: club_members DELETE (leave / kick) ──────────────────────

CREATE OR REPLACE FUNCTION public.tg_notify_club_admins_on_member_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_club       RECORD;
  v_actor_name TEXT;
  v_recipients UUID[];
BEGIN
  SELECT id, slug, name INTO v_club FROM public.clubs WHERE id = OLD.club_id;
  IF NOT FOUND THEN
    RETURN OLD;
  END IF;

  v_recipients := public.get_club_admin_ids(OLD.club_id, auth.uid());
  IF v_recipients IS NULL OR array_length(v_recipients, 1) IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT COALESCE(NULLIF(trim(display_name), ''),
                  NULLIF(trim(split_part(email, '@', 1)), ''),
                  '(không tên)')
  INTO v_actor_name
  FROM public.profiles
  WHERE id = OLD.profile_id;

  PERFORM public.dispatch_club_admin_push(
    v_recipients,
    'club_member_left',
    'Thành viên rời CLB',
    v_actor_name || ' đã rời ' || v_club.name,
    '/clb/' || v_club.slug || '/quan-ly',
    jsonb_build_object(
      'club_id',     v_club.id,
      'club_slug',   v_club.slug,
      'club_name',   v_club.name,
      'member_id',   OLD.profile_id,
      'member_name', v_actor_name,
      'prev_status', OLD.status
    )
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS notify_club_admins_on_member_delete ON public.club_members;
CREATE TRIGGER notify_club_admins_on_member_delete
  AFTER DELETE ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notify_club_admins_on_member_delete();


-- ─── 4. Trigger: social_events INSERT (new event in club) ────────────────

CREATE OR REPLACE FUNCTION public.tg_notify_club_admins_on_event_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_club       RECORD;
  v_recipients UUID[];
BEGIN
  -- Chỉ fire khi event link tới CLB (club_id NOT NULL) và là draft/published.
  IF NEW.club_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, slug, name INTO v_club FROM public.clubs WHERE id = NEW.club_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Loại actor (creator của event) khỏi recipients để không tự ping mình.
  v_recipients := public.get_club_admin_ids(NEW.club_id, NEW.created_by);
  IF v_recipients IS NULL OR array_length(v_recipients, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.dispatch_club_admin_push(
    v_recipients,
    'club_event_created',
    'Sự kiện mới trong CLB',
    v_club.name || ' vừa tạo sự kiện: ' || NEW.title_vi,
    '/social/' || NEW.slug,
    jsonb_build_object(
      'club_id',     v_club.id,
      'club_slug',   v_club.slug,
      'event_id',    NEW.id,
      'event_slug',  NEW.slug,
      'event_title', NEW.title_vi,
      'start_at',    NEW.start_at,
      'status',      NEW.status
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_club_admins_on_event_create ON public.social_events;
CREATE TRIGGER notify_club_admins_on_event_create
  AFTER INSERT ON public.social_events
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notify_club_admins_on_event_create();


-- ─── 5. Trigger: matches INSERT with club_id (new match logged) ──────────

CREATE OR REPLACE FUNCTION public.tg_notify_club_admins_on_match_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_club       RECORD;
  v_recipients UUID[];
  v_score_str  TEXT;
BEGIN
  IF NEW.club_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, slug, name INTO v_club FROM public.clubs WHERE id = NEW.club_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_recipients := public.get_club_admin_ids(NEW.club_id, NEW.recorded_by);
  IF v_recipients IS NULL OR array_length(v_recipients, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build "A score - B score" compact line for body
  v_score_str := COALESCE(
    (
      SELECT string_agg(a::TEXT || '-' || b::TEXT, ', ')
      FROM unnest(NEW.team_a_score, NEW.team_b_score) AS s(a, b)
    ),
    '—'
  );

  PERFORM public.dispatch_club_admin_push(
    v_recipients,
    'club_match_logged',
    'Trận đấu mới trong CLB',
    v_club.name || ' • ' || v_score_str,
    '/tran-dau/' || NEW.slug,
    jsonb_build_object(
      'club_id',      v_club.id,
      'club_slug',    v_club.slug,
      'match_id',     NEW.id,
      'match_slug',   NEW.slug,
      'format',       NEW.format,
      'winning_team', NEW.winning_team,
      'scores',       v_score_str
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_club_admins_on_match_create ON public.matches;
CREATE TRIGGER notify_club_admins_on_match_create
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notify_club_admins_on_match_create();
