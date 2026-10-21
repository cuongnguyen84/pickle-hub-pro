-- news-repair-hourly — recover news_origins that news-rewrite gave up on.
--
-- Hourly, not every 30 minutes: news-rewrite runs on the half hour and already
-- retries three times per run, so repairing more often than it fails would just
-- race it. An article stuck for an hour is not an outage.
--
-- The function only touches rows at pipeline_status='failed'. It cannot disturb
-- pending, rewriting or published work, so a bug here costs recovery, not the
-- working pipeline.

DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_secret') THEN
    RAISE WARNING 'vault.secrets.cron_secret missing — news-repair-hourly will skip until set';
  END IF;
END
$check$;

-- Top-level: cron.* mutations are flaky inside DO blocks (ops-runbook §1).
SELECT cron.unschedule('news-repair-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news-repair-hourly');

SELECT cron.schedule(
  'news-repair-hourly',
  '20 * * * *',
  $job$
  DO $inner$
  DECLARE v_secret TEXT;
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
     WHERE name = 'cron_secret' LIMIT 1;
    IF v_secret IS NULL THEN
      RAISE WARNING 'cron_secret missing from vault — skip news-repair';
      RETURN;
    END IF;
    PERFORM net.http_post(
      url := public.ops_project_url() || '/functions/v1/news-repair',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', v_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  END
  $inner$;
  $job$
);
