-- ============================================================================
-- match_proposals — club_id becomes optional (matchSource=PARTNER support)
-- ----------------------------------------------------------------------------
-- DUPR docs (Developer FAQ): valid `matchSource` values are CLUB or PARTNER.
-- For PARTNER submissions the clubId is OMITTED. Original PR6 forced
-- club_id NOT NULL — too strict. Now:
--   - club_id NULL → matchSource=PARTNER, approval by user_roles
--     ∈ ('admin','creator')
--   - club_id NOT NULL → matchSource=CLUB, approval by club DIRECTOR/
--     ORGANIZER (existing path)
--
-- RLS broadened: admin/creator user_roles see PARTNER proposals so they
-- can find them in the approval queue.
-- ============================================================================

ALTER TABLE public.match_proposals
  ALTER COLUMN club_id DROP NOT NULL;

COMMENT ON COLUMN public.match_proposals.club_id IS
  'DUPR clubId. NULL = matchSource=PARTNER (approved by ThePickleHub admin/creator). NOT NULL = matchSource=CLUB (approved by club DIRECTOR/ORGANIZER).';

-- ─── RLS: extend SELECT to include admin/creator for PARTNER proposals ────
DROP POLICY IF EXISTS match_proposals_select ON public.match_proposals;
CREATE POLICY match_proposals_select
  ON public.match_proposals
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = ANY (team_a_player_ids)
    OR auth.uid() = ANY (team_b_player_ids)
    OR (
      club_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.dupr_user_clubs uc
        WHERE uc.user_id = auth.uid()
          AND uc.club_id = match_proposals.club_id
          AND uc.role IN ('DIRECTOR', 'ORGANIZER')
          AND uc.expires_at > now()
      )
    )
    OR (
      club_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin', 'creator')
      )
    )
  );

-- Verifications inherit visibility through their proposal — same broaden.
DROP POLICY IF EXISTS match_proposal_verifications_select
  ON public.match_proposal_verifications;
CREATE POLICY match_proposal_verifications_select
  ON public.match_proposal_verifications
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = player_user_id
    OR EXISTS (
      SELECT 1 FROM public.match_proposals mp
      WHERE mp.id = proposal_id
        AND (
          auth.uid() = mp.created_by
          OR auth.uid() = ANY (mp.team_a_player_ids)
          OR auth.uid() = ANY (mp.team_b_player_ids)
          OR (
            mp.club_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.dupr_user_clubs uc
              WHERE uc.user_id = auth.uid()
                AND uc.club_id = mp.club_id
                AND uc.role IN ('DIRECTOR', 'ORGANIZER')
                AND uc.expires_at > now()
            )
          )
          OR (
            mp.club_id IS NULL
            AND EXISTS (
              SELECT 1 FROM public.user_roles ur
              WHERE ur.user_id = auth.uid()
                AND ur.role IN ('admin', 'creator')
            )
          )
        )
    )
  );

NOTIFY pgrst, 'reload schema';
