-- ============================================================================
-- Sprint 6 PR-D — pro-tour boost in get_trending_feed + return shape
-- ============================================================================
-- Two changes to the trending RPC, kept in one migration because they
-- touch the same function body:
--
-- 1. Pro tour matches (source_provider <> 'community') get pinned to the
--    TOP of the trending feed. The current sort blends recency + kudos +
--    comments; pro tour matches have ghost participants and zero
--    organic engagement, so under the unmodified formula they sink
--    below freshly-played community matches with even one kudo.
--
--    Implementation: add p_pro_boost (default 1000) to the score for
--    rows where source_provider <> 'community'. 1000 is large enough
--    that no realistic community match (max ~ 100 kudos × 3 + 50
--    comments × 5 + 1.0 recency = 551) outranks a pro match within
--    the 7-day window. Tunable via the param if a tournament organiser
--    wants to lower the boost.
--
--    Cursor pagination caveat: the existing cursor uses played_at
--    (not score), so the page-2 fetch may include matches whose score
--    would have placed them on page 1. That's a pre-existing weakness
--    of the trending RPC, NOT new with this migration; documenting it
--    here so future-self doesn't think the boost broke pagination.
--
-- 2. Add source_provider, source_url, tournament_name, tournament_event,
--    round_name to the RETURNS TABLE so the FeedMatchCard can render
--    "PPA Tour: 2026 PPA Finals" tournament chips. The hook
--    src/hooks/social/useTrendingFeed.ts already destructures these
--    fields with fallback defaults, so missing them was silent — this
--    migration wires them through.
--
-- Function signature CHANGES (added p_pro_boost). Drop+recreate so
-- PostgREST picks up the new arity. Callers pass via named params so
-- the new default doesn't break existing call sites.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_trending_feed(
  INT, TIMESTAMPTZ, UUID, UUID, INT, INT, INT
);

CREATE OR REPLACE FUNCTION public.get_trending_feed(
  p_limit                INT DEFAULT 20,
  p_cursor_played_at     TIMESTAMPTZ DEFAULT NULL,
  p_cursor_match_id      UUID DEFAULT NULL,
  p_viewer_id            UUID DEFAULT NULL,
  p_kudos_weight         INT DEFAULT 3,
  p_comments_weight      INT DEFAULT 5,
  p_recency_decay_hours  INT DEFAULT 168,
  p_pro_boost            INT DEFAULT 1000
)
RETURNS TABLE (
  match_id            UUID,
  slug                TEXT,
  played_at           TIMESTAMPTZ,
  format              TEXT,
  match_type          TEXT,
  verification_status TEXT,
  venue_name          TEXT,
  team_a_score        INTEGER[],
  team_b_score        INTEGER[],
  winning_team        TEXT,
  participants        JSONB,
  kudos_count         INT,
  viewer_kudoed       BOOLEAN,
  comment_count       INT,
  -- Sprint 6: pro tour provenance fields. NULL for community matches.
  source_provider     TEXT,
  source_url          TEXT,
  tournament_name     TEXT,
  tournament_event    TEXT,
  round_name          TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.slug,
    m.played_at,
    m.format,
    m.match_type,
    m.verification_status,
    COALESCE(v.name_vi, v.name, m.venue_name_override) AS venue_name,
    m.team_a_score,
    m.team_b_score,
    m.winning_team,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'player_id',    mp.player_id,
        'team',         mp.team,
        'position',     mp.position,
        'username',     pr.username,
        'display_name', pr.display_name,
        'avatar_url',   pr.avatar_url,
        'is_ghost',     pr.is_ghost,
        'dupr_doubles', pr.dupr_doubles
      ) ORDER BY mp.team, mp.position)
      FROM public.match_participants mp
      JOIN public.profiles pr ON pr.id = mp.player_id
      WHERE mp.match_id = m.id
    ) AS participants,
    COALESCE(mk.cnt, 0)::INT     AS kudos_count,
    (vmk.user_id IS NOT NULL)    AS viewer_kudoed,
    COALESCE(cc.cnt, 0)::INT     AS comment_count,
    m.source_provider            AS source_provider,
    m.source_url                 AS source_url,
    m.tournament_name            AS tournament_name,
    m.tournament_event           AS tournament_event,
    m.round_name                 AS round_name
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
    AND m.played_at >= NOW() - (p_recency_decay_hours::TEXT || ' hours')::INTERVAL
    AND (
      p_cursor_played_at IS NULL
      OR m.played_at < p_cursor_played_at
      OR (
        m.played_at = p_cursor_played_at
        AND p_cursor_match_id IS NOT NULL
        AND m.id < p_cursor_match_id
      )
    )
  ORDER BY
    -- score = (pro_boost when non-community)
    --       + kudos*w_k + comments*w_c + recency_decay
    -- Pro tour matches dominate by p_pro_boost so they pin to the top
    -- of the trending feed regardless of zero organic engagement on
    -- ghost participants.
    (
      CASE WHEN m.source_provider <> 'community' THEN p_pro_boost ELSE 0 END
      + COALESCE(mk.cnt, 0) * p_kudos_weight
      + COALESCE(cc.cnt, 0) * p_comments_weight
      + EXP(
          -EXTRACT(EPOCH FROM (NOW() - m.played_at))
          / NULLIF(p_recency_decay_hours * 3600.0, 0)
        )
    ) DESC,
    m.played_at DESC,
    m.id DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_feed(
  INT, TIMESTAMPTZ, UUID, UUID, INT, INT, INT, INT
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
