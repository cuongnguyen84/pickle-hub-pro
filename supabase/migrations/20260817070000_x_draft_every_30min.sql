-- x-draft: daily → every 30 minutes.
--
-- The daily job was the real bottleneck in "post news as it arrives". Pacing
-- was the visible half — a 90-minute gap between posts — but a story that
-- landed at 10:00 still waited until 06:20 the next morning to be written at
-- all. Publishing faster than you draft changes nothing.
--
-- Running every 30 minutes is safe because both producers are idempotent:
--   * news  — x-draft skips any news_item that already has an x_posts row, so a
--             run with nothing new writes nothing.
--   * roundup — refuses to write a second row when one already exists for the
--             day, so it cannot repeat itself 48 times.
--
-- Offset to :05 and :35 so news-rewrite (on the half hour) has finished
-- publishing before this looks for something to write about.

DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'social_poster_auth_secret') THEN
    RAISE WARNING 'vault.secrets.social_poster_auth_secret missing — x-draft will skip until set';
  END IF;
END
$check$;

-- Top-level, not in a DO block: cron.* mutations are flaky there (runbook §1).
SELECT cron.unschedule('x-draft-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'x-draft-daily');

SELECT cron.unschedule('x-draft-every-30min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'x-draft-every-30min');

SELECT cron.schedule(
  'x-draft-every-30min',
  '5,35 * * * *',
  $job$
  DO $inner$
  DECLARE v_secret TEXT;
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
     WHERE name = 'social_poster_auth_secret' LIMIT 1;
    IF v_secret IS NULL THEN
      RAISE WARNING 'social_poster_auth_secret missing from vault — skip x-draft';
      RETURN;
    END IF;
    PERFORM net.http_post(
      url := 'https://social-poster.thecuong.workers.dev/x/draft',
      headers := jsonb_build_object('Content-Type','application/json','X-Auth-Secret', v_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  END
  $inner$;
  $job$
);
