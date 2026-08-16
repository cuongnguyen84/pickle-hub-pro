-- ============================================================================
-- Cron: drain the X (Twitter) queue via the social-poster Worker
-- ============================================================================
--
-- One job, every 5 minutes, hitting POST /x/run with an empty body.
--
-- Why 5 minutes when the playbook only wants 2-4 posts a day: the tick does
-- two jobs, and they need different cadences. Publishing is throttled by the
-- Worker's own X_POST_MIN_GAP_MINUTES (90 min), so a fast tick cannot produce
-- a burst. But the link reply — the entire conversion path, since the post
-- body deliberately carries no URL — can only be sent by a later tick, and a
-- link that shows up 30 minutes after the post has already missed the readers
-- who saw it. A 5-minute tick bounds that lag; the pacing gap keeps the actual
-- post rate where the playbook wants it.
--
-- Serialization is the same argument as social-poster-catchup-15min (see
-- 20260528000000): the Worker claims exactly one row per invocation, so a
-- single scheduled caller means no concurrent publish of the same row. Do NOT
-- add a realtime trigger on x_posts — that is precisely what caused the
-- 2026-05-28 Facebook outage.
--
-- Reuses the existing `social_poster_auth_secret` vault entry: same Worker,
-- same X-Auth-Secret check, so a second secret would only add a way for the
-- two halves to drift apart.
-- ============================================================================

DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'social_poster_auth_secret') THEN
    RAISE WARNING 'vault.secrets.social_poster_auth_secret missing — x-poster-drain-5min will skip until set';
  END IF;
END
$check$;

DO $schedule$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'x-poster-drain-5min') THEN
    PERFORM cron.schedule(
      'x-poster-drain-5min',
      '*/5 * * * *',
      $cmd$
DO $do$
DECLARE v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'social_poster_auth_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE WARNING 'social_poster_auth_secret missing from vault — skip x-poster drain';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://social-poster.thecuong.workers.dev/x/run',
    headers := jsonb_build_object('Content-Type','application/json','X-Auth-Secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END
$do$;
      $cmd$
    );
  END IF;
END
$schedule$;
