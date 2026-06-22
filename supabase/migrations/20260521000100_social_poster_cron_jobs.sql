-- ============================================================================
-- Cron jobs for the social-poster + news-translate pipeline
-- ============================================================================
--
-- Two pg_cron jobs that drive the auto-post pipeline:
--
-- 1. news-translate-daily-7am-ict (cron 7) — bumped from "30 0 * * *"
--    (once/day) to "*/30 * * * *" (every 30 min). Original cadence was
--    designed for ~3-5 EN rows/day but news-fetcher now pulls 15+/day
--    and the 6-row batch couldn't keep up. With BATCH_SIZE=6 every 30 min
--    we can handle up to 288 EN rows/day with comfortable Gemini quota
--    headroom (15 RPM × 60 = 900 calls/hour available).
--
-- 2. social-poster-catchup-15min (cron 8) — new. Every 15 minutes, hits the
--    social-poster Worker /run endpoint with no body. The Worker's
--    pickNextNewsItem() picks the highest-importance VI row that does NOT
--    yet have a posted row in fb_post_log and posts it. Catches:
--      - VI rows that fired the realtime trigger while Worker was
--        rate-limited (defer 202, never retried otherwise)
--      - Bulk-translated VI rows from cron 7 batches (only the first row in
--        each batch fires the trigger inside the rate-limit window)
--      - Any row missed by the realtime trigger for any reason
--
-- Both jobs read their auth secret from supabase vault so the migration text
-- never contains the secret value. Set the vault secrets manually via:
--   SELECT vault.create_secret('<value>', 'scraper_auth_secret', '...');
--   SELECT vault.create_secret('<value>', 'social_poster_auth_secret', '...');
-- before applying this migration on a fresh project.
-- ============================================================================

-- Make sure vault secrets exist (warn, don't fail — secrets are set out-of-band)
DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'scraper_auth_secret') THEN
    RAISE WARNING 'vault.secrets.scraper_auth_secret missing — cron 7 (news-translate) will skip until set';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'social_poster_auth_secret') THEN
    RAISE WARNING 'vault.secrets.social_poster_auth_secret missing — cron 8 (social-poster catchup) will skip until set';
  END IF;
END$check$;

-- ----------------------------------------------------------------------------
-- Cron 7: news-translate every 30 min
-- ----------------------------------------------------------------------------
DO $alter$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news-translate-daily-7am-ict') THEN
    PERFORM cron.alter_job(
      job_id := (SELECT jobid FROM cron.job WHERE jobname = 'news-translate-daily-7am-ict'),
      schedule := '*/30 * * * *',
      command := $cmd$
DO $do$
DECLARE v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'scraper_auth_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE WARNING 'scraper_auth_secret missing from vault — skip news-translate cron';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/news-translate',
    headers := jsonb_build_object('Content-Type','application/json','x-auth-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END
$do$;
      $cmd$
    );
  END IF;
END$alter$;

-- ----------------------------------------------------------------------------
-- Cron 8: social-poster catchup every 15 min
-- ----------------------------------------------------------------------------
DO $schedule$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'social-poster-catchup-15min') THEN
    PERFORM cron.schedule(
      'social-poster-catchup-15min',
      '*/15 * * * *',
      $cmd$
DO $do$
DECLARE v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'social_poster_auth_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE WARNING 'social_poster_auth_secret missing from vault — skip catchup';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://social-poster.thecuong.workers.dev/run',
    headers := jsonb_build_object('Content-Type','application/json','X-Auth-Secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END
$do$;
      $cmd$
    );
  END IF;
END$schedule$;
