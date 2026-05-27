-- ============================================================================
-- dupr_players_near_rating — "Players near my DUPR" RPC
-- ----------------------------------------------------------------------------
-- Sprint A11 (2026-05-27) — powers the PlayersNearRating widget on the
-- PlayerProfile sidebar (and any future "find a partner" surface).
--
-- Returns up to N profiles whose dupr_doubles is within ± p_window of
-- p_target_rating, excluding the caller (p_exclude_user_id). Sorted by
-- absolute distance ascending so the closest matches come first.
--
-- Whitelist columns identical to dupr_leaderboard_vietnam — no
-- email/phone/dupr_last_error leak through this RPC even with SECURITY
-- DEFINER bypassing RLS.
--
-- Once Sprint A1 (profiles.is_public_profile) lands, add `AND
-- is_public_profile = true` to the WHERE clause. Until then, the
-- onboarded + non-ghost + has-username filter acts as a proxy for
-- "public-ready" matching the existing /nguoi-choi/:username SSR
-- visibility model.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dupr_players_near_rating(
  p_target_rating    NUMERIC,
  p_window           NUMERIC DEFAULT 0.3,
  p_exclude_user_id  UUID    DEFAULT NULL,
  p_limit            INT     DEFAULT 10
)
RETURNS TABLE (
  user_id        UUID,
  username       TEXT,
  display_name   TEXT,
  avatar_url     TEXT,
  city           TEXT,
  dupr_doubles   NUMERIC,
  dupr_singles   NUMERIC,
  dupr_synced_at TIMESTAMPTZ,
  rating_diff    NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.id            AS user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.city,
    p.dupr_doubles,
    p.dupr_singles,
    p.dupr_synced_at,
    ABS(p.dupr_doubles - p_target_rating) AS rating_diff
  FROM public.profiles p
  WHERE p.is_ghost = false
    AND p.onboarding_completed_at IS NOT NULL
    AND p.username IS NOT NULL
    AND p.dupr_doubles IS NOT NULL
    AND ABS(p.dupr_doubles - p_target_rating) <= p_window
    AND (p_exclude_user_id IS NULL OR p.id <> p_exclude_user_id)
  ORDER BY ABS(p.dupr_doubles - p_target_rating) ASC, p.username ASC
  LIMIT GREATEST(LEAST(p_limit, 50), 1);
$$;

COMMENT ON FUNCTION public.dupr_players_near_rating(NUMERIC, NUMERIC, UUID, INT) IS
  'Sprint A11 (2026-05-27). Find players whose DUPR doubles rating is within ± p_window of p_target_rating. Used by PlayersNearRating widget. Whitelist columns only. SECURITY DEFINER + RLS bypass intentional since all returned columns are public-safe.';

GRANT EXECUTE ON FUNCTION public.dupr_players_near_rating(NUMERIC, NUMERIC, UUID, INT)
  TO anon, authenticated;
