-- ============================================================================
-- Shop SePay Payment Gateway — sandbox-first, server-side only.
-- ----------------------------------------------------------------------------
-- The marketplace currently sends bank transfers straight to each seller.
-- A SePay merchant account has a single money recipient, so the gateway stays
-- OFF until Product has chosen the merchant-of-record / seller-settlement
-- model. When OFF, the existing seller VietQR flow is unchanged.
--
-- No merchant secret, IPN secret, card detail or raw webhook body is stored in
-- Postgres. We retain only provider identifiers and reconciliation state.
-- ============================================================================

INSERT INTO public.system_settings (key, value)
VALUES ('shop_sepay_gateway_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE public.shop_sepay_payment_attempts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID NOT NULL UNIQUE
                            REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  invoice_number          TEXT NOT NULL UNIQUE,
  expected_amount_vnd     INTEGER NOT NULL CHECK (expected_amount_vnd > 0),
  provider_status         TEXT NOT NULL DEFAULT 'initiated'
                            CHECK (provider_status IN ('initiated', 'paid', 'voided')),
  provider_order_id       TEXT,
  provider_transaction_id TEXT UNIQUE,
  provider_payment_method TEXT,
  paid_at                 TIMESTAMPTZ,
  voided_at               TIMESTAMPTZ,
  last_ipn_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_sepay_paid_shape CHECK (
    (provider_status = 'paid' AND provider_transaction_id IS NOT NULL AND paid_at IS NOT NULL)
    OR provider_status <> 'paid'
  )
);

COMMENT ON TABLE public.shop_sepay_payment_attempts IS
  'Minimal SePay reconciliation ledger. Never stores secrets, raw IPN payloads, customer bank/card data or PII.';

ALTER TABLE public.shop_sepay_payment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_sepay_payment_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.shop_sepay_payment_attempts TO service_role;

-- Buyer-only preparation. The unique order_id makes repeated taps and network
-- retries return the same invoice instead of creating a second payable object.
CREATE OR REPLACE FUNCTION public.shop_sepay_checkout_prepare(_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _o       public.shop_orders%ROWTYPE;
  _attempt public.shop_sepay_payment_attempts%ROWTYPE;
  _enabled BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'cần đăng nhập' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO _o FROM public.shop_orders WHERE code = _code FOR UPDATE;
  IF NOT FOUND OR _o.buyer_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'không tìm thấy đơn' USING ERRCODE = 'no_data_found';
  END IF;
  IF _o.payment_method <> 'bank_transfer' THEN
    RAISE EXCEPTION 'đơn này thanh toán khi nhận hàng' USING ERRCODE = '22023';
  END IF;
  IF _o.status = 'cancelled' THEN
    RAISE EXCEPTION 'đơn đã huỷ' USING ERRCODE = '22023';
  END IF;
  IF _o.payment_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'đơn đã thanh toán' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce((value #>> '{}')::boolean, false) INTO _enabled
  FROM public.system_settings WHERE key = 'shop_sepay_gateway_enabled';
  IF coalesce(_enabled, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'SePay chưa được bật' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.shop_sepay_payment_attempts (
    order_id, invoice_number, expected_amount_vnd
  ) VALUES (
    _o.id, _o.code, _o.total_vnd
  )
  ON CONFLICT (order_id) DO UPDATE
    SET updated_at = now()
  RETURNING * INTO _attempt;

  -- The amount is frozen at order creation. A mismatch here means somebody
  -- changed data outside the supported order workflow; do not sign it.
  IF _attempt.expected_amount_vnd <> _o.total_vnd THEN
    RAISE EXCEPTION 'số tiền đối soát không khớp' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'code', _o.code,
    'invoice_number', _attempt.invoice_number,
    'amount_vnd', _attempt.expected_amount_vnd,
    'status', _attempt.provider_status
  );
END $$;

REVOKE ALL ON FUNCTION public.shop_sepay_checkout_prepare(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_sepay_checkout_prepare(TEXT) TO authenticated, service_role;

-- Only the service-role Edge Function may reconcile an IPN. It passes an
-- already type-checked, deliberately tiny projection of the payload.
CREATE OR REPLACE FUNCTION public.shop_sepay_apply_ipn(
  _notification_type       TEXT,
  _invoice_number          TEXT,
  _provider_order_id       TEXT,
  _order_status            TEXT,
  _order_amount_vnd        INTEGER,
  _order_currency          TEXT,
  _provider_transaction_id TEXT,
  _transaction_status      TEXT,
  _transaction_amount_vnd  INTEGER,
  _transaction_currency    TEXT,
  _payment_method          TEXT,
  _sent_at                 TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _attempt public.shop_sepay_payment_attempts%ROWTYPE;
  _o       public.shop_orders%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO _attempt
  FROM public.shop_sepay_payment_attempts
  WHERE invoice_number = _invoice_number
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown invoice' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT * INTO _o FROM public.shop_orders WHERE id = _attempt.order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown order' USING ERRCODE = 'no_data_found';
  END IF;

  IF upper(coalesce(_order_currency, '')) <> 'VND'
     OR upper(coalesce(_transaction_currency, '')) <> 'VND'
     OR _order_amount_vnd <> _attempt.expected_amount_vnd
     OR _transaction_amount_vnd <> _attempt.expected_amount_vnd THEN
    RAISE EXCEPTION 'payment amount or currency mismatch' USING ERRCODE = '22023';
  END IF;

  IF _notification_type = 'TRANSACTION_VOID' THEN
    IF _attempt.provider_status = 'paid' THEN
      RETURN jsonb_build_object('ok', true, 'result', 'ignored_paid', 'code', _o.code);
    END IF;

    UPDATE public.shop_sepay_payment_attempts
    SET provider_status = 'voided', provider_order_id = _provider_order_id,
        provider_transaction_id = coalesce(provider_transaction_id, _provider_transaction_id),
        provider_payment_method = _payment_method, voided_at = coalesce(voided_at, now()),
        last_ipn_at = now(), updated_at = now()
    WHERE id = _attempt.id;
    RETURN jsonb_build_object('ok', true, 'result', 'voided', 'code', _o.code);
  END IF;

  IF _notification_type <> 'ORDER_PAID'
     OR upper(coalesce(_order_status, '')) <> 'CAPTURED'
     OR upper(coalesce(_transaction_status, '')) <> 'APPROVED'
     OR coalesce(_provider_transaction_id, '') = '' THEN
    RAISE EXCEPTION 'payment is not approved' USING ERRCODE = '22023';
  END IF;

  IF _attempt.provider_status = 'paid' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'result', CASE WHEN _attempt.provider_transaction_id = _provider_transaction_id
                     THEN 'duplicate' ELSE 'already_paid' END,
      'code', _o.code
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.shop_sepay_payment_attempts
    WHERE provider_transaction_id = _provider_transaction_id AND id <> _attempt.id
  ) THEN
    RAISE EXCEPTION 'transaction already belongs to another invoice'
      USING ERRCODE = 'unique_violation';
  END IF;

  UPDATE public.shop_sepay_payment_attempts
  SET provider_status = 'paid', provider_order_id = _provider_order_id,
      provider_transaction_id = _provider_transaction_id,
      provider_payment_method = _payment_method, paid_at = coalesce(paid_at, now()),
      voided_at = NULL, last_ipn_at = now(), updated_at = now()
  WHERE id = _attempt.id;

  UPDATE public.shop_orders
  SET payment_confirmed_at = coalesce(payment_confirmed_at, now()),
      payment_confirmed_by = NULL
  WHERE id = _o.id;

  PERFORM public.log_audit_event(
    'shop_order_payment_confirmed_sepay'::text, 'shop'::text,
    'shop_order'::text, _o.id::text, 'info'::text,
    jsonb_build_object(
      'code', _o.code, 'total_vnd', _attempt.expected_amount_vnd,
      'sepay_order_id', _provider_order_id,
      'sepay_transaction_id', _provider_transaction_id,
      'sent_at', _sent_at
    ),
    'system'::text
  );

  RETURN jsonb_build_object('ok', true, 'result', 'paid', 'code', _o.code);
END $$;

REVOKE ALL ON FUNCTION public.shop_sepay_apply_ipn(
  TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_sepay_apply_ipn(
  TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;

-- Extend the existing party-scoped projection. When gateway routing is ON,
-- seller bank details are intentionally withheld so the screen cannot offer
-- two different recipients for the same order.
CREATE OR REPLACE FUNCTION public.shop_order_payment_info(_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _o       public.shop_orders%ROWTYPE;
  _s       public.shops%ROWTYPE;
  _attempt public.shop_sepay_payment_attempts%ROWTYPE;
  _enabled BOOLEAN;
BEGIN
  SELECT * INTO _o FROM public.shop_orders WHERE code = _code;
  IF NOT FOUND OR NOT public.shop_order_is_party(_o.id) THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF _o.payment_method <> 'bank_transfer' THEN
    RETURN jsonb_build_object('found', true, 'method', _o.payment_method, 'bank', NULL);
  END IF;

  SELECT * INTO _s FROM public.shops WHERE id = _o.shop_id;
  SELECT * INTO _attempt FROM public.shop_sepay_payment_attempts WHERE order_id = _o.id;
  SELECT coalesce((value #>> '{}')::boolean, false) INTO _enabled
  FROM public.system_settings WHERE key = 'shop_sepay_gateway_enabled';

  RETURN jsonb_build_object(
    'found', true,
    'method', 'bank_transfer',
    'amount_vnd', _o.total_vnd,
    'memo', _o.code,
    'claimed_at', _o.payment_claimed_at,
    'confirmed_at', _o.payment_confirmed_at,
    'gateway', jsonb_build_object(
      'enabled', coalesce(_enabled, false),
      'provider', 'sepay',
      'status', coalesce(_attempt.provider_status, 'not_started')
    ),
    'bank', CASE
      WHEN coalesce(_enabled, false) THEN NULL
      WHEN _s.bank_code IS NULL THEN NULL
      ELSE jsonb_build_object(
        'code', _s.bank_code,
        'account_number', _s.bank_account_number,
        'account_name', _s.bank_account_name
      )
    END
  );
END $$;

REVOKE ALL ON FUNCTION public.shop_order_payment_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_order_payment_info(TEXT) TO authenticated, service_role;

-- Automatic SePay confirmation informs both sides. Manual seller confirmation
-- informs only the buyer; the seller is the actor and needs no echo.
CREATE OR REPLACE FUNCTION public.tg_shop_order_push_payment_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _recipients UUID[];
BEGIN
  IF NEW.payment_confirmed_at IS NULL
     OR NEW.payment_confirmed_at IS NOT DISTINCT FROM OLD.payment_confirmed_at THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_confirmed_by IS NULL THEN
    SELECT array_agg(DISTINCT uid) INTO _recipients
    FROM (
      SELECT NEW.buyer_user_id AS uid
      UNION SELECT s.owner_user_id FROM public.shops s WHERE s.id = NEW.shop_id
      UNION SELECT m.user_id FROM public.shop_members m WHERE m.shop_id = NEW.shop_id
    ) x WHERE uid IS NOT NULL;
  ELSE
    _recipients := ARRAY[NEW.buyer_user_id];
  END IF;

  PERFORM public.push_notify(
    _recipients,
    'Đã nhận thanh toán đơn ' || NEW.code,
    replace(to_char(NEW.total_vnd, 'FM999G999G999'), ',', '.') || '₫ đã được đối soát.',
    jsonb_build_object(
      'type', 'shop_order_payment_confirmed', 'order_id', NEW.id::text,
      'order_code', NEW.code, 'url', '/shop/order/' || NEW.code
    )
  );

  BEGIN
    INSERT INTO public.social_notifications (user_id, type, title, body, link_url, payload)
    SELECT uid, 'shop_order_payment_confirmed',
           'Đã nhận thanh toán đơn ' || NEW.code,
           replace(to_char(NEW.total_vnd, 'FM999G999G999'), ',', '.') || '₫ đã được đối soát.',
           '/shop/order/' || NEW.code,
           jsonb_build_object('order_id', NEW.id)
    FROM unnest(_recipients) u(uid)
    WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shop_order_push_payment_confirmed ON public.shop_orders;
CREATE TRIGGER trg_shop_order_push_payment_confirmed
  AFTER UPDATE OF payment_confirmed_at ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_shop_order_push_payment_confirmed();

NOTIFY pgrst, 'reload schema';
