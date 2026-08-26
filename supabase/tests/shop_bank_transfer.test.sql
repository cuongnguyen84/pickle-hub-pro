-- ============================================================================
-- Phase 4b — bank transfer, VietQR and manual reconciliation.
--
-- What this file is really asking:
--   * can a shop store a HALF-filled bank trio (a QR that scans and then
--     fails is worse than no QR);
--   * can anybody who is not a party to an order read the seller's account
--     number, and can a stranger use the lookup to test whether a code is
--     real;
--   * can the SELLER declare that the BUYER paid — the one direction the
--     claim button must not work in;
--   * can `support`, who cannot move an order, move its money;
--   * does a double tap on a phone move the timestamp;
--   * is payment_confirmed_by reachable from any grant or any projection
--     (it is a uid, and profiles is world-readable to logged-in users).
--
-- Fixture users:
--   b1 buyer · b2 stranger buyer · o1 owner · f1 fulfillment · s1 support ·
--   ad admin (aal2)
-- ============================================================================

BEGIN;

SELECT plan(33);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('0c110001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'btr-b1@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0c220002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'btr-b2@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0c330003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'btr-owner@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0c440004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'btr-fulfil@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0c550005-0000-4000-8000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'btr-support@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0c660006-0000-4000-8000-000000000006'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'btr-admin@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('0c660006-0000-4000-8000-000000000006'::uuid, 'admin') ON CONFLICT DO NOTHING;
INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES ('0c6600f8-0000-4000-8000-000000000008'::uuid, '0c660006-0000-4000-8000-000000000006'::uuid,
        'test-totp', 'totp', 'verified', NOW(), NOW(), 'JBSWY3DPEHPK3PXP');

INSERT INTO public.shop_pilot_members (user_id)
VALUES ('0c330003-0000-4000-8000-000000000003'::uuid) ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id, ordering_enabled, shipping_fee_vnd,
                          bank_code, bank_account_number, bank_account_name) VALUES
  ('0c990001-0000-4000-8000-000000000001'::uuid, 'btr-shop', 'Shop Chuyển Khoản', 'active',
   '0c330003-0000-4000-8000-000000000003'::uuid, true, 30000,
   'MB', '0123456789', 'NGUYEN VAN CUONG');

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('0c990001-0000-4000-8000-000000000001'::uuid, '0c330003-0000-4000-8000-000000000003'::uuid, 'owner'),
  ('0c990001-0000-4000-8000-000000000001'::uuid, '0c440004-0000-4000-8000-000000000004'::uuid, 'fulfillment'),
  ('0c990001-0000-4000-8000-000000000001'::uuid, '0c550005-0000-4000-8000-000000000005'::uuid, 'support');

SELECT set_config('shop.privileged_write', 'on', true);
INSERT INTO public.products (id, shop_id, slug, title, description, category_slug, status, is_published) VALUES
  ('0c880001-0000-4000-8000-000000000001'::uuid, '0c990001-0000-4000-8000-000000000001'::uuid,
   'btr-vot', 'Vợt Chuyển Khoản', 'Vợt carbon T700, lõi tổ ong 16mm.', 'vot', 'approved', true);
SELECT set_config('shop.privileged_write', 'off', true);

INSERT INTO public.product_variants (id, product_id, shop_id, price_vnd, stock_on_hand, position) VALUES
  ('0c770001-0000-4000-8000-000000000001'::uuid, '0c880001-0000-4000-8000-000000000001'::uuid,
   '0c990001-0000-4000-8000-000000000001'::uuid, 1000000, 10, 0);

CREATE TEMP TABLE t_btr (k TEXT PRIMARY KEY, v TEXT);
GRANT SELECT, INSERT ON t_btr TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.line(_variant UUID, _qty INT, _price INT)
RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_build_array(jsonb_build_object(
    'variant_id', _variant, 'qty', _qty, 'expected_unit_price_vnd', _price))
$$;

CREATE OR REPLACE FUNCTION pg_temp.state_of(_sql TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE _sql;
  RETURN 'no-error';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;

-- ─── 1. The trio is all-or-nothing ──────────────────────────────────────────

SELECT is(
  pg_temp.state_of($$
    INSERT INTO public.shops (id, slug, name, state, owner_user_id, bank_code)
    VALUES ('0c990009-0000-4000-8000-000000000009'::uuid, 'btr-half', 'Nửa Vời', 'active',
            '0c330003-0000-4000-8000-000000000003'::uuid, 'MB') $$),
  '23514',
  'một mình mã ngân hàng bị từ chối — QR nửa vời quét được rồi mới hỏng');

SELECT is(
  pg_temp.state_of($$
    UPDATE public.shops SET bank_account_number = '01 23 456'
    WHERE id = '0c990001-0000-4000-8000-000000000001'::uuid $$),
  '23514',
  'số tài khoản có khoảng trắng không được lưu — một dạng lưu duy nhất');

SELECT is(
  (SELECT bank_account_number FROM public.shops WHERE id='0c990001-0000-4000-8000-000000000001'::uuid),
  '0123456789',
  'và số cũ không bị câu UPDATE hỏng làm sứt mẻ');

-- shop_profile_update strips the spaces the seller pasted, rather than telling
-- them their own account number is invalid.
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0c330003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.shop_profile_update('0c990001-0000-4000-8000-000000000001'::uuid,
     (SELECT version FROM public.shops WHERE id='0c990001-0000-4000-8000-000000000001'::uuid),
     '{"bank_account_number":"0123 4567 89"}'::jsonb)).bank_account_number,
  '0123456789',
  'người bán dán "0123 4567 89" thì server tự bỏ khoảng trắng');

SELECT is(
  (public.shop_profile_update('0c990001-0000-4000-8000-000000000001'::uuid,
     (SELECT version FROM public.shops WHERE id='0c990001-0000-4000-8000-000000000001'::uuid),
     '{"bank_code":"VCB"}'::jsonb)).bank_code,
  'VCB', 'và đổi được mã ngân hàng — cột này là của người bán, không bị trigger ghim');

-- Put it back so the rest of the file reads the shape it set up.
SELECT ok(
  (public.shop_profile_update('0c990001-0000-4000-8000-000000000001'::uuid,
     (SELECT version FROM public.shops WHERE id='0c990001-0000-4000-8000-000000000001'::uuid),
     '{"bank_code":"MB"}'::jsonb)).bank_code = 'MB', 'khôi phục fixture');

-- ─── 2. Two orders: one transfer, one COD ───────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"0c110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

INSERT INTO t_btr VALUES ('bank', (public.shop_order_create(
  'tok-btr-1', 'bank_transfer', 'Nguyễn Văn A', '0912345678',
  'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', NULL, 30000,
  pg_temp.line('0c770001-0000-4000-8000-000000000001'::uuid, 1, 1000000)) ->> 'code'));

INSERT INTO t_btr VALUES ('cod', (public.shop_order_create(
  'tok-btr-2', 'cod', 'Nguyễn Văn A', '0912345678',
  'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', NULL, 30000,
  pg_temp.line('0c770001-0000-4000-8000-000000000001'::uuid, 1, 1000000)) ->> 'code'));

-- ─── 3. Who may read the account number ─────────────────────────────────────

SELECT is(
  (public.shop_order_payment_info((SELECT v FROM t_btr WHERE k='bank'))) -> 'bank' ->> 'account_number',
  '0123456789', 'người mua của đơn đọc được số tài khoản để chuyển');

SELECT is(
  (public.shop_order_payment_info((SELECT v FROM t_btr WHERE k='bank'))) ->> 'memo',
  (SELECT v FROM t_btr WHERE k='bank'),
  'nội dung chuyển khoản CHÍNH LÀ mã đơn — sợi dây duy nhất nối dòng sao kê với đơn');

SELECT is(
  (public.shop_order_payment_info((SELECT v FROM t_btr WHERE k='bank'))) ->> 'amount_vnd',
  '1030000', 'và số tiền là tổng của đơn, do Postgres tính');

SELECT is(
  (public.shop_order_payment_info((SELECT v FROM t_btr WHERE k='cod'))) -> 'bank',
  'null'::jsonb, 'đơn COD không kèm thông tin ngân hàng');

SET LOCAL request.jwt.claims TO '{"sub":"0c220002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.shop_order_payment_info((SELECT v FROM t_btr WHERE k='bank'))) ->> 'found',
  'false', 'người lạ không đọc được thông tin thanh toán của đơn người khác');
SELECT is(
  public.shop_order_payment_info('PH-0000-XXXX'),
  public.shop_order_payment_info((SELECT v FROM t_btr WHERE k='bank')),
  'và mã có thật trả lời GIỐNG HỆT mã bịa — không dò được đơn nào tồn tại');

-- ─── 4. The claim is the buyer's, and only the buyer's ──────────────────────

SELECT is(
  pg_temp.state_of(format($$ SELECT public.shop_order_claim_payment(%L) $$,
    (SELECT v FROM t_btr WHERE k='bank'))),
  '42501', 'người lạ không báo hộ được');

SET LOCAL request.jwt.claims TO '{"sub":"0c330003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
SELECT is(
  pg_temp.state_of(format($$ SELECT public.shop_order_claim_payment(%L) $$,
    (SELECT v FROM t_btr WHERE k='bank'))),
  '42501',
  'người BÁN cũng không — "khách đã chuyển rồi" không phải câu của người bán');

SET LOCAL request.jwt.claims TO '{"sub":"0c110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  pg_temp.state_of(format($$ SELECT public.shop_order_claim_payment(%L) $$,
    (SELECT v FROM t_btr WHERE k='cod'))),
  '22023', 'đơn COD không có gì để báo đã chuyển');

SELECT ok(
  ((public.shop_order_claim_payment((SELECT v FROM t_btr WHERE k='bank'))) ->> 'claimed_at') IS NOT NULL,
  'người mua báo đã chuyển khoản');

INSERT INTO t_btr VALUES ('claim1',
  (public.shop_order_claim_payment((SELECT v FROM t_btr WHERE k='bank'))) ->> 'claimed_at');
SELECT is(
  (public.shop_order_claim_payment((SELECT v FROM t_btr WHERE k='bank'))) ->> 'claimed_at',
  (SELECT v FROM t_btr WHERE k='claim1'),
  'bấm lần hai không dời mốc thời gian — nút nằm trên điện thoại, chạm đúp là chuyện thường');

SELECT ok(
  ((public.shop_order_claim_payment((SELECT v FROM t_btr WHERE k='bank'))) ->> 'confirmed_at') IS NULL,
  'và người mua tự báo KHÔNG làm đơn thành đã nhận tiền');

-- ─── 5. The confirmation is the seller's ────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"0c550005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
SELECT is(
  pg_temp.state_of(format($$ SELECT public.shop_order_confirm_payment(%L) $$,
    (SELECT v FROM t_btr WHERE k='bank'))),
  '42501',
  'vai support không xác nhận được tiền — vai không chuyển được trạng thái thì cũng không đụng vào tiền');

SET LOCAL request.jwt.claims TO '{"sub":"0c110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  pg_temp.state_of(format($$ SELECT public.shop_order_confirm_payment(%L) $$,
    (SELECT v FROM t_btr WHERE k='bank'))),
  '42501', 'người mua không tự xác nhận là shop đã nhận tiền');

SET LOCAL request.jwt.claims TO '{"sub":"0c440004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
SELECT ok(
  ((public.shop_order_confirm_payment((SELECT v FROM t_btr WHERE k='bank'))) ->> 'confirmed_at') IS NOT NULL,
  'vai fulfillment xác nhận được — cùng ba vai giao được hàng');

INSERT INTO t_btr VALUES ('conf1',
  (public.shop_order_confirm_payment((SELECT v FROM t_btr WHERE k='bank'))) ->> 'confirmed_at');
SELECT is(
  (public.shop_order_confirm_payment((SELECT v FROM t_btr WHERE k='bank'))) ->> 'confirmed_at',
  (SELECT v FROM t_btr WHERE k='conf1'),
  'xác nhận lần hai cũng không dời mốc');

-- A second order, confirmed with NO claim: the seller watches their own bank
-- feed, and money that has arrived must not sit marked unpaid because the
-- buyer never pressed anything.
SET LOCAL request.jwt.claims TO '{"sub":"0c110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
INSERT INTO t_btr VALUES ('bank2', (public.shop_order_create(
  'tok-btr-3', 'bank_transfer', 'Nguyễn Văn A', '0912345678',
  'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', NULL, 30000,
  pg_temp.line('0c770001-0000-4000-8000-000000000001'::uuid, 1, 1000000)) ->> 'code'));

SET LOCAL request.jwt.claims TO '{"sub":"0c660006-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}';
SELECT ok(
  ((public.shop_order_confirm_payment((SELECT v FROM t_btr WHERE k='bank2'))) ->> 'confirmed_at') IS NOT NULL,
  'quản trị viên xác nhận được, KHÔNG cần người mua bấm báo trước');
SELECT ok(
  ((public.shop_order_confirm_payment((SELECT v FROM t_btr WHERE k='bank2'))) ->> 'claimed_at') IS NULL,
  'và mốc "người mua đã báo" vẫn trống — hai sự kiện khác nhau, không suy ra nhau');

-- ─── 6. The status machine is untouched ─────────────────────────────────────

SET LOCAL role postgres;
SELECT is(
  (SELECT status FROM public.shop_orders WHERE code = (SELECT v FROM t_btr WHERE k='bank')),
  'pending',
  'xác nhận tiền KHÔNG chuyển trạng thái đơn — D2 vẫn đúng: không có awaiting_payment');

SELECT is(
  (SELECT count(*)::int FROM pg_constraint c
   WHERE c.conrelid = 'public.shop_orders'::regclass
     AND pg_get_constraintdef(c.oid) ILIKE '%awaiting_payment%'),
  0, 'và không có trạng thái mới nào được thêm vào máy trạng thái');

-- ─── 7. payment_confirmed_by never leaves the server ────────────────────────

SELECT ok(
  NOT has_column_privilege('authenticated', 'public.shop_orders', 'payment_confirmed_by', 'SELECT'),
  'payment_confirmed_by không nằm trong grant — nó là uid, và profiles đọc được bởi mọi người đăng nhập');

SELECT ok(
  has_column_privilege('authenticated', 'public.shop_orders', 'payment_claimed_at', 'SELECT'),
  'nhưng hai cột mốc thời gian thì có');
SELECT ok(
  has_column_privilege('authenticated', 'public.shop_orders', 'payment_confirmed_at', 'SELECT'),
  'cả hai');

SELECT is(
  (SELECT count(*)::int FROM information_schema.columns
   WHERE table_schema='public' AND table_name='my_shop_orders'
     AND column_name IN ('payment_confirmed_by', 'buyer_user_id', 'cancelled_by')),
  0,
  'và view my_shop_orders không mang uid nào — danh sách cột của view là hàng rào thứ hai');

SELECT is(
  (SELECT count(*)::int FROM information_schema.columns
   WHERE table_schema='public' AND table_name='my_shop_orders'
     AND column_name IN ('payment_claimed_at', 'payment_confirmed_at')),
  2, 'người mua thấy được tình trạng thanh toán của chính đơn mình');

-- ─── 8. A cancelled order takes no more money ───────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0c110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
INSERT INTO t_btr VALUES ('bank3', (public.shop_order_create(
  'tok-btr-4', 'bank_transfer', 'Nguyễn Văn A', '0912345678',
  'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', NULL, 30000,
  pg_temp.line('0c770001-0000-4000-8000-000000000001'::uuid, 1, 1000000)) ->> 'code'));

SELECT ok(
  (public.shop_order_transition(
     (SELECT id FROM public.shop_orders WHERE code=(SELECT v FROM t_btr WHERE k='bank3')),
     'cancel', 'pending', 'Đổi ý', NULL)) IS NOT NULL,
  'người mua huỷ đơn khi shop chưa xác nhận');

SELECT is(
  pg_temp.state_of(format($$ SELECT public.shop_order_claim_payment(%L) $$,
    (SELECT v FROM t_btr WHERE k='bank3'))),
  '22023', 'đơn đã huỷ thì không báo chuyển khoản được nữa');

SELECT * FROM finish();
ROLLBACK;
