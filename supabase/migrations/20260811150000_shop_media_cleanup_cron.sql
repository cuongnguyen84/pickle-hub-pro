-- ============================================================================
-- Shop media cleanup — scheduling (P2a.2)
-- ----------------------------------------------------------------------------
-- The revocation promise in shop_media_cleanup_jobs is only worth as much as
-- the thing that drains it. A queue nobody runs is a note saying "someone
-- should delete this", which is precisely what D1 forbids.
--
-- cleanup    every 5 minutes. With the retry ladder in
--            shop_media_cleanup_complete this puts the operational target at
--            p95 deletion within ~10 minutes of a revocation. That is a
--            CONFIGURATION default, not a product SLA — change the schedule
--            here, not the meaning of the word "revoked".
-- reconcile  hourly. Unsticks jobs a dead worker was holding and queues
--            objects nothing points at any more.
--
-- Both are guarded by the same x-cron-secret contract as every other
-- cron-only handler; the secret lives in vault as 'cron_secret'.
-- ============================================================================

DO $$
DECLARE
  v_job_id  bigint;
  v_command text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed (local dev) — skipping schedule';
    RETURN;
  END IF;

  -- ── cleanup ──────────────────────────────────────────────────────────────
  v_command := $command$
DO $job$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'cron_secret is not configured';
  END IF;

  PERFORM net.http_post(
    url := public.ops_project_url() || '/functions/v1/shop-media-lifecycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{"action":"cleanup"}'::jsonb,
    timeout_milliseconds := 60000
  );
END
$job$;
$command$;

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'shop-media-cleanup-every-5m' LIMIT 1;
  IF v_job_id IS NULL THEN
    PERFORM cron.schedule('shop-media-cleanup-every-5m', '*/5 * * * *', v_command);
  ELSE
    PERFORM cron.alter_job(v_job_id, schedule := '*/5 * * * *', command := v_command);
  END IF;

  -- ── reconcile ────────────────────────────────────────────────────────────
  v_command := $command$
DO $job$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'cron_secret is not configured';
  END IF;

  PERFORM net.http_post(
    url := public.ops_project_url() || '/functions/v1/shop-media-lifecycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{"action":"reconcile"}'::jsonb,
    timeout_milliseconds := 120000
  );
END
$job$;
$command$;

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'shop-media-reconcile-hourly' LIMIT 1;
  IF v_job_id IS NULL THEN
    PERFORM cron.schedule('shop-media-reconcile-hourly', '17 * * * *', v_command);
  ELSE
    PERFORM cron.alter_job(v_job_id, schedule := '17 * * * *', command := v_command);
  END IF;
END $$;
