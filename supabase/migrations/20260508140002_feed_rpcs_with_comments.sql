-- ============================================================================
-- Sprint 4 Phase 4C — Feed RPCs activate comment engagement weighting
-- ============================================================================
-- Replaces both feed RPC bodies (Phase 4B → Phase 4C). Adds:
--   1. comment_count INT in the return TABLE
--   2. LEFT JOIN LATERAL on social_comments WHERE target_type='match'
--      AND is_deleted = FALSE
--   3. Trending score formula now factors comments — was hardcoded 0:
--        score = (kudos * w_k) + (comments * w_c) + recency_decay
--      Both kudos and comments contribute now; Phase 4B's structure for
--      the formula is preserved, only the placeholder is replaced.
--
-- Function signatures unchanged from Phase 4B — same Args, the only
-- additive change is one new return column. Existing call sites stay
-- compatible because supabase-js maps by column name on RETURNS TABLE.
--
-- IDEMPOTENT: DROP FUNCTION IF EXISTS guards.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_following_feed(UUID, INT, TIMESTAMPTZ, UUID);
DROP FUNCTION IF EXISTS public.get_trending_feed(INT, TIMESTAMPTZ, UUID, UUID, INT, INT, INT);

-- ─── 1. get_following_feed ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_following_feed(
  p_viewer_id        UUID,
  p_limit            INT DEFAULT 20,
  p_cursor_played_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_match_id  UUID DEFAULT NULL
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
  comment_count       INT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH viewer_targets AS (
    SELECT followed_id AS target_id FROM public.social_follows
    WHERE follower_id = p_viewer_id
    UNION
    SELECT p_viewer_id AS target_id
  )
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
    COALESCE(cc.cnt, 0)::INT     AS comment_count
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
    AND EXISTS (
      SELECT 1 FROM public.match_participants mp
      WHERE mp.match_id = m.id
        AND mp.player_id IN (SELECT target_id FROM viewer_targets)
    )
    AND (
      p_cursor_played_at IS NULL
      OR m.played_at < p_cursor_played_at
      OR (
        m.played_at = p_cursor_played_at
        AND p_cursor_match_id IS NOT NULL
        AND m.id < p_cursor_match_id
      )
    )
  ORDER BY m.played_at DESC, m.id DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_following_feed(UUID, INT, TIMESTAMPTZ, UUID)
  TO authenticated;

-- ─── 2. get_trending_feed ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_trending_feed(
  p_limit                INT DEFAULT 20,
  p_cursor_played_at     TIMESTAMPTZ DEFAULT NULL,
  p_cursor_match_id      UUID DEFAULT NULL,
  p_viewer_id            UUID DEFAULT NULL,
  p_kudos_weight         INT DEFAULT 3,
  p_comments_weight      INT DEFAULT 5,
  p_recency_decay_hours  INT DEFAULT 168
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
  comment_count       INT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Phase 4C activates comment engagement weighting. Trending score now
  -- factors both kudos AND comments — both placeholders are gone.
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
    COALESCE(cc.cnt, 0)::INT     AS comment_count
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
    -- score = kudos*w_k + comments*w_c + recency_decay
    -- Phase 4C: both engagement signals active.
    (
      COALESCE(mk.cnt, 0) * p_kudos_weight
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

GRANT EXECUTE ON FUNCTION public.get_trending_feed(INT, TIMESTAMPTZ, UUID, UUID, INT, INT, INT)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
