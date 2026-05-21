-- ============================================================================
-- Match proposals — player-initiated matches with admin approval (PR6)
-- ----------------------------------------------------------------------------
-- Flow:
--   1. Any user creates a proposal (`pending_verify`).
--   2. At least one player from side A AND one from side B confirms.
--      Trigger auto-flips status to `verified`. Any player can `disputed`
--      which freezes the proposal.
--   3. A DIRECTOR/ORGANIZER of the proposal's club_id approves
--      (status → `approved` then `submitted` after DUPR call) or rejects.
--
-- Only matches with a club_id can be submitted to DUPR — DUPR requires
-- "tournament directors, admins, or designated match owners" to be the
-- submitter; club ORGANIZER/DIRECTOR is the cleanest mapping. Non-club
-- matches stay local-only for now.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.match_proposal_status AS ENUM (
    'pending_verify',
    'verified',
    'approved',
    'rejected',
    'disputed',
    'submitted'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.match_proposals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  club_id             bigint NOT NULL,    -- DUPR clubId — required for the approval path
  format              text NOT NULL CHECK (format IN ('SINGLES', 'DOUBLES')),
  match_type          text NOT NULL DEFAULT 'SIDEOUT'
                       CHECK (match_type IN ('SIDEOUT', 'RALLY')),
  match_date          date NOT NULL,
  location            text,
  event               text,
  bracket             text,
  team_a_player_ids   uuid[] NOT NULL,
  team_b_player_ids   uuid[] NOT NULL,
  team_a_scores       int[] NOT NULL,
  team_b_scores       int[] NOT NULL,
  status              public.match_proposal_status NOT NULL DEFAULT 'pending_verify',
  status_changed_at   timestamptz NOT NULL DEFAULT now(),
  dupr_match_code     text,
  dupr_identifier     text,
  approved_by         uuid REFERENCES public.profiles(id),
  approved_at         timestamptz,
  rejected_by         uuid REFERENCES public.profiles(id),
  rejected_at         timestamptz,
  rejection_reason    text,
  created_at          timestamptz NOT NULL DEFAULT now(),

  -- Shape integrity
  CHECK (
    (format = 'SINGLES' AND array_length(team_a_player_ids, 1) = 1
                          AND array_length(team_b_player_ids, 1) = 1)
    OR
    (format = 'DOUBLES' AND array_length(team_a_player_ids, 1) = 2
                          AND array_length(team_b_player_ids, 1) = 2)
  ),
  CHECK (array_length(team_a_scores, 1) BETWEEN 1 AND 5),
  CHECK (array_length(team_b_scores, 1) = array_length(team_a_scores, 1))
);

COMMENT ON TABLE public.match_proposals IS
  'Player-initiated match records pending peer verification + admin approval before push to DUPR. Only club matches (club_id NOT NULL) reach the DUPR submission step.';

CREATE INDEX IF NOT EXISTS match_proposals_status_idx
  ON public.match_proposals (status, status_changed_at DESC);
CREATE INDEX IF NOT EXISTS match_proposals_creator_idx
  ON public.match_proposals (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS match_proposals_club_idx
  ON public.match_proposals (club_id, status);

-- ─── match_proposal_verifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.match_proposal_verifications (
  proposal_id      uuid NOT NULL REFERENCES public.match_proposals(id) ON DELETE CASCADE,
  player_user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  side             text NOT NULL CHECK (side IN ('A', 'B')),
  verified_at      timestamptz,
  disputed_at      timestamptz,
  dispute_reason   text,
  CHECK ((verified_at IS NOT NULL) <> (disputed_at IS NOT NULL)),
  PRIMARY KEY (proposal_id, player_user_id)
);

COMMENT ON TABLE public.match_proposal_verifications IS
  'Per-player verify/dispute log for match proposals. side is the team this player belongs to. Either verified_at or disputed_at is set, never both.';

CREATE INDEX IF NOT EXISTS match_proposal_verifications_player_idx
  ON public.match_proposal_verifications (player_user_id);

-- ─── Trigger: auto-promote status ──────────────────────────────────────────
-- Rule (Cuong's pick): ≥1 verify from side A AND ≥1 verify from side B,
-- with no outstanding disputes. Singles → exactly 1+1 needed; doubles →
-- partner approval implied.
CREATE OR REPLACE FUNCTION public.tg_match_proposal_recompute_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_verified_a int;
  v_verified_b int;
  v_disputes int;
BEGIN
  -- Skip if proposal has already moved past the verification window.
  SELECT mp.status INTO v_status
  FROM public.match_proposals mp
  WHERE mp.id = COALESCE(NEW.proposal_id, OLD.proposal_id);

  IF v_status NOT IN ('pending_verify', 'verified', 'disputed') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    count(*) FILTER (WHERE verified_at IS NOT NULL AND side = 'A'),
    count(*) FILTER (WHERE verified_at IS NOT NULL AND side = 'B'),
    count(*) FILTER (WHERE disputed_at IS NOT NULL)
  INTO v_verified_a, v_verified_b, v_disputes
  FROM public.match_proposal_verifications
  WHERE proposal_id = COALESCE(NEW.proposal_id, OLD.proposal_id);

  IF v_disputes > 0 THEN
    UPDATE public.match_proposals
       SET status = 'disputed', status_changed_at = now()
     WHERE id = COALESCE(NEW.proposal_id, OLD.proposal_id)
       AND status <> 'disputed';
  ELSIF v_verified_a >= 1 AND v_verified_b >= 1 THEN
    UPDATE public.match_proposals
       SET status = 'verified', status_changed_at = now()
     WHERE id = COALESCE(NEW.proposal_id, OLD.proposal_id)
       AND status = 'pending_verify';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_match_proposal_recompute_status
  ON public.match_proposal_verifications;
CREATE TRIGGER trg_match_proposal_recompute_status
  AFTER INSERT OR UPDATE OR DELETE
  ON public.match_proposal_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_match_proposal_recompute_status();

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.match_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_proposal_verifications ENABLE ROW LEVEL SECURITY;

-- Self-read: player can see proposals they're in or club-admins of theirs.
-- The club-admin check leans on dupr_user_clubs (24h cached). Fresh cache
-- assumed — callers can force-refresh via dupr-clubs?force=1.
DROP POLICY IF EXISTS match_proposals_select ON public.match_proposals;
CREATE POLICY match_proposals_select
  ON public.match_proposals
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = ANY (team_a_player_ids)
    OR auth.uid() = ANY (team_b_player_ids)
    OR EXISTS (
      SELECT 1 FROM public.dupr_user_clubs uc
      WHERE uc.user_id = auth.uid()
        AND uc.club_id = match_proposals.club_id
        AND uc.role IN ('DIRECTOR', 'ORGANIZER')
        AND uc.expires_at > now()
    )
  );

-- Insert: any authenticated user (we trust the edge function to validate).
-- Direct table inserts bypass the edge fn; use it for the validation chain.
-- For now grant insert + restrict via column check (created_by = auth.uid()).
DROP POLICY IF EXISTS match_proposals_self_insert ON public.match_proposals;
CREATE POLICY match_proposals_self_insert
  ON public.match_proposals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- No client UPDATE/DELETE — only edge fn (service-role) mutates.

-- Verifications: player can see verifications for proposals they're in.
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
          OR EXISTS (
            SELECT 1 FROM public.dupr_user_clubs uc
            WHERE uc.user_id = auth.uid()
              AND uc.club_id = mp.club_id
              AND uc.role IN ('DIRECTOR', 'ORGANIZER')
              AND uc.expires_at > now()
          )
        )
    )
  );

-- Verifications writes go through the edge function (service-role).

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON public.match_proposals TO authenticated;
GRANT SELECT ON public.match_proposal_verifications TO authenticated;

NOTIFY pgrst, 'reload schema';
