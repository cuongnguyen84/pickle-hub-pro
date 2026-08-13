-- Restore the production-only Zalo token refresh caller to source control and
-- remove its plaintext service-role credential. The Edge Function now uses
-- the same fail-closed x-cron-secret contract as the other cron-only handlers.

DO $migration$
DECLARE
  v_command text;
  v_job_id bigint;
BEGIN
  v_command := $command$
DO $zalo_job$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'cron_secret is not configured';
  END IF;

  PERFORM net.http_post(
    url := public.ops_project_url() || '/functions/v1/zalo-token-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END
$zalo_job$;
$command$;

  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'zalo-token-refresh'
  LIMIT 1;

  IF v_job_id IS NULL THEN
    PERFORM cron.schedule('zalo-token-refresh', '0 */23 * * *', v_command);
  ELSE
    PERFORM cron.alter_job(
      job_id := v_job_id,
      schedule := '0 */23 * * *',
      command := v_command,
      active := true
    );
  END IF;
END;
$migration$;
