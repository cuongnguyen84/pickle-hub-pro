-- ============================================================================
-- Migration 20260828150000 — refund obligation + no manual confirm on a
-- gateway order.
-- ----------------------------------------------------------------------------
--   b1 buyer · o1 owner · s1 support · ad admin (aal2)
-- ============================================================================
BEGIN;

SELECT plan(22);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('0e110001-0000-4000-8000-00000000000a'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rf-b1@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0e220002-0000-4000-8000-00000000000a'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rf-owner@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0e330003-0000-4000-8000-00000000000a'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rf-support@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0e440004-0000-4000-8000-00000000000a'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rf-admin@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('0e440004-0000-4000-8000-00000000000a'::uuid, 'admin') ON CONFLICT DO NOTHING;
INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES ('0e4400f8-0000-4000-8000-00000000000a'::uuid, '0e440004-0000-4000-8000-00000000000a'::uuid,
        'test-totp', 'totp', 'verified', NOW(), NOW(), 'JBSWY3DPEHPK3PXP');

INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('0e220002-0000-4000-8000-00000000000a'::uuid) ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id, ordering_enabled, shipping_fee_vnd) VALUES
  ('0f110001-0000-4000-8000-00000000000a'::uuid, 'rf-shop', 'Shop Hoàn Tiền', 'active',
   '0e220002-0000-4000-8000-00000000000a'::uuid, true, 30000);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('0f110001-0000-4000-8000-00000000000a'::uuid, '0e220002-0000-4000-8000-00000000000a'::uuid, 'owner'),
  ('0f110001-0000-4000-8000-00000000000a'::uuid, '0e330003-0000-4000-8000-00000000000a'::uuid, 'support');

SELECT set_config('shop.privileged_write', 'on', true);
INSERT INTO public.products (id, shop_id, slug, title, description, category_slug, status, is_published) VALUES
  ('01110001-0000-4000-8000-00000000000a'::uuid, '0f110001-0000-4000-8000-00000000000a'::uuid,
   'rf-vot', 'Vợt Hoàn Tiền', 'Vợt carbon T700, lõi tổ ong 16mm.', 'vot', 'approved', true);
SELECT set_config('shop.privileged_write', 'off', true);

INSERT INTO public.product_variants (id, product_id, shop_id, price_vnd, stock_on_hand, position) VALUES
  ('02110001-0000-4000-8000-00000000000a'::uuid, '01110001-0000-4000-8000-00000000000a'::uuid,
   '0f110001-0000-4000-8000-00000000000a'::uuid, 500000, 5, 0);

CREATE TEMP TABLE t_rf (k TEXT PRIMARY KEY, v UUID, code TEXT);
GRANT SELECT, INSERT ON t_rf TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.err(_sql TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE _state TEXT;
BEGIN
  EXECUTE _sql;
  RETURN 'no-error';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS _state = RETURNED_SQLSTATE;
  RETURN _state;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.place(_token TEXT)
RETURNS JSONB LANGUAGE sql AS $$
  SELECT public.shop_order_create(_token, 'bank_transfer', 'Nguyễn Văn A', '0912345678',
    'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', NULL, 30000,
    jsonb_build_array(jsonb_build_object(
      'variant_id', '02110001-0000-4000-8000-00000000000a', 'qty', 1,
      'expected_unit_price_vnd', 500000)))
$$;

-- ─── Columns and projection ─────────────────────────────────────────────────
SELECT has_column('public', 'shop_orders', 'refund_due_vnd', 'refund_due_vnd tồn tại');
SELECT has_column('public', 'shop_orders', 'refunded_at',    'refunded_at tồn tại');
SELECT ok(
  has_column_privilege('authenticated', 'public.shop_orders', 'refund_due_vnd', 'SELECT'),
  'authenticated đọc được refund_due_vnd');
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.shop_orders', 'refunded_by', 'SELECT'),
  'refunded_by là uid — KHÔNG được grant');
SELECT has_column('public', 'my_shop_orders', 'refund_due_vnd', 'my_shop_orders có refund_due_vnd');

-- ─── An unpaid cancel owes nothing ──────────────────────────────────────────
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0e110001-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';
INSERT INTO t_rf SELECT 'unpaid', (j->>'id')::uuid, j->>'code' FROM pg_temp.place('rf-unpaid') j;
SELECT is(
  (public.shop_order_transition((SELECT v FROM t_rf WHERE k='unpaid'), 'cancel', 'pending', NULL, NULL)) ->> 'status',
  'cancelled', 'người mua huỷ đơn chưa trả tiền');
SET LOCAL role postgres;
SELECT is(
  (SELECT refund_due_vnd FROM public.shop_orders WHERE id = (SELECT v FROM t_rf WHERE k='unpaid')),
  NULL, 'đơn chưa trả tiền: không có khoản cần hoàn');

-- ─── A paid cancel owes the whole total ─────────────────────────────────────
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0e110001-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';
INSERT INTO t_rf SELECT 'paid', (j->>'id')::uuid, j->>'code' FROM pg_temp.place('rf-paid') j;

-- The seller confirms the money arrived (manual VietQR path).
SET LOCAL request.jwt.claims TO '{"sub":"0e220002-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';
SELECT ok(
  (public.shop_order_confirm_payment((SELECT code FROM t_rf WHERE k='paid'))) ->> 'confirmed_at' IS NOT NULL,
  'chủ shop xác nhận đã nhận tiền (đơn không qua cổng)');

SELECT is(
  pg_temp.err(format($$ SELECT public.shop_order_mark_refunded(%L) $$, (SELECT code FROM t_rf WHERE k='paid'))),
  '22023', 'chưa huỷ thì không có gì để hoàn — 22023');

SELECT is(
  (public.shop_order_transition((SELECT v FROM t_rf WHERE k='paid'), 'cancel', 'pending', 'hết hàng', NULL)) ->> 'status',
  'cancelled', 'chủ shop huỷ đơn ĐÃ trả tiền');
SELECT is(
  (SELECT refund_due_vnd FROM public.shop_orders WHERE id = (SELECT v FROM t_rf WHERE k='paid')),
  530000, 'refund_due_vnd = total_vnd (500.000 hàng + 30.000 ship) — ghi bởi trigger, chủ shop đọc được');

SET LOCAL role postgres;
SELECT is(
  (SELECT count(*)::int FROM public.social_notifications
   WHERE type = 'shop_order_refund_due'
     AND user_id = '0e220002-0000-4000-8000-00000000000a'::uuid),
  (SELECT count(*)::int FROM public.profiles WHERE id = '0e220002-0000-4000-8000-00000000000a'::uuid),
  'chuông "cần hoàn" tới chủ shop (nếu có profile)');

-- ─── Who may say "đã hoàn" ──────────────────────────────────────────────────
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0e110001-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';
SELECT is(
  pg_temp.err(format($$ SELECT public.shop_order_mark_refunded(%L) $$, (SELECT code FROM t_rf WHERE k='paid'))),
  '42501', 'người mua không tự đánh dấu đã hoàn');

SET LOCAL request.jwt.claims TO '{"sub":"0e330003-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';
SELECT is(
  pg_temp.err(format($$ SELECT public.shop_order_mark_refunded(%L) $$, (SELECT code FROM t_rf WHERE k='paid'))),
  '42501', 'support đọc được đơn nhưng không đánh dấu hoàn');

SET LOCAL request.jwt.claims TO '{"sub":"0e220002-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';
SELECT ok(
  (public.shop_order_mark_refunded((SELECT code FROM t_rf WHERE k='paid'))) ->> 'refunded_at' IS NOT NULL,
  'chủ shop đánh dấu đã hoàn');
SELECT is(
  ((public.shop_order_mark_refunded((SELECT code FROM t_rf WHERE k='paid'))) ->> 'refunded_at')::timestamptz,
  (SELECT refunded_at FROM public.shop_orders WHERE id = (SELECT v FROM t_rf WHERE k='paid')),
  'bấm lần hai trả lại đúng mốc cũ — idempotent');
SET LOCAL role postgres;
SELECT ok(
  (public.shop_order_json((SELECT v FROM t_rf WHERE k='paid'))) ? 'refund_due_vnd',
  'shop_order_json mang refund_due_vnd để cache client có ngay');

SET LOCAL role postgres;
SELECT is(
  (SELECT count(*)::int FROM public.social_notifications
   WHERE type = 'shop_order_refunded'
     AND user_id = '0e110001-0000-4000-8000-00000000000a'::uuid),
  (SELECT count(*)::int FROM public.profiles WHERE id = '0e110001-0000-4000-8000-00000000000a'::uuid),
  'chuông "đã hoàn" tới người mua (nếu có profile)');

-- ─── A gateway order refuses the manual stamp ───────────────────────────────
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0e110001-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';
INSERT INTO t_rf SELECT 'gw', (j->>'id')::uuid, j->>'code' FROM pg_temp.place('rf-gw') j;
SET LOCAL role postgres;
INSERT INTO public.shop_sepay_payment_attempts (order_id, invoice_number, expected_amount_vnd)
VALUES ((SELECT v FROM t_rf WHERE k='gw'), (SELECT code FROM t_rf WHERE k='gw'), 530000);

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0e220002-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';
SELECT is(
  pg_temp.err(format($$ SELECT public.shop_order_confirm_payment(%L) $$, (SELECT code FROM t_rf WHERE k='gw'))),
  '22023', 'đơn đã có hoá đơn SePay: chủ shop KHÔNG xác nhận tay được');
SET LOCAL role postgres;
SELECT is(
  (SELECT payment_confirmed_at FROM public.shop_orders WHERE id = (SELECT v FROM t_rf WHERE k='gw')),
  NULL, 'và mốc thanh toán vẫn trống');

-- ─── The gateway path still records the debt ────────────────────────────────
-- Simulate what shop_sepay_apply_ipn does, then the seller cancels.
UPDATE public.shop_orders SET payment_confirmed_at = now(), payment_confirmed_by = NULL
WHERE id = (SELECT v FROM t_rf WHERE k='gw');
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0e220002-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.shop_order_transition((SELECT v FROM t_rf WHERE k='gw'), 'cancel', 'pending', 'không giao được', NULL)) ->> 'refund_due_vnd',
  '530000', 'huỷ đơn cổng đã trả: transition trả về refund_due_vnd luôn');

-- ─── Grants ─────────────────────────────────────────────────────────────────
SET LOCAL role postgres;
SELECT ok(
  NOT has_function_privilege('anon', 'public.shop_order_mark_refunded(text)', 'EXECUTE'),
  'anon không gọi được shop_order_mark_refunded');
SELECT ok(
  has_function_privilege('authenticated', 'public.shop_order_mark_refunded(text)', 'EXECUTE'),
  'authenticated gọi được — hàm tự kiểm tra vai trò bên trong');

SELECT * FROM finish();
ROLLBACK;
