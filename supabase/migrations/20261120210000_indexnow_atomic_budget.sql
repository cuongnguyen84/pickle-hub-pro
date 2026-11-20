-- Apply before deploying the Pages handler: missing RPC fails closed (503).
-- One bounded singleton row; no caller identifiers, secrets or cleanup job.
CREATE TABLE public.indexnow_rate_budget (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  window_start timestamptz NOT NULL,
  used integer NOT NULL CHECK (used BETWEEN 1 AND 10)
);
ALTER TABLE public.indexnow_rate_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.indexnow_rate_budget FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.consume_indexnow_budget() RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  WITH consumed AS (
    INSERT INTO public.indexnow_rate_budget AS b (singleton, window_start, used)
    VALUES (true, date_trunc('minute', statement_timestamp()), 1)
    -- A statement queued before rollover must never move a newer row backwards.
    ON CONFLICT (singleton) DO UPDATE
    SET window_start = EXCLUDED.window_start,
        used = CASE WHEN b.window_start < EXCLUDED.window_start THEN 1 ELSE b.used + 1 END
    WHERE b.window_start < EXCLUDED.window_start
       OR (b.window_start = EXCLUDED.window_start AND b.used < 10)
    RETURNING true AS allowed
  ) SELECT coalesce((SELECT allowed FROM consumed), false);
$$;
REVOKE ALL ON FUNCTION public.consume_indexnow_budget() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_indexnow_budget() TO service_role;
COMMENT ON FUNCTION public.consume_indexnow_budget() IS
  'IndexNow global fixed-minute budget: at most 10 authorized calls/minute; service only, atomic singleton upsert.';
NOTIFY pgrst, 'reload schema';
