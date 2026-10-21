-- Register the two crons added on 2026-08-17 for health monitoring.
--
-- This is not only about alerting. ops-job-control resolves a Telegram "🛠 Xử lý"
-- button through ops_cron_monitors, so an unregistered job has no button and no
-- /diagnose — the failures land in Telegram as text with nothing to press. That
-- is exactly what happened with news-repair's first real report.
--
-- Grace is generous on purpose. A late run is not an incident here: news-repair
-- only has work when something has already failed, and x-draft only has work
-- when news arrived.

INSERT INTO public.ops_cron_monitors (
  monitor_key,
  display_name,
  source,
  cron_job_name,
  external_identifier,
  expected_interval_seconds,
  grace_seconds
)
VALUES
  (
    'news-repair',
    'Khôi phục tin lỗi (news_origins)',
    'pg_net',
    'news-repair-hourly',
    NULL,
    3600,
    3600
  ),
  (
    'x-draft',
    'Sinh bài X từ tin tiếng Anh',
    'pg_net',
    'x-draft-every-30min',
    NULL,
    1800,
    1800
  )
ON CONFLICT (monitor_key) DO UPDATE
  SET display_name              = EXCLUDED.display_name,
      cron_job_name             = EXCLUDED.cron_job_name,
      expected_interval_seconds = EXCLUDED.expected_interval_seconds,
      grace_seconds             = EXCLUDED.grace_seconds;
