-- SEC-04: standardize scheduled Edge Function callers and harden the DUPR
-- callback ledger. Apply this migration and deploy the matching strict handlers
-- as one coordinated rollout; it records the final one-secret state.

ALTER TABLE public.dupr_webhook_events
  ADD COLUMN IF NOT EXISTS event_key text;

CREATE UNIQUE INDEX IF NOT EXISTS dupr_webhook_events_event_key_unique
  ON public.dupr_webhook_events (event_key)
  WHERE event_key IS NOT NULL;

COMMENT ON COLUMN public.dupr_webhook_events.event_key IS
  'SHA-256 of the bounded webhook body; exact provider retries are acknowledged once without duplicating rating history.';

-- Historical rows stored the partner client key in both columns. It is not
-- needed for debugging and must not remain recoverable from the event ledger.
UPDATE public.dupr_webhook_events
SET
  client_id = CASE WHEN client_id IS NULL THEN NULL ELSE 'legacy:redacted' END,
  payload = CASE
    WHEN payload ? 'clientId'
      THEN jsonb_set(payload, '{clientId}', to_jsonb('[redacted]'::text), true)
    ELSE payload
  END
WHERE client_id IS DISTINCT FROM 'legacy:redacted'
   OR payload ->> 'clientId' IS DISTINCT FROM '[redacted]';

-- The table is debugging-only. Bound retained callback data even when a valid
-- provider credential is accidentally noisy.
DO $retention$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'dupr-webhook-events-retention-daily'
  ) THEN
    PERFORM cron.unschedule('dupr-webhook-events-retention-daily');
  END IF;
END;
$retention$;

SELECT cron.schedule(
  'dupr-webhook-events-retention-daily',
  '15 19 * * *',
  $command$DELETE FROM public.dupr_webhook_events WHERE received_at < now() - interval '30 days';$command$
);

DO $migration$
DECLARE
  v_command text;
  v_job_id bigint;
  v_legacy_job_id bigint;
BEGIN
  -- DUPR backfill: preserve the OPS-00 dispatch ledger while replacing the
  -- legacy Authorization bearer with the standard cron header.
  v_command := $command$
DO $dupr_sync$
DECLARE
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'cron_secret is not configured';
  END IF;

  SELECT net.http_post(
    url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/dupr-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) INTO v_request_id;

  INSERT INTO public.ops_cron_dispatches (monitor_key, request_id)
  VALUES ('dupr-sync-daily', v_request_id);
END;
$dupr_sync$;
$command$;

  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'dupr-sync-daily'
  LIMIT 1;
  IF v_job_id IS NULL THEN
    RAISE WARNING 'dupr-sync-daily cron job is missing';
  ELSE
    PERFORM cron.alter_job(job_id := v_job_id, command := v_command, active := true);
  END IF;

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
    RAISE WARNING 'cron_secret missing — skip feed-embeds-sync';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/feed-embeds-sync',
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

  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'feed-embeds-sync-hourly'
  LIMIT 1;
  IF v_job_id IS NULL THEN
    RAISE WARNING 'feed-embeds-sync-hourly cron job is missing';
  ELSE
    PERFORM cron.alter_job(job_id := v_job_id, command := v_command, active := true);
  END IF;

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
    RAISE WARNING 'cron_secret missing — skip feed-generate';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/feed-generate',
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

  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'feed-generate-hourly'
  LIMIT 1;
  IF v_job_id IS NULL THEN
    RAISE WARNING 'feed-generate-hourly cron job is missing';
  ELSE
    PERFORM cron.alter_job(job_id := v_job_id, command := v_command, active := true);
  END IF;

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
    RAISE WARNING 'cron_secret missing — skip news-translate';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/news-translate',
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

  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'news-translate-daily-7am-ict'
  LIMIT 1;

  SELECT jobid INTO v_legacy_job_id
  FROM cron.job
  WHERE jobname = 'news-translate-every-30m'
  LIMIT 1;

  -- Fresh schemas only have the legacy name; production had both names after
  -- an earlier reconciliation. Prefer the documented job and remove the
  -- duplicate when both exist. The canonical job's historical name says
  -- "daily", but migration 20260521000100 changed its cadence to every 30m.
  IF v_job_id IS NULL THEN
    v_job_id := v_legacy_job_id;
    v_legacy_job_id := NULL;
  END IF;

  IF v_job_id IS NULL THEN
    RAISE WARNING 'news-translate cron job is missing';
  ELSE
    PERFORM cron.alter_job(job_id := v_job_id, command := v_command, active := true);
  END IF;

  IF v_legacy_job_id IS NOT NULL AND v_legacy_job_id <> v_job_id THEN
    PERFORM cron.unschedule(v_legacy_job_id);
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
