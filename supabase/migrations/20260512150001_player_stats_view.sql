-- ============================================================================
-- Social Events MVP — PR53: player_stats view
-- ============================================================================
-- Aggregate per-player stats over completed matches + non-cancelled
-- registrations. Regular view (not materialized) — the table sizes are
-- small enough that the cost is negligible and we get zero-lag updates
-- as matches complete. If/when the social event base grows past ~100K
-- rows we can swap this for a materialized view + refresh trigger.
--
-- A wins-or-losses mismatch is possible if `winning_team` is null on a
-- completed match (defensive: the atomic-submit RPC sets winning_team
-- on every transition to 'completed', so `null` only happens via a
-- direct DB write). Such matches count toward matches_played but not
-- toward wins or losses — which matches how computeStandings() handles
-- the same edge case on the client.
--
-- IDEMPOTENT: CREATE OR REPLACE.
-- ============================================================================

CREATE OR REPLACE VIEW public.player_stats AS
WITH match_results AS (
  SELECT
    p.id AS player_id,
    m.id AS match_id,
    CASE
      WHEN (m.winning_team = 'a'
            AND (m.team_a_player1_id = p.id OR m.team_a_player2_id = p.id))
        OR (m.winning_team = 'b'
            AND (m.team_b_player1_id = p.id OR m.team_b_player2_id = p.id))
      THEN 1 ELSE 0
    END AS is_win,
    CASE
      WHEN (m.winning_team = 'b'
            AND (m.team_a_player1_id = p.id OR m.team_a_player2_id = p.id))
        OR (m.winning_team = 'a'
            AND (m.team_b_player1_id = p.id OR m.team_b_player2_id = p.id))
      THEN 1 ELSE 0
    END AS is_loss
  FROM public.profiles p
  JOIN public.social_event_matches m ON (
    m.status = 'completed'
    AND (
      m.team_a_player1_id = p.id OR m.team_a_player2_id = p.id
      OR m.team_b_player1_id = p.id OR m.team_b_player2_id = p.id
    )
  )
),
registration_counts AS (
  SELECT
    er.profile_id AS player_id,
    COUNT(DISTINCT er.event_id) AS events_played
  FROM public.event_registrations er
  WHERE er.status <> 'cancelled'
    AND er.profile_id IS NOT NULL
  GROUP BY er.profile_id
)
SELECT
  p.id AS player_id,
  p.display_name,
  p.is_ghost,
  COALESCE(rc.events_played, 0) AS events_played,
  COALESCE(mr.matches_played, 0) AS matches_played,
  COALESCE(mr.wins, 0) AS wins,
  COALESCE(mr.losses, 0) AS losses
FROM public.profiles p
LEFT JOIN registration_counts rc ON rc.player_id = p.id
LEFT JOIN (
  SELECT
    player_id,
    COUNT(*) AS matches_played,
    SUM(is_win) AS wins,
    SUM(is_loss) AS losses
  FROM match_results
  GROUP BY player_id
) mr ON mr.player_id = p.id;

GRANT SELECT ON public.player_stats TO anon;
GRANT SELECT ON public.player_stats TO authenticated;

COMMENT ON VIEW public.player_stats IS
  'Per-player aggregate over completed matches + non-cancelled registrations. Regular (not materialized) view — refresh-free. See migration 20260512150001.';
