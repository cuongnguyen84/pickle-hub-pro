-- Reconcile the concurrently merged first OPS-00 implementation.
--
-- 20260715090000 only observes cron.job_run_details. pg_cron reports success
-- once pg_net queues a request, so that monitor cannot see the downstream
-- HTTP 401/503 or partial-success payloads OPS-00 explicitly requires. The
-- durable request/response ledger from 20260715130000 supersedes it.

DO $cleanup$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-cron-health-10min') THEN
    PERFORM cron.unschedule('ops-cron-health-10min');
  END IF;
END;
$cleanup$;

DROP FUNCTION IF EXISTS public.ops_cron_health_snapshot();

-- Remove only dedupe fingerprints created by the superseded monitor. The
-- active implementation keeps independent state in ops_cron_alert_state.
DELETE FROM public.error_alert_dedup
WHERE fingerprint LIKE 'cron-health:%';

NOTIFY pgrst, 'reload schema';
