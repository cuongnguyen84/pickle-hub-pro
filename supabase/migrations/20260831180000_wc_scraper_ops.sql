-- ============================================================================
-- Operational state for wc-open-scraper's Telegram reporting.
--
-- The worker is a cron with no memory: every minute is a cold invocation. Two
-- things need to survive between them.
--
--   * The hourly digest. Reporting each run would be ~840 messages a day, which
--     Telegram rate-limits and a human mutes within the hour. So each cycle adds
--     its numbers to an accumulator here and one message goes out per hour.
--
--   * Alert de-duplication. A source outage repeats identically every minute.
--     Without a memo of what was last sent, a single sporttora 503 becomes 60
--     notifications an hour — the fastest way to make someone stop reading
--     alerts entirely, right before the one that matters.
--
-- Keyed rows rather than a table per concern: this is a scratchpad with two
-- kinds of entry ('digest', and 'alert:<fingerprint>'), not a domain model.
--
-- Service-role only. RLS is on with no policy, so anon and authenticated see
-- nothing; the worker writes with the service key, which bypasses RLS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wc_scraper_ops (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wc_scraper_ops IS
  'wc-open-scraper cross-invocation state: hourly digest accumulator and alert de-duplication memos. Service-role only.';

ALTER TABLE public.wc_scraper_ops ENABLE ROW LEVEL SECURITY;
