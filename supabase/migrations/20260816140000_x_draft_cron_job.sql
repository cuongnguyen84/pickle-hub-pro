-- x-draft-daily — turn fresh English news into X drafts once a day.
--
-- Separate job from x-poster-drain-5min on purpose. The drain publishes and
-- must tick often (it paces posting and would otherwise sit on an approved
-- row); drafting calls Gemini and only needs to run when there is new news.
-- Folding them together would mean a Gemini call every five minutes to
-- discover there is nothing to write.
--
-- This job cannot publish anything. /x/draft writes rows at status='draft',
-- and the drain only ever selects status='approved', so the path from a
-- generated draft to a live post runs through Cuong and nowhere else.
--
-- 23:20 UTC = 06:20 ICT: the news fetcher has swept the US evening results by
-- then, so the drafts are waiting when Cuong looks at his phone in the morning.

DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'social_poster_auth_secret') THEN
    RAISE WARNING 'vault.secrets.social_poster_auth_secret missing — x-draft-daily will skip until set';
  END IF;
END
$check$;

-- Top-level, not inside a DO block: cron.* mutations are flaky in DO blocks
-- (ops-runbook §1).
SELECT cron.unschedule('x-draft-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'x-draft-daily');

SELECT cron.schedule(
  'x-draft-daily',
  '20 23 * * *',
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
