-- ============================================================================
-- Sprint 6 follow-up — two-tier feed ordering for pro tour recency
-- ============================================================================
-- Problem: the p_pro_boost=1000 blended score in 20260511120000 pins pro
-- tour rows above community rows, but all pro tour matches share the same
-- boost baseline so they sort by the recency_decay term (a float 0–1).
-- Two tournaments ingested on the same day produce near-identical decay
-- values, and m.id tiebreak randomises which event the user sees first.
-- Newer pro tour events should appear above older ones, in a stable order.
--
-- Fix: replace the single blended ORDER BY with a two-tier sort:
--   Tier 1: pro tour rows (source_provider <> 'community') → sort key 0
--           community rows                                 → sort key 1
--   Tier 2: within pro tour  → EXTRACT(EPOCH FROM played_at) DESC (newest first)
--           within community → engagement score DESC (existing formula, minus boost)
--   Tiebreak: m.id DESC (stable across pages)
--
-- p_pro_boost is kept in the signature unchanged for backward compatibility
-- (existing call sites pass it by name). It is now a no-op in the body.
--
-- No change to function signature, RETURNS TABLE, cursor pagination logic,
-- WHERE clause, or any other part of the function body.
-- No new GRANTs needed — existing GRANT from 20260511120000 covers this.
-- ============================================================================

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
    -- Tier 1: pro tour rows always above community rows
    CASE WHEN m.source_provider <> 'community' THEN 0 ELSE 1 END,
    -- Tier 2: within pro tour → newest played_at first (epoch is stable across pages);
    --         within community → engagement score DESC (same formula, minus retired boost)
    CASE
      WHEN m.source_provider <> 'community'
        THEN EXTRACT(EPOCH FROM m.played_at)
      ELSE (
        COALESCE(mk.cnt, 0) * p_kudos_weight
        + COALESCE(cc.cnt, 0) * p_comments_weight
        + EXP(
            -EXTRACT(EPOCH FROM (NOW() - m.played_at))
            / NULLIF(p_recency_decay_hours * 3600.0, 0)
          )
      )
    END DESC,
    m.id DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1);
$$;

NOTIFY pgrst, 'reload schema';
