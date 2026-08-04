-- Publish Facebook queue items only during Vietnam daytime. The Worker also
-- enforces this window, so manual calls and delayed pg_net requests cannot
-- post overnight. Keeping the serialized 15-minute cadence drains overnight
-- crawl/translation backlog gradually without a morning burst.
DO $migration$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'social-poster-catchup-15min'
  LIMIT 1;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'social-poster-catchup-15min cron job not found';
  END IF;

  -- pg_cron uses UTC. 00:00-12:59 UTC = 07:00-19:59 ICT (UTC+7).
  PERFORM cron.alter_job(
    job_id := v_job_id,
    schedule := '*/15 0-12 * * *',
    active := true
  );
END
$migration$;
