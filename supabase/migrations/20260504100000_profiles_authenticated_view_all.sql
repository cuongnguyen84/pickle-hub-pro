-- ============================================================================
-- profiles RLS: allow authenticated to view all (basic info)
-- ----------------------------------------------------------------------------
-- Bet #1 Sprint 2 Phase 3A E2E uncovered that authenticated users could not
-- search other users (PlayerSelector returned 0 results for any query).
--
-- Root cause: the existing SELECT policies on profiles were:
--   1. "Anon can view basic profile info"  TO anon  USING (true)        ← anon ONLY
--   2. "Users can view own full profile"   TO authenticated  USING (auth.uid()=id)
--   3. "Users can view their own profile"  PUBLIC  USING (id=auth.uid() OR is_admin())
--
-- Authenticated callers therefore matched only #2 + #3 (both self-only).
-- Anon callers (no JWT) saw all rows via #1, but the wizard runs while logged
-- in so it always failed.
--
-- Fix: mirror the anon public-read policy for authenticated. Same disclosure
-- level as anon already has, just for the role the social wizard actually uses.
-- Idempotent (DROP POLICY IF EXISTS first).
-- ============================================================================

DROP POLICY IF EXISTS "profiles_authenticated_view_all" ON public.profiles;

CREATE POLICY "profiles_authenticated_view_all"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (TRUE);

NOTIFY pgrst, 'reload schema';
