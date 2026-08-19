-- Cron fail-loud (roadmap mục C).
--
-- Several pg_cron dispatch jobs skipped SILENTLY when their Vault secret was
-- missing: `RAISE WARNING ...; RETURN;`. A missing secret then looks identical
-- to a healthy no-op run in cron.job_run_details, so the feed/news/social
-- pipelines could die unnoticed. Switch them to `RAISE EXCEPTION` (the pattern
-- dupr-sync-daily already uses) so the run is recorded as FAILED and surfaces
-- to cron-health.
--
-- The exception fires strictly BEFORE net.http_post, so nothing about the HTTP
-- contract changes — the branch only triggers when the secret is genuinely
-- absent, which is a real outage, not a routine skip. cron_secret is currently
-- present in vault, so this is inert under normal operation.
--
-- ops-cron-health-10min (job 29) has the same anti-pattern but is reworked
-- separately under roadmap mục D; left untouched here on purpose.

DO $migration$
DECLARE
  v_job_id  bigint;
  v_command text;
BEGIN
  -- ─── feed-embeds-sync-hourly ──────────────────────────────────────────
  v_command := $command$
DO $feed_embeds$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'cron_secret missing from vault — feed-embeds-sync aborted';
  END IF;
  PERFORM net.http_post(
    url := public.ops_project_url() || '/functions/v1/feed-embeds-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$feed_embeds$;
$command$;
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'feed-embeds-sync-hourly' LIMIT 1;
  IF v_job_id IS NULL THEN
    RAISE WARNING 'feed-embeds-sync-hourly cron job is missing';
  ELSE
    PERFORM cron.alter_job(job_id := v_job_id, command := v_command, active := true);
  END IF;

  -- ─── feed-generate-hourly ─────────────────────────────────────────────
  v_command := $command$
DO $feed_generate$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'cron_secret missing from vault — feed-generate aborted';
  END IF;
  PERFORM net.http_post(
    url := public.ops_project_url() || '/functions/v1/feed-generate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$feed_generate$;
$command$;
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'feed-generate-hourly' LIMIT 1;
  IF v_job_id IS NULL THEN
    RAISE WARNING 'feed-generate-hourly cron job is missing';
  ELSE
    PERFORM cron.alter_job(job_id := v_job_id, command := v_command, active := true);
  END IF;

  -- ─── news-translate-daily-7am-ict ─────────────────────────────────────
  v_command := $command$
DO $news_translate$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'cron_secret missing from vault — news-translate aborted';
  END IF;
  PERFORM net.http_post(
    url := public.ops_project_url() || '/functions/v1/news-translate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$news_translate$;
$command$;
  -- Prod uses the canonical name; fresh schemas still carry the legacy name
  -- (see 20260715180000 reconciliation). Target whichever exists.
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'news-translate-daily-7am-ict' LIMIT 1;
  IF v_job_id IS NULL THEN
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'news-translate-every-30m' LIMIT 1;
  END IF;
  IF v_job_id IS NULL THEN
    RAISE WARNING 'news-translate cron job is missing';
  ELSE
    PERFORM cron.alter_job(job_id := v_job_id, command := v_command, active := true);
  END IF;

  -- ─── social-poster-catchup-15min ──────────────────────────────────────
  v_command := $command$
DO $social_poster$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'social_poster_auth_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'social_poster_auth_secret missing from vault — social-poster-catchup aborted';
  END IF;
  PERFORM net.http_post(
    url := 'https://social-poster.thecuong.workers.dev/run',
    headers := jsonb_build_object('Content-Type','application/json','X-Auth-Secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END
$social_poster$;
$command$;
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'social-poster-catchup-15min' LIMIT 1;
  IF v_job_id IS NULL THEN
    RAISE WARNING 'social-poster-catchup-15min cron job is missing';
  ELSE
    PERFORM cron.alter_job(job_id := v_job_id, command := v_command, active := true);
  END IF;

  -- ─── secret-sync-heal-30min ───────────────────────────────────────────
  v_command := $command$
DO $secret_sync$
DECLARE v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'secret_sync_heal_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'secret_sync_heal_secret missing from vault — secret-sync-heal aborted';
  END IF;
  PERFORM net.http_post(
    url := 'https://secret-sync.thecuong.workers.dev/heal',
    headers := jsonb_build_object('Content-Type','application/json','X-Heal-Secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END
$secret_sync$;
$command$;
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'secret-sync-heal-30min' LIMIT 1;
  IF v_job_id IS NULL THEN
    RAISE WARNING 'secret-sync-heal-30min cron job is missing';
  ELSE
    PERFORM cron.alter_job(job_id := v_job_id, command := v_command, active := true);
  END IF;
END;
$migration$;
