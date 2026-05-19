-- ============================================================================
-- Sprint 7 follow-up (Phase 1.5) — same-cluster diversity penalty
-- ============================================================================
-- Phase 1 (20260515100000_feed_timeline_scored.sql) introduced score-based
-- ordering but produced visibly clustered results in prod: when the
-- pro-tour ingest cron ran, ~20 matches from the SAME tournament all
-- landed in the timeline within a few milliseconds of each other. Every
-- match shared identical (age, kudos=0, comments=0, source_provider,
-- type_bonus), so their scores were identical and they swept the top 20
-- slots — blog and video items got pushed off page 1 entirely.
--
-- Fix: penalize the same cluster appearing repeatedly so each tournament
-- gets a couple of representative slots up top, then yields to other
-- content. Pure SQL — single CREATE OR REPLACE FUNCTION on the same
-- signature/return shape as Phase 1's cursor-correctness fix.
--
-- Algorithm
-- ---------
-- cluster_key:
--   matches  → source_provider || ':' || COALESCE(tournament_name, '_none')
--   blog     → 'blog:'  || id   (each blog its own cluster)
--   video    → 'video:' || id   (each video its own cluster)
--
-- Within each cluster, rank items by raw _score DESC (item_id tiebreaker).
-- The first row in a cluster keeps its full score; subsequent rows take
-- an additive penalty:
--
--   cluster_rank = 1   →  penalty = 0.0
--   cluster_rank = 2   →  penalty = 0.3
--   cluster_rank = 3   →  penalty = 0.6
--   cluster_rank ≥ 4   →  penalty = 1.5
--
-- The returned `score` column is `_score - cluster_penalty` (the value
-- used by both WHERE cursor filter and ORDER BY). This is what the
-- client sends back as p_cursor_score, so keyset pagination stays
-- correct across pages (Codex P1 fix from PR #82's update).
--
-- Sanity scenario
-- ---------------
-- Cluster A: 20 PPA Kuala Lumpur matches, age=16h, 0 engagement
--   recency_decay = exp(-16/48)        ≈ 0.7165
--   multiplier    = 1.0
--   type_bonus    = 2.0 (ppa_tour)
--   raw _score    ≈ 0.7165 + 2.0       ≈ 2.71  (each row, all identical)
--
-- After cluster_penalty:
--   Rank 1: 2.71 - 0.0                 = 2.71
--   Rank 2: 2.71 - 0.3                 = 2.41
--   Rank 3: 2.71 - 0.6                 = 2.11
--   Rank 4..20: 2.71 - 1.5             = 1.21  (17 rows, identical)
--
-- Fresh VI blog post, age=12h, 0 engagement (solo cluster, penalty 0):
--   recency_decay = exp(-12/48)        ≈ 0.7788
--   multiplier    = 1.0
--   type_bonus    = 1.0 (blog)
--   final score   ≈ 0.7788 + 1.0       ≈ 1.78
--
-- Top of feed becomes:
--   1. PPA #1   2.71
--   2. PPA #2   2.41
--   3. PPA #3   2.11
--   4. Blog     1.78
--   5. PPA #4   1.21   (and 16 more PPA rows tied at 1.21 behind it)
--
-- That's the curve we want — tournament gets 2-3 representative slots,
-- then blog/video breaks through, then the rest of the cluster falls in
-- behind. Multiple tournaments compete fairly because each one's
-- cluster_rank=1..3 rows score independently of the others.
--
-- Signature
-- ---------
-- Unchanged from PR #82's post-Codex-P1 signature:
--   get_feed_timeline(INTEGER, DOUBLE PRECISION, UUID, UUID)
-- The CREATE OR REPLACE just swaps the body. The pre-Phase-1 TIMESTAMPTZ
-- signature drop is left in case this migration runs against a DB where
-- Phase 1 was never applied.
-- ============================================================================

-- Defensive: drop any lingering pre-Phase-1 signature so the function
-- definition collapses to a single overload.
DROP FUNCTION IF EXISTS public.get_feed_timeline(
  INTEGER, TIMESTAMPTZ, UUID, UUID
);

CREATE OR REPLACE FUNCTION public.get_feed_timeline(
  p_limit                  INTEGER DEFAULT 20,
  p_cursor_score           DOUBLE PRECISION DEFAULT NULL,
  p_cursor_item_id         UUID DEFAULT NULL,
  p_viewer_id              UUID DEFAULT NULL
)
RETURNS TABLE (
  item_type            TEXT,
  item_id              UUID,
  published_at         TIMESTAMPTZ,
  score                DOUBLE PRECISION,
  -- match-specific (NULL when item_type <> 'match')
  slug                 TEXT,
  format               TEXT,
  match_type           TEXT,
  verification_status  TEXT,
  venue_name           TEXT,
  team_a_score         INTEGER[],
  team_b_score         INTEGER[],
  winning_team         TEXT,
  participants         JSONB,
  kudos_count          INTEGER,
  viewer_kudoed        BOOLEAN,
  comment_count        INTEGER,
  source_provider      TEXT,
  source_url           TEXT,
  tournament_name      TEXT,
  tournament_event     TEXT,
  round_name           TEXT,
  -- blog/video shared (NULL when item_type='match')
  title                TEXT,
  excerpt              TEXT,
  cover_image_url      TEXT,
  category             TEXT,
  duration_seconds     INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  window_start AS (
    SELECT NOW() - INTERVAL '30 days' AS ts
  ),
  match_rows AS (
    SELECT
      'match'::TEXT                                          AS item_type,
      m.id                                                   AS item_id,
      m.played_at                                            AS published_at,
      m.slug                                                 AS slug,
      m.format                                               AS format,
      m.match_type                                           AS match_type,
      m.verification_status                                  AS verification_status,
      COALESCE(v.name_vi, v.name, m.venue_name_override)     AS venue_name,
      m.team_a_score                                         AS team_a_score,
      m.team_b_score                                         AS team_b_score,
      m.winning_team                                         AS winning_team,
      (
        SELECT jsonb_agg(jsonb_build_object(
          'player_id',    mp.player_id,
          'team',         mp.team,
          'position',     mp.position,
          'username',     pr.username,
          'display_name', pr.display_name,
          'avatar_url',   pr.avatar_url,
          'is_ghost',     pr.is_ghost,
          'dupr_doubles', pr.dupr_doubles,
          'country_code', pr.country_code
        ) ORDER BY mp.team, mp.position)
        FROM public.match_participants mp
        JOIN public.profiles pr ON pr.id = mp.player_id
        WHERE mp.match_id = m.id
      )                                                      AS participants,
      COALESCE(mk.cnt, 0)::INTEGER                           AS kudos_count,
      (vmk.user_id IS NOT NULL)                              AS viewer_kudoed,
      COALESCE(cc.cnt, 0)::INTEGER                           AS comment_count,
      m.source_provider                                      AS source_provider,
      m.source_url                                           AS source_url,
      m.tournament_name                                      AS tournament_name,
      m.tournament_event                                     AS tournament_event,
      m.round_name                                           AS round_name,
      NULL::TEXT                                             AS title,
      NULL::TEXT                                             AS excerpt,
      NULL::TEXT                                             AS cover_image_url,
      NULL::TEXT                                             AS category,
      NULL::INTEGER                                          AS duration_seconds,
      -- Cluster key for matches: collapse a tournament's rows together.
      -- COALESCE with '_none' so community matches without a tournament
      -- still cluster correctly (all community-no-tournament rows share
      -- a single cluster, which is the right behavior — they would
      -- otherwise each be a solo cluster and bypass diversity).
      'match:'
        || COALESCE(m.source_provider, 'community')
        || ':'
        || COALESCE(m.tournament_name, '_none')             AS _cluster_key
    FROM public.matches m
    LEFT JOIN public.venues v ON v.id = m.venue_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt
      FROM public.kudos k
      WHERE k.target_type = 'match' AND k.target_id = m.id
    ) mk ON TRUE
    LEFT JOIN public.kudos vmk
      ON vmk.target_type = 'match'
     AND vmk.target_id   = m.id
     AND vmk.user_id     = p_viewer_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt
      FROM public.social_comments sc
      WHERE sc.target_type = 'match'
        AND sc.target_id   = m.id
        AND sc.is_deleted  = FALSE
    ) cc ON TRUE
    WHERE m.is_public = TRUE
      AND m.verification_status IN ('verified', 'pending', 'disputed')
      AND m.played_at >= (SELECT ts FROM window_start)
  ),
  blog_rows AS (
    SELECT
      'blog'::TEXT                                           AS item_type,
      b.id                                                   AS item_id,
      b.published_at                                         AS published_at,
      b.slug                                                 AS slug,
      NULL::TEXT                                             AS format,
      NULL::TEXT                                             AS match_type,
      NULL::TEXT                                             AS verification_status,
      NULL::TEXT                                             AS venue_name,
      NULL::INTEGER[]                                        AS team_a_score,
      NULL::INTEGER[]                                        AS team_b_score,
      NULL::TEXT                                             AS winning_team,
      NULL::JSONB                                            AS participants,
      NULL::INTEGER                                          AS kudos_count,
      NULL::BOOLEAN                                          AS viewer_kudoed,
      NULL::INTEGER                                          AS comment_count,
      NULL::TEXT                                             AS source_provider,
      NULL::TEXT                                             AS source_url,
      NULL::TEXT                                             AS tournament_name,
      NULL::TEXT                                             AS tournament_event,
      NULL::TEXT                                             AS round_name,
      b.title                                                AS title,
      COALESCE(b.excerpt, b.meta_description)                AS excerpt,
      b.cover_image_url                                      AS cover_image_url,
      b.category                                             AS category,
      NULL::INTEGER                                          AS duration_seconds,
      -- Each blog post is its own cluster (id is unique) so the
      -- diversity penalty never fires on blog rows.
      'blog:' || b.id::TEXT                                  AS _cluster_key
    FROM public.vi_blog_posts b
    WHERE b.status = 'published'
      AND b.published_at IS NOT NULL
      AND b.published_at >= (SELECT ts FROM window_start)
  ),
  video_rows AS (
    SELECT
      'video'::TEXT                                          AS item_type,
      vid.id                                                 AS item_id,
      vid.published_at                                       AS published_at,
      NULL::TEXT                                             AS slug,
      NULL::TEXT                                             AS format,
      NULL::TEXT                                             AS match_type,
      NULL::TEXT                                             AS verification_status,
      NULL::TEXT                                             AS venue_name,
      NULL::INTEGER[]                                        AS team_a_score,
      NULL::INTEGER[]                                        AS team_b_score,
      NULL::TEXT                                             AS winning_team,
      NULL::JSONB                                            AS participants,
      NULL::INTEGER                                          AS kudos_count,
      NULL::BOOLEAN                                          AS viewer_kudoed,
      NULL::INTEGER                                          AS comment_count,
      NULL::TEXT                                             AS source_provider,
      NULL::TEXT                                             AS source_url,
      NULL::TEXT                                             AS tournament_name,
      NULL::TEXT                                             AS tournament_event,
      NULL::TEXT                                             AS round_name,
      vid.title                                              AS title,
      vid.description                                        AS excerpt,
      vid.thumbnail_url                                      AS cover_image_url,
      vid.type::TEXT                                         AS category,
      vid.duration_seconds                                   AS duration_seconds,
      -- Each video is its own cluster.
      'video:' || vid.id::TEXT                               AS _cluster_key
    FROM public.videos vid
    WHERE vid.status = 'published'
      AND vid.published_at IS NOT NULL
      AND vid.published_at >= (SELECT ts FROM window_start)
  ),
  scored_rows AS (
    SELECT
      *,
      -- Phase 1 score — same formula as 20260515100000.
      (
        EXP(
          -EXTRACT(EPOCH FROM (NOW() - published_at)) / 3600.0 / 48.0
        )
        * (
            1.0
            + LN(
                1.0
                + COALESCE(kudos_count, 0) * 1.0
                + COALESCE(comment_count, 0) * 5.0
              )
          )
        + CASE item_type
            WHEN 'match' THEN
              CASE source_provider
                WHEN 'ppa_tour'  THEN 2.0
                WHEN 'community' THEN 0.5
                ELSE 0.0
              END
            WHEN 'blog'  THEN 1.0
            WHEN 'video' THEN 1.0
            ELSE 0.0
          END
      )::DOUBLE PRECISION AS _score
    FROM (
      SELECT * FROM match_rows
      UNION ALL
      SELECT * FROM blog_rows
      UNION ALL
      SELECT * FROM video_rows
    ) unioned
  ),
  ranked_rows AS (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY _cluster_key
        ORDER BY _score DESC, item_id DESC
      ) AS _cluster_rank
    FROM scored_rows
  ),
  -- Final score = raw score minus the cluster penalty. Materialized so
  -- the keyset cursor filter and the ORDER BY agree on the same value,
  -- and so the value is what we return to the client (which sends it
  -- back as p_cursor_score for the next page).
  final_rows AS (
    SELECT
      *,
      (
        _score
        - CASE _cluster_rank
            WHEN 1 THEN 0.0
            WHEN 2 THEN 0.3
            WHEN 3 THEN 0.6
            ELSE 1.5
          END
      )::DOUBLE PRECISION AS _final_score
    FROM ranked_rows
  )
  SELECT
    item_type,
    item_id,
    published_at,
    _final_score AS score,
    slug,
    format,
    match_type,
    verification_status,
    venue_name,
    team_a_score,
    team_b_score,
    winning_team,
    participants,
    kudos_count,
    viewer_kudoed,
    comment_count,
    source_provider,
    source_url,
    tournament_name,
    tournament_event,
    round_name,
    title,
    excerpt,
    cover_image_url,
    category,
    duration_seconds
  FROM final_rows
  -- Keyset pagination on (final_score, item_id) — must match the ORDER BY.
  WHERE (
    p_cursor_score IS NULL
    OR _final_score < p_cursor_score
    OR (
      _final_score = p_cursor_score
      AND p_cursor_item_id IS NOT NULL
      AND item_id < p_cursor_item_id
    )
  )
  ORDER BY _final_score DESC, item_id DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_feed_timeline(
  INTEGER, DOUBLE PRECISION, UUID, UUID
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
