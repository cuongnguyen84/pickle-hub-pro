-- ============================================================================
-- RPCs gated by profiles.is_public_profile
-- ----------------------------------------------------------------------------
-- Sprint A2 (2026-05-27). Re-CREATE OR REPLACE the two public-facing RPCs
-- (dupr_leaderboard_vietnam + dupr_players_near_rating) to add the
-- `is_public_profile = true` opt-in gate. Both functions are SECURITY
-- DEFINER + whitelist columns; this gate enforces user consent before
-- the row appears on any public surface.
--
-- Idempotent — CREATE OR REPLACE is safe on either fresh DB or one
-- where Sprint A6/A11 migrations already ran.
-- ============================================================================

-- ─── dupr_leaderboard_vietnam (Sprint A6 → A2 update) ───────────────────────

CREATE OR REPLACE FUNCTION public.dupr_leaderboard_vietnam(
  p_format TEXT DEFAULT 'doubles',  -- 'singles' | 'doubles'
  p_limit  INT  DEFAULT 100
)
RETURNS TABLE (
  rank           BIGINT,
  user_id        UUID,
  username       TEXT,
  display_name   TEXT,
  avatar_url     TEXT,
  city           TEXT,
  dupr_rating    NUMERIC,
  dupr_synced_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH ranked AS (
    SELECT
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      p.city,
      CASE WHEN p_format = 'singles' THEN p.dupr_singles ELSE p.dupr_doubles END AS rating,
      p.dupr_synced_at
    FROM public.profiles p
    WHERE p.is_ghost = false
      AND p.onboarding_completed_at IS NOT NULL
      AND p.username IS NOT NULL
      AND p.is_public_profile = true  -- Sprint A2 opt-in gate
      AND (
        p.country_code = 'VN'
        OR p.country = 'VN'
        OR p.country ILIKE '%viet%'
        OR (p.country_code IS NULL AND p.country IS NULL)
      )
      AND (CASE WHEN p_format = 'singles' THEN p.dupr_singles ELSE p.dupr_doubles END) IS NOT NULL
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY rating DESC NULLS LAST, username ASC) AS rank,
    id           AS user_id,
    username,
    display_name,
    avatar_url,
    city,
    rating       AS dupr_rating,
    dupr_synced_at
  FROM ranked
  ORDER BY rating DESC NULLS LAST, username ASC
  LIMIT GREATEST(LEAST(p_limit, 500), 1);
$$;

COMMENT ON FUNCTION public.dupr_leaderboard_vietnam(TEXT, INT) IS
  'Sprint A6 → A2 (2026-05-27). Vietnam DUPR leaderboard. Requires is_public_profile = true (Sprint A2 opt-in). Whitelist columns only.';

-- ─── dupr_players_near_rating (Sprint A11 → A2 update) ──────────────────────

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
    AND p.is_public_profile = true  -- Sprint A2 opt-in gate
    AND p.dupr_doubles IS NOT NULL
    AND ABS(p.dupr_doubles - p_target_rating) <= p_window
    AND (p_exclude_user_id IS NULL OR p.id <> p_exclude_user_id)
  ORDER BY ABS(p.dupr_doubles - p_target_rating) ASC, p.username ASC
  LIMIT GREATEST(LEAST(p_limit, 50), 1);
$$;

COMMENT ON FUNCTION public.dupr_players_near_rating(NUMERIC, NUMERIC, UUID, INT) IS
  'Sprint A11 → A2 (2026-05-27). PlayersNearRating widget data source. Requires is_public_profile = true (Sprint A2 opt-in).';

-- ─── username uniqueness check RPC for onboarding A5 ────────────────────────
-- Called by ProfileSetup as user types a candidate username. Returns
-- TRUE when the slug is available (no row owns it). SECURITY DEFINER
-- because RLS may block bare SELECT on profiles for anonymous callers.

CREATE OR REPLACE FUNCTION public.username_is_available(
  p_candidate TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE LOWER(username) = LOWER(p_candidate)
  );
$$;

COMMENT ON FUNCTION public.username_is_available(TEXT) IS
  'Sprint A5 (2026-05-27). Returns true if no profile owns this username (case-insensitive). Called real-time from ProfileSetup as user types.';

GRANT EXECUTE ON FUNCTION public.username_is_available(TEXT)
  TO anon, authenticated;
