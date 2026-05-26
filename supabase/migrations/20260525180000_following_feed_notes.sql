-- ============================================================================
-- Add `notes` column to get_following_feed return shape
-- ----------------------------------------------------------------------------
-- Codex P1 follow-up on PR #144: FeedMlpMatchCard relies on `match.notes`
-- JSON for team logos + per-game lineups. get_feed_timeline returned it after
-- migration 20260525170000, but get_following_feed didn't — so MLP matchups
-- shown under the Following tab were dropped to the generic FeedMatchCard
-- (the dispatch guard in Feed.tsx now uses `notes` truthiness).
--
-- Mirrors the previous migration's notes-passthrough on the get_feed_timeline
-- return shape. Idempotent via DROP FUNCTION IF EXISTS.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_following_feed(UUID, INT, TIMESTAMPTZ, UUID);

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
  comment_count       INT,
  source_provider     TEXT,
  source_url          TEXT,
  tournament_name     TEXT,
  tournament_event    TEXT,
  round_name          TEXT,
  notes               TEXT
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
    m.id, m.slug, m.played_at, m.format, m.match_type, m.verification_status,
    COALESCE(v.name_vi, v.name, m.venue_name_override) AS venue_name,
    m.team_a_score, m.team_b_score, m.winning_team,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'player_id',    mp.player_id, 'team', mp.team, 'position', mp.position,
        'username',     pr.username, 'display_name', pr.display_name,
        'avatar_url',   pr.avatar_url, 'is_ghost', pr.is_ghost,
        'dupr_doubles', pr.dupr_doubles, 'country_code', pr.country_code
      ) ORDER BY mp.team, mp.position)
      FROM public.match_participants mp
      JOIN public.profiles pr ON pr.id = mp.player_id
      WHERE mp.match_id = m.id
    ) AS participants,
    COALESCE(mk.cnt, 0)::INT AS kudos_count,
    (vmk.user_id IS NOT NULL) AS viewer_kudoed,
    COALESCE(cc.cnt, 0)::INT AS comment_count,
    m.source_provider, m.source_url,
    m.tournament_name, m.tournament_event, m.round_name,
    m.notes
  FROM public.matches m
  LEFT JOIN public.venues v ON v.id = m.venue_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt FROM public.kudos k
    WHERE k.target_type = 'match' AND k.target_id = m.id
  ) mk ON TRUE
  LEFT JOIN public.kudos vmk
    ON vmk.target_type = 'match' AND vmk.target_id = m.id AND vmk.user_id = p_viewer_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt FROM public.social_comments sc
    WHERE sc.target_type = 'match' AND sc.target_id = m.id AND sc.is_deleted = FALSE
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
      OR (m.played_at = p_cursor_played_at AND p_cursor_match_id IS NOT NULL AND m.id < p_cursor_match_id)
    )
  ORDER BY m.played_at DESC, m.id DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_following_feed(UUID, INT, TIMESTAMPTZ, UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
