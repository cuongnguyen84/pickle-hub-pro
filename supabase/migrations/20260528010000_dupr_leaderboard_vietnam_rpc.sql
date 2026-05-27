-- ============================================================================
-- dupr_leaderboard_vietnam — Vietnam DUPR leaderboard RPC
-- ----------------------------------------------------------------------------
-- Sprint A6 (2026-05-27) — powers the "Vietnam" scope on /rankings.
--
-- Reads from public.profiles only. Whitelist columns intentionally — no
-- email/phone/dupr_last_error leak through this RPC even with SECURITY
-- DEFINER bypassing RLS.
--
-- Filter chain:
--   * is_ghost = false                      (skip placeholder rows)
--   * onboarding_completed_at IS NOT NULL   (skip half-onboarded users)
--   * country/country_code points to Vietnam OR both NULL (~95% VN userbase)
--   * dupr_doubles/dupr_singles NOT NULL (depending on p_format)
--
-- NOTE: This v1 does NOT support gender (mens/womens split) or age brackets
-- because public.profiles has no `gender` or `birth_year` columns today.
-- Sprint A1 phase will add `profiles.is_public_profile`; a follow-up
-- migration should also add `gender` + `birth_year` to enable richer
-- filtering. The function signature below uses two args only for that
-- reason — extend in a forward-compatible follow-up.
--
-- Also returns plain text columns the UI needs to render a row + link to
-- /nguoi-choi/:username. `dupr_synced_at` lets the UI show a "synced X
-- days ago" badge when the rating is stale.
-- ============================================================================

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
  'Sprint A6 (2026-05-27). Vietnam DUPR leaderboard for the /rankings vietnam scope. Whitelist columns only — no email/phone/dupr_last_error. SECURITY DEFINER + RLS bypass intentional since all returned columns are public-safe. Add is_public_profile filter once Sprint A1 migration lands.';

GRANT EXECUTE ON FUNCTION public.dupr_leaderboard_vietnam(TEXT, INT)
  TO anon, authenticated;

-- ─── Supporting index ───────────────────────────────────────────────────────
-- Partial index speeds up the ORDER BY rating DESC scan when most rows are
-- non-VN or have NULL DUPR. Use CONCURRENTLY in production-like migrations;
-- inside a Supabase migration transaction we cannot, so the runtime hit on
-- ~1700 rows is negligible. If profile count grows past 50k, recreate this
-- index out-of-band with CONCURRENTLY.
CREATE INDEX IF NOT EXISTS idx_profiles_vn_dupr_doubles
  ON public.profiles (dupr_doubles DESC NULLS LAST)
  WHERE is_ghost = false
    AND onboarding_completed_at IS NOT NULL
    AND dupr_doubles IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_vn_dupr_singles
  ON public.profiles (dupr_singles DESC NULLS LAST)
  WHERE is_ghost = false
    AND onboarding_completed_at IS NOT NULL
    AND dupr_singles IS NOT NULL;
