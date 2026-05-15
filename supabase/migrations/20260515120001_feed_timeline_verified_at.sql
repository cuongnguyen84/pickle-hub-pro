-- ============================================================================
-- Sprint 7 follow-up — get_feed_timeline uses verified_at as recency anchor
-- ============================================================================
-- Companion to 20260515120000_matches_verified_at.sql. Two changes to the
-- function body — same signature, mostly-same return shape:
--
-- 1. match_rows.published_at = COALESCE(m.verified_at, m.played_at)
--    Score / cluster diversity / cursor pagination all flow from
--    published_at, so retargeting that single column shifts the entire
--    feed-recency story to "when this became news" rather than "when
--    the match was scheduled to start".
--
-- 2. RETURNS TABLE gains `match_played_at TIMESTAMPTZ` — the raw
--    m.played_at, populated only for match rows (NULL for blog/video).
--    The card UI consumes this for the displayed timestamp so the
--    visible "5h ago / 2 days ago" label still reflects the actual
--    match time, not the moment we learned about the result.
--
-- Why decouple "published_at" from "displayed time"
-- -------------------------------------------------
-- A match scheduled at 09:00 might get its bracket result scraped at
-- 20:00 the same day (11h delay). Two requirements:
--   * Feed sort: at 20:00 this should surface as fresh news (top of
--     feed). → recency anchor needs to be 20:00 = verified_at.
--   * Card UI: when the user clicks in, the displayed time should read
--     "9:00 AM today" because that's when the match was played.
--     → display field needs to be played_at.
-- Splitting `published_at` (sort key) from `match_played_at` (display
-- key) lets both requirements coexist without a new RPC.
--
-- Backfill semantics
-- ------------------
-- COALESCE means rows whose verified_at is NULL (legacy verified matches
-- + community matches + retroactively-imported completed pro tour
-- matches) fall back to played_at. No regression for those — the feed
-- behavior for legacy rows is unchanged. Only pending→verified flips
-- going forward gain the new freshness boost.
--
-- IDEMPOTENT — CREATE OR REPLACE FUNCTION. Same Phase 1 + 1.5 signature
-- (INTEGER, DOUBLE PRECISION, UUID, UUID); the function-call surface
-- expands only via the new return column.
-- ============================================================================

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
  -- Sprint 7 follow-up — actual match start time, decoupled from the
  -- published_at recency anchor so the card UI can show "when it
  -- happened" while the feed sorts by "when we learned about it".
  match_played_at      TIMESTAMPTZ,
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
      -- Recency anchor: "when this became news". COALESCE falls back to
      -- played_at for legacy rows (verified_at NULL), preserving the
      -- pre-Sprint-7 behavior for everything that landed before the
      -- pending→verified flip path started recording verified_at.
      COALESCE(m.verified_at, m.played_at)                   AS published_at,
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
      -- Display anchor: literal scheduled/actual match time. Card UI
      -- reads this for the "5h ago" label so users see when the match
      -- was played, not when we scraped the result.
      m.played_at                                            AS match_played_at,
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
      AND COALESCE(m.verified_at, m.played_at) >= (SELECT ts FROM window_start)
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
      -- Blog rows have no scheduled-vs-published distinction; the card
      -- just renders b.published_at, which is what published_at already
      -- holds, so match_played_at stays NULL.
      NULL::TIMESTAMPTZ                                      AS match_played_at,
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
      NULL::TIMESTAMPTZ                                      AS match_played_at,
      'video:' || vid.id::TEXT                               AS _cluster_key
    FROM public.videos vid
    WHERE vid.status = 'published'
      AND vid.published_at IS NOT NULL
      AND vid.published_at >= (SELECT ts FROM window_start)
  ),
  scored_rows AS (
    SELECT
      *,
      -- Phase 1 score — identical formula. published_at now includes
      -- the verified_at boost for matches, which is the entire point of
      -- this migration: a freshly-flipped row gets a fresh recency_decay.
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
    match_played_at,
    title,
    excerpt,
    cover_image_url,
    category,
    duration_seconds
  FROM final_rows
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

NOTIFY pgrst, 'reload schema';
