-- ============================================================================
-- Telegram alert dedup table + realtime publication for client_errors
-- ============================================================================

-- 1. Dedup tracking. Edge function errors-telegram-alert writes a row
--    here each time it sends a Telegram message; later runs check this
--    before re-sending the same fingerprint within a 1-hour window.
CREATE TABLE IF NOT EXISTS public.error_alert_dedup (
  fingerprint     text PRIMARY KEY,
  last_alerted_at timestamptz NOT NULL DEFAULT now(),
  alert_count     integer NOT NULL DEFAULT 1
);

COMMENT ON TABLE public.error_alert_dedup IS
  'Per-fingerprint alert suppression so the Telegram bot does not spam Cuong with the same error over and over.';

GRANT SELECT, INSERT, UPDATE ON public.error_alert_dedup TO service_role;

-- 2. Enable Supabase Realtime for client_errors so the admin /admin/errors
--    page can stream INSERT events live. The publication is the standard
--    `supabase_realtime` one.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'client_errors'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.client_errors;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
