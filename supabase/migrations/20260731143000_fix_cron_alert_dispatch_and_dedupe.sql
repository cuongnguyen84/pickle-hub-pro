-- Prevent false/duplicate cron-health alerts.
--
-- 1. news-rewrite registered a pg_net monitor without recording request IDs,
--    so the monitor could never observe a dispatch.
-- 2. Edge invocations claimed Telegram incidents in application code after
--    sending. Concurrent invocations could therefore send the same incident.
-- 3. Reconcile the dispatcher schedule to exactly one active pg_cron job.

CREATE OR REPLACE FUNCTION public.ops_claim_cron_alert(
  p_monitor_key text,
  p_state text,
  p_reason text,
  p_now timestamptz,
  p_alert_after_seconds integer
)
RETURNS TABLE (
  action text,
  claim_token timestamptz,
  previous_state text,
  previous_incident_started_at timestamptz,
  previous_last_alerted_at timestamptz,
  previous_recovered_at timestamptz,
  previous_last_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_previous public.ops_cron_alert_state%ROWTYPE;
  v_action text;
  v_unhealthy boolean;
  v_claim_token timestamptz := coalesce(p_now, clock_timestamp());
BEGIN
  IF p_state NOT IN (
    'healthy', 'pending', 'never_ran', 'stale', 'ran_failed',
    'partial_success', 'caller_auth_failed'
  ) THEN
    RAISE EXCEPTION 'invalid cron health state: %', p_state;
  END IF;

  IF p_alert_after_seconds IS NULL OR p_alert_after_seconds <= 0 THEN
    RAISE EXCEPTION 'alert interval must be positive';
  END IF;

  -- Covers the no-row-yet case as well as updates to an existing row.
  PERFORM pg_advisory_xact_lock(hashtextextended('ops_cron_alert:' || p_monitor_key, 0));

  SELECT * INTO v_previous
  FROM public.ops_cron_alert_state
  WHERE monitor_key = p_monitor_key
  FOR UPDATE;

  previous_state := v_previous.last_state;
  previous_incident_started_at := v_previous.incident_started_at;
  previous_last_alerted_at := v_previous.last_alerted_at;
  previous_recovered_at := v_previous.recovered_at;
  previous_last_reason := v_previous.last_reason;

  -- Pending is transient and must not replace an open incident.
  IF p_state = 'pending' THEN
    action := NULL;
    claim_token := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  v_unhealthy := p_state NOT IN ('healthy', 'pending');

  IF v_unhealthy THEN
    IF NOT FOUND
      OR v_previous.last_state <> p_state
      OR v_previous.recovered_at IS NOT NULL
      OR v_previous.last_alerted_at IS NULL
      OR v_previous.last_alerted_at <= v_claim_token - make_interval(secs => p_alert_after_seconds)
    THEN
      v_action := 'incident';
    END IF;
  ELSIF FOUND
    AND v_previous.last_state NOT IN ('healthy', 'pending')
    AND v_previous.recovered_at IS NULL
  THEN
    v_action := 'recovery';
  END IF;

  INSERT INTO public.ops_cron_alert_state (
    monitor_key,
    last_state,
    incident_started_at,
    last_alerted_at,
    recovered_at,
    last_reason,
    updated_at
  ) VALUES (
    p_monitor_key,
    p_state,
    CASE WHEN v_action = 'incident' THEN v_claim_token ELSE NULL END,
    CASE WHEN v_action = 'incident' THEN v_claim_token ELSE NULL END,
    CASE WHEN v_action = 'recovery' THEN v_claim_token ELSE NULL END,
    left(p_reason, 1000),
    v_claim_token
  )
  ON CONFLICT (monitor_key) DO UPDATE SET
    last_state = EXCLUDED.last_state,
    incident_started_at = CASE
      WHEN v_action = 'incident' AND (
        v_previous.last_state IS NULL
        OR v_previous.last_state <> p_state
        OR v_previous.recovered_at IS NOT NULL
      ) THEN v_claim_token
      ELSE v_previous.incident_started_at
    END,
    last_alerted_at = CASE
      WHEN v_action = 'incident' THEN v_claim_token
      ELSE v_previous.last_alerted_at
    END,
    recovered_at = CASE
      WHEN v_action = 'recovery' THEN v_claim_token
      WHEN v_action = 'incident' THEN NULL
      ELSE v_previous.recovered_at
    END,
    last_reason = EXCLUDED.last_reason,
    updated_at = v_claim_token;

  action := v_action;
  claim_token := v_claim_token;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ops_release_cron_alert_claim(
  p_monitor_key text,
  p_claim_token timestamptz,
  p_previous_state text,
  p_previous_incident_started_at timestamptz,
  p_previous_last_alerted_at timestamptz,
  p_previous_recovered_at timestamptz,
  p_previous_last_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_changed integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ops_cron_alert:' || p_monitor_key, 0));

  IF p_previous_state IS NULL THEN
    DELETE FROM public.ops_cron_alert_state
    WHERE monitor_key = p_monitor_key
      AND updated_at = p_claim_token;
  ELSE
    UPDATE public.ops_cron_alert_state
    SET
      last_state = p_previous_state,
      incident_started_at = p_previous_incident_started_at,
      last_alerted_at = p_previous_last_alerted_at,
      recovered_at = p_previous_recovered_at,
      last_reason = p_previous_last_reason,
      updated_at = clock_timestamp()
    WHERE monitor_key = p_monitor_key
      AND updated_at = p_claim_token;
  END IF;

  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed = 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.ops_claim_cron_alert(text, text, text, timestamptz, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ops_release_cron_alert_claim(
  text, timestamptz, text, timestamptz, timestamptz, timestamptz, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_claim_cron_alert(text, text, text, timestamptz, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.ops_release_cron_alert_claim(
  text, timestamptz, text, timestamptz, timestamptz, timestamptz, text
) TO service_role;

DO $migration$
DECLARE
  v_job_id bigint;
  v_command text;
BEGIN
  v_command := $command$
DO $news_rewrite_job$
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
    url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/news-rewrite',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) INTO v_request_id;

  INSERT INTO public.ops_cron_dispatches (monitor_key, request_id)
  VALUES ('news-rewrite', v_request_id);
END
$news_rewrite_job$;
$command$;

  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'news-rewrite-every-30m'
  ORDER BY jobid
  LIMIT 1;

  IF v_job_id IS NULL THEN
    PERFORM cron.schedule('news-rewrite-every-30m', '*/30 * * * *', v_command);
  ELSE
    PERFORM cron.alter_job(
      job_id := v_job_id,
      schedule := '*/30 * * * *',
      command := v_command,
      active := true
    );
  END IF;

  -- Give the corrected monitor one full expected interval plus grace before
  -- it may alert, and discard the false never_ran incident.
  UPDATE public.ops_cron_monitors
  SET monitoring_started_at = clock_timestamp()
  WHERE monitor_key = 'news-rewrite';

  DELETE FROM public.ops_cron_alert_state
  WHERE monitor_key = 'news-rewrite';
END;
$migration$;

-- Reconcile the dispatcher to exactly one job. This removes production drift
-- where two simultaneous invocations could race before application dedupe.
DO $dispatcher$
DECLARE
  v_job record;
  v_command text;
BEGIN
  FOR v_job IN
    SELECT jobid FROM cron.job
    WHERE jobname = 'errors-telegram-alert-10min'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;

  v_command := $command$
DO $alert_job$
DECLARE
  v_anon_key text;
  v_cron_secret text;
BEGIN
  SELECT decrypted_secret INTO v_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'internal_anon_key'
  LIMIT 1;

  SELECT decrypted_secret INTO v_cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF v_anon_key IS NULL OR v_cron_secret IS NULL THEN
    RAISE EXCEPTION 'internal_anon_key or cron_secret is not configured';
  END IF;

  PERFORM net.http_post(
    url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/errors-telegram-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'x-cron-secret', v_cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END
$alert_job$;
$command$;

  PERFORM cron.schedule(
    'errors-telegram-alert-10min',
    '*/10 * * * *',
    v_command
  );
END;
$dispatcher$;

NOTIFY pgrst, 'reload schema';
