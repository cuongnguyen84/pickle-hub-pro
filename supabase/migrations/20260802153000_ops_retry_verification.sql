-- Correlate each retry with the exact pg_net dispatch and verified outcome.
ALTER TABLE public.ops_job_retry_requests
  ADD COLUMN IF NOT EXISTS dispatch_request_id bigint,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS http_status integer,
  ADD COLUMN IF NOT EXISTS response_content text;

ALTER TABLE public.ops_job_retry_requests DROP CONSTRAINT IF EXISTS ops_job_retry_requests_status_check;
ALTER TABLE public.ops_job_retry_requests ADD CONSTRAINT ops_job_retry_requests_status_check
  CHECK (status IN ('running','dispatched','verified_success','verified_failed','failed','rejected'));

CREATE OR REPLACE FUNCTION public.ops_request_job_retry(
  p_job_key text,p_source text,p_requested_by text DEFAULT NULL,p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,cron,pg_temp AS $function$
DECLARE
  v_request_id uuid; v_dispatch_id bigint; v_command text; v_job_name text; v_executor text;
  v_role text:=coalesce(auth.role(),''); v_started timestamptz:=clock_timestamp();
BEGIN
  IF p_source NOT IN ('admin','telegram','auto') THEN RAISE EXCEPTION 'invalid_retry_source' USING ERRCODE='22023'; END IF;
  IF p_source='admin' THEN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
  ELSIF v_role<>'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
  SELECT executor,cron_job_name INTO v_executor,v_job_name FROM public.ops_job_registry WHERE job_key=p_job_key AND enabled;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_job' USING ERRCODE='22023'; END IF;
  IF v_executor<>'pg_net' OR v_job_name IS NULL THEN RETURN jsonb_build_object('ok',false,'code','retry_not_supported','job_key',p_job_key); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ops-job-retry:'||p_job_key));
  IF EXISTS(SELECT 1 FROM public.ops_job_retry_requests WHERE job_key=p_job_key AND status IN ('running','dispatched') AND created_at>now()-interval '10 minutes') THEN
    RETURN jsonb_build_object('ok',false,'code','cooldown','job_key',p_job_key,'retry_after_seconds',600);
  END IF;
  SELECT command INTO v_command FROM cron.job WHERE jobname=v_job_name AND active LIMIT 1;
  IF v_command IS NULL THEN RETURN jsonb_build_object('ok',false,'code','cron_job_unavailable','job_key',p_job_key); END IF;
  INSERT INTO public.ops_job_retry_requests(job_key,source,requested_by,status,reason)
  VALUES(p_job_key,p_source,left(p_requested_by,200),'running',left(p_reason,1000)) RETURNING id INTO v_request_id;
  BEGIN
    EXECUTE v_command;
    SELECT request_id INTO v_dispatch_id FROM public.ops_cron_dispatches
    WHERE monitor_key=p_job_key AND dispatched_at>=v_started ORDER BY dispatched_at DESC LIMIT 1;
    UPDATE public.ops_job_retry_requests SET status='dispatched',dispatch_request_id=v_dispatch_id,completed_at=now() WHERE id=v_request_id;
    RETURN jsonb_build_object('ok',true,'request_id',v_request_id,'dispatch_request_id',v_dispatch_id,'job_key',p_job_key,'status','dispatched');
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.ops_job_retry_requests SET status='failed',error_message=left(SQLERRM,2000),completed_at=now() WHERE id=v_request_id;
    RETURN jsonb_build_object('ok',false,'code','dispatch_failed','job_key',p_job_key,'request_id',v_request_id,'error',SQLERRM);
  END;
END $function$;

CREATE OR REPLACE FUNCTION public.ops_finish_job_retry(
  p_request_id uuid,p_success boolean,p_http_status integer,p_response text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
  UPDATE public.ops_job_retry_requests SET status=CASE WHEN p_success THEN 'verified_success' ELSE 'verified_failed' END,
    verified_at=now(),http_status=p_http_status,response_content=left(p_response,4000),
    error_message=CASE WHEN p_success THEN NULL ELSE left(p_response,2000) END
  WHERE id=p_request_id;
END $function$;
REVOKE ALL ON FUNCTION public.ops_finish_job_retry(uuid,boolean,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_finish_job_retry(uuid,boolean,integer,text) TO service_role;
