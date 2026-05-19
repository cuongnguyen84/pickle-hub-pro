-- ============================================================================
-- Sprint 7 — get_feed_timeline: single UNION RPC mixing matches + VI blog
--           posts + videos into one chronological /feed timeline
-- ============================================================================
-- Product context
-- ---------------
-- The previous /feed Trending tab called get_trending_feed (matches only,
-- engagement-weighted within a 7-day window). Sprint 7 reshapes /feed into
-- a Facebook-style mixed timeline:
--
--   - matches (community + pro tour, existing pipeline)
--   - vi_blog_posts (status='published', latest)
--   - videos (status='published', latest)
--
-- Sorted purely by recency: coalesce(played_at, published_at) DESC. No tier
-- separation, no engagement boost. EN blog posts live as static metadata in
-- src/content/blog/metadata.ts and are merged client-side (page 1 only),
-- intentionally NOT in this RPC.
--
-- We DO NOT touch get_trending_feed — it stays available for backward
-- compatibility in case other consumers rely on it. /feed simply stops
-- calling it (handled in src/pages/Feed.tsx).
--
-- Architecture decision
-- ---------------------
-- Phương án C — single UNION ALL RPC, no new tables. Data volume is small
-- (<100 published blog posts, <500 videos, ~hundreds of matches in any
-- 30-day window). If this grows or the UNION shape gets unwieldy, the
-- follow-up is a dedicated feed_items table maintained by triggers; the
-- public-facing hook will not need to change because the discriminated
-- union return shape is already shaped to be table-friendly.
--
-- Return shape
-- ------------
-- All three sources project into one wide TABLE row with item_type
-- discriminating which fields are meaningful:
--
--   * item_type='match' → match_* fields populated; title/excerpt/... NULL
--   * item_type='blog'  → title/excerpt/cover_image_url/category populated;
--                         match_* + duration_seconds NULL
--   * item_type='video' → title/description (in excerpt)/thumbnail/category
--                         (= 'short' | 'long')/duration_seconds populated;
--                         match_* NULL
--
-- Composite cursor pagination on (published_at, item_id) — same defensive
-- tiebreaker pattern used by get_trending_feed so two rows sharing the
-- same minute don't get silently dropped at a page boundary.
--
-- IDEMPOTENT — CREATE OR REPLACE FUNCTION + DROP guard for forward compat
-- if the signature ever changes.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_feed_timeline(
  INTEGER, TIMESTAMPTZ, UUID, UUID
);

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
      -- Excerpt fallback chain: editor-set excerpt → meta_description.
      -- Both are TEXT so coalesce works cleanly. meta_description is
      -- NOT NULL on the table (validated by editor flow) so the final
      -- output is never NULL when excerpt is missing.
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
      -- Videos don't have a category, but the timeline card key on this
      -- column to know whether the thumbnail should render 16:9 (long)
      -- or 9:16 (short). Casting the enum to TEXT keeps the UNION shape
      -- consistent with blog rows where category is free-form TEXT.
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
  SELECT *
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
  ORDER BY all_rows.published_at DESC, all_rows.item_id DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_feed_timeline(
  INTEGER, TIMESTAMPTZ, UUID, UUID
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
