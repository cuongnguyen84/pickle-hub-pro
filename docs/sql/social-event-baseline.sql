-- BI baseline: last 30 complete Vietnam calendar days.
-- Aggregate only. Event outcomes are current snapshots grouped by scheduled
-- end date, not timestamps of score saves or publication.
WITH bounds AS (
  SELECT date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
         AT TIME ZONE 'Asia/Ho_Chi_Minh' AS until_at
),
registrations AS (
  SELECT CASE WHEN registration_source IN ('self', 'proxy', 'manual')
              THEN registration_source ELSE 'other' END AS registration_source,
         count(*) AS n
  FROM public.event_registrations, bounds
  WHERE registered_at >= until_at - interval '720 hours'
    AND registered_at < until_at
  GROUP BY CASE WHEN registration_source IN ('self', 'proxy', 'manual')
                THEN registration_source ELSE 'other' END
),
ended AS (
  SELECT e.id, e.status, EXISTS (
    SELECT 1 FROM public.social_event_matches m
    WHERE m.event_id = e.id AND m.status = 'completed'
      AND m.team_a_score IS NOT NULL AND m.team_b_score IS NOT NULL
  ) AS has_completed_score
  FROM public.social_events e CROSS JOIN bounds
  WHERE e.end_at >= until_at - interval '720 hours' AND e.end_at < until_at
    AND e.status IN ('published', 'completed')
)
SELECT until_at - interval '720 hours' AS from_at, until_at,
  now() AS observed_at,
  (SELECT coalesce(jsonb_object_agg(registration_source, n), '{}'::jsonb)
   FROM registrations) AS registration_rows_by_source,
  (SELECT count(*) FROM public.social_events) AS social_events_all_time,
  (SELECT count(*) FROM public.event_registrations) AS registration_rows_all_time,
  (SELECT count(*) FROM public.quick_tables
   WHERE created_at >= until_at - interval '720 hours' AND created_at < until_at)
    AS quick_tables_created_in_window,
  (SELECT count(*) FROM ended) AS events_past_scheduled_end,
  (SELECT count(*) FROM ended WHERE status = 'completed') AS marked_completed,
  (SELECT count(*) FROM ended WHERE has_completed_score) AS with_completed_score,
  (SELECT count(*) FROM ended WHERE status = 'completed' AND has_completed_score)
    AS marked_completed_with_score
FROM bounds;
