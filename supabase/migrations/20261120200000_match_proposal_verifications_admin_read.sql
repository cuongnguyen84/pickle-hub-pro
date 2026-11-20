-- Site admins need to read every match_proposal_verifications row.
--
-- The 20260730100000 sweep only lets public.is_admin() through when the
-- parent proposal has club_id IS NULL, so a site admin who is not a player
-- or a club DIRECTOR/ORGANIZER sees no verification rows for club matches,
-- and the /match page shows every player as "not confirmed" even after
-- they verified (follow-up to PR #1056).
--
-- This migration recreates the SELECT policy with one added top-level
-- branch: public.is_admin() - the repo-standard database admin check
-- (user_roles role 'admin' behind the AAL2 guard) - may read all rows.
-- Every existing branch is kept verbatim, so nobody loses access; no
-- write policy and no other table is touched. Idempotent: DROP POLICY
-- IF EXISTS + CREATE POLICY, safe to run more than once.

DROP POLICY IF EXISTS "match_proposal_verifications_select" ON public.match_proposal_verifications;
CREATE POLICY "match_proposal_verifications_select" ON public.match_proposal_verifications
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR auth.uid() = player_user_id
    OR EXISTS (
      SELECT 1 FROM public.match_proposals mp
      WHERE mp.id = match_proposal_verifications.proposal_id
        AND (
          auth.uid() = mp.created_by
          OR auth.uid() = ANY (mp.team_a_player_ids)
          OR auth.uid() = ANY (mp.team_b_player_ids)
          OR (mp.club_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.dupr_user_clubs uc
            WHERE uc.user_id = auth.uid()
              AND uc.club_id = mp.club_id
              AND uc.role = ANY (ARRAY['DIRECTOR'::text, 'ORGANIZER'::text])
              AND uc.expires_at > now()
          ))
          OR (mp.club_id IS NULL AND (
            public.is_admin()
            OR EXISTS (
              SELECT 1 FROM public.user_roles ur
              WHERE ur.user_id = auth.uid() AND ur.role = 'creator'::app_role
            )
          ))
        )
    )
  );