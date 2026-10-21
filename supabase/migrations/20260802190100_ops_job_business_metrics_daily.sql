-- Khôi phục 18/08 cùng lý do với 20260802190000 — nguyên văn từ commit 40a2f9e0.
--
-- Refine business metrics after the first live scheduled runs:
-- use the latest completed social dispatch and distinguish latest Pro Tour
-- batch output from the number of matches imported during the ICT day.
ALTER FUNCTION public.ops_job_health_snapshot() RENAME TO ops_job_health_snapshot_business_v1;

CREATE OR REPLACE FUNCTION public.ops_job_health_snapshot()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path=public,cron,pg_temp
AS $function$
WITH base AS (
  SELECT public.ops_job_health_snapshot_business_v1() AS snapshot
), social AS (
  SELECT response_content
  FROM public.ops_cron_dispatches
  WHERE monitor_key='social-poster' AND response_content IS NOT NULL
  ORDER BY dispatched_at DESC LIMIT 1
), pro_today AS (
  SELECT coalesce(sum(matches_imported),0) AS matches_today,
    count(*) AS ingestion_events_today
  FROM public.pro_tour_ingestion_logs
  WHERE triggered_by='scheduled'
    AND started_at >= date_trunc('day',now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh'
), enriched AS (
  SELECT jsonb_agg(
    CASE job->>'job_key'
      WHEN 'social-poster' THEN job || jsonb_build_object(
        'summary', CASE WHEN social.response_content LIKE '%no_eligible_item%'
          THEN concat('ThePickleHub: ',job->'metrics'->>'thepicklehub_posts_today',
            ' bài hôm nay; TA Pickleball: ',job->'metrics'->>'ta_pickleball_posts_today',
            ' bài hôm nay; không có bài đủ điều kiện')
          ELSE job->>'summary' END,
        'metrics', coalesce(job->'metrics','{}'::jsonb) || jsonb_build_object(
          'pages_no_eligible',CASE WHEN social.response_content LIKE '%no_eligible_item%' THEN 2 ELSE 0 END)
      )
      WHEN 'pro-tour-scraper' THEN job || jsonb_build_object(
        'metrics',coalesce(job->'metrics','{}'::jsonb) || jsonb_build_object(
          'matches_today',pro_today.matches_today,
          'ingestion_events_today',pro_today.ingestion_events_today),
        'error_message',CASE WHEN jsonb_array_length(coalesce(job->'runs','[]'::jsonb))>0
          AND job->>'health_state'='healthy' THEN NULL ELSE job->'error_message' END
      )
      ELSE job
    END ORDER BY job->>'category',job->>'display_name'
  ) AS jobs
  FROM base CROSS JOIN LATERAL jsonb_array_elements(base.snapshot->'jobs') job
  LEFT JOIN social ON true CROSS JOIN pro_today
)
SELECT jsonb_set(base.snapshot,'{jobs}',coalesce(enriched.jobs,'[]'::jsonb))
FROM base CROSS JOIN enriched;
$function$;

REVOKE ALL ON FUNCTION public.ops_job_health_snapshot_business_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_job_health_snapshot_business_v1() TO service_role;
REVOKE ALL ON FUNCTION public.ops_job_health_snapshot() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_job_health_snapshot() TO service_role;
