-- Trợ lý AI chung trên mọi màn hình (edge function site-assistant, 12/11/2026).
-- Chỉ thêm đối tượng mới, không đụng bảng/hàm cũ.
--
-- 1. site_assistant_quota — bộ đếm hạn mức theo cửa sổ cố định (ngày UTC +
--    phút) cho từng danh tính đã băm SHA-256 (user id hoặc IP — không lưu IP
--    thô) và một trần chung mỗi ngày cho toàn hệ thống.
-- 2. consume_site_assistant_quota — kiểm + tăng nguyên tử, trả 'ok' |
--    'rate_limited' | 'capped'. Chỉ service_role gọi được.
-- 3. site_assistant_log — nhật ký từng lượt (giữ 30 ngày, pg_cron xoá).
--    RLS bật, không policy cho anon/authenticated; admin đọc qua is_admin().

CREATE TABLE IF NOT EXISTS public.site_assistant_quota (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count > 0),
  PRIMARY KEY (bucket, window_start)
);

ALTER TABLE public.site_assistant_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.site_assistant_quota FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.site_assistant_quota TO service_role;

COMMENT ON TABLE public.site_assistant_quota IS
  'Fixed-window counters for site-assistant (per SHA-256 identity per UTC day / per minute, plus a global daily cap). No raw IP or user id stored. Rows older than 2 days are pruned by consume_site_assistant_quota.';

CREATE OR REPLACE FUNCTION public.consume_site_assistant_quota(
  p_identity_hash text,
  p_daily_limit integer,
  p_burst_limit integer,
  p_global_limit integer
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
  v_min timestamptz := date_trunc('minute', v_now);
  v_count integer;
BEGIN
  IF p_identity_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'identity hash must be 64 lowercase hex characters' USING ERRCODE = '22023';
  END IF;

  -- Bảng nhỏ ở mức traffic hiện tại; vẫn chặn phình nếu bị xoay danh tính liên tục.
  DELETE FROM public.site_assistant_quota WHERE window_start < v_now - interval '2 days';

  -- Trần chung trước: hết trần thì không trừ lượt của người dùng.
  SELECT count INTO v_count FROM public.site_assistant_quota WHERE bucket = 'global' AND window_start = v_day;
  IF coalesce(v_count, 0) >= p_global_limit THEN
    RETURN 'capped';
  END IF;

  v_count := NULL;
  INSERT INTO public.site_assistant_quota AS q (bucket, window_start, count)
  VALUES ('m:' || p_identity_hash, v_min, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET count = q.count + 1
  WHERE q.count < p_burst_limit
  RETURNING count INTO v_count;
  IF v_count IS NULL OR v_count > p_burst_limit THEN
    RETURN 'rate_limited';
  END IF;

  v_count := NULL;
  INSERT INTO public.site_assistant_quota AS q (bucket, window_start, count)
  VALUES ('d:' || p_identity_hash, v_day, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET count = q.count + 1
  WHERE q.count < p_daily_limit
  RETURNING count INTO v_count;
  IF v_count IS NULL OR v_count > p_daily_limit THEN
    RETURN 'rate_limited';
  END IF;

  v_count := NULL;
  INSERT INTO public.site_assistant_quota AS q (bucket, window_start, count)
  VALUES ('global', v_day, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET count = q.count + 1
  WHERE q.count < p_global_limit
  RETURNING count INTO v_count;
  IF v_count IS NULL THEN
    RETURN 'capped';
  END IF;

  RETURN 'ok';
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_site_assistant_quota(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_site_assistant_quota(text, integer, integer, integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.site_assistant_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  thread_id text,
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  page_type text,
  route text,
  lang text,
  user_text text,
  reply text,
  outcome text NOT NULL CHECK (outcome IN ('answered', 'off_topic', 'rate_limited', 'capped', 'error')),
  model text,
  latency_ms integer,
  prompt_tokens integer,
  output_tokens integer
);

CREATE INDEX IF NOT EXISTS site_assistant_log_created_at_idx ON public.site_assistant_log (created_at);
CREATE INDEX IF NOT EXISTS site_assistant_log_user_id_idx ON public.site_assistant_log (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.site_assistant_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.site_assistant_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.site_assistant_log TO service_role;
GRANT SELECT ON TABLE public.site_assistant_log TO authenticated;

CREATE POLICY "Admins read site assistant log"
  ON public.site_assistant_log FOR SELECT TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.site_assistant_log IS
  'One row per site-assistant turn (clipped user text + reply, outcome, model, latency). Written by the edge function via service_role; admins read via is_admin(). Purged after 30 days by pg_cron purge-site-assistant-log.';

SELECT cron.unschedule('purge-site-assistant-log')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-site-assistant-log');

SELECT cron.schedule(
  'purge-site-assistant-log',
  '37 3 * * *',
  $$DELETE FROM public.site_assistant_log WHERE created_at < now() - interval '30 days'$$
);
