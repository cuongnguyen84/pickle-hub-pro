-- ============================================================================
-- Match proposal invitations — invite-to-confirm for unregistered opponents
-- ----------------------------------------------------------------------------
-- Growth loop (Phase A): a player logs a match against an opponent who is NOT
-- on ThePickleHub yet. We represent that opponent as a ghost profile slot in
-- the match_proposals.team_*_player_ids array and mint a shareable invite
-- token. The opponent opens the link, signs up, and the redeem edge function
-- swaps the ghost slot for their real user id + records their verification —
-- which flips the proposal to `verified` (creator already auto-verified).
--
-- Mirrors the proven quick_table_partner_invitations pattern (random hex
-- invite_code, redeem-on-accept, supports sign-up at acceptance time).
--
-- Token URLs are bearer credentials → reads go through the SECURITY DEFINER
-- get_match_invite() RPC (anon-callable preview); writes go through the
-- match-invite-redeem edge function (service-role). No client table writes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.match_proposal_invitations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id       uuid NOT NULL REFERENCES public.match_proposals(id) ON DELETE CASCADE,
  -- The placeholder ghost profile occupying the opponent's slot in the
  -- proposal player array. Nullable + SET NULL so cleaning up a ghost later
  -- never erases the invitation audit row.
  ghost_profile_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  side              text NOT NULL CHECK (side IN ('A', 'B')),
  invite_code       text NOT NULL UNIQUE
                      DEFAULT encode(extensions.gen_random_bytes(9), 'hex'),
  invited_by        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_user_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status            public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at        timestamptz NOT NULL DEFAULT now(),
  used_at           timestamptz
);

COMMENT ON TABLE public.match_proposal_invitations IS
  'Shareable invite tokens letting an unregistered opponent confirm a match proposal by signing up. Redeemed via the match-invite-redeem edge function which swaps the ghost slot for the new user id and records their verification.';

CREATE INDEX IF NOT EXISTS match_proposal_invitations_proposal_idx
  ON public.match_proposal_invitations (proposal_id);
CREATE INDEX IF NOT EXISTS match_proposal_invitations_inviter_idx
  ON public.match_proposal_invitations (invited_by, created_at DESC);

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.match_proposal_invitations ENABLE ROW LEVEL SECURITY;

-- Inviter + redeemer + match participants can read their invitations (so the
-- sharer can re-copy the link, and the redeemer can see it post-accept). The
-- public token preview does NOT rely on this — it uses get_match_invite()
-- (SECURITY DEFINER) so an anonymous visitor can read just the preview.
DROP POLICY IF EXISTS match_proposal_invitations_select
  ON public.match_proposal_invitations;
CREATE POLICY match_proposal_invitations_select
  ON public.match_proposal_invitations
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = invited_by
    OR auth.uid() = invited_user_id
    OR EXISTS (
      SELECT 1 FROM public.match_proposals mp
      WHERE mp.id = proposal_id
        AND (
          auth.uid() = mp.created_by
          OR auth.uid() = ANY (mp.team_a_player_ids)
          OR auth.uid() = ANY (mp.team_b_player_ids)
        )
    )
  );

-- No client INSERT/UPDATE/DELETE — creation + redemption run through the
-- match-proposal / match-invite-redeem edge functions (service-role).

GRANT SELECT ON public.match_proposal_invitations TO authenticated;

-- ─── get_match_invite — anon-callable token preview ────────────────────────
-- Returns a single JSON object describing the invitation + its match so the
-- public /match/confirm/:code page can render a preview without auth. The
-- token (p_code) is the bearer credential; we only expose display-safe data
-- (names, scores, date) — never emails, phones, or user ids beyond what the
-- inviter chose to surface.
CREATE OR REPLACE FUNCTION public.get_match_invite(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv   public.match_proposal_invitations%ROWTYPE;
  v_mp    public.match_proposals%ROWTYPE;
  v_result jsonb;
  v_expired boolean;
BEGIN
  SELECT * INTO v_inv
  FROM public.match_proposal_invitations
  WHERE invite_code = p_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_mp
  FROM public.match_proposals
  WHERE id = v_inv.proposal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_expired := v_inv.expires_at <= now();

  SELECT jsonb_build_object(
    'found', true,
    'invite_code', v_inv.invite_code,
    'status', v_inv.status,
    'expired', v_expired,
    'side', v_inv.side,
    'proposal_id', v_mp.id,
    'match_status', v_mp.status,
    'format', v_mp.format,
    'match_date', v_mp.match_date,
    'location', v_mp.location,
    'team_a_scores', v_mp.team_a_scores,
    'team_b_scores', v_mp.team_b_scores,
    'inviter', (
      SELECT jsonb_build_object('display_name', p.display_name, 'avatar_url', p.avatar_url)
      FROM public.profiles p WHERE p.id = v_inv.invited_by
    ),
    'slot_name', (
      SELECT p.display_name FROM public.profiles p WHERE p.id = v_inv.ghost_profile_id
    ),
    'team_a', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('display_name', p.display_name, 'avatar_url', p.avatar_url) ORDER BY ord), '[]'::jsonb)
      FROM unnest(v_mp.team_a_player_ids) WITH ORDINALITY AS t(pid, ord)
      LEFT JOIN public.profiles p ON p.id = t.pid
    ),
    'team_b', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('display_name', p.display_name, 'avatar_url', p.avatar_url) ORDER BY ord), '[]'::jsonb)
      FROM unnest(v_mp.team_b_player_ids) WITH ORDINALITY AS t(pid, ord)
      LEFT JOIN public.profiles p ON p.id = t.pid
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_match_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_match_invite(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
