-- match-expire-daily và auto-cancel-unpaid-registrations được thêm monitor
-- (20260804120000) nhưng cron command của chúng chỉ PERFORM net.http_post mà
-- không ghi ops_cron_dispatches như pattern dupr-sync/mux-sync — evaluator
-- báo "Scheduler ran but no monitored request was dispatched" giả.
-- Cập nhật 2 command: capture request_id + INSERT dispatch với monitor_key.
DO $migration$
DECLARE
  v_command text;
  v_job_id bigint;
BEGIN
  v_command := $command$
DO $match_expire_job$
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
    url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/match-expire',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO v_request_id;

  INSERT INTO public.ops_cron_dispatches (monitor_key, request_id)
  VALUES ('match-expire', v_request_id);
END
$match_expire_job$;
$command$;

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'match-expire-daily' LIMIT 1;
  IF v_job_id IS NULL THEN
    PERFORM cron.schedule('match-expire-daily', '0 21 * * *', v_command);
  ELSE
    PERFORM cron.alter_job(job_id := v_job_id, schedule := '0 21 * * *', command := v_command, active := true);
  END IF;

  v_command := $command$
DO $auto_cancel_job$
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
    url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/auto-cancel-unpaid-registrations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO v_request_id;

  INSERT INTO public.ops_cron_dispatches (monitor_key, request_id)
  VALUES ('auto-cancel-unpaid-registrations', v_request_id);
END
$auto_cancel_job$;
$command$;

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'auto-cancel-unpaid-registrations' LIMIT 1;
  IF v_job_id IS NULL THEN
    PERFORM cron.schedule('auto-cancel-unpaid-registrations', '0 * * * *', v_command);
  ELSE
    PERFORM cron.alter_job(job_id := v_job_id, schedule := '0 * * * *', command := v_command, active := true);
  END IF;
END $migration$;
