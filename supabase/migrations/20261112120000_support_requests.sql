-- Yêu cầu hỗ trợ gửi qua trợ lý AI (thay 2 nút Messenger/Zalo nổi, 12/11/2026).
-- Chỉ thêm đối tượng mới, không đụng bảng/hàm cũ.
--
-- 1. support_requests — mỗi lần người dùng bấm "Gửi cho admin" trong khung
--    trợ lý. Chỉ edge function site-assistant (service_role) INSERT; user_id
--    lấy từ JWT đã kiểm ở server. Admin (is_admin()) đọc + cập nhật trạng thái;
--    người gửi đã đăng nhập đọc được dòng của chính mình (kể cả admin_note —
--    ghi chú đó viết như thể người gửi sẽ đọc).
-- 2. Trigger đóng dấu handled_at / handled_by = auth.uid() khi đổi trạng thái
--    (không tin client tự điền).
-- 3. consume_support_request_quota — hạn mức theo giờ + ngày cho danh tính đã
--    băm (user id hoặc IP), dùng chung bảng đếm site_assistant_quota với tiền
--    tố bucket riêng. Chỉ service_role gọi được.

CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  name text CHECK (char_length(name) <= 80),
  phone text CHECK (char_length(phone) <= 20),
  email text CHECK (char_length(email) <= 120),
  zalo text CHECK (char_length(zalo) <= 60),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  page_type text CHECK (char_length(page_type) <= 30),
  route text CHECK (char_length(route) <= 200),
  page_label text CHECK (char_length(page_label) <= 200),
  lang text CHECK (lang IN ('vi', 'en')),
  transcript jsonb CHECK (transcript IS NULL OR (jsonb_typeof(transcript) = 'array' AND pg_column_size(transcript) <= 8000)),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'handled')),
  handled_at timestamptz,
  handled_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  admin_note text CHECK (char_length(admin_note) <= 2000)
);

CREATE INDEX IF NOT EXISTS support_requests_status_created_idx ON public.support_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS support_requests_user_id_idx ON public.support_requests (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.support_requests TO service_role;
-- Không có INSERT cho anon/authenticated: chỉ edge function ghi.
GRANT SELECT ON TABLE public.support_requests TO authenticated;
GRANT UPDATE (status, admin_note) ON TABLE public.support_requests TO authenticated;

CREATE POLICY "Admins read support requests"
  ON public.support_requests FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users read own support requests"
  ON public.support_requests FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Admins update support requests"
  ON public.support_requests FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.support_requests_stamp_handled()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'handled' THEN
      NEW.handled_at := now();
      NEW.handled_by := auth.uid();
    ELSE
      NEW.handled_at := NULL;
      NEW.handled_by := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS support_requests_stamp_handled ON public.support_requests;
CREATE TRIGGER support_requests_stamp_handled
  BEFORE UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.support_requests_stamp_handled();

COMMENT ON TABLE public.support_requests IS
  'Contact-admin requests sent from the AI assistant (web + iOS). Inserted only by the site-assistant edge function via service_role (user_id from the verified JWT). Admins read/update via is_admin(); a signed-in requester reads their own rows. handled_at/handled_by are stamped by trigger.';

CREATE OR REPLACE FUNCTION public.consume_support_request_quota(
  p_identity_hash text,
  p_hourly_limit integer,
  p_daily_limit integer
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_day timestamptz := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_hour timestamptz := date_trunc('hour', v_now);
  v_count integer;
BEGIN
  IF p_identity_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'identity hash must be 64 lowercase hex characters' USING ERRCODE = '22023';
  END IF;

  -- Ngày trước (không trừ lượt giờ khi đã hết lượt ngày), giờ sau.
  v_count := NULL;
  INSERT INTO public.site_assistant_quota AS q (bucket, window_start, count)
  VALUES ('sd:' || p_identity_hash, v_day, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET count = q.count + 1
  WHERE q.count < p_daily_limit
  RETURNING count INTO v_count;
  IF v_count IS NULL OR v_count > p_daily_limit THEN
    RETURN 'rate_limited';
  END IF;

  v_count := NULL;
  INSERT INTO public.site_assistant_quota AS q (bucket, window_start, count)
  VALUES ('sh:' || p_identity_hash, v_hour, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET count = q.count + 1
  WHERE q.count < p_hourly_limit
  RETURNING count INTO v_count;
  IF v_count IS NULL OR v_count > p_hourly_limit THEN
    RETURN 'rate_limited';
  END IF;

  RETURN 'ok';
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_support_request_quota(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_support_request_quota(text, integer, integer) TO service_role;
