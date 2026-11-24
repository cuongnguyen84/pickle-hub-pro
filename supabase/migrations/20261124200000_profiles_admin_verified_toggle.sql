-- =====================================================================
-- profiles: let site admins flip the is_verified flag (blue tick).
--
-- The AdminUsers screen gains a verified toggle that updates
-- profiles.is_verified from the admin's own session. Two gaps would
-- otherwise make that update fail or silently no-op:
--   1. The only UPDATE policy on profiles is "users update their own
--      profile" (id = auth.uid()) - no admin path for other rows.
--   2. After the PII column lockdown (20260706120000), column-level
--      grants are deliberate; authenticated has no UPDATE grant on
--      is_verified.
-- This migration adds exactly the missing pieces, column-scoped:
-- an UPDATE grant on is_verified alone, plus one admin-only policy.
-- No other profile column becomes writable through this path.
-- =====================================================================

GRANT UPDATE (is_verified) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_update_admin_verified" ON public.profiles;
CREATE POLICY "profiles_update_admin_verified"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
