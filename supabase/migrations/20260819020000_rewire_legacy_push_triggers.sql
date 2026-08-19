-- ============================================================================
-- Nối hai trigger push cũ vào public.push_notify — đóng nốt lỗi 401 câm
-- ----------------------------------------------------------------------------
-- 20260818190000 dựng helper và dùng nó cho shop, nhưng CỐ Ý không đụng hai
-- hàm này: chúng là lỗi riêng, bán kính riêng, và lúc đó đường ống mới chưa
-- chứng minh được gì. Nay đã chứng minh — đo trên production, cùng cách đã
-- dùng để bắt lỗi:
--
--   trước: req 62590 → 401 {"error":"Unauthorized"}
--   sau:   req 63730 → 200 {"dry_run":true,"total_tokens":4,"total_users":1}
--
-- nên hai hàm còn lại được nối nốt.
--
-- Cả hai đang gửi `Authorization: Bearer <internal_anon_key>`, thứ mà
-- send-push-notification từ chối. Nghĩa là:
--   * ban tổ chức KHÔNG hề nhận push khi có người đăng ký sự kiện;
--   * quản trị viên câu lạc bộ KHÔNG hề nhận push.
-- Chuông trong app vẫn chạy suốt — nên nhìn từ ứng dụng thì mọi thứ có vẻ ổn,
-- và đó là lý do không ai báo.
--
-- Thân hai hàm lấy NGUYÊN VĂN từ production (pg_get_functiondef), không lấy từ
-- file migration cũ — giữa chừng có thể đã có ai sửa tay, và thứ cần bảo toàn
-- là cái đang chạy. Thay đổi duy nhất: khối `net.http_post` + đọc vault đổi
-- thành một lời gọi push_notify. Mọi logic chọn người nhận, tiêu đề, payload
-- giữ y nguyên.
-- ============================================================================

-- ─── 1. Push cho quản trị viên câu lạc bộ ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.dispatch_club_admin_push(
  p_recipients uuid[],
  p_type       text,
  p_title      text,
  p_body       text,
  p_link_url   text,
  p_payload    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp', 'extensions'
AS $function$
BEGIN
  IF p_recipients IS NULL OR array_length(p_recipients, 1) IS NULL THEN
    RETURN;
  END IF;

  -- 1) Bell-badge row per recipient
  INSERT INTO public.social_notifications
    (user_id, type, title, body, link_url, payload)
  SELECT r, p_type, p_title, p_body, p_link_url, p_payload
  FROM unnest(p_recipients) AS r;

  -- 2) FCM push. Trước 19/08 chỗ này tự đọc vault và tự gọi net.http_post bằng
  --    anon key — và nhận 401 mọi lần. Nay đi qua push_notify, nơi duy nhất
  --    biết cách xác thực với hàm push.
  PERFORM public.push_notify(
    p_recipients,
    p_title,
    COALESCE(p_body, ''),
    COALESCE(p_payload, '{}'::jsonb)
      || jsonb_build_object('type', p_type, 'link_url', COALESCE(p_link_url, ''))
  );
END;
$function$;

-- ─── 2. Push cho ban tổ chức khi có đăng ký sự kiện ─────────────────────────
CREATE OR REPLACE FUNCTION public.tg_notify_organizers_on_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp', 'extensions'
AS $function$
DECLARE
  v_event      RECORD;
  v_actor      UUID;
  v_payload    JSONB;
  v_title      TEXT;
  v_recipients UUID[];
  v_push_body  TEXT;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT id, club_id, slug, title_vi, created_by
  INTO v_event
  FROM public.social_events
  WHERE id = NEW.event_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_title := 'Đăng ký mới: ' || COALESCE(NULLIF(trim(NEW.display_name), ''), '(không tên)');
  v_actor := NEW.profile_id;
  v_payload := jsonb_build_object(
    'event_id',        v_event.id,
    'event_slug',      v_event.slug,
    'event_title',     v_event.title_vi,
    'player_name',     NEW.display_name,
    'registration_id', NEW.id
  );

  -- Recipient set (creator + club managers, minus actor)
  v_recipients := ARRAY[]::UUID[];
  IF v_event.created_by IS NOT NULL
     AND (v_actor IS NULL OR v_actor <> v_event.created_by) THEN
    v_recipients := array_append(v_recipients, v_event.created_by);
  END IF;
  IF v_event.club_id IS NOT NULL THEN
    SELECT array_cat(v_recipients, array_agg(m.profile_id))
    INTO v_recipients
    FROM public.club_managers m
    WHERE m.club_id = v_event.club_id
      AND m.profile_id <> v_event.created_by
      AND (v_actor IS NULL OR m.profile_id <> v_actor);
  END IF;
  IF v_recipients IS NULL OR array_length(v_recipients, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Bell-badge rows
  INSERT INTO public.social_notifications
    (user_id, type, title, body, link_url, payload)
  SELECT
    r,
    'event_registration',
    v_title,
    v_event.title_vi,
    '/social/' || v_event.slug || '/danh-sach',
    v_payload
  FROM unnest(v_recipients) r;

  -- FCM push — xem ghi chú ở dispatch_club_admin_push.
  v_push_body := COALESCE(NULLIF(trim(NEW.display_name), ''), '(không tên)')
              || ' • ' || v_event.title_vi;

  PERFORM public.push_notify(
    v_recipients,
    'Đăng ký mới',
    v_push_body,
    jsonb_build_object(
      'type',            'event_registration',
      'event_slug',      v_event.slug,
      'registration_id', NEW.id::TEXT,
      'player_name',     COALESCE(NEW.display_name, '')
    )
  );

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.tg_notify_organizers_on_registration() IS
  'AFTER INSERT trên event_registrations — ghi social_notifications cho chuông và bắn FCM qua public.push_notify. Đường push tự-gọi bằng anon key đã gỡ 19/08 vì nó trả 401 câm (xem 20260818190000).';
