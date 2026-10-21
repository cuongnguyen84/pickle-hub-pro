-- Runtime availability monitoring for business-critical Edge Functions.
CREATE TABLE IF NOT EXISTS public.ops_edge_function_registry (
  function_slug text PRIMARY KEY,
  display_name text NOT NULL,
  job_key text REFERENCES public.ops_job_registry(job_key) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ops_edge_function_state (
  function_slug text PRIMARY KEY REFERENCES public.ops_edge_function_registry(function_slug) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('available','missing_blob','http_error','timeout','pending')),
  http_status integer,
  response_ms integer,
  reason text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  checked_at timestamptz NOT NULL DEFAULT now(),
  changed_at timestamptz NOT NULL DEFAULT now(),
  last_alerted_at timestamptz,
  recovered_at timestamptz
);

ALTER TABLE public.ops_edge_function_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_edge_function_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_edge_function_registry, public.ops_edge_function_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ops_edge_function_registry, public.ops_edge_function_state TO service_role;

INSERT INTO public.ops_edge_function_registry(function_slug,display_name,job_key) VALUES
  ('dupr-sync','DUPR daily sync','dupr-sync-daily'),
  ('news-rewrite','News bilingual rewrite','news-rewrite'),
  ('mux-sync-assets','Mux asset reconciliation','mux-sync-assets'),
  ('feed-embeds-sync','Instagram embeds sync','feed-embeds-sync'),
  ('feed-generate','Personalized feed generation','feed-generate'),
  ('zalo-token-refresh','Zalo token refresh','zalo-token-refresh'),
  ('ops-job-digest','Morning Job Health digest',NULL),
  ('ops-job-control','Job retry and Telegram control',NULL),
  ('errors-telegram-alert','Runtime/cron Telegram alerts',NULL)
ON CONFLICT(function_slug) DO UPDATE SET
  display_name=EXCLUDED.display_name,job_key=EXCLUDED.job_key,enabled=true;

CREATE OR REPLACE FUNCTION public.ops_admin_edge_function_health()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'generated_at',now(),
    'counts',jsonb_build_object(
      'available',(SELECT count(*) FROM public.ops_edge_function_state WHERE state='available'),
      'failed',(SELECT count(*) FROM public.ops_edge_function_state WHERE state IN ('missing_blob','http_error','timeout')),
      'pending',(SELECT count(*) FROM public.ops_edge_function_registry r LEFT JOIN public.ops_edge_function_state s USING(function_slug) WHERE r.enabled AND (s.state IS NULL OR s.state='pending'))
    ),
    'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'function_slug',r.function_slug,'display_name',r.display_name,'job_key',r.job_key,
      'state',coalesce(s.state,'pending'),'http_status',s.http_status,'response_ms',s.response_ms,
      'reason',s.reason,'consecutive_failures',coalesce(s.consecutive_failures,0),
      'checked_at',s.checked_at,'changed_at',s.changed_at
    ) ORDER BY r.display_name),'[]'::jsonb) FROM public.ops_edge_function_registry r LEFT JOIN public.ops_edge_function_state s USING(function_slug) WHERE r.enabled)
  );
END $function$;
REVOKE ALL ON FUNCTION public.ops_admin_edge_function_health() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_admin_edge_function_health() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.ops_admin_probe_edge_functions()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,net,pg_temp AS $function$
DECLARE v_secret text; v_id bigint;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN RAISE EXCEPTION 'cron_secret_not_configured'; END IF;
  SELECT net.http_post(
    url:=public.ops_project_url() || '/functions/v1/ops-edge-health',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
    body:='{}'::jsonb,timeout_milliseconds:=60000
  ) INTO v_id;
  RETURN v_id;
END $function$;
REVOKE ALL ON FUNCTION public.ops_admin_probe_edge_functions() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_admin_probe_edge_functions() TO authenticated;

DO $migration$
DECLARE v_command text;
BEGIN
  v_command := $command$
DO $edge_health$
DECLARE v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN RAISE EXCEPTION 'cron_secret is not configured'; END IF;
  PERFORM net.http_post(
    url:=public.ops_project_url() || '/functions/v1/ops-edge-health',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
    body:='{}'::jsonb,timeout_milliseconds:=60000
  );
END $edge_health$;
$command$;
  IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='ops-edge-health-every-5m') THEN
    PERFORM cron.unschedule('ops-edge-health-every-5m');
  END IF;
  PERFORM cron.schedule('ops-edge-health-every-5m','*/5 * * * *',v_command);
END $migration$;
