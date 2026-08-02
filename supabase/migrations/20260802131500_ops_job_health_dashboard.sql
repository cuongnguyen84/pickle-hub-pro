-- Central business-job health ledger + admin dashboard snapshot + morning digest.
-- Scope intentionally excludes CI/audit/retention and tournament lifecycle jobs.

CREATE TABLE IF NOT EXISTS public.ops_job_registry (
  job_key                    text PRIMARY KEY,
  display_name               text NOT NULL,
  category                   text NOT NULL CHECK (category IN ('news','pro_tour','dupr','media','social','integration')),
  executor                   text NOT NULL CHECK (executor IN ('cloudflare_worker','pg_net','github_actions')),
  cron_job_name              text,
  existing_monitor_key       text,
  schedule_label             text NOT NULL,
  expected_interval_seconds  integer NOT NULL CHECK (expected_interval_seconds > 0),
  grace_seconds              integer NOT NULL DEFAULT 900 CHECK (grace_seconds >= 0),
  details_path               text,
  enabled                    boolean NOT NULL DEFAULT true,
  monitoring_started_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ops_job_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key           text NOT NULL REFERENCES public.ops_job_registry(job_key) ON DELETE CASCADE,
  external_run_id   text NOT NULL,
  trigger_kind      text NOT NULL DEFAULT 'scheduled' CHECK (trigger_kind IN ('scheduled','manual')),
  status            text NOT NULL CHECK (status IN ('running','success','warning','failed','skipped')),
  started_at        timestamptz NOT NULL,
  completed_at      timestamptz,
  summary           text,
  metrics           jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code        text,
  error_message     text,
  details_url       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_key, external_run_id),
  CHECK ((status = 'running' AND completed_at IS NULL) OR status <> 'running')
);

CREATE INDEX IF NOT EXISTS ops_job_runs_job_started_idx
  ON public.ops_job_runs (job_key, started_at DESC);
CREATE INDEX IF NOT EXISTS ops_job_runs_status_started_idx
  ON public.ops_job_runs (status, started_at DESC);

CREATE TABLE IF NOT EXISTS public.ops_job_digest_deliveries (
  report_date       date PRIMARY KEY,
  status            text NOT NULL CHECK (status IN ('sending','sent','failed')),
  attempts          integer NOT NULL DEFAULT 1,
  claimed_at        timestamptz NOT NULL DEFAULT now(),
  sent_at           timestamptz,
  healthy_count     integer,
  warning_count     integer,
  failed_count      integer,
  message_preview   text,
  last_error        text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ops_job_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_job_digest_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_job_registry, public.ops_job_runs, public.ops_job_digest_deliveries
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ops_job_registry, public.ops_job_runs, public.ops_job_digest_deliveries TO service_role;
GRANT INSERT, UPDATE ON public.ops_job_runs, public.ops_job_digest_deliveries TO service_role;

INSERT INTO public.ops_job_registry (
  job_key, display_name, category, executor, cron_job_name, existing_monitor_key,
  schedule_label, expected_interval_seconds, grace_seconds, details_path
) VALUES
  ('news-fetcher', 'News RSS fetcher', 'news', 'cloudflare_worker', NULL, NULL, 'Mỗi 2 giờ', 7200, 1200, '/admin/news'),
  ('news-rewrite', 'News bilingual rewrite', 'news', 'pg_net', 'news-rewrite-every-30m', 'news-rewrite', 'Mỗi 30 phút', 1800, 900, '/admin/news'),
  ('pro-tour-scraper', 'Pro Tour results scraper', 'pro_tour', 'cloudflare_worker', NULL, NULL, 'Mỗi 6 giờ', 21600, 1800, '/admin/pro-tour'),
  ('dupr-sync-daily', 'DUPR daily rating sync', 'dupr', 'pg_net', 'dupr-sync-daily', 'dupr-sync-daily', 'Hằng ngày 03:00 ICT', 86400, 7200, '/admin/dupr'),
  ('dupr-rankings-refresh', 'DUPR weekly rankings', 'dupr', 'github_actions', NULL, 'dupr-rankings-refresh', 'Thứ Hai 09:00 ICT', 604800, 86400, '/admin/dupr'),
  ('mux-sync-assets', 'Mux asset reconciliation', 'media', 'pg_net', 'mux-sync-assets-every-4-hours', 'mux-sync-assets', 'Mỗi 4 giờ', 14400, 7200, '/admin/viewers'),
  ('feed-embeds-sync', 'Instagram feed embeds sync', 'media', 'pg_net', 'feed-embeds-sync-hourly', NULL, 'Mỗi giờ', 3600, 1200, '/admin/embeds'),
  ('feed-generate', 'Personalized feed generation', 'media', 'pg_net', 'feed-generate-hourly', NULL, 'Mỗi giờ', 3600, 1200, '/admin'),
  ('social-poster', 'Facebook social poster', 'social', 'pg_net', 'social-poster-catchup-15min', NULL, 'Mỗi 15 phút', 900, 600, '/admin/news'),
  ('zalo-token-refresh', 'Zalo token refresh', 'integration', 'pg_net', 'zalo-token-refresh', NULL, 'Mỗi 23 giờ', 82800, 7200, '/admin')
ON CONFLICT (job_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  executor = EXCLUDED.executor,
  cron_job_name = EXCLUDED.cron_job_name,
  existing_monitor_key = EXCLUDED.existing_monitor_key,
  schedule_label = EXCLUDED.schedule_label,
  expected_interval_seconds = EXCLUDED.expected_interval_seconds,
  grace_seconds = EXCLUDED.grace_seconds,
  details_path = EXCLUDED.details_path,
  enabled = true;

CREATE OR REPLACE FUNCTION public.ops_record_job_run(
  p_job_key text,
  p_external_run_id text,
  p_status text,
  p_started_at timestamptz,
  p_completed_at timestamptz DEFAULT NULL,
  p_trigger_kind text DEFAULT 'scheduled',
  p_summary text DEFAULT NULL,
  p_metrics jsonb DEFAULT '{}'::jsonb,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_details_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF p_status NOT IN ('running','success','warning','failed','skipped') THEN
    RAISE EXCEPTION 'invalid job status: %', p_status;
  END IF;
  IF p_trigger_kind NOT IN ('scheduled','manual') THEN
    RAISE EXCEPTION 'invalid trigger kind: %', p_trigger_kind;
  END IF;

  INSERT INTO public.ops_job_runs (
    job_key, external_run_id, trigger_kind, status, started_at, completed_at,
    summary, metrics, error_code, error_message, details_url
  ) VALUES (
    p_job_key, left(p_external_run_id, 250), p_trigger_kind, p_status, p_started_at,
    CASE WHEN p_status = 'running' THEN NULL ELSE coalesce(p_completed_at, now()) END,
    left(p_summary, 1000), coalesce(p_metrics, '{}'::jsonb), left(p_error_code, 100),
    left(p_error_message, 4000), left(p_details_url, 1000)
  )
  ON CONFLICT (job_key, external_run_id) DO UPDATE SET
    trigger_kind = EXCLUDED.trigger_kind,
    status = EXCLUDED.status,
    started_at = least(public.ops_job_runs.started_at, EXCLUDED.started_at),
    completed_at = EXCLUDED.completed_at,
    summary = EXCLUDED.summary,
    metrics = EXCLUDED.metrics,
    error_code = EXCLUDED.error_code,
    error_message = EXCLUDED.error_message,
    details_url = EXCLUDED.details_url,
    updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.ops_record_job_run(
  text,text,text,timestamptz,timestamptz,text,text,jsonb,text,text,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_record_job_run(
  text,text,text,timestamptz,timestamptz,text,text,jsonb,text,text,text
) TO service_role;

CREATE OR REPLACE FUNCTION public.ops_job_health_snapshot()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron, pg_temp
AS $function$
WITH job_rows AS (
  SELECT
    registry.*,
    run.id AS run_id,
    run.status AS run_status,
    run.started_at AS run_started_at,
    run.completed_at AS run_completed_at,
    run.summary,
    run.metrics,
    run.error_code,
    run.error_message,
    run.details_url,
    monitor.last_state AS monitor_state,
    monitor.last_reason AS monitor_reason,
    monitor.updated_at AS monitor_updated_at,
    scheduler.status AS scheduler_status,
    scheduler.return_message AS scheduler_message,
    scheduler.start_time AS scheduler_started_at
  FROM public.ops_job_registry registry
  LEFT JOIN LATERAL (
    SELECT r.* FROM public.ops_job_runs r
    WHERE r.job_key = registry.job_key
    ORDER BY r.started_at DESC LIMIT 1
  ) run ON true
  LEFT JOIN public.ops_cron_alert_state monitor
    ON monitor.monitor_key = registry.existing_monitor_key
  LEFT JOIN LATERAL (
    SELECT d.status, d.return_message, d.start_time
    FROM cron.job j JOIN cron.job_run_details d ON d.jobid = j.jobid
    WHERE j.jobname = registry.cron_job_name
    ORDER BY d.start_time DESC LIMIT 1
  ) scheduler ON true
  WHERE registry.enabled
), classified AS (
  SELECT *,
    CASE
      WHEN monitor_state = 'partial_success' THEN 'warning'
      WHEN monitor_state IS NOT NULL AND monitor_state NOT IN ('healthy','pending') THEN 'failed'
      WHEN run_status = 'warning' THEN 'warning'
      WHEN run_status = 'failed' THEN 'failed'
      WHEN run_started_at IS NOT NULL
        AND now() - coalesce(run_completed_at, run_started_at)
          > make_interval(secs => expected_interval_seconds + grace_seconds) THEN 'failed'
      WHEN run_status IN ('success','skipped') THEN 'healthy'
      WHEN monitor_state = 'healthy' THEN 'healthy'
      WHEN scheduler_status = 'failed' THEN 'failed'
      WHEN monitoring_started_at + make_interval(secs => expected_interval_seconds + grace_seconds) > now() THEN 'pending'
      ELSE 'pending'
    END AS health_state,
    coalesce(run_completed_at, monitor_updated_at, scheduler_started_at) AS last_activity_at,
    coalesce(error_message, monitor_reason,
      CASE WHEN scheduler_status = 'failed' THEN scheduler_message END) AS health_reason
  FROM job_rows
), recent AS (
  SELECT job_key, jsonb_agg(to_jsonb(r) ORDER BY started_at DESC) AS runs
  FROM (
    SELECT id, job_key, status, trigger_kind, started_at, completed_at, summary,
      metrics, error_code, error_message, details_url
    FROM public.ops_job_runs
    WHERE started_at >= now() - interval '30 days'
    ORDER BY started_at DESC
  ) r GROUP BY job_key
), jobs AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'job_key', c.job_key, 'display_name', c.display_name, 'category', c.category,
      'executor', c.executor, 'schedule_label', c.schedule_label,
      'health_state', c.health_state, 'last_activity_at', c.last_activity_at,
      'summary', c.summary, 'metrics', coalesce(c.metrics, '{}'::jsonb),
      'error_code', c.error_code, 'error_message', c.health_reason,
      'details_path', c.details_path, 'details_url', c.details_url,
      'runs', coalesce(recent.runs, '[]'::jsonb)
    ) ORDER BY c.category, c.display_name
  ) AS value FROM classified c LEFT JOIN recent USING (job_key)
), counts AS (
  SELECT jsonb_build_object(
    'healthy', count(*) FILTER (WHERE health_state='healthy'),
    'warning', count(*) FILTER (WHERE health_state='warning'),
    'failed', count(*) FILTER (WHERE health_state='failed'),
    'pending', count(*) FILTER (WHERE health_state='pending')
  ) AS value FROM classified
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'counts', counts.value,
  'jobs', coalesce(jobs.value, '[]'::jsonb),
  'latest_digest', (
    SELECT to_jsonb(d) FROM public.ops_job_digest_deliveries d
    ORDER BY report_date DESC LIMIT 1
  )
) FROM jobs CROSS JOIN counts;
$function$;

REVOKE ALL ON FUNCTION public.ops_job_health_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_job_health_snapshot() TO service_role;

CREATE OR REPLACE FUNCTION public.ops_admin_job_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  RETURN public.ops_job_health_snapshot();
END;
$function$;
REVOKE ALL ON FUNCTION public.ops_admin_job_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_admin_job_health() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ops_claim_daily_digest(p_report_date date)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_rows integer := 0;
BEGIN
  INSERT INTO public.ops_job_digest_deliveries (report_date, status)
  VALUES (p_report_date, 'sending')
  ON CONFLICT (report_date) DO UPDATE SET
    status = 'sending', attempts = public.ops_job_digest_deliveries.attempts + 1,
    claimed_at = now(), updated_at = now(), last_error = NULL
  WHERE public.ops_job_digest_deliveries.status = 'failed'
     OR (public.ops_job_digest_deliveries.status = 'sending'
         AND public.ops_job_digest_deliveries.claimed_at < now() - interval '15 minutes');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ops_finish_daily_digest(
  p_report_date date, p_status text, p_healthy integer, p_warning integer,
  p_failed integer, p_preview text, p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF p_status NOT IN ('sent','failed') THEN RAISE EXCEPTION 'invalid digest status'; END IF;
  UPDATE public.ops_job_digest_deliveries SET
    status = p_status, sent_at = CASE WHEN p_status='sent' THEN now() ELSE NULL END,
    healthy_count = p_healthy, warning_count = p_warning, failed_count = p_failed,
    message_preview = left(p_preview, 4000), last_error = left(p_error, 1000), updated_at = now()
  WHERE report_date = p_report_date;
END;
$function$;

REVOKE ALL ON FUNCTION public.ops_claim_daily_digest(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ops_finish_daily_digest(date,text,integer,integer,integer,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_claim_daily_digest(date),
  public.ops_finish_daily_digest(date,text,integer,integer,integer,text,text) TO service_role;

-- Monitor the digest itself through the existing pg_net health machinery.
INSERT INTO public.ops_cron_monitors (
  monitor_key, display_name, source, cron_job_name, expected_interval_seconds, grace_seconds
) VALUES ('ops-job-digest', 'Morning job health digest', 'pg_net', 'ops-job-digest-morning', 86400, 1800)
ON CONFLICT (monitor_key) DO UPDATE SET
  display_name=EXCLUDED.display_name, source=EXCLUDED.source,
  cron_job_name=EXCLUDED.cron_job_name, expected_interval_seconds=EXCLUDED.expected_interval_seconds,
  grace_seconds=EXCLUDED.grace_seconds, monitoring_started_at=now(), enabled=true;

DO $migration$
DECLARE v_command text;
BEGIN
  v_command := $command$
DO $digest$
DECLARE v_secret text; v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
  WHERE name='cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN RAISE EXCEPTION 'cron_secret is not configured'; END IF;
  SELECT net.http_post(
    url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/ops-job-digest',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
    body := '{"mode":"send"}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO v_request_id;
  INSERT INTO public.ops_cron_dispatches(monitor_key, request_id)
  VALUES ('ops-job-digest', v_request_id);
END $digest$;
$command$;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='ops-job-digest-morning') THEN
    PERFORM cron.unschedule('ops-job-digest-morning');
  END IF;
  -- 09:15 ICT primary send; 09:35 idempotent safety retry.
  PERFORM cron.schedule('ops-job-digest-morning', '15,35 2 * * *', v_command);
END;
$migration$;

-- Add downstream HTTP evidence for the four business pg_net jobs that were
-- previously visible only as a successful scheduler `DO`.
INSERT INTO public.ops_cron_monitors (
  monitor_key, display_name, source, cron_job_name, expected_interval_seconds, grace_seconds
) VALUES
  ('feed-embeds-sync', 'Instagram feed embeds sync', 'pg_net', 'feed-embeds-sync-hourly', 3600, 1200),
  ('feed-generate', 'Personalized feed generation', 'pg_net', 'feed-generate-hourly', 3600, 1200),
  ('social-poster', 'Facebook social poster', 'pg_net', 'social-poster-catchup-15min', 900, 600),
  ('zalo-token-refresh', 'Zalo token refresh', 'pg_net', 'zalo-token-refresh', 82800, 7200)
ON CONFLICT (monitor_key) DO UPDATE SET
  display_name=EXCLUDED.display_name, source=EXCLUDED.source,
  cron_job_name=EXCLUDED.cron_job_name,
  expected_interval_seconds=EXCLUDED.expected_interval_seconds,
  grace_seconds=EXCLUDED.grace_seconds, monitoring_started_at=now(), enabled=true;

UPDATE public.ops_job_registry SET existing_monitor_key = job_key
WHERE job_key IN ('feed-embeds-sync','feed-generate','social-poster','zalo-token-refresh');

DO $instrument$
DECLARE v_job_id bigint; v_command text;
BEGIN
  v_command := $command$
DO $feed_embeds$
DECLARE v_secret text; v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN RAISE EXCEPTION 'cron_secret missing from vault — feed-embeds-sync aborted'; END IF;
  SELECT net.http_post(
    url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/feed-embeds-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
    body := '{}'::jsonb, timeout_milliseconds := 60000
  ) INTO v_request_id;
  INSERT INTO public.ops_cron_dispatches(monitor_key,request_id) VALUES ('feed-embeds-sync',v_request_id);
END $feed_embeds$;
$command$;
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname='feed-embeds-sync-hourly' LIMIT 1;
  IF v_job_id IS NOT NULL THEN PERFORM cron.alter_job(job_id:=v_job_id,schedule:='20 * * * *',command:=v_command,active:=true); END IF;

  v_command := $command$
DO $feed_generate$
DECLARE v_secret text; v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN RAISE EXCEPTION 'cron_secret missing from vault — feed-generate aborted'; END IF;
  SELECT net.http_post(
    url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/feed-generate',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
    body := '{}'::jsonb, timeout_milliseconds := 60000
  ) INTO v_request_id;
  INSERT INTO public.ops_cron_dispatches(monitor_key,request_id) VALUES ('feed-generate',v_request_id);
END $feed_generate$;
$command$;
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname='feed-generate-hourly' LIMIT 1;
  IF v_job_id IS NOT NULL THEN PERFORM cron.alter_job(job_id:=v_job_id,schedule:='50 * * * *',command:=v_command,active:=true); END IF;

  v_command := $command$
DO $social_poster$
DECLARE v_secret text; v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='social_poster_auth_secret' LIMIT 1;
  IF v_secret IS NULL THEN RAISE EXCEPTION 'social_poster_auth_secret missing from vault'; END IF;
  SELECT net.http_post(
    url := 'https://social-poster.thecuong.workers.dev/run',
    headers := jsonb_build_object('Content-Type','application/json','X-Auth-Secret',v_secret),
    body := '{}'::jsonb, timeout_milliseconds := 30000
  ) INTO v_request_id;
  INSERT INTO public.ops_cron_dispatches(monitor_key,request_id) VALUES ('social-poster',v_request_id);
END $social_poster$;
$command$;
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname='social-poster-catchup-15min' LIMIT 1;
  IF v_job_id IS NOT NULL THEN PERFORM cron.alter_job(job_id:=v_job_id,schedule:='*/15 * * * *',command:=v_command,active:=true); END IF;

  v_command := $command$
DO $zalo$
DECLARE v_secret text; v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN RAISE EXCEPTION 'cron_secret is not configured'; END IF;
  SELECT net.http_post(
    url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/zalo-token-refresh',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
    body := '{}'::jsonb, timeout_milliseconds := 30000
  ) INTO v_request_id;
  INSERT INTO public.ops_cron_dispatches(monitor_key,request_id) VALUES ('zalo-token-refresh',v_request_id);
END $zalo$;
$command$;
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname='zalo-token-refresh' LIMIT 1;
  IF v_job_id IS NOT NULL THEN PERFORM cron.alter_job(job_id:=v_job_id,schedule:='0 */23 * * *',command:=v_command,active:=true); END IF;
END;
$instrument$;
