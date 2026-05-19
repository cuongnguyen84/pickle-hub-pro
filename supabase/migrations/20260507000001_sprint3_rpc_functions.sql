-- ============================================================================
-- Sprint 3 Phase 1 — RPC functions for player profile + search + suggestions
-- ============================================================================
-- Spec: docs picklehub-bet1-spec-v2.md (Tuần 5-6)
-- Branch: feat/social-sprint-3-phase-1
-- Date: 2026-05-07
--
-- 4 RPC functions consumed by Phase 3 UI:
--   - get_player_stats(p_username)        → PlayerHeroCard + PlayerStats panel
--   - get_player_match_history(...)       → MatchHistoryList paginated
--   - search_players(...)                 → PlayerSelector / username collision
--   - get_suggested_follows(...)          → onboarding step 4
--
-- Every function is LANGUAGE sql STABLE with default SECURITY INVOKER (RLS
-- applies). DROP FUNCTION IF EXISTS guards re-runs even if a future migration
-- changes the RETURNS TABLE shape (CREATE OR REPLACE alone fails on shape
-- changes).
-- ============================================================================

-- ─── 1. get_player_stats(p_username) ──────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_player_stats(TEXT);

CREATE OR REPLACE FUNCTION public.get_player_stats(p_username TEXT)
RETURNS TABLE (
  profile_id        UUID,
  total_matches     INTEGER,
  wins              INTEGER,
  losses            INTEGER,
  win_rate          NUMERIC,
  last_5_form       TEXT,
  followers_count   INTEGER,
  following_count   INTEGER,
  current_streak    INTEGER
)
LANGUAGE sql STABLE
AS $$
  WITH p AS (
    SELECT id FROM public.profiles WHERE username = p_username LIMIT 1
  ),
  player_matches AS (
    SELECT
      m.id,
      m.played_at,
      (mp.team = m.winning_team) AS won
    FROM public.matches m
    INNER JOIN public.match_participants mp ON mp.match_id = m.id
    WHERE mp.player_id = (SELECT id FROM p)
      AND m.verification_status = 'verified'
      AND m.is_public = TRUE
  ),
  ordered AS (
    SELECT
      won,
      ROW_NUMBER() OVER (ORDER BY played_at DESC) AS rn
    FROM player_matches
  ),
  totals AS (
    SELECT
      COUNT(*)::INT                                     AS total_matches,
      COUNT(*) FILTER (WHERE won)::INT                  AS wins,
      COUNT(*) FILTER (WHERE NOT won)::INT              AS losses
    FROM player_matches
  ),
  form AS (
    SELECT string_agg(
             CASE WHEN won THEN 'W' ELSE 'L' END,
             '' ORDER BY rn ASC
           ) AS last_5
    FROM (SELECT * FROM ordered WHERE rn <= 5) f
  ),
  follow_counts AS (
    SELECT
      (SELECT COUNT(*)::INT FROM public.social_follows WHERE followed_id = (SELECT id FROM p)) AS followers,
      (SELECT COUNT(*)::INT FROM public.social_follows WHERE follower_id = (SELECT id FROM p)) AS following
  ),
  first_match AS (
    SELECT won AS first_won FROM ordered WHERE rn = 1
  ),
  streak AS (
    -- Streak = leading run of identical outcomes from most recent match.
    -- Positive when first match was won (W streak), negative when loss streak,
    -- 0 when no matches.
    SELECT
      CASE
        WHEN (SELECT COUNT(*) FROM ordered) = 0 THEN 0
        WHEN (SELECT first_won FROM first_match) THEN
          COALESCE(
            (SELECT MIN(rn) - 1 FROM ordered WHERE won = FALSE)::INT,
            (SELECT COUNT(*)::INT FROM ordered)
          )
        ELSE
          -COALESCE(
            (SELECT MIN(rn) - 1 FROM ordered WHERE won = TRUE)::INT,
            (SELECT COUNT(*)::INT FROM ordered)
          )
      END AS current_streak
  )
  SELECT
    (SELECT id FROM p),
    t.total_matches,
    t.wins,
    t.losses,
    CASE WHEN t.total_matches = 0 THEN 0::NUMERIC
         ELSE ROUND((t.wins::NUMERIC / t.total_matches) * 100, 1) END,
    COALESCE(f.last_5, ''),
    fc.followers,
    fc.following,
    s.current_streak
  FROM totals t, form f, follow_counts fc, streak s;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_stats(TEXT) TO anon, authenticated;

-- ─── 2. get_player_match_history(p_player_id, p_limit, p_offset) ──────────
DROP FUNCTION IF EXISTS public.get_player_match_history(UUID, INT, INT);

CREATE OR REPLACE FUNCTION public.get_player_match_history(
  p_player_id UUID,
  p_limit     INT DEFAULT 20,
  p_offset    INT DEFAULT 0
)
RETURNS TABLE (
  match_id          UUID,
  slug              TEXT,
  played_at         TIMESTAMPTZ,
  format            TEXT,
  match_type        TEXT,
  venue_name        TEXT,
  team_a_score      INTEGER[],
  team_b_score      INTEGER[],
  winning_team      TEXT,
  player_team       TEXT,
  player_won        BOOLEAN,
  participants      JSONB
)
LANGUAGE sql STABLE
AS $$
  SELECT
    m.id,
    m.slug,
    m.played_at,
    m.format,
    m.match_type,
    COALESCE(v.name_vi, v.name, m.venue_name_override) AS venue_name,
    m.team_a_score,
    m.team_b_score,
    m.winning_team,
    mp_self.team AS player_team,
    (mp_self.team = m.winning_team) AS player_won,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'player_id',    mp.player_id,
        'team',         mp.team,
        'username',     pr.username,
        'display_name', pr.display_name,
        'avatar_url',   pr.avatar_url,
        'is_ghost',     pr.is_ghost
      ) ORDER BY mp.team, mp.position)
      FROM public.match_participants mp
      JOIN public.profiles pr ON pr.id = mp.player_id
      WHERE mp.match_id = m.id
    ) AS participants
  FROM public.matches m
  INNER JOIN public.match_participants mp_self
    ON mp_self.match_id = m.id AND mp_self.player_id = p_player_id
  LEFT JOIN public.venues v ON v.id = m.venue_id
  WHERE m.is_public = TRUE
    AND m.verification_status IN ('verified', 'pending')
  ORDER BY m.played_at DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1)
  OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_player_match_history(UUID, INT, INT) TO anon, authenticated;

-- ─── 3. search_players(p_query, p_limit, p_exclude_id) ────────────────────
DROP FUNCTION IF EXISTS public.search_players(TEXT, INT, UUID);

CREATE OR REPLACE FUNCTION public.search_players(
  p_query      TEXT,
  p_limit      INT DEFAULT 10,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
  username      TEXT,
  display_name  TEXT,
  avatar_url    TEXT,
  city          TEXT,
  dupr_doubles  NUMERIC,
  is_verified   BOOLEAN,
  is_ghost      BOOLEAN
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id, p.username, p.display_name, p.avatar_url, p.city,
    p.dupr_doubles, p.is_verified, p.is_ghost
  FROM public.profiles p
  WHERE p.username IS NOT NULL
    AND (p_exclude_id IS NULL OR p.id != p_exclude_id)
    AND (
      p.username      ILIKE p_query || '%'
      OR p.display_name ILIKE '%' || p_query || '%'
    )
  ORDER BY
    (p.dupr_doubles IS NOT NULL) DESC,
    p.is_verified DESC,
    p.is_ghost ASC,
    p.dupr_doubles DESC NULLS LAST,
    p.username ASC
  LIMIT GREATEST(LEAST(p_limit, 50), 1);
$$;

GRANT EXECUTE ON FUNCTION public.search_players(TEXT, INT, UUID) TO anon, authenticated;

-- ─── 4. get_suggested_follows(p_viewer_id, p_limit) ───────────────────────
DROP FUNCTION IF EXISTS public.get_suggested_follows(UUID, INT);

CREATE OR REPLACE FUNCTION public.get_suggested_follows(
  p_viewer_id UUID,
  p_limit     INT DEFAULT 10
)
RETURNS TABLE (
  id            UUID,
  username      TEXT,
  display_name  TEXT,
  avatar_url    TEXT,
  city          TEXT,
  dupr_doubles  NUMERIC,
  reason        TEXT
)
LANGUAGE sql STABLE
AS $$
  WITH viewer AS (
    SELECT id, city FROM public.profiles WHERE id = p_viewer_id
  ),
  already_followed AS (
    SELECT followed_id FROM public.social_follows WHERE follower_id = p_viewer_id
  ),
  candidates AS (
    -- 1. played_together (priority 1) — viewer's match opponents/teammates
    SELECT DISTINCT mp.player_id AS id, 'played_together'::TEXT AS reason, 1 AS priority
    FROM public.match_participants mp
    WHERE mp.match_id IN (
      SELECT match_id FROM public.match_participants WHERE player_id = p_viewer_id
    )
    AND mp.player_id != p_viewer_id

    UNION

    -- 2. same_city (priority 2)
    SELECT p.id, 'same_city'::TEXT, 2
    FROM public.profiles p
    INNER JOIN viewer v ON p.city = v.city
    WHERE p.id != p_viewer_id AND p.username IS NOT NULL

    UNION

    -- 3. verified_pro fallback (priority 3) — for sparse cities / new users
    SELECT p.id, 'verified_pro'::TEXT, 3
    FROM public.profiles p
    WHERE p.is_pro = TRUE AND p.username IS NOT NULL AND p.id != p_viewer_id
  ),
  best_reason AS (
    -- Pick lowest priority (= best reason) per candidate profile
    SELECT id, MIN(priority) AS priority,
           (ARRAY_AGG(reason ORDER BY priority ASC))[1] AS reason
    FROM candidates
    GROUP BY id
  )
  SELECT
    p.id, p.username, p.display_name, p.avatar_url, p.city, p.dupr_doubles,
    br.reason
  FROM public.profiles p
  INNER JOIN best_reason br ON br.id = p.id
  WHERE p.id NOT IN (SELECT followed_id FROM already_followed)
    AND p.is_ghost = FALSE
  ORDER BY
    br.priority ASC,
    p.dupr_doubles DESC NULLS LAST
  LIMIT GREATEST(LEAST(p_limit, 30), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_suggested_follows(UUID, INT) TO authenticated;
-- Not granted to anon: feature is logged-in only.

-- ─── Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
