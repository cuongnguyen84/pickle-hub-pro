-- ============================================================================
-- Social Events MVP — PR49 (Payment): payment_orders
-- ============================================================================
-- One row per registration that opens a payment flow. Carries:
--   - amount_vnd: the price snapshot at order time (event price can move)
--   - reference_code: PHUB-XXXXXX, unique global, what the player writes
--                     in the bank-transfer memo
--   - player_claimed_paid + player_claimed_at: the player's self-declared
--                     "I've sent the money" flag. Not organizer-verified —
--                     the organizer reconciles in their banking app and
--                     decides at the venue whether to let the player play.
--
-- SELECT is gated to the event's organizer + admin so the roster page can
-- show "Mã thanh toán" + "Trạng thái CK" columns. Players do NOT SELECT
-- payment_orders client-side; create-payment-order returns the order data
-- in its response (and is idempotent on subsequent reload, so a returning
-- guest still gets their order back via that edge function).
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id       UUID NOT NULL UNIQUE REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  amount_vnd            INTEGER NOT NULL,
  reference_code        TEXT NOT NULL UNIQUE,
  player_claimed_paid   BOOLEAN NOT NULL DEFAULT false,
  player_claimed_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_amount_positive;
ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_amount_positive
  CHECK (amount_vnd >= 0);

-- Reference code shape: PHUB- followed by 6 chars from the
-- crockford-style alphabet (no 0/1/I/L/O — reduces transcription errors
-- when the player types it into a banking app's memo field).
ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_reference_code_format;
ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_reference_code_format
  CHECK (reference_code ~ '^PHUB-[2-9A-HJ-NP-Z]{6}$');

ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_claim_timestamp_with_flag;
ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_claim_timestamp_with_flag
  CHECK (
    (player_claimed_paid = false AND player_claimed_at IS NULL)
    OR (player_claimed_paid = true AND player_claimed_at IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_payment_orders_registration_id
  ON public.payment_orders (registration_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- SELECT path: event organizer + admin only. Player access is mediated by
-- create-payment-order / mark-payment-claimed edge functions (service role).
-- No INSERT / UPDATE / DELETE policies on purpose — those paths run only
-- under the service role key, which bypasses RLS entirely.

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_orders_select_organizer" ON public.payment_orders;
CREATE POLICY "payment_orders_select_organizer" ON public.payment_orders
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.event_registrations r
      JOIN public.social_events e ON e.id = r.event_id
      WHERE r.id = payment_orders.registration_id
        AND e.created_by = auth.uid()
    )
  );

-- ─── GRANTs ─────────────────────────────────────────────────────────────────
-- Authenticated needs SELECT for the roster page; anon never reads orders
-- (any data they'd care about is delivered via the edge functions).
-- No INSERT/UPDATE/DELETE GRANTs — only service_role mutates this table.

GRANT SELECT ON public.payment_orders TO authenticated;

COMMENT ON TABLE public.payment_orders IS
  'Per-registration VietQR payment record. Player self-claims via the mark-payment-claimed edge fn. Organizer reconciles in their banking app using reference_code. SELECT gated to organizer + admin; mutations via service-role edge functions only. See migration 20260512130001.';
