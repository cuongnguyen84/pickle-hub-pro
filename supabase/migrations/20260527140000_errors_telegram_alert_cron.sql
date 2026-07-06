-- ============================================================================
-- Cron schedule for errors-telegram-alert (runs every 10 minutes)
-- ============================================================================
-- Reads `internal_anon_key` from Vault — same pattern as
-- social-poster-catchup-15min (the closest sibling cron). The edge
-- function has verify_jwt = false but Supabase Functions gateway still
-- wants an Authorization header to route the request.
--
-- To pause:
--   SELECT cron.unschedule('errors-telegram-alert-10min');
-- ============================================================================

-- Idempotent re-apply.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'errors-telegram-alert-10min') THEN
    PERFORM cron.unschedule('errors-telegram-alert-10min');
  END IF;
END $$;

SELECT cron.schedule(
  'errors-telegram-alert-10min',
  '*/10 * * * *',
  $$
  DO $do$
  DECLARE
    v_key TEXT;
  BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'internal_anon_key'
    LIMIT 1;
    IF v_key IS NULL THEN
      RAISE WARNING 'internal_anon_key missing — skip errors-telegram-alert';
      RETURN;
    END IF;
    PERFORM net.http_post(
      url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/errors-telegram-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  END$do$;
  $$
);

-- Daily GC for the dedup table — drop entries older than 7 days.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'error-alert-dedup-gc') THEN
    PERFORM cron.unschedule('error-alert-dedup-gc');
  END IF;
END $$;

SELECT cron.schedule(
  'error-alert-dedup-gc',
  '0 4 * * *',
  $$
  DELETE FROM public.error_alert_dedup
  WHERE last_alerted_at < now() - interval '7 days';
  $$
);
