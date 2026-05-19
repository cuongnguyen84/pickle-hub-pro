-- ============================================================================
-- Allow authenticated users to create ghost profiles
-- ----------------------------------------------------------------------------
-- Bet #1 Sprint 2 Phase 3A.3 PlayerSelector lets users invite a teammate by
-- phone number when they don't have a ThePickleHub account yet. We materialize
-- those invitees as ghost rows in profiles (`is_ghost = true`) so we can link
-- match_participants by player_id and surface the placeholder name in feeds.
--
-- Without this policy, RLS only permits self-INSERT (auth.uid() = id), and
-- ghosts have no auth account → blocked. We open a narrow exception:
-- authenticated users may INSERT a row IFF is_ghost = true.
--
-- Real-account creation continues to flow through Supabase Auth + the
-- handle_new_user trigger; nothing about that path changes.
--
-- Idempotent: DROP POLICY IF EXISTS first.
-- ============================================================================

DROP POLICY IF EXISTS "profiles_authenticated_create_ghost" ON public.profiles;

CREATE POLICY "profiles_authenticated_create_ghost"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (is_ghost = TRUE);

NOTIFY pgrst, 'reload schema';
