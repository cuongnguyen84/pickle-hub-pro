-- SEC-03: bound public client-error ingestion and retain diagnostic data for
-- 90 days (three times the longest 30-day admin dashboard window).

CREATE TABLE IF NOT EXISTS public.client_error_rate_limits (
  identity_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  event_count integer NOT NULL CHECK (event_count > 0),
  request_count integer NOT NULL CHECK (request_count > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (identity_hash, window_start)
);

CREATE INDEX IF NOT EXISTS idx_client_error_rate_limits_window_start
  ON public.client_error_rate_limits (window_start);

ALTER TABLE public.client_error_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_error_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.client_error_rate_limits TO service_role;

COMMENT ON TABLE public.client_error_rate_limits IS
  'Short-lived SHA-256 identities for log-client-event fixed-window rate limits; no raw user id or IP is stored.';

CREATE OR REPLACE FUNCTION public.consume_client_error_rate_limit(
  p_identity_hash text,
  p_event_count integer,
  p_limit integer,
  p_window_seconds integer DEFAULT 600
)
RETURNS TABLE (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
  v_retry_after integer;
BEGIN
  IF p_identity_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'identity hash must be 64 lowercase hex characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_event_count < 1 OR p_event_count > 20 THEN
    RAISE EXCEPTION 'event count must be between 1 and 20'
      USING ERRCODE = '22023';
  END IF;
  IF p_limit < 20 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'limit must be between 20 and 1000'
      USING ERRCODE = '22023';
  END IF;
  IF p_window_seconds < 60 OR p_window_seconds > 3600 THEN
    RAISE EXCEPTION 'window must be between 60 and 3600 seconds'
      USING ERRCODE = '22023';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds
  );
  v_retry_after := greatest(
    1,
    ceil(extract(epoch FROM (
      v_window_start + make_interval(secs => p_window_seconds) - v_now
    )))::integer
  );

  DELETE FROM public.client_error_rate_limits
  WHERE window_start < v_now - interval '2 days';

  INSERT INTO public.client_error_rate_limits AS limiter (
    identity_hash,
    window_start,
    event_count,
    request_count,
    updated_at
  )
  VALUES (p_identity_hash, v_window_start, p_event_count, 1, v_now)
  ON CONFLICT (identity_hash, window_start) DO UPDATE
  SET event_count = limiter.event_count + EXCLUDED.event_count,
      request_count = limiter.request_count + 1,
      updated_at = v_now
  WHERE limiter.event_count + EXCLUDED.event_count <= p_limit
  RETURNING event_count INTO v_count;

  IF v_count IS NULL THEN
    SELECT event_count INTO v_count
    FROM public.client_error_rate_limits
    WHERE identity_hash = p_identity_hash
      AND window_start = v_window_start;
    RETURN QUERY SELECT false, greatest(0, p_limit - coalesce(v_count, p_limit)), v_retry_after;
  ELSE
    RETURN QUERY SELECT true, greatest(0, p_limit - v_count), v_retry_after;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_client_error_rate_limit(text, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_client_error_rate_limit(text, integer, integer, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.prune_client_errors(
  p_retention_days integer DEFAULT 90
)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_deleted bigint;
BEGIN
  IF p_retention_days < 30 OR p_retention_days > 365 THEN
    RAISE EXCEPTION 'retention days must be between 30 and 365'
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.client_errors
  WHERE recorded_at < clock_timestamp() - make_interval(days => p_retention_days);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.prune_client_errors(integer)
  FROM PUBLIC, anon, authenticated, service_role;

-- Keep admin reads behind the existing RLS policy, and remove the unnecessary
-- anonymous SELECT grant observed in production.
REVOKE ALL ON TABLE public.client_errors FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.client_errors FROM authenticated;
GRANT SELECT ON TABLE public.client_errors TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.client_errors TO service_role;

DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'client-errors-retention-daily') THEN
    PERFORM cron.unschedule('client-errors-retention-daily');
  END IF;
END;
$block$;

SELECT cron.schedule(
  'client-errors-retention-daily',
  '17 3 * * *',
  $cron$SELECT public.prune_client_errors(90);$cron$
);
