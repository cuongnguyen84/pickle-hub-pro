-- SEC-02: atomically rate-limit the public batch-view-events endpoint without
-- storing raw user ids or IP addresses in the limiter table.

CREATE TABLE IF NOT EXISTS public.view_event_rate_limits (
  identity_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  event_count integer NOT NULL CHECK (event_count > 0),
  request_count integer NOT NULL CHECK (request_count > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (identity_hash, window_start)
);

ALTER TABLE public.view_event_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.view_event_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.view_event_rate_limits TO service_role;

COMMENT ON TABLE public.view_event_rate_limits IS
  'Short-lived, SHA-256-keyed fixed windows for batch-view-events. No raw IP or user id is stored.';

CREATE OR REPLACE FUNCTION public.consume_view_event_rate_limit(
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

  -- At current traffic this table stays tiny, but bound retention even if an
  -- abusive caller rotates identities continuously.
  DELETE FROM public.view_event_rate_limits
  WHERE window_start < v_now - interval '2 days';

  INSERT INTO public.view_event_rate_limits AS limiter (
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
    FROM public.view_event_rate_limits
    WHERE identity_hash = p_identity_hash
      AND window_start = v_window_start;
    RETURN QUERY SELECT false, greatest(0, p_limit - coalesce(v_count, p_limit)), v_retry_after;
  ELSE
    RETURN QUERY SELECT true, greatest(0, p_limit - v_count), v_retry_after;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_view_event_rate_limit(text, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_view_event_rate_limit(text, integer, integer, integer)
  TO service_role;

-- Direct browser INSERT is already impossible in production because anon and
-- authenticated have no table INSERT grant. Remove the inert permissive policy
-- so a future grant cannot silently bypass the hardened Edge Function.
DROP POLICY IF EXISTS "Validated view event inserts" ON public.view_events;
