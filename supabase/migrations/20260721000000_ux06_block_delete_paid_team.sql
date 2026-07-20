-- ============================================================================
-- UX-06 increment 6 — refuse to delete a team that has paid.
-- ============================================================================
-- `team_match_teams` carries payment_status / payment_claimed_at /
-- payment_confirmed_at directly on the row (20260701140000). There is no
-- ledger for the team-match branch — `payment_orders.registration_id` is a FK
-- to `event_registrations`, so it only ever covered social events — and there
-- is no refund function anywhere in this repo. Deleting a paid team therefore
-- destroys the ONLY record that the money arrived.
--
-- Why a trigger and not an RPC: RLS grants creators `FOR DELETE` and
-- `20260513000000` grants DELETE to `authenticated`, so the browser can call
-- `.delete()` straight through PostgREST — and does, at
-- src/hooks/useTeamMatchTeams.ts. An RPC would be a polite suggestion any
-- caller can skip: the shipped iOS binary, a stale service-worker cache, a
-- future call site. A BEFORE DELETE trigger is the only guard that covers all
-- of them at once, including the already-released native app (App Store
-- submission is RED-gated, so we cannot push an update to force the fix).
--
-- `team_match_teams.tournament_id` is ON DELETE CASCADE from
-- `team_match_tournaments`, and row triggers fire on cascaded deletes — so
-- this one trigger also blocks "delete the whole tournament", which is the
-- path that actually worries us: quota is 3 tournaments for life (Cuong's
-- intent, confirmed 2026-07-20), so deleting an old tournament is the only way
-- to create a fourth. The product deliberately pushes organizers toward this
-- button; this trigger is what stands between that pressure and someone's
-- payment record.
--
-- Escape hatch is deliberately NOT in the UI. An organizer who is genuinely
-- stuck gets their quota raised by an admin (`set_user_quota`, /admin/users).
-- An organizer who truly means to delete a paid team must first set that
-- team's payment_status back to 'unpaid' — an explicit, separate, auditable
-- act rather than a side effect of a delete they may not have thought through.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.block_delete_paid_team_match_team()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.payment_status IN ('claimed', 'confirmed') THEN
    RAISE EXCEPTION
      'Không thể xoá đội "%" — đội này đã nộp lệ phí (trạng thái: %). Xoá sẽ mất bằng chứng thanh toán và hệ thống không có chức năng hoàn tiền. Nếu thực sự cần xoá, hãy đổi trạng thái thanh toán của đội về "chưa nộp" trước. / Cannot delete team "%" — it has paid (status: %). Deleting would destroy the only record of that payment and there is no refund flow. Set the team payment status back to unpaid first if you really mean to remove it.',
      OLD.team_name, OLD.payment_status, OLD.team_name, OLD.payment_status
      USING ERRCODE = 'PH001';
  END IF;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.block_delete_paid_team_match_team() IS
  'UX-06: refuses DELETE of a team_match_teams row whose payment_status is claimed/confirmed. Raises SQLSTATE PH001. Also fires on cascade from team_match_tournaments, which is the tournament-delete path.';

DROP TRIGGER IF EXISTS trg_block_delete_paid_team ON public.team_match_teams;
CREATE TRIGGER trg_block_delete_paid_team
  BEFORE DELETE ON public.team_match_teams
  FOR EACH ROW
  EXECUTE FUNCTION public.block_delete_paid_team_match_team();
