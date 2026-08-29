-- ============================================================================
-- Shop pilot hardening — refund obligation on paid-then-cancelled orders, and
-- no manual "đã nhận tiền" on an order the gateway is reconciling.
-- ----------------------------------------------------------------------------
-- Found while reviewing the seller flow after the first real SePay-confirmed
-- order (PH-2608-7776, 2026-08-28):
--
--   1. shop_order_transition(cancel) never looked at payment_confirmed_at. A
--      paid order could be cancelled and the 530.000₫ simply vanished from
--      every screen — no column, no event, no notification said "refund this".
--   2. shop_order_confirm_payment() let a seller stamp payment_confirmed_by on
--      an order that SePay was about to reconcile, so the audit trail read
--      "manual" for money the gateway actually matched.
--
-- Design: two nullable columns and a trigger, not a rewrite of the 250-line
-- transition function. `refund_due_vnd` is set by a BEFORE UPDATE trigger the
-- moment a paid order becomes `cancelled`, so EVERY cancel path — RPC, admin
-- SQL, whatever comes next — records the debt. `refunded_at` is set by one
-- RPC the seller (or admin) presses after sending the money back. Refunds are
-- manual bank transfers in this phase; the platform holds no money (Option B′).
-- ============================================================================

-- ─── 1. Columns ─────────────────────────────────────────────────────────────
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS refund_due_vnd INTEGER CHECK (refund_due_vnd IS NULL OR refund_due_vnd > 0),
  ADD COLUMN IF NOT EXISTS refunded_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.shop_orders.refund_due_vnd IS
  'Set by trigger when a PAID order is cancelled: the amount the seller owes the buyer. NULL = nothing owed.';
COMMENT ON COLUMN public.shop_orders.refunded_at IS
  'Seller/admin declared the refund sent (shop_order_mark_refunded). Self-declared, like payment_confirmed_at.';
COMMENT ON COLUMN public.shop_orders.refunded_by IS
  'A uid — never granted, never projected, exactly like payment_confirmed_by.';

-- Same rule as payment_claimed_at / payment_confirmed_at (20260818150000):
-- the two facts are readable by both parties, the uid is not.
GRANT SELECT (refund_due_vnd, refunded_at) ON public.shop_orders TO authenticated;

-- ─── 2. The buyer's list view, restated with the two new columns ────────────
DROP VIEW IF EXISTS public.my_shop_orders;
CREATE VIEW public.my_shop_orders WITH (security_barrier = true) AS
SELECT
  o.id, o.code, o.shop_id, o.status, o.payment_method,
  o.recipient_name, o.recipient_phone, o.shipping_address, o.delivery_note,
  o.items_total_vnd, o.shipping_fee_vnd, o.total_vnd,
  o.confirm_due_at, o.tracking_code, o.cancel_reason,
  o.payment_claimed_at, o.payment_confirmed_at,
  o.refund_due_vnd, o.refunded_at,
  o.created_at, o.updated_at
FROM public.shop_orders o
WHERE o.buyer_user_id = auth.uid();

COMMENT ON VIEW public.my_shop_orders IS
  'Đơn của CHÍNH người đang đăng nhập. Dùng cho /shop/orders; trang chi tiết vẫn đọc shop_orders '
  'vì ở đó cả người bán cũng là một bên hợp lệ. payment_confirmed_by / refunded_by KHÔNG có mặt — là uid.';

REVOKE ALL   ON public.my_shop_orders FROM PUBLIC, anon;
GRANT SELECT ON public.my_shop_orders TO authenticated, service_role;

-- ─── 3. Cancel of a paid order records the debt ─────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_shop_order_refund_due()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled'
     AND NEW.payment_confirmed_at IS NOT NULL
     AND NEW.refund_due_vnd IS NULL THEN
    -- total_vnd is GENERATED and not yet computed in a BEFORE trigger, so it
    -- reads NULL here; the two inputs it is generated from are real.
    NEW.refund_due_vnd := NEW.items_total_vnd + NEW.shipping_fee_vnd;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shop_order_refund_due ON public.shop_orders;
CREATE TRIGGER trg_shop_order_refund_due
  BEFORE UPDATE OF status ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_shop_order_refund_due();

-- Both sides are told, in the same breath as the cancel push. The seller
-- members get the instruction; the buyer gets the promise.
CREATE OR REPLACE FUNCTION public.tg_shop_order_push_refund_due()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _amount TEXT;
  _sellers UUID[];
BEGIN
  IF NEW.refund_due_vnd IS NULL OR OLD.refund_due_vnd IS NOT NULL THEN
    RETURN NEW;
  END IF;

  _amount := replace(to_char(NEW.refund_due_vnd, 'FM999G999G999'), ',', '.') || '₫';

  SELECT array_agg(DISTINCT uid) INTO _sellers
  FROM (
    SELECT s.owner_user_id AS uid FROM public.shops s WHERE s.id = NEW.shop_id
    UNION SELECT m.user_id FROM public.shop_members m
          WHERE m.shop_id = NEW.shop_id AND m.role IN ('owner', 'manager', 'fulfillment')
  ) x WHERE uid IS NOT NULL;

  PERFORM public.push_notify(
    _sellers,
    'Cần hoàn ' || _amount || ' cho đơn ' || NEW.code,
    'Đơn đã huỷ sau khi người mua thanh toán. Chuyển trả rồi bấm “Đã hoàn tiền” trên đơn.',
    jsonb_build_object(
      'type', 'shop_order_refund_due', 'order_id', NEW.id::text,
      'order_code', NEW.code, 'url', '/seller/orders/' || NEW.code
    )
  );

  IF NEW.buyer_user_id IS NOT NULL THEN
    PERFORM public.push_notify(
      ARRAY[NEW.buyer_user_id],
      'Shop sẽ hoàn ' || _amount || ' cho đơn ' || NEW.code,
      'Đơn đã huỷ sau khi anh/chị thanh toán. Shop sẽ chuyển trả về tài khoản anh/chị đã dùng.',
      jsonb_build_object(
        'type', 'shop_order_refund_due', 'order_id', NEW.id::text,
        'order_code', NEW.code, 'url', '/shop/order/' || NEW.code
      )
    );
  END IF;

  BEGIN
    INSERT INTO public.social_notifications (user_id, type, title, body, link_url, payload)
    SELECT uid, 'shop_order_refund_due',
           'Cần hoàn ' || _amount || ' cho đơn ' || NEW.code,
           'Đơn đã huỷ sau khi người mua thanh toán.',
           '/seller/orders/' || NEW.code,
           jsonb_build_object('order_id', NEW.id)
    FROM unnest(_sellers) u(uid)
    WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END $$;

-- `OF status`, not `OF refund_due_vnd`: an UPDATE OF list matches the SET
-- clause of the statement, and the debt is written by the BEFORE trigger, not
-- by any statement's SET. The function itself checks the column moved.
DROP TRIGGER IF EXISTS trg_shop_order_push_refund_due ON public.shop_orders;
CREATE TRIGGER trg_shop_order_push_refund_due
  AFTER UPDATE OF status ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_shop_order_push_refund_due();

-- ─── 4. The seller says the money went back ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.shop_order_mark_refunded(_code TEXT)
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

  IF NOT (public.is_admin() OR EXISTS (
            SELECT 1 FROM public.shop_members m
            WHERE m.shop_id = _o.shop_id AND m.user_id = auth.uid()
              AND m.role IN ('owner', 'manager', 'fulfillment'))) THEN
    RAISE EXCEPTION 'không có quyền xác nhận hoàn tiền cho shop này'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF _o.refund_due_vnd IS NULL THEN
    RAISE EXCEPTION 'đơn này không có khoản cần hoàn' USING ERRCODE = '22023';
  END IF;

  IF _o.refunded_at IS NULL THEN
    UPDATE public.shop_orders
    SET refunded_at = now(), refunded_by = auth.uid()
    WHERE id = _o.id
    RETURNING * INTO _o;

    PERFORM public.log_audit_event(
      'shop_order_refunded'::text, 'shop'::text, 'shop_order'::text, _o.id::text,
      'info'::text,
      jsonb_build_object('code', _o.code, 'refund_due_vnd', _o.refund_due_vnd),
      'user'::text
    );

    IF _o.buyer_user_id IS NOT NULL THEN
      PERFORM public.push_notify(
        ARRAY[_o.buyer_user_id],
        'Shop đã hoàn tiền đơn ' || _o.code,
        replace(to_char(_o.refund_due_vnd, 'FM999G999G999'), ',', '.') ||
          '₫ đã được chuyển trả. Kiểm tra tài khoản của anh/chị.',
        jsonb_build_object(
          'type', 'shop_order_refunded', 'order_id', _o.id::text,
          'order_code', _o.code, 'url', '/shop/order/' || _o.code
        )
      );
      BEGIN
        INSERT INTO public.social_notifications (user_id, type, title, body, link_url, payload)
        SELECT _o.buyer_user_id, 'shop_order_refunded',
               'Shop đã hoàn tiền đơn ' || _o.code,
               replace(to_char(_o.refund_due_vnd, 'FM999G999G999'), ',', '.') || '₫ đã được chuyển trả.',
               '/shop/order/' || _o.code,
               jsonb_build_object('order_id', _o.id)
        WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _o.buyer_user_id);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'code', _o.code,
    'refund_due_vnd', _o.refund_due_vnd,
    'refunded_at', _o.refunded_at);
END $$;

REVOKE ALL   ON FUNCTION public.shop_order_mark_refunded(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_order_mark_refunded(TEXT) TO authenticated, service_role;

-- ─── 5. shop_order_json carries the two facts, so a transition's return value
--        seeds the cache with the refund block already present ───────────────
CREATE OR REPLACE FUNCTION public.shop_order_json(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _o    public.shop_orders%ROWTYPE;
  _shop public.shops%ROWTYPE;
BEGIN
  SELECT * INTO _o FROM public.shop_orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT * INTO _shop FROM public.shops WHERE id = _o.shop_id;

  RETURN jsonb_build_object(
    'id',                   _o.id,
    'code',                 _o.code,
    'status',               _o.status,
    'payment_method',       _o.payment_method,
    'recipient_name',       _o.recipient_name,
    'recipient_phone',      _o.recipient_phone,
    'shipping_address',     _o.shipping_address,
    'delivery_note',        _o.delivery_note,
    'items_total_vnd',      _o.items_total_vnd,
    'shipping_fee_vnd',     _o.shipping_fee_vnd,
    'total_vnd',            _o.total_vnd,
    'confirm_due_at',       _o.confirm_due_at,
    'tracking_code',        _o.tracking_code,
    'cancel_reason',        _o.cancel_reason,
    'payment_claimed_at',   _o.payment_claimed_at,
    'payment_confirmed_at', _o.payment_confirmed_at,
    'refund_due_vnd',       _o.refund_due_vnd,
    'refunded_at',          _o.refunded_at,
    'created_at',           _o.created_at,
    'updated_at',           _o.updated_at,
    'shop', jsonb_build_object(
      'slug', _shop.slug, 'name', _shop.name, 'state', _shop.state),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', i.id, 'product_id', i.product_id, 'variant_id', i.variant_id,
               'qty', i.qty, 'product_title', i.product_title,
               'variant_label', i.variant_label, 'sku', i.sku,
               'unit_price_vnd', i.unit_price_vnd, 'line_total_vnd', i.line_total_vnd)
             ORDER BY i.created_at, i.id)
      FROM public.shop_order_items i WHERE i.order_id = _o.id), '[]'::jsonb),
    'events', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', e.id, 'action', e.action,
               'from_status', e.from_status, 'to_status', e.to_status,
               'metadata', e.metadata, 'created_at', e.created_at)
             ORDER BY e.created_at, e.id)
      FROM public.shop_order_events e WHERE e.order_id = _o.id), '[]'::jsonb)
  );
END $$;

-- ─── 6. No manual confirmation on a gateway order ───────────────────────────
-- Gated on the ATTEMPT, not the global flag: an order that already has a
-- SePay invoice is SePay's to reconcile even if the flag is later switched
-- off; an order placed before the gateway existed stays manual.
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

  IF EXISTS (SELECT 1 FROM public.shop_sepay_payment_attempts a WHERE a.order_id = _o.id) THEN
    RAISE EXCEPTION 'đơn này thanh toán qua cổng — hệ thống tự đối soát, không xác nhận tay'
      USING ERRCODE = '22023';
  END IF;

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

NOTIFY pgrst, 'reload schema';
