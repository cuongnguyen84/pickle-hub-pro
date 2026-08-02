-- Controlled manual/Telegram/automatic retry for business pg_cron jobs.
CREATE TABLE IF NOT EXISTS public.ops_job_retry_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL REFERENCES public.ops_job_registry(job_key) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('admin','telegram','auto')),
  requested_by text,
  status text NOT NULL CHECK (status IN ('running','dispatched','failed','rejected')),
  reason text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ops_job_retry_requests_job_created_idx
  ON public.ops_job_retry_requests(job_key, created_at DESC);

ALTER TABLE public.ops_job_retry_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_job_retry_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ops_job_retry_requests TO service_role;

CREATE OR REPLACE FUNCTION public.ops_request_job_retry(
  p_job_key text,
  p_source text,
  p_requested_by text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, pg_temp
AS $function$
DECLARE
  v_request_id uuid;
  v_command text;
  v_job_name text;
  v_executor text;
  v_role text := coalesce(auth.role(), '');
BEGIN
  IF p_source NOT IN ('admin','telegram','auto') THEN
    RAISE EXCEPTION 'invalid_retry_source' USING ERRCODE='22023';
  END IF;
  IF p_source = 'admin' THEN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
  ELSIF v_role <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501';
  END IF;

  SELECT executor, cron_job_name INTO v_executor, v_job_name
  FROM public.ops_job_registry WHERE job_key=p_job_key AND enabled;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_job' USING ERRCODE='22023'; END IF;
  IF v_executor <> 'pg_net' OR v_job_name IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','retry_not_supported','job_key',p_job_key);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ops-job-retry:' || p_job_key));
  IF EXISTS (
    SELECT 1 FROM public.ops_job_retry_requests
    WHERE job_key=p_job_key AND status IN ('running','dispatched')
      AND created_at > now() - interval '10 minutes'
  ) THEN
    RETURN jsonb_build_object('ok',false,'code','cooldown','job_key',p_job_key,'retry_after_seconds',600);
  END IF;

  SELECT command INTO v_command FROM cron.job WHERE jobname=v_job_name AND active LIMIT 1;
  IF v_command IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','cron_job_unavailable','job_key',p_job_key);
  END IF;

  INSERT INTO public.ops_job_retry_requests(job_key,source,requested_by,status,reason)
  VALUES (p_job_key,p_source,left(p_requested_by,200),'running',left(p_reason,1000))
  RETURNING id INTO v_request_id;

  BEGIN
    EXECUTE v_command;
    UPDATE public.ops_job_retry_requests SET status='dispatched',completed_at=now()
    WHERE id=v_request_id;
    RETURN jsonb_build_object('ok',true,'request_id',v_request_id,'job_key',p_job_key,'status','dispatched');
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.ops_job_retry_requests SET status='failed',error_message=left(SQLERRM,2000),completed_at=now()
    WHERE id=v_request_id;
    RETURN jsonb_build_object('ok',false,'code','dispatch_failed','job_key',p_job_key,'request_id',v_request_id,'error',SQLERRM);
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.ops_request_job_retry(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_request_job_retry(text,text,text,text) TO authenticated, service_role;

-- Process Telegram commands once per minute. The function itself allowlists
-- TELEGRAM_CHAT_ID and only consumes /jobs, /retry and /diagnose.
DO $migration$
DECLARE v_command text;
BEGIN
  v_command := $command$
DO $telegram_commands$
DECLARE v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN RAISE EXCEPTION 'cron_secret is not configured'; END IF;
  PERFORM net.http_post(
    url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/ops-job-control',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
    body := '{"action":"process_telegram"}'::jsonb,
    timeout_milliseconds := 30000
  );
END $telegram_commands$;
$command$;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='ops-job-telegram-commands') THEN
    PERFORM cron.unschedule('ops-job-telegram-commands');
  END IF;
  PERFORM cron.schedule('ops-job-telegram-commands','* * * * *',v_command);
END;
$migration$;
