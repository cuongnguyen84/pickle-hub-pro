-- Aggregate transition evidence, not first-ever activation or intent.
-- Last 30 complete Vietnam calendar days. Historical unknowns stay unknown.
WITH bounds AS (
 SELECT date_trunc('day',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
        AT TIME ZONE 'Asia/Ho_Chi_Minh' AS until_at
)
SELECT until_at - interval '720 hours' AS from_at, until_at, now() AS observed_at,
 (SELECT count(*) FROM public.social_events
  WHERE first_published_at >= until_at - interval '720 hours'
    AND first_published_at < until_at) AS publications_in_window,
 (SELECT count(*) FROM public.social_events WHERE first_published_at IS NULL)
   AS publication_timestamp_unknown,
 (SELECT count(*) FROM public.quick_table_score_evidence
  WHERE observed_at >= until_at - interval '720 hours'
    AND observed_at < until_at) AS score_receipts_in_window,
 (SELECT count(*) FROM public.quick_table_score_evidence) AS score_receipts_all_time
FROM bounds;
