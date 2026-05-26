-- ============================================================================
-- Auto-sync: organizer marks "paid" → player_claimed_paid=true on the order
-- ============================================================================
-- The organizer-side roster has an action "Đánh dấu đã thanh toán" that
-- flips event_registrations.payment_status to 'paid'. The player-side flow
-- is a separate column on payment_orders (player_claimed_paid) that the
-- player toggles via the magic-link page after they finish the QR
-- transfer. When the organizer receives money out-of-band (cash at the
-- venue, or a transfer the player forgot to mark) they flip the
-- organizer column manually — but the player column stayed stale,
-- leaving the roster's "Trạng thái CK" column showing "Chưa chuyển"
-- alongside the green "Đã thanh toán" badge.
--
-- Fix: AFTER UPDATE trigger on event_registrations that mirrors
-- payment_status='paid' onto payment_orders.player_claimed_paid. One-way
-- mirror — the organizer marking 'unpaid' again does NOT auto-clear the
-- player claim, because the player legitimately may have claimed it.
--
-- Also backfills currently-stale rows (payment_status='paid' AND
-- the corresponding payment_order still has player_claimed_paid=false).
--
-- IDEMPOTENT — replay-safe.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_sync_player_claimed_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- One-way: only when transitioning INTO 'paid'. Leave the player
  -- column alone in every other transition.
  IF NEW.payment_status = 'paid'
     AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
    UPDATE public.payment_orders
    SET player_claimed_paid = true,
        player_claimed_at   = COALESCE(player_claimed_at, now())
    WHERE registration_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_registrations_sync_player_claimed
  ON public.event_registrations;
CREATE TRIGGER trg_event_registrations_sync_player_claimed
  AFTER UPDATE OF payment_status ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_player_claimed_on_paid();

COMMENT ON FUNCTION public.tg_sync_player_claimed_on_paid() IS
  'When organizer flips event_registrations.payment_status to paid, set the matching payment_orders.player_claimed_paid=true so the roster transfer-status column stays consistent. One-way mirror. See migration 20260522130000.';

-- ─── Backfill ───────────────────────────────────────────────────────────
-- Any row where organizer already marked paid but the player order is
-- still showing unclaimed gets snapped into sync now.

UPDATE public.payment_orders po
SET player_claimed_paid = true,
    player_claimed_at   = COALESCE(po.player_claimed_at, er.paid_at, now())
FROM public.event_registrations er
WHERE er.id = po.registration_id
  AND er.payment_status = 'paid'
  AND po.player_claimed_paid IS NOT TRUE;
