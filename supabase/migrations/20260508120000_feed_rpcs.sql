-- ============================================================================
-- Sprint 4 Phase 4A — Feed RPCs (get_following_feed, get_trending_feed)
-- ============================================================================
-- Read-only feed surface for the new /feed page. Two RPCs, identical return
-- shape so a single React component renders either tab:
--
--   - get_following_feed(p_viewer_id, p_limit, p_cursor_played_at)
--       Authenticated only. Returns matches where viewer or anyone they
--       follow is a participant. Cursor-paginated by played_at DESC.
--
--   - get_trending_feed(p_limit, p_cursor_played_at, p_kudos_weight,
--                        p_comments_weight, p_recency_decay_hours)
--       Public read. Returns the highest-scoring matches in the recency
--       window. Score = engagement * weights + recency decay.
--
-- Phase 4A renders trending as recency-only because match_kudos and
-- match_comments tables don't exist yet (Phase 4B and 4C respectively).
-- The trending RPC accepts the engagement multipliers as parameters today
-- so 4B/4C can ALTER the function body to plug in the JOINs without any
-- call-site changes.
--
-- IDEMPOTENT: DROP FUNCTION IF EXISTS guards on every signature.
-- ============================================================================

-- ─── 1. get_following_feed ───────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_following_feed(UUID, INT, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_following_feed(
  p_viewer_id        UUID,
  p_limit            INT DEFAULT 20,
  p_cursor_played_at TIMESTAMPTZ DEFAULT NULL
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
  participants        JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Following = matches where viewer or any followed_id is a participant.
  -- Viewer's own matches are included (own activity belongs in own feed).
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
    ) AS participants
  FROM public.matches m
  LEFT JOIN public.venues v ON v.id = m.venue_id
  WHERE m.is_public = TRUE
    AND m.verification_status IN ('verified', 'pending', 'disputed')
    AND EXISTS (
      SELECT 1 FROM public.match_participants mp
      WHERE mp.match_id = m.id
        AND mp.player_id IN (SELECT target_id FROM viewer_targets)
    )
    AND (p_cursor_played_at IS NULL OR m.played_at < p_cursor_played_at)
  ORDER BY m.played_at DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_following_feed(UUID, INT, TIMESTAMPTZ)
  TO authenticated;

-- ─── 2. get_trending_feed ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_trending_feed(INT, TIMESTAMPTZ, INT, INT, INT);

CREATE OR REPLACE FUNCTION public.get_trending_feed(
  p_limit                INT DEFAULT 20,
  p_cursor_played_at     TIMESTAMPTZ DEFAULT NULL,
  p_kudos_weight         INT DEFAULT 3,
  p_comments_weight      INT DEFAULT 5,
  p_recency_decay_hours  INT DEFAULT 168    -- 7 days
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
  participants        JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Phase 4A: kudos_count and comment_count are hard-zeroed because the
  -- match_kudos and match_comments tables don't exist yet. The score is
  -- effectively pure recency_decay. When 4B/4C land, REPLACE this function
  -- body with the full LEFT JOIN to those tables and the score will start
  -- to weight engagement automatically — no call-site changes needed.
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
    ) AS participants
  FROM public.matches m
  LEFT JOIN public.venues v ON v.id = m.venue_id
  WHERE m.is_public = TRUE
    AND m.verification_status IN ('verified', 'pending', 'disputed')
    AND m.played_at >= NOW() - (p_recency_decay_hours::TEXT || ' hours')::INTERVAL
    AND (p_cursor_played_at IS NULL OR m.played_at < p_cursor_played_at)
  ORDER BY
    -- score = (kudos * w_k) + (comments * w_c) + recency_decay.
    -- Phase 4A: kudos = comments = 0; recency_decay dominates.
    (
      0 * p_kudos_weight
      + 0 * p_comments_weight
      + EXP(
          -EXTRACT(EPOCH FROM (NOW() - m.played_at))
          / NULLIF(p_recency_decay_hours * 3600.0, 0)
        )
    ) DESC,
    m.played_at DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_feed(INT, TIMESTAMPTZ, INT, INT, INT)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
