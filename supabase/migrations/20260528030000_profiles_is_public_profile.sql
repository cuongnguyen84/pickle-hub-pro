-- ============================================================================
-- profiles.is_public_profile — opt-in flag for public surfaces
-- ----------------------------------------------------------------------------
-- Sprint A1 (2026-05-27).
--
-- Backfill policy (Option A, locked 2026-05-27 by Cuong):
--   - Default for new rows: FALSE
--   - Backfill TRUE for users with onboarding_completed_at IS NOT NULL
--     AND is_ghost = false AND username IS NOT NULL → preserves SEO and
--     existing indexed /nguoi-choi/:username pages.
--
-- Downstream filters added in the same PR:
--   - usePlayerProfile hook → `is_public_profile = true OR id = auth.uid()`
--   - renderPlayer SSR (bots only) → `is_public_profile = true`
--   - dupr_leaderboard_vietnam RPC → `AND is_public_profile = true`
--   - dupr_players_near_rating RPC → `AND is_public_profile = true`
--   - sitemap-players.xml → `AND is_public_profile = true`
--
-- A separate UI surface (Account → Quyền riêng tư toggle) lets users flip
-- the flag at any time. delete-account edge function already handles full
-- deletion if the user revokes consent entirely.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_public_profile IS
  'Sprint A1 (2026-05-27). Opt-in flag — when true, /nguoi-choi/:username is publicly accessible, profile surfaces in dupr_leaderboard_vietnam + dupr_players_near_rating + sitemap-players.xml. Backfill 2026-05-27 set true for all then-onboarded non-ghost users to preserve SEO. New users default false; flip via Account → Quyền riêng tư.';

-- ─── Backfill (Option A) ────────────────────────────────────────────────────
-- This UPDATE is idempotent — re-running is a no-op once values are set.
UPDATE public.profiles
SET is_public_profile = true
WHERE onboarding_completed_at IS NOT NULL
  AND is_ghost = false
  AND username IS NOT NULL
  AND is_public_profile = false;

-- ─── Index ──────────────────────────────────────────────────────────────────
-- Partial index since the vast majority of rows will eventually be false
-- (new users opt-in over time). Speeds up the public-surface queries that
-- always filter `WHERE is_public_profile = true`.
CREATE INDEX IF NOT EXISTS idx_profiles_is_public_profile
  ON public.profiles (id)
  WHERE is_public_profile = true;
