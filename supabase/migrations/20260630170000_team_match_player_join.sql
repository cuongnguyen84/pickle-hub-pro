-- ============================================================================
-- Player-initiated team join (MLP team match)
-- ----------------------------------------------------------------------------
-- A logged-in player can add THEMSELVES to any team as a pending, non-captain
-- member. The captain/creator then approves (updates status) or removes them.
-- Players can also withdraw their own pending row.
--
-- The existing "Captain or creator can insert/update/delete roster" policies
-- stay in place — RLS is permissive (OR), so this only widens who may insert
-- their own pending row, never narrows captain/creator control.
-- SELECT is already public ("Roster is publicly viewable").
-- Table-level GRANTs for `authenticated` were added in 20260513000000.
-- ============================================================================

DROP POLICY IF EXISTS "Player can self-join as pending" ON public.team_match_roster;
CREATE POLICY "Player can self-join as pending"
ON public.team_match_roster
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND is_captain = false
  AND status = 'pending'
);

DROP POLICY IF EXISTS "Player can withdraw own roster row" ON public.team_match_roster;
CREATE POLICY "Player can withdraw own roster row"
ON public.team_match_roster
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
