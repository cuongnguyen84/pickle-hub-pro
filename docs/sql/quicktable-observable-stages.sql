-- Read-only cohort snapshot, v1 (2026-11-20).
-- Defaults to the last 30 complete Vietnam calendar days; replace until_at
-- with an explicit timestamptz to reproduce the creation cohort later.
-- Aggregate output only; no names, user IDs, table IDs, or guessed intent.
WITH bounds AS (
  SELECT date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
         AT TIME ZONE 'Asia/Ho_Chi_Minh' AS until_at
),
cohort AS (
  SELECT q.id, q.creator_user_id, q.status::text AS status
  FROM public.quick_tables q CROSS JOIN bounds b
  WHERE q.created_at >= b.until_at - interval '720 hours'
    AND q.created_at < b.until_at
),
observed AS (
  SELECT q.*,
    EXISTS (SELECT 1 FROM public.quick_table_players p
            WHERE p.table_id = q.id AND p.is_bye IS NOT TRUE) AS has_roster,
    EXISTS (SELECT 1 FROM public.quick_table_teams t
            WHERE t.table_id = q.id) AS has_team_registration,
    EXISTS (SELECT 1 FROM public.quick_table_matches m
            WHERE m.table_id = q.id) AS has_matches,
    EXISTS (SELECT 1 FROM public.quick_table_matches m
            WHERE m.table_id = q.id
              AND m.score1 IS NOT NULL AND m.score2 IS NOT NULL) AS has_score
  FROM cohort q
),
classified AS (
  SELECT *,
    CASE
      WHEN status = 'completed' THEN 'completed'
      WHEN has_score THEN 'scored'
      WHEN has_matches THEN 'matches_no_scores'
      WHEN has_roster THEN 'roster_no_matches'
      ELSE 'created_no_roster'
    END AS stage
  FROM observed
),
stages(stage, sort_order) AS (
  VALUES ('created_no_roster', 1), ('roster_no_matches', 2),
         ('matches_no_scores', 3), ('scored', 4), ('completed', 5)
)
SELECT b.until_at - interval '720 hours' AS cohort_from_at,
       b.until_at AS cohort_until_at,
       now() AS observed_at,
       s.stage,
       count(c.id) AS tables,
       count(DISTINCT c.creator_user_id) AS creators,
       count(c.id) FILTER (WHERE c.has_team_registration) AS with_team_registrations,
       count(c.id) FILTER (WHERE c.has_matches AND NOT c.has_roster)
         AS with_matches_but_no_roster,
       count(c.id) FILTER (WHERE c.status = 'completed' AND NOT c.has_score)
         AS completed_without_score
FROM bounds b CROSS JOIN stages s
LEFT JOIN classified c ON c.stage = s.stage
GROUP BY b.until_at, s.stage, s.sort_order
ORDER BY s.sort_order;
