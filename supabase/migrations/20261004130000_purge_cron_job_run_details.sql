-- ops_job_health_snapshot timed out (57014, 8s authenticator statement_timeout):
-- cron.job_run_details had never been purged (193k rows / 278 MB since 2026-05),
-- and ops_job_health_snapshot_base seq-scans it once per enabled job.
-- No reader needs >7 days of pg_cron history (ops_job_runs keeps our own 30d history).

DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days';

SELECT cron.unschedule('purge-cron-job-run-details')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-cron-job-run-details');

SELECT cron.schedule(
  'purge-cron-job-run-details',
  '17 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days'$$
);
