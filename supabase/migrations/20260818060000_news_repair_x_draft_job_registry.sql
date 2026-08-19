-- Two defects in yesterday's monitoring work, both mine.
--
-- 1. "Không tìm thấy job: news-repair" when the Telegram button is pressed.
--    I registered the new crons in ops_cron_monitors, but ops-job-control
--    resolves /fix and /diagnose through ops_job_registry — a different table.
--    The alert therefore carried my display_name (that path does read the
--    monitors) while the button had nothing to look up.
--
-- 2. "State: never_ran — Scheduler ran but no monitored request was dispatched".
--    A monitored cron has to record its own dispatch; social-poster's job does
--    `SELECT net.http_post(...) INTO v_request_id` then inserts into
--    ops_cron_dispatches. Mine called PERFORM and recorded nothing, so the
--    monitor was correct: it saw a scheduler tick and no dispatch. Registering
--    a job for monitoring without wiring the dispatch produces a permanent
--    false alarm, which is worse than no monitoring at all.

-- --------------------------------------------------------------------------
-- 1. The registry ops-job-control actually reads
-- --------------------------------------------------------------------------
INSERT INTO public.ops_job_registry (
  job_key, display_name, category, executor, cron_job_name,
  existing_monitor_key, schedule_label,
  expected_interval_seconds, grace_seconds, details_path, enabled,
  monitoring_started_at
)
VALUES
  ('news-repair', 'Khôi phục tin lỗi', 'news', 'pg_net', 'news-repair-hourly',
   'news-repair', 'Mỗi giờ', 3600, 3600, '/admin/news', true, now()),
  ('x-draft', 'Sinh bài X từ tin tiếng Anh', 'news', 'pg_net', 'x-draft-every-30min',
   'x-draft', 'Mỗi 30 phút', 1800, 1800, NULL, true, now())
ON CONFLICT (job_key) DO UPDATE
  SET display_name              = EXCLUDED.display_name,
      cron_job_name             = EXCLUDED.cron_job_name,
      existing_monitor_key      = EXCLUDED.existing_monitor_key,
      schedule_label            = EXCLUDED.schedule_label,
      expected_interval_seconds = EXCLUDED.expected_interval_seconds,
      grace_seconds             = EXCLUDED.grace_seconds,
      enabled                   = EXCLUDED.enabled;

-- --------------------------------------------------------------------------
-- 2. Reschedule both crons so they record the dispatch they are monitored on
-- --------------------------------------------------------------------------
SELECT cron.unschedule('x-draft-every-30min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'x-draft-every-30min');

SELECT cron.schedule(
  'x-draft-every-30min',
  '5,35 * * * *',
  $job$
  DO $inner$
  DECLARE v_secret TEXT; v_request_id bigint;
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
     WHERE name = 'social_poster_auth_secret' LIMIT 1;
    IF v_secret IS NULL THEN
      RAISE WARNING 'social_poster_auth_secret missing from vault — skip x-draft';
      RETURN;
    END IF;
    SELECT net.http_post(
      url := 'https://social-poster.thecuong.workers.dev/x/draft',
      headers := jsonb_build_object('Content-Type','application/json','X-Auth-Secret', v_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    ) INTO v_request_id;
    INSERT INTO public.ops_cron_dispatches(monitor_key, request_id)
    VALUES ('x-draft', v_request_id);
  END
  $inner$;
  $job$
);

SELECT cron.unschedule('news-repair-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news-repair-hourly');

SELECT cron.schedule(
  'news-repair-hourly',
  '20 * * * *',
  $job$
  DO $inner$
  DECLARE v_secret TEXT; v_request_id bigint;
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
     WHERE name = 'cron_secret' LIMIT 1;
    IF v_secret IS NULL THEN
      RAISE WARNING 'cron_secret missing from vault — skip news-repair';
      RETURN;
    END IF;
    SELECT net.http_post(
      url := public.ops_project_url() || '/functions/v1/news-repair',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', v_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    ) INTO v_request_id;
    INSERT INTO public.ops_cron_dispatches(monitor_key, request_id)
    VALUES ('news-repair', v_request_id);
  END
  $inner$;
  $job$
);
