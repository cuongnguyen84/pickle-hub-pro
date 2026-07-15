-- OPS-00: monitor the three highest-impact scheduled jobs.
-- The public RPC is service_role-only; cron internals never become client-readable.
CREATE OR REPLACE FUNCTION public.ops_cron_health_snapshot()
RETURNS TABLE (
  job_name TEXT,
  expected_interval_seconds INTEGER,
  grace_seconds INTEGER,
  state TEXT,
  last_started_at TIMESTAMPTZ,
  last_finished_at TIMESTAMPTZ,
  return_message TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron, pg_catalog
AS $$
  WITH monitored AS (
    SELECT * FROM (VALUES
      ('mux-sync-assets-every-4-hours'::TEXT, 14400, 7200),
      ('news-translate'::TEXT, 86400, 7200),
      ('auto-archive-tournaments'::TEXT, 86400, 7200)
    ) AS x(job_name, expected_interval_seconds, grace_seconds)
  ), jobs AS (
    SELECT m.*, j.jobid
    FROM monitored m
    LEFT JOIN cron.job j ON j.jobname = m.job_name
  ), latest AS (
    SELECT DISTINCT ON (j.jobid)
      -- pg_cron exposes start_time/end_time; keep the RPC's original output
      -- names through aliases so clean migration replay matches production.
      j.jobid,
      d.start_time AS started_at,
      d.end_time AS finished_at,
      d.return_message,
      d.status
    FROM jobs j
    JOIN cron.job_run_details d ON d.jobid = j.jobid
    ORDER BY j.jobid, d.start_time DESC
  )
  SELECT
    j.job_name,
    j.expected_interval_seconds,
    j.grace_seconds,
    CASE
      WHEN j.jobid IS NULL THEN 'never-configured'
      WHEN l.jobid IS NULL THEN 'never-ran'
      WHEN lower(coalesce(l.status, '')) IN ('failed', 'failure') THEN
        CASE WHEN coalesce(l.return_message, '') ~* '(401|403|503|unauthori[sz])'
          THEN 'auth-failure' ELSE 'failed' END
      WHEN coalesce(l.return_message, '') ~* '(401|403|503|partial|error)'
        THEN CASE WHEN l.return_message ~* '(401|403|503|unauthori[sz])'
          THEN 'auth-failure' ELSE 'partial-success' END
      WHEN l.started_at < now() - make_interval(secs => j.expected_interval_seconds + j.grace_seconds)
        THEN 'stale'
      ELSE 'healthy'
    END,
    l.started_at,
    l.finished_at,
    l.return_message
  FROM jobs j
  LEFT JOIN latest l ON l.jobid = j.jobid;
$$;

REVOKE ALL ON FUNCTION public.ops_cron_health_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_cron_health_snapshot() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-cron-health-10min') THEN
    PERFORM cron.unschedule('ops-cron-health-10min');
  END IF;
END $$;

SELECT cron.schedule(
  'ops-cron-health-10min',
  '*/10 * * * *',
  $$
  DO $do$
  DECLARE
    v_key TEXT;
    v_cron_secret TEXT;
  BEGIN
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets
      WHERE name = 'internal_anon_key' LIMIT 1;
    SELECT decrypted_secret INTO v_cron_secret FROM vault.decrypted_secrets
      WHERE name = 'cron_secret' LIMIT 1;
    IF v_key IS NULL OR v_cron_secret IS NULL THEN
      RAISE WARNING 'OPS-00 Vault secrets missing';
      RETURN;
    END IF;
    PERFORM net.http_post(
      url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/cron-health-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key,
        'x-cron-secret', v_cron_secret
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  END $do$;
  $$
);
