-- ============================================================================
-- Phase 4b — bank transfer stops being a promise made through a chat window.
-- ----------------------------------------------------------------------------
-- D2 (Phase 3) chose COD plus a `bank_transfer` method that carried NO bank
-- column, no QR and no reconciliation: the buyer picked it, the label said
-- "shop sẽ gửi thông tin", and the rest happened on Zalo. That was the right
-- cut for a closed pilot with one shop. It is the wrong one for a public
-- catalogue, where the buyer and the seller have never spoken.
--
-- This migration reverses exactly the part of D2 that the launch invalidates,
-- and nothing else. Still true afterwards:
--
--   * NO payment provider, no merchant account, no API key, no webhook.
--   * NO `awaiting_payment` status. The five-state machine is untouched.
--     Payment is an ATTRIBUTE of an order, not a stage of it — the same shape
--     team_match_teams.payment_status has had since 20260701140000, and for
--     the same reason: an order whose money is late is still `pending`, and a
--     seller who is happy to ship first must not be blocked by a flag.
--   * NO automatic reconciliation. A human sees the money and says so.
--
-- What is new is a QR the buyer can scan and a pair of timestamps that make
-- "did they pay?" answerable inside the product instead of by scrolling a
-- banking app next to a chat thread.
--
-- The QR itself needs nothing from this schema: img.vietqr.io renders one from
-- (bank, account, amount, memo) as a plain <img>, which is how event fees
-- (20260512130000) and team-match fees (20260701120001) have worked all along.
-- This migration is the third caller of that pattern, not a new one.

-- ─── 1. Where the money goes ────────────────────────────────────────────────

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS bank_code           TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name   TEXT;

-- All three or none. A half-filled trio renders a QR that a banking app
-- accepts and then fails to complete, which is worse than no QR: the buyer
-- believes they have paid.
ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_bank_trio_complete;
ALTER TABLE public.shops
  ADD CONSTRAINT shops_bank_trio_complete
  CHECK (num_nonnulls(bank_code, bank_account_number, bank_account_name) IN (0, 3));

ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_bank_shape;
ALTER TABLE public.shops
  ADD CONSTRAINT shops_bank_shape CHECK (
    (bank_code           IS NULL OR bank_code           ~ '^[A-Za-z0-9]{2,20}$') AND
    -- Vietnamese account numbers are digits. Rejecting spaces and dashes here
    -- rather than stripping them keeps ONE stored form, so the QR URL and the
    -- copy-to-clipboard button can never disagree.
    (bank_account_number IS NULL OR bank_account_number ~ '^[0-9]{6,20}$') AND
    (bank_account_name   IS NULL OR char_length(btrim(bank_account_name)) BETWEEN 2 AND 100)
  );

COMMENT ON COLUMN public.shops.bank_code IS
  'VietQR bank code (e.g. MB, VCB). The seller owns this — NOT pinned by shops_guard_privileged_columns, same as shipping_fee_vnd.';
COMMENT ON COLUMN public.shops.bank_account_number IS
  'Digits only, one stored form. Reaches a buyer solely through shop_order_payment_info, and only for an order they are a party to.';
COMMENT ON COLUMN public.shops.bank_account_name IS
  'Account holder as the bank prints it. Shown next to the QR so the buyer can check it before confirming in their banking app.';

-- ─── 2. Two timestamps, not a status ────────────────────────────────────────

ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS payment_claimed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.shop_orders.payment_claimed_at IS
  'The BUYER said they sent the money. Self-declared, never proof — the same contract as payment_orders.player_claimed_paid.';
COMMENT ON COLUMN public.shop_orders.payment_confirmed_at IS
  'A human on the SELLER side saw the money arrive. This is the one that counts.';
COMMENT ON COLUMN public.shop_orders.payment_confirmed_by IS
  'Never leaves the server: a uid, and profiles is readable by every logged-in user. Absent from every grant and every projection, exactly like buyer_user_id and cancelled_by.';

-- The two timestamps join the buyer/seller column list. payment_confirmed_by
-- does NOT — see 20260818100000's note on cancelled_by; this is the same rule,
-- not a second one.
GRANT SELECT (payment_claimed_at, payment_confirmed_at)
  ON public.shop_orders TO authenticated;

-- ─── 3. The buyer's view of their own orders ────────────────────────────────
-- Restated in full. CREATE OR REPLACE VIEW cannot add a column in the middle,
-- and this list is the second, independent place the identity invariant lives
-- (20260818120000) — so it is written out rather than patched.

DROP VIEW IF EXISTS public.my_shop_orders;
CREATE VIEW public.my_shop_orders WITH (security_barrier = true) AS
SELECT
  o.id, o.code, o.shop_id, o.status, o.payment_method,
  o.recipient_name, o.recipient_phone, o.shipping_address, o.delivery_note,
  o.items_total_vnd, o.shipping_fee_vnd, o.total_vnd,
  o.confirm_due_at, o.tracking_code, o.cancel_reason,
  o.payment_claimed_at, o.payment_confirmed_at,
  o.created_at, o.updated_at
FROM public.shop_orders o
WHERE o.buyer_user_id = auth.uid();

COMMENT ON VIEW public.my_shop_orders IS
  'Đơn của CHÍNH người đang đăng nhập. Dùng cho /shop/orders; trang chi tiết vẫn đọc shop_orders '
  'vì ở đó cả người bán cũng là một bên hợp lệ. payment_confirmed_by KHÔNG có mặt — nó là một uid.';

REVOKE ALL   ON public.my_shop_orders FROM PUBLIC, anon;
GRANT SELECT ON public.my_shop_orders TO authenticated, service_role;

-- ─── 4. The bank details, behind a door ─────────────────────────────────────
-- Not a grant and not a column on any projection: a SECURITY DEFINER function
-- that answers only for somebody who is already a party to the order, and only
-- when that order is actually waiting on a transfer. A seller's account number
-- is not catalogue data, and `shop_public_shop` must never learn it.

CREATE OR REPLACE FUNCTION public.shop_order_payment_info(_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _o public.shop_orders%ROWTYPE;
  _s public.shops%ROWTYPE;
BEGIN
  SELECT * INTO _o FROM public.shop_orders WHERE code = _code;
  IF NOT FOUND OR NOT public.shop_order_is_party(_o.id) THEN
    -- A stranger and a missing code get the same answer, so the function
    -- cannot be used to test whether an order code is real.
    RETURN jsonb_build_object('found', false);
  END IF;

  IF _o.payment_method <> 'bank_transfer' THEN
    RETURN jsonb_build_object('found', true, 'method', _o.payment_method, 'bank', NULL);
  END IF;

  SELECT * INTO _s FROM public.shops WHERE id = _o.shop_id;

  RETURN jsonb_build_object(
    'found', true,
    'method', 'bank_transfer',
    'amount_vnd', _o.total_vnd,
    -- The memo IS the order code. It is the only string tying a bank line to
    -- an order, so it is generated here rather than composed in the client,
    -- where a well-meaning "Thanh toán đơn " prefix would break the seller's
    -- search in their banking app.
    'memo', _o.code,
    'claimed_at', _o.payment_claimed_at,
    'confirmed_at', _o.payment_confirmed_at,
    'bank', CASE WHEN _s.bank_code IS NULL THEN NULL ELSE jsonb_build_object(
      'code', _s.bank_code,
      'account_number', _s.bank_account_number,
      'account_name', _s.bank_account_name
    ) END);
END $$;

REVOKE ALL   ON FUNCTION public.shop_order_payment_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_order_payment_info(TEXT) TO authenticated, service_role;

-- ─── 5. Claim (buyer) and confirm (seller) ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.shop_order_claim_payment(_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _o public.shop_orders%ROWTYPE;
BEGIN
  SELECT * INTO _o FROM public.shop_orders WHERE code = _code FOR UPDATE;
  IF NOT FOUND OR _o.buyer_user_id <> auth.uid() THEN
    -- The BUYER, specifically. A seller declaring that the buyer paid is the
    -- one direction this button must not work in.
    RAISE EXCEPTION 'không phải đơn của bạn' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _o.payment_method <> 'bank_transfer' THEN
    RAISE EXCEPTION 'đơn này thanh toán khi nhận hàng' USING ERRCODE = '22023';
  END IF;
  IF _o.status = 'cancelled' THEN
    RAISE EXCEPTION 'đơn đã huỷ' USING ERRCODE = '22023';
  END IF;

  -- Idempotent. The button is on a phone: a double tap, or a retry after a
  -- dropped connection, must not move the timestamp and must not look like a
  -- failure.
  IF _o.payment_claimed_at IS NULL THEN
    UPDATE public.shop_orders
    SET payment_claimed_at = now()
    WHERE id = _o.id
    RETURNING * INTO _o;

    PERFORM public.log_audit_event(
      'shop_order_payment_claimed'::text, 'shop'::text, 'shop_order'::text, _o.id::text,
      'info'::text, jsonb_build_object('code', _o.code, 'total_vnd', _o.total_vnd), 'user'::text
    );
  END IF;

  RETURN jsonb_build_object(
    'code', _o.code,
    'claimed_at', _o.payment_claimed_at,
    'confirmed_at', _o.payment_confirmed_at);
END $$;

REVOKE ALL   ON FUNCTION public.shop_order_claim_payment(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_order_claim_payment(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.shop_order_confirm_payment(_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _o public.shop_orders%ROWTYPE;
BEGIN
  SELECT * INTO _o FROM public.shop_orders WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'không tìm thấy đơn' USING ERRCODE = 'no_data_found';
  END IF;

  -- `support` can read an order and cannot move it (Phase 3 §9). Money is not
  -- the exception to that: the same three roles that ship an order confirm its
  -- payment.
  IF NOT (public.is_admin() OR EXISTS (
            SELECT 1 FROM public.shop_members m
            WHERE m.shop_id = _o.shop_id AND m.user_id = auth.uid()
              AND m.role IN ('owner', 'manager', 'fulfillment'))) THEN
    RAISE EXCEPTION 'không có quyền xác nhận thanh toán cho shop này'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF _o.payment_method <> 'bank_transfer' THEN
    RAISE EXCEPTION 'đơn này thanh toán khi nhận hàng' USING ERRCODE = '22023';
  END IF;

  -- Deliberately NOT gated on payment_claimed_at. The seller watches their own
  -- bank feed; requiring the buyer to press a button first would leave money
  -- that has already arrived marked unpaid.
  IF _o.payment_confirmed_at IS NULL THEN
    UPDATE public.shop_orders
    SET payment_confirmed_at = now(),
        payment_confirmed_by = auth.uid()
    WHERE id = _o.id
    RETURNING * INTO _o;

    PERFORM public.log_audit_event(
      'shop_order_payment_confirmed'::text, 'shop'::text, 'shop_order'::text, _o.id::text,
      'info'::text,
      jsonb_build_object('code', _o.code, 'total_vnd', _o.total_vnd,
                         'was_claimed', _o.payment_claimed_at IS NOT NULL),
      'user'::text
    );
  END IF;

  RETURN jsonb_build_object(
    'code', _o.code,
    'claimed_at', _o.payment_claimed_at,
    'confirmed_at', _o.payment_confirmed_at);
END $$;

REVOKE ALL   ON FUNCTION public.shop_order_confirm_payment(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_order_confirm_payment(TEXT) TO authenticated, service_role;

-- ─── 6. The seller's profile save learns three fields ───────────────────────
-- Restated in FULL, deliberately. 20260818100000's header records what happens
-- otherwise: a CREATE OR REPLACE that restated an older body silently un-did
-- the slug_write escape hatch, and no reader noticed. The body below is
-- 20260811180000's plus the three bank lines.

CREATE OR REPLACE FUNCTION public.shop_profile_update(
  _shop_id          UUID,
  _expected_version INTEGER,
  _patch            JSONB
)
RETURNS public.shops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.shops%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.shops WHERE id = _shop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shop not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_shop_manager(_shop_id) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _row.version <> _expected_version THEN
    RAISE EXCEPTION 'hồ sơ đã được cập nhật ở nơi khác (phiên bản % ≠ %)', _row.version, _expected_version
      USING ERRCODE = 'PT409';
  END IF;

  UPDATE public.shops
  SET name                  = coalesce(_patch ->> 'name', name),
      intro                 = CASE WHEN _patch ? 'intro' THEN NULLIF(btrim(_patch ->> 'intro'), '') ELSE intro END,
      city                  = CASE WHEN _patch ? 'city' THEN NULLIF(btrim(_patch ->> 'city'), '') ELSE city END,
      region                = CASE WHEN _patch ? 'region' THEN NULLIF(btrim(_patch ->> 'region'), '') ELSE region END,
      primary_category_slug = CASE WHEN _patch ? 'primary_category_slug'
                                   THEN NULLIF(_patch ->> 'primary_category_slug', '') ELSE primary_category_slug END,
      shipping_note         = CASE WHEN _patch ? 'shipping_note' THEN NULLIF(btrim(_patch ->> 'shipping_note'), '') ELSE shipping_note END,
      return_note           = CASE WHEN _patch ? 'return_note' THEN NULLIF(btrim(_patch ->> 'return_note'), '') ELSE return_note END,
      -- Whitespace is stripped from the account number rather than rejected:
      -- every banking app in the country prints it in groups, and a buyer who
      -- pastes "0123 4567 8901" should not be told their own account is
      -- invalid. The CHECK still refuses anything that is not digits.
      bank_code             = CASE WHEN _patch ? 'bank_code'
                                   THEN NULLIF(btrim(_patch ->> 'bank_code'), '') ELSE bank_code END,
      bank_account_number   = CASE WHEN _patch ? 'bank_account_number'
                                   THEN NULLIF(regexp_replace(coalesce(_patch ->> 'bank_account_number', ''), '\s', '', 'g'), '')
                                   ELSE bank_account_number END,
      bank_account_name     = CASE WHEN _patch ? 'bank_account_name'
                                   THEN NULLIF(btrim(_patch ->> 'bank_account_name'), '') ELSE bank_account_name END
  WHERE id = _shop_id AND version = _expected_version
  RETURNING * INTO _row;

  RETURN _row;
END $$;

NOTIFY pgrst, 'reload schema';
