-- ============================================================================
-- Fix: Feed pagination tiebreaker (Codex P1 on PR #16)
-- ============================================================================
-- The 4A migration (20260508000000_feed_rpcs.sql) cursored on played_at only.
-- When two or more matches share an identical played_at timestamp at the
-- page boundary, the strict-less-than cursor ("WHERE played_at < cursor")
-- causes those rows to be silently skipped — they're not on this page (they
-- equal the boundary, not less than) and they're filtered out of the next
-- page (because the cursor is now < boundary).
--
-- Fix: pagination becomes a (played_at, match_id) composite cursor. The
-- ORDER BY adds id DESC as a stable secondary sort and the WHERE clause
-- uses lexicographic comparison so equal-played_at rows are partitioned
-- by id without dropping any.
--
-- Both RPCs gain p_cursor_match_id parameter. Drop + recreate is required
-- because PostgreSQL function signatures include all parameter types.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_following_feed(UUID, INT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_trending_feed(INT, TIMESTAMPTZ, INT, INT, INT);

-- ─── 1. get_following_feed (with composite cursor) ───────────────────────
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
  participants        JSONB
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

-- ─── 2. get_trending_feed (with composite cursor) ────────────────────────
CREATE OR REPLACE FUNCTION public.get_trending_feed(
  p_limit                INT DEFAULT 20,
  p_cursor_played_at     TIMESTAMPTZ DEFAULT NULL,
  p_cursor_match_id      UUID DEFAULT NULL,
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
  participants        JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Phase 4A: kudos and comments hard-zeroed; effective sort is recency.
  -- Phase 4B/4C will REPLACE this body to JOIN match_kudos / match_comments.
  -- The composite cursor pairs (played_at, id) so equal-played_at rows
  -- partition cleanly across pages.
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
    (
      0 * p_kudos_weight
      + 0 * p_comments_weight
      + EXP(
          -EXTRACT(EPOCH FROM (NOW() - m.played_at))
          / NULLIF(p_recency_decay_hours * 3600.0, 0)
        )
    ) DESC,
    m.played_at DESC,
    m.id DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_feed(INT, TIMESTAMPTZ, UUID, INT, INT, INT)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
