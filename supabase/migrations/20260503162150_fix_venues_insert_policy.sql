-- ============================================================================
-- Fix: venues_auth_insert allowed ownership spoofing (Codex bot — PR #4)
-- ============================================================================
-- Bug: original policy in 20260503131017_bet1_social_layer.sql was
--
--   CREATE POLICY "venues_auth_insert" ON venues
--     FOR INSERT TO authenticated WITH CHECK (TRUE);
--
-- TRUE in WITH CHECK means any authenticated user can INSERT a row with
-- created_by set to ANOTHER user's id — spoofing venue ownership. The
-- subsequent venues_creator_update policy (auth.uid() = created_by) then
-- locks the spoofed row to the impersonated user, not the actual creator.
--
-- Fix: tighten WITH CHECK to require created_by = auth.uid(). Drop +
-- recreate so older deployments converge to the correct definition.
-- Idempotent — safe to re-run.
-- ============================================================================

DROP POLICY IF EXISTS "venues_auth_insert" ON public.venues;

CREATE POLICY "venues_auth_insert"
  ON public.venues
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Reload PostgREST schema cache so the corrected policy applies immediately.
NOTIFY pgrst, 'reload schema';
