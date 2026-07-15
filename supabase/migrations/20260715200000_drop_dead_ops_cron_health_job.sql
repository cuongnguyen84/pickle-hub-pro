-- Remove the dead ops-cron-health-10min cron job (roadmap mục D).
--
-- 20260715140000 already unscheduled this job when cron-health moved into the
-- errors-telegram-alert function (job errors-telegram-alert-10min runs
-- runCronHealth()). Production drifted and kept the job, which POSTs every 10
-- minutes to functions/v1/cron-health-alert — a function that was never
-- deployed (its source directory is empty), so every dispatch 404s while
-- pg_cron records it as "succeeded" (pg_net only queues the request). Dead
-- noise. Drop it idempotently; safe to re-run.

DO $cleanup$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-cron-health-10min') THEN
    PERFORM cron.unschedule('ops-cron-health-10min');
  END IF;
END;
$cleanup$;
