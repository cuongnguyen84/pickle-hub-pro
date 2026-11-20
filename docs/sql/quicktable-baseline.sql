WITH w AS (
 SELECT date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' until_at
), t AS (
 SELECT q.id,q.creator_user_id,q.status,
 EXISTS (SELECT 1 FROM public.quick_table_matches m WHERE m.table_id=q.id AND m.score1 IS NOT NULL AND m.score2 IS NOT NULL) has_score,
 EXISTS (SELECT 1 FROM public.quick_table_matches m WHERE m.table_id=q.id AND m.status='completed') has_completed
 FROM public.quick_tables q,w
 WHERE q.created_at >= until_at - interval '720 hours' AND q.created_at < until_at
)
SELECT (SELECT until_at - interval '720 hours' FROM w) AS from_at,
 (SELECT until_at FROM w) AS until_at,
 now() AS observed_at,
 count(*) created,
 count(*) FILTER (WHERE has_score) with_score,
 count(*) FILTER (WHERE has_completed) with_completed_match,
 count(*) FILTER (WHERE status::text IN ('completed','archived')) finished,
 count(*) FILTER (WHERE status::text = 'completed') AS completed,
 count(*) FILTER (WHERE status::text = 'archived') AS archived,
 (SELECT count(*) FROM public.quick_table_matches m JOIN t ON t.id=m.table_id WHERE m.status='completed') AS completed_matches,
 count(DISTINCT creator_user_id) creators
FROM t;
