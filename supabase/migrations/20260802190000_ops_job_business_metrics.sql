-- Khôi phục 18/08: file này đã áp lên production 02/08 nhưng nhánh
-- agent/job-business-metrics không bao giờ merge, nên main mất file trong khi
-- prod đã có object. Nội dung lấy nguyên văn từ commit 8671e28e, không sửa gì.
--
-- Enrich transport-level job health with the business outcomes operators need.
-- Keep the original classifier as a base so this migration stays focused and
-- future migrations can still replace the base independently.
ALTER FUNCTION public.ops_job_health_snapshot() RENAME TO ops_job_health_snapshot_base;

CREATE OR REPLACE FUNCTION public.ops_job_health_snapshot()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron, pg_temp
AS $function$
WITH base AS (
  SELECT public.ops_job_health_snapshot_base() AS snapshot
), social_dispatch AS (
  SELECT response_content, dispatched_at
  FROM public.ops_cron_dispatches
  WHERE monitor_key = 'social-poster'
  ORDER BY dispatched_at DESC LIMIT 1
), social_stats AS (
  SELECT
    count(*) FILTER (WHERE page_key='thepicklehub' AND status='posted'
      AND posted_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh') AS tph_today,
    count(*) FILTER (WHERE page_key='ta-pickleball' AND status='posted'
      AND posted_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh') AS ta_today,
    max(posted_at) FILTER (WHERE page_key='thepicklehub' AND status='posted') AS tph_last,
    max(posted_at) FILTER (WHERE page_key='ta-pickleball' AND status='posted') AS ta_last,
    count(*) FILTER (WHERE status='failed') AS failed_rows,
    count(*) FILTER (WHERE status='pending' AND updated_at < now()-interval '10 minutes') AS stale_pending
  FROM public.fb_post_log
), social AS (
  SELECT jsonb_build_object(
    'thepicklehub_posts_today', s.tph_today,
    'ta_pickleball_posts_today', s.ta_today,
    'thepicklehub_last_posted_at', s.tph_last,
    'ta_pickleball_last_posted_at', s.ta_last,
    'failed_rows', s.failed_rows,
    'stale_pending', s.stale_pending,
    'pages_no_eligible', CASE WHEN d.response_content LIKE '%no_eligible_item%'
      THEN 2 ELSE 0 END
  ) AS metrics,
  concat('ThePickleHub: ',s.tph_today,' bài hôm nay; TA Pickleball: ',s.ta_today,
    ' bài hôm nay; ', CASE
      WHEN d.response_content LIKE '%no_eligible_item%' THEN 'không có bài đủ điều kiện'
      WHEN d.response_content LIKE '%post_failed%' THEN 'có fanpage đăng lỗi'
      ELSE 'đã xử lý lượt đăng gần nhất' END) AS summary,
  CASE WHEN s.stale_pending>0 OR d.response_content LIKE '%post_failed%'
    THEN 'warning' ELSE NULL END AS state_override
  FROM social_stats s CROSS JOIN social_dispatch d
), latest_pro AS (
  SELECT * FROM public.pro_tour_ingestion_logs
  WHERE triggered_by='scheduled'
  ORDER BY started_at DESC LIMIT 1
), pro_batch AS (
  SELECT
    count(*) AS events_processed,
    count(*) FILTER (WHERE l.status='success') AS events_succeeded,
    count(*) FILTER (WHERE l.status='partial') AS events_partial,
    count(*) FILTER (WHERE l.status='failed') AS events_failed,
    coalesce(sum(l.matches_imported),0) AS matches_imported,
    coalesce(sum(l.players_created),0) AS players_created,
    coalesce(sum(l.players_matched),0) AS players_matched,
    max(l.completed_at) AS completed_at,
    string_agg(l.error_message,'; ' ORDER BY l.started_at) FILTER (WHERE l.error_message IS NOT NULL) AS errors
  FROM public.pro_tour_ingestion_logs l CROSS JOIN latest_pro latest
  WHERE l.triggered_by='scheduled'
    AND l.started_at BETWEEN latest.started_at-interval '10 minutes' AND latest.started_at+interval '10 minutes'
), pro AS (
  SELECT jsonb_build_object(
    'matches_imported', matches_imported,
    'events_processed', events_processed,
    'events_succeeded', events_succeeded,
    'events_partial', events_partial,
    'events_failed', events_failed,
    'players_created', players_created,
    'players_matched', players_matched
  ) AS metrics,
  concat(matches_imported,' trận từ ',events_processed,' event; ',events_succeeded,
    ' thành công, ',events_partial,' partial, ',events_failed,' lỗi') AS summary,
  completed_at,
  errors,
  CASE
    WHEN events_failed>0 AND events_succeeded=0 THEN 'failed'
    WHEN events_failed>0 OR events_partial>0 THEN 'warning'
    WHEN completed_at IS NOT NULL AND now()-completed_at > interval '7 hours 30 minutes' THEN 'failed'
    WHEN completed_at IS NOT NULL THEN 'healthy'
    ELSE NULL
  END AS state_override
  FROM pro_batch
), enriched AS (
  SELECT jsonb_agg(
    CASE job->>'job_key'
      WHEN 'social-poster' THEN CASE WHEN social.metrics IS NULL THEN job ELSE job || jsonb_build_object(
        'summary', social.summary,
        'metrics', social.metrics,
        'health_state', coalesce(social.state_override,job->>'health_state')
      ) END
      WHEN 'pro-tour-scraper' THEN job || jsonb_strip_nulls(jsonb_build_object(
        'summary', CASE WHEN coalesce(job->'metrics','{}'::jsonb) ? 'matches_imported'
          THEN job->>'summary' ELSE pro.summary END,
        'metrics', CASE WHEN coalesce(job->'metrics','{}'::jsonb) ? 'matches_imported'
          THEN job->'metrics' ELSE pro.metrics END,
        'last_activity_at', coalesce(job->>'last_activity_at',pro.completed_at::text),
        'error_message', coalesce(job->>'error_message',pro.errors),
        'health_state', coalesce(CASE WHEN job->>'health_state'<>'pending' THEN job->>'health_state' END,pro.state_override,job->>'health_state')
      ))
      ELSE job
    END ORDER BY job->>'category',job->>'display_name'
  ) AS jobs
  FROM base CROSS JOIN LATERAL jsonb_array_elements(base.snapshot->'jobs') job
  LEFT JOIN social ON true LEFT JOIN pro ON true
)
SELECT jsonb_set(base.snapshot,'{jobs}',coalesce(enriched.jobs,'[]'::jsonb))
FROM base CROSS JOIN enriched;
$function$;

REVOKE ALL ON FUNCTION public.ops_job_health_snapshot_base() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_job_health_snapshot_base() TO service_role;
REVOKE ALL ON FUNCTION public.ops_job_health_snapshot() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_job_health_snapshot() TO service_role;
