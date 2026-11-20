WITH w AS (SELECT date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' until_at),
recent AS (SELECT DISTINCT q.creator_user_id FROM public.quick_tables q,w WHERE q.created_at >= until_at - interval '720 hours' AND q.created_at < until_at AND q.creator_user_id IS NOT NULL)
SELECT (SELECT until_at - interval '720 hours' FROM w) AS from_at,
 (SELECT until_at FROM w) AS until_at,
 now() AS observed_at,
 count(*) recent_creators,
 count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.quick_tables q2,w WHERE q2.creator_user_id=r.creator_user_id AND q2.created_at < (SELECT until_at FROM w) - interval '720 hours')) returning_creators
FROM recent r;
