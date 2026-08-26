-- ============================================================================
-- Đẩy thông báo đơn hàng ra khỏi ứng dụng — và vá đường ống push đang chết câm
-- ----------------------------------------------------------------------------
-- Trước file này, người bán CHỈ biết có đơn mới khi tự mở app: chuông trong
-- app có bắn (shop_order_create bước 13), nhưng không có gì rời khỏi máy chủ.
-- Với shop sắp mở cho người lạ từ Google thì đó là đơn rơi vào im lặng.
--
-- 🔴 Trong lúc dựng phần này phát hiện một lỗi production rộng hơn: MỌI push
-- bắn từ trigger Postgres trong dự án đều đang trả 401 và không ai biết.
-- Các trigger cũ (đăng ký sự kiện → ban tổ chức, club admin) gửi
-- `Authorization: Bearer <internal_anon_key>`, nhưng send-push-notification đã
-- được siết lại và nay chỉ nhận service-role bearer hoặc JWT admin. Anon key
-- không phải cả hai.
--
-- Đo trực tiếp trên production 18/08, bằng chính pg_net, đúng lệnh mà trigger
-- gọi (user_ids rỗng nên không ai bị làm phiền):
--
--   SELECT net.http_post(url := ops_project_url() || '/functions/v1/send-push-notification',
--                        headers := ... 'Bearer ' || internal_anon_key ...);
--   → req 62590 → status_code 401, body {"error":"Unauthorized"}
--
-- Nó câm vì hai tầng cùng nuốt: pg_net không raise khi HTTP lỗi, và thân
-- trigger lại bọc EXCEPTION WHEN OTHERS THEN NULL.
--
-- File này KHÔNG đụng vào 2 trigger cũ — chúng là lỗi riêng, có bán kính riêng,
-- và sẽ được nối vào cùng helper ở một commit sau khi đường ống này đã chứng
-- minh là chạy thật. Ở đây chỉ dựng helper đúng và dùng nó cho shop.
-- ============================================================================

-- ─── 1. Helper dùng chung ───────────────────────────────────────────────────
-- Một chỗ duy nhất biết cách nói chuyện với send-push-notification. Ba chỗ gọi
-- bên dưới, và 2 trigger cũ sẽ nối vào đây sau — nên khi đường ống đổi lần nữa
-- thì chỉ có một file phải sửa, thay vì đi tìm bốn bản sao của cùng một khối
-- http_post.
--
-- Xác thực bằng `x-cron-secret` chứ không phải Authorization: đó là cơ chế đã
-- có sẵn cho người gọi nội bộ không phải người dùng (_shared/cron-auth.ts), và
-- là thứ DUY NHẤT trigger cầm được — vault không giữ service-role key, và
-- trigger không mượn được JWT admin của ai.
-- Ghi chú định dạng tiền: `to_char(... 'G')` bám lc_numeric của server và ở
-- đây trả về dấu phẩy ("2,500,000"). Người Việt đọc dấu chấm, nên replace —
-- đừng đổi lc_numeric của cả database cho một dòng thông báo.
CREATE OR REPLACE FUNCTION public.push_notify(
  _user_ids UUID[],
  _title    TEXT,
  _body     TEXT,
  _data     JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault, pg_temp
AS $$
DECLARE
  _secret TEXT;
BEGIN
  -- Không người nhận thì không có gì để gửi. Gọi hàm push với mảng rỗng chỉ
  -- tốn một vòng HTTP để nhận về "đã gửi 0".
  IF _user_ids IS NULL OR array_length(_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
    WHERE name = 'cron_secret'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    _secret := NULL;
  END;

  -- Thiếu secret thì KÊU, đừng câm. Đây đúng là cách lỗi cũ sống được 3 tháng.
  -- WARNING chứ không EXCEPTION: một thông báo hỏng không được phép giết đơn
  -- hàng đã đặt xong.
  IF _secret IS NULL OR _secret = '' THEN
    RAISE WARNING 'push_notify: thiếu vault secret cron_secret — bỏ qua push "%"', _title;
    RETURN;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url     := public.ops_project_url() || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-cron-secret', _secret
      ),
      body    := jsonb_build_object(
        'user_ids', to_jsonb(_user_ids),
        'title',    _title,
        'body',     _body,
        'data',     coalesce(_data, '{}'::jsonb)
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push_notify: net.http_post lỗi cho "%": %', _title, SQLERRM;
  END;
END $$;

REVOKE ALL   ON FUNCTION public.push_notify(UUID[], TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_notify(UUID[], TEXT, TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION public.push_notify(UUID[], TEXT, TEXT, JSONB) IS
  'Best-effort FCM push từ Postgres. Xác thực bằng x-cron-secret (vault cron_secret) — anon key bị send-push-notification trả 401, xem 20260818190000.';

-- ─── 2. Đơn mới → người bán ─────────────────────────────────────────────────
-- Dùng trigger chứ không sửa thẳng shop_order_create: RPC đó dài hơn 200 dòng
-- và đang chạy đúng trên production với một đơn thật. Viết lại nguyên hàm chỉ
-- để chèn một lời gọi là đổi rủi ro lấy sự gọn mắt.
--
-- pg_net xếp hàng bằng một dòng trong bảng queue, nên lời gọi này NẰM TRONG
-- transaction của đơn: đơn rollback thì push cũng biến mất. Đó là hành vi đúng.
CREATE OR REPLACE FUNCTION public.tg_shop_order_push_new()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _recipients UUID[];
  _shop       RECORD;
BEGIN
  SELECT s.slug, s.name, s.owner_user_id INTO _shop
  FROM public.shops s WHERE s.id = NEW.shop_id;

  -- Chủ shop cộng mọi thành viên có quyền xử lý đơn. Hôm nay shop_members chỉ
  -- có vai 'owner', nhưng viết theo bảng thì thêm vai sau không phải sửa lại.
  SELECT array_agg(DISTINCT uid) INTO _recipients
  FROM (
    SELECT _shop.owner_user_id AS uid
    UNION
    SELECT m.user_id FROM public.shop_members m WHERE m.shop_id = NEW.shop_id
  ) t
  WHERE uid IS NOT NULL
    -- Người đặt tự đặt trong shop của chính mình thì không tự báo cho mình.
    AND uid IS DISTINCT FROM NEW.buyer_user_id;

  PERFORM public.push_notify(
    _recipients,
    'Đơn hàng mới ' || NEW.code,
    coalesce(NEW.recipient_name, 'Khách') || ' • ' ||
      replace(to_char(NEW.total_vnd, 'FM999G999G999'), ',', '.') || '₫',
    jsonb_build_object(
      'type',      'shop_order_new',
      'order_id',  NEW.id::TEXT,
      'order_code', NEW.code,
      'shop_slug', _shop.slug,
      'url',       '/seller/orders/' || NEW.code
    )
  );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shop_order_push_new ON public.shop_orders;
CREATE TRIGGER trg_shop_order_push_new
  AFTER INSERT ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_shop_order_push_new();

-- ─── 3. Đổi trạng thái → người mua ──────────────────────────────────────────
-- Chuông trong app đã có (shop_order_transition), nhưng người mua thì càng
-- không mở app: họ đặt một lần rồi đợi. "Shop đã gửi hàng" mà chỉ nằm trong
-- app là gần như không tồn tại.
CREATE OR REPLACE FUNCTION public.tg_shop_order_push_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _body TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Không báo cho người vừa tự bấm. auth.uid() đọc được ở đây vì trigger chạy
  -- trong chính phiên đã gọi RPC — cùng nguồn với `_uid` trong RPC đó.
  IF NEW.buyer_user_id IS NULL OR NEW.buyer_user_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  _body := CASE NEW.status::TEXT
    WHEN 'confirmed' THEN 'Shop đã xác nhận đơn và đang chuẩn bị hàng.'
    WHEN 'shipped'   THEN 'Shop đã gửi hàng.' ||
                          coalesce(' Mã vận đơn: ' || NULLIF(btrim(NEW.tracking_code), ''), '')
    WHEN 'delivered' THEN 'Đơn đã hoàn tất.'
    WHEN 'cancelled' THEN 'Đơn đã bị huỷ.' ||
                          coalesce(' Lý do: ' || NULLIF(btrim(NEW.cancel_reason), ''), '')
    ELSE NULL
  END;

  IF _body IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.push_notify(
    ARRAY[NEW.buyer_user_id],
    'Đơn ' || NEW.code || ' đã cập nhật',
    _body,
    jsonb_build_object(
      'type',       'shop_order_status',
      'order_id',   NEW.id::TEXT,
      'order_code', NEW.code,
      'status',     NEW.status::TEXT,
      'url',        '/shop/order/' || NEW.code
    )
  );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shop_order_push_status ON public.shop_orders;
CREATE TRIGGER trg_shop_order_push_status
  AFTER UPDATE OF status ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_shop_order_push_status();

-- ─── 4. Người mua báo đã chuyển khoản → người bán ───────────────────────────
-- Lỗ thứ ba, và là lỗ không có cả chuông in-app: shop_order_claim_payment
-- (20260818150000) không ghi social_notifications dòng nào. Người mua bấm "tôi
-- đã chuyển", rồi ngồi đợi một người không hề biết là mình cần đi soi sao kê.
CREATE OR REPLACE FUNCTION public.tg_shop_order_push_payment_claimed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _recipients UUID[];
BEGIN
  IF NEW.payment_claimed_at IS NULL
     OR NEW.payment_claimed_at IS NOT DISTINCT FROM OLD.payment_claimed_at THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(DISTINCT uid) INTO _recipients
  FROM (
    SELECT s.owner_user_id AS uid FROM public.shops s WHERE s.id = NEW.shop_id
    UNION
    SELECT m.user_id FROM public.shop_members m WHERE m.shop_id = NEW.shop_id
  ) t
  WHERE uid IS NOT NULL;

  PERFORM public.push_notify(
    _recipients,
    'Khách báo đã chuyển khoản',
    'Đơn ' || NEW.code || ' • ' || replace(to_char(NEW.total_vnd, 'FM999G999G999'), ',', '.') ||
      '₫ — kiểm sao kê rồi xác nhận.',
    jsonb_build_object(
      'type',       'shop_order_payment_claimed',
      'order_id',   NEW.id::TEXT,
      'order_code', NEW.code,
      'url',        '/seller/orders/' || NEW.code
    )
  );

  -- Chuông in-app cho cùng sự việc — bên trong app thì đây mới là thứ hiện ra.
  BEGIN
    INSERT INTO public.social_notifications (user_id, type, title, body, link_url, payload)
    SELECT uid, 'shop_order_payment_claimed',
           'Khách báo đã chuyển khoản',
           'Đơn ' || NEW.code || ' — kiểm sao kê rồi xác nhận.',
           '/seller/orders/' || NEW.code,
           jsonb_build_object('order_id', NEW.id)
    FROM unnest(_recipients) AS u(uid)
    WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shop_order_push_payment_claimed ON public.shop_orders;
CREATE TRIGGER trg_shop_order_push_payment_claimed
  AFTER UPDATE OF payment_claimed_at ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_shop_order_push_payment_claimed();
