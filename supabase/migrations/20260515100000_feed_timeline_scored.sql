-- ============================================================================
-- Sprint 7 follow-up (Phase 1) — score-based sort for get_feed_timeline
-- ============================================================================
-- Replaces the pure `published_at DESC` sort in get_feed_timeline (shipped
-- 20260514120000) with a heuristic score so the /feed Trending tab can
-- mix freshness, engagement, and content-type priority instead of letting
-- the absolute newest empty row always win.
--
-- This is Phase 1 of anh's "social feed algorithms" work: no
-- personalization, no tracking infrastructure, no ML. Pure SQL derived
-- from columns already in the existing UNION CTE.
--
-- Algorithm
-- ---------
--   score = recency_decay * (1 + ln(1 + engagement_score)) + type_bonus
--
--   recency_decay    = EXP(-age_hours / 48.0)
--   engagement_score = kudos_count*1.0 + comment_count*5.0   (matches only;
--                      blog/video set to 0 → collapses to 1)
--   age_hours        = EXTRACT(EPOCH FROM (NOW() - published_at)) / 3600.0
--   type_bonus       = source_provider='ppa_tour' → 2.0
--                      source_provider='community' → 0.5
--                      item_type='blog'           → 1.0
--                      item_type='video'          → 1.0
--                      everything else            → 0
--
-- Constants are hardcoded. We'll promote them to function parameters if
-- tuning becomes a frequent need; for now a single follow-up migration
-- is cheaper than guessing the right knob shape.
--
-- Sanity scenarios (computed by hand — paste these into PR and check
-- against `psql` if the scores ever feel surprising):
--
--   A. Fresh PPA Tour match, 1h old, 0 kudos / 0 comments
--      recency_decay = exp(-1/48)         ≈ 0.9794
--      ln(1+0)       = 0  → multiplier 1
--      type_bonus    = 2.0 (ppa_tour)
--      score         ≈ 0.9794*1 + 2.0     ≈ 2.98
--
--   B. 24h old community match, 10 kudos + 2 comments
--      recency_decay = exp(-24/48)        ≈ 0.6065
--      engagement    = 10 + 10            = 20
--      multiplier    = 1 + ln(21)         ≈ 4.0445
--      type_bonus    = 0.5 (community)
--      score         ≈ 0.6065*4.0445+0.5  ≈ 2.95
--
--   C. 2-day old VI blog post (no engagement signals)
--      recency_decay = exp(-48/48)        ≈ 0.3679
--      multiplier    = 1
--      type_bonus    = 1.0 (blog)
--      score         ≈ 0.3679 + 1.0       ≈ 1.37
--
-- A vs B is the headline test: a fresh pro tour match and a day-old
-- community match with healthy engagement score about the same — that's
-- the curve we want. Engagement can overtake recency around the 24h mark.
--
-- Cursor consistency caveat
-- -------------------------
-- The outer query ORDER BY uses the score, but cursor pagination still
-- filters on (published_at, item_id) — DO NOT switch the cursor to score,
-- because score changes over time as recency decays, which would make
-- pagination non-idempotent across pages. The trade-off is that
-- "page 2" becomes "older content scrolled down by time", not "next 20
-- by score". For Phase 1 this is acceptable: the top of page 1 still
-- reflects the score, and users scrolling further naturally drop into
-- older material.
--
-- IDEMPOTENT — CREATE OR REPLACE FUNCTION. Signature + return shape are
-- unchanged from 20260514120000 so no type regen is needed; the hook in
-- src/hooks/social/useFeedTimeline.ts continues to compile against the
-- existing Supabase types.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_feed_timeline(
  p_limit                  INTEGER DEFAULT 20,
  p_cursor_published_at    TIMESTAMPTZ DEFAULT NULL,
  p_cursor_item_id         UUID DEFAULT NULL,
  p_viewer_id              UUID DEFAULT NULL
)
RETURNS TABLE (
  item_type            TEXT,
  item_id              UUID,
  published_at         TIMESTAMPTZ,
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
  -- 30-day rolling window applied uniformly so each branch only scans a
  -- bounded slice. Tunable: bump to 60 if the feed starts feeling sparse
  -- after blog/video cadence settles.
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
      NULL::INTEGER                                          AS duration_seconds
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
      NULL::INTEGER                                          AS duration_seconds
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
      vid.duration_seconds                                   AS duration_seconds
    FROM public.videos vid
    WHERE vid.status = 'published'
      AND vid.published_at IS NOT NULL
      AND vid.published_at >= (SELECT ts FROM window_start)
  ),
  all_rows AS (
    SELECT * FROM match_rows
    UNION ALL
    SELECT * FROM blog_rows
    UNION ALL
    SELECT * FROM video_rows
  )
  SELECT
    item_type,
    item_id,
    published_at,
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
  FROM all_rows
  WHERE (
    p_cursor_published_at IS NULL
    OR all_rows.published_at < p_cursor_published_at
    OR (
      all_rows.published_at = p_cursor_published_at
      AND p_cursor_item_id IS NOT NULL
      AND all_rows.item_id < p_cursor_item_id
    )
  )
  ORDER BY
    -- Phase 1 score. Computed inline so we don't materialize an extra
    -- column into the function return shape. PostgreSQL evaluates the
    -- expression per row once for ORDER BY; the inner CTEs are already
    -- bounded by the 30-day window so the row count stays in the low
    -- thousands at worst.
    (
      EXP(
        -EXTRACT(EPOCH FROM (NOW() - all_rows.published_at)) / 3600.0 / 48.0
      )
      * (
          1.0
          + LN(
              1.0
              + COALESCE(all_rows.kudos_count, 0) * 1.0
              + COALESCE(all_rows.comment_count, 0) * 5.0
            )
        )
      + CASE all_rows.item_type
          WHEN 'match' THEN
            CASE all_rows.source_provider
              WHEN 'ppa_tour'  THEN 2.0
              WHEN 'community' THEN 0.5
              ELSE 0.0
            END
          WHEN 'blog'  THEN 1.0
          WHEN 'video' THEN 1.0
          ELSE 0.0
        END
    ) DESC,
    -- Recency tiebreaker — matters when two items in the same content
    -- bucket have nearly identical scores (e.g. two fresh pro tour
    -- matches an hour apart with zero engagement).
    all_rows.published_at DESC,
    -- Final tiebreaker — UUIDs sort stably so the result set is
    -- deterministic for snapshot diffs / pagination boundaries.
    all_rows.item_id DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1);
$$;

NOTIFY pgrst, 'reload schema';
