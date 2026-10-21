-- ============================================================================
-- Shop Phase 3 — S2: the order core.
--
-- What this file is really asking:
--   * can a client hand the server a total, a shop id, or somebody else's
--     buyer id;
--   * does a retry produce a second order, a second stock movement, a second
--     refund;
--   * is every refusal distinguishable — SQLSTATE *and* a machine-readable
--     `reason`, because the checkout screen has to say a different sentence
--     for each one, and "it threw something" is an empty assertion;
--   * does a refusal leave the database exactly as it found it;
--   * can somebody who is not a party to an order move it;
--   * does cancelling put the stock back exactly once, through a NEW ledger
--     row rather than by editing the old one;
--   * can the order timeline be edited by anybody, INCLUDING somebody who has
--     been handed the grant.
--
-- Fixture users, first 12 hex chars all distinct (handle_new_user derives
-- profiles.profile_slug from them):
--   b1 buyer · b2 buyer (pending-limit) · b3 buyer with NO profiles row ·
--   o1 owner · f1 fulfillment · s1 support · ad admin (aal2) · r1 rival owner
-- ============================================================================

BEGIN;

SELECT plan(118);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('0d110001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ord-b1@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0d220002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ord-b2@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0d330003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ord-b3@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0d440004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ord-owner@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0d550005-0000-4000-8000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ord-fulfil@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0d660006-0000-4000-8000-000000000006'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ord-support@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0d770007-0000-4000-8000-000000000007'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ord-admin@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('0d880008-0000-4000-8000-000000000008'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ord-rival@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('0d770007-0000-4000-8000-000000000007'::uuid, 'admin') ON CONFLICT DO NOTHING;
INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES ('0d7700f8-0000-4000-8000-000000000008'::uuid, '0d770007-0000-4000-8000-000000000007'::uuid,
        'test-totp', 'totp', 'verified', NOW(), NOW(), 'JBSWY3DPEHPK3PXP');

INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('0d440004-0000-4000-8000-000000000004'::uuid),
  ('0d880008-0000-4000-8000-000000000008'::uuid) ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id, ordering_enabled, shipping_fee_vnd) VALUES
  ('0e110001-0000-4000-8000-000000000001'::uuid, 'ord-shop-a', 'Shop Đơn A', 'active',
   '0d440004-0000-4000-8000-000000000004'::uuid, true,  30000),
  ('0e220002-0000-4000-8000-000000000002'::uuid, 'ord-shop-b', 'Shop Chưa Bật Bán', 'active',
   '0d440004-0000-4000-8000-000000000004'::uuid, false, 0),
  ('0e330003-0000-4000-8000-000000000003'::uuid, 'ord-shop-c', 'Shop Bị Gỡ', 'suspended',
   '0d440004-0000-4000-8000-000000000004'::uuid, true,  0),
  ('0e440004-0000-4000-8000-000000000004'::uuid, 'ord-shop-d', 'Shop Đối Thủ', 'active',
   '0d880008-0000-4000-8000-000000000008'::uuid, true,  0);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('0e110001-0000-4000-8000-000000000001'::uuid, '0d440004-0000-4000-8000-000000000004'::uuid, 'owner'),
  ('0e110001-0000-4000-8000-000000000001'::uuid, '0d550005-0000-4000-8000-000000000005'::uuid, 'fulfillment'),
  ('0e110001-0000-4000-8000-000000000001'::uuid, '0d660006-0000-4000-8000-000000000006'::uuid, 'support'),
  ('0e220002-0000-4000-8000-000000000002'::uuid, '0d440004-0000-4000-8000-000000000004'::uuid, 'owner'),
  ('0e330003-0000-4000-8000-000000000003'::uuid, '0d440004-0000-4000-8000-000000000004'::uuid, 'owner'),
  ('0e440004-0000-4000-8000-000000000004'::uuid, '0d880008-0000-4000-8000-000000000008'::uuid, 'owner');

SELECT set_config('shop.privileged_write', 'on', true);
INSERT INTO public.products (id, shop_id, slug, title, description, category_slug, status, is_published) VALUES
  ('0f110001-0000-4000-8000-000000000001'::uuid, '0e110001-0000-4000-8000-000000000001'::uuid,
   'ord-vot-chinh', 'Vợt Bán Chạy', 'Vợt carbon T700, lõi tổ ong 16mm.', 'vot', 'approved', true),
  ('0f220002-0000-4000-8000-000000000002'::uuid, '0e110001-0000-4000-8000-000000000001'::uuid,
   'ord-bong-khong-dem', 'Bóng Không Đếm Kho', 'Shop này không đếm tồn.', 'bong', 'approved', true),
  ('0f330003-0000-4000-8000-000000000003'::uuid, '0e110001-0000-4000-8000-000000000001'::uuid,
   'ord-vot-nghi-ban', 'Vợt Nghỉ Bán', 'Phiên bản đã nghỉ.', 'vot', 'approved', true),
  ('0f440004-0000-4000-8000-000000000004'::uuid, '0e110001-0000-4000-8000-000000000001'::uuid,
   'ord-vot-nhap', 'Vợt Bản Nháp', 'Chưa gửi duyệt.', 'vot', 'draft', false),
  ('0f550005-0000-4000-8000-000000000005'::uuid, '0e220002-0000-4000-8000-000000000002'::uuid,
   'ord-vot-tat-ban', 'Vợt Shop Tắt Bán', 'Shop chưa bật bán.', 'vot', 'approved', true),
  ('0f660006-0000-4000-8000-000000000006'::uuid, '0e330003-0000-4000-8000-000000000003'::uuid,
   'ord-vot-shop-go', 'Vợt Shop Bị Gỡ', 'Shop bị gỡ.', 'vot', 'approved', true),
  ('0f770007-0000-4000-8000-000000000007'::uuid, '0e440004-0000-4000-8000-000000000004'::uuid,
   'ord-vot-doi-thu', 'Vợt Shop Đối Thủ', 'Shop khác.', 'vot', 'approved', true);
SELECT set_config('shop.privileged_write', 'off', true);

INSERT INTO public.product_variants (id, product_id, shop_id, price_vnd, stock_on_hand, position) VALUES
  ('01110001-0000-4000-8000-000000000001'::uuid, '0f110001-0000-4000-8000-000000000001'::uuid,
   '0e110001-0000-4000-8000-000000000001'::uuid, 1500000, 5, 0),
  -- NULL = the shop does not count this one. Not zero, and never turned into
  -- zero: an uncounted variant that became 0 would be sold out for ever.
  ('01220002-0000-4000-8000-000000000002'::uuid, '0f220002-0000-4000-8000-000000000002'::uuid,
   '0e110001-0000-4000-8000-000000000001'::uuid,  200000, NULL, 0),
  ('01330003-0000-4000-8000-000000000003'::uuid, '0f330003-0000-4000-8000-000000000003'::uuid,
   '0e110001-0000-4000-8000-000000000001'::uuid,  900000, 4, 0),
  ('01440004-0000-4000-8000-000000000004'::uuid, '0f440004-0000-4000-8000-000000000004'::uuid,
   '0e110001-0000-4000-8000-000000000001'::uuid,  500000, 5, 0),
  ('01550005-0000-4000-8000-000000000005'::uuid, '0f550005-0000-4000-8000-000000000005'::uuid,
   '0e220002-0000-4000-8000-000000000002'::uuid,  100000, 5, 0),
  ('01660006-0000-4000-8000-000000000006'::uuid, '0f660006-0000-4000-8000-000000000006'::uuid,
   '0e330003-0000-4000-8000-000000000003'::uuid,  100000, 5, 0),
  ('01770007-0000-4000-8000-000000000007'::uuid, '0f770007-0000-4000-8000-000000000007'::uuid,
   '0e440004-0000-4000-8000-000000000004'::uuid,  100000, 5, 0);

UPDATE public.product_variants SET retired_at = now()
WHERE id = '01330003-0000-4000-8000-000000000003'::uuid;

CREATE TEMP TABLE t_ord (k TEXT PRIMARY KEY, v UUID);
GRANT SELECT, INSERT ON t_ord TO authenticated;

-- Every refusal in this file is checked as SQLSTATE *plus* `reason`. A
-- throws_ok on the SQLSTATE alone would pass for six different refusals, which
-- is exactly the confusion the checkout copy cannot survive.
CREATE OR REPLACE FUNCTION pg_temp.err(_sql TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE _state TEXT; _detail TEXT; _reason TEXT;
BEGIN
  EXECUTE _sql;
  RETURN 'no-error';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS _state = RETURNED_SQLSTATE, _detail = PG_EXCEPTION_DETAIL;
  BEGIN
    _reason := coalesce((_detail::jsonb) ->> 'reason', '-');
  EXCEPTION WHEN OTHERS THEN
    _reason := '-';
  END;
  RETURN _state || '|' || _reason;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.err_detail(_sql TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE _detail TEXT;
BEGIN
  EXECUTE _sql;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS _detail = PG_EXCEPTION_DETAIL;
  RETURN _detail::jsonb;
END $$;

-- One place that builds a create call, so an assertion reads as the ONE thing
-- it changes rather than as eight repeated arguments.
CREATE OR REPLACE FUNCTION pg_temp.mk(_token TEXT, _fee INT, _items JSONB)
RETURNS TEXT LANGUAGE sql AS $$
  SELECT format(
    $q$ SELECT public.shop_order_create(%L, 'cod', 'Nguyễn Văn A', '0912345678',
          'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', NULL, %s, %L::jsonb) $q$,
    _token, _fee, _items::text)
$$;

-- Same idea, one field further: a bad-payload refusal is only usable by the
-- client if it also names WHICH field, so the whole triple travels in one
-- assertion instead of three that can drift apart.
CREATE OR REPLACE FUNCTION pg_temp.err3(_sql TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE _state TEXT; _detail TEXT; _d JSONB;
BEGIN
  EXECUTE _sql;
  RETURN 'no-error';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS _state = RETURNED_SQLSTATE, _detail = PG_EXCEPTION_DETAIL;
  BEGIN
    _d := _detail::jsonb;
  EXCEPTION WHEN OTHERS THEN
    _d := '{}'::jsonb;
  END;
  RETURN _state || '|' || coalesce(_d ->> 'reason', '-') || '|' || coalesce(_d ->> 'field', '-');
END $$;

-- mk() pins a valid recipient so the item assertions read as one variable. The
-- delivery details need the opposite, so they get their own builder.
CREATE OR REPLACE FUNCTION pg_temp.mk_ship(
  _token TEXT, _name TEXT, _phone TEXT, _addr TEXT, _note TEXT)
RETURNS TEXT LANGUAGE sql AS $$
  SELECT format(
    $q$ SELECT public.shop_order_create(%L, 'cod', %L, %L, %L, %L, 30000, %L::jsonb) $q$,
    _token, _name, _phone, _addr, _note,
    jsonb_build_array(jsonb_build_object(
      'variant_id', '01110001-0000-4000-8000-000000000001'::uuid,
      'qty', 1, 'expected_unit_price_vnd', 1500000))::text)
$$;

CREATE OR REPLACE FUNCTION pg_temp.one(_variant UUID, _qty INT, _price INT)
RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_build_array(jsonb_build_object(
    'variant_id', _variant, 'qty', _qty, 'expected_unit_price_vnd', _price))
$$;

-- ─── Shape, generated columns and grants ────────────────────────────────────

SELECT has_table('public', 'shop_orders',       'đơn hàng có bảng riêng');
SELECT has_table('public', 'shop_order_items',  'dòng đơn hàng có bảng riêng');
SELECT has_table('public', 'shop_order_events', 'nhật ký đơn hàng có bảng riêng');

SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='shop_orders'),
  'RLS bật trên shop_orders');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='shop_order_items'),
  'RLS bật trên shop_order_items');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='shop_order_events'),
  'RLS bật trên shop_order_events');

SELECT ok(NOT (SELECT has_table_privilege('anon', 'public.shop_orders', 'SELECT')),
  'anon KHÔNG đọc được shop_orders');
SELECT ok(NOT (SELECT has_table_privilege('anon', 'public.shop_order_items', 'SELECT')),
  'anon KHÔNG đọc được shop_order_items');
SELECT ok(NOT (SELECT has_table_privilege('anon', 'public.shop_order_events', 'SELECT')),
  'anon KHÔNG đọc được shop_order_events');

SELECT ok(NOT (SELECT has_column_privilege('authenticated', 'public.shop_orders', 'buyer_user_id', 'SELECT')),
  'buyer_user_id KHÔNG bao giờ ra ngoài qua REST');
SELECT ok(NOT (SELECT has_column_privilege('authenticated', 'public.shop_orders', 'client_token', 'SELECT')),
  'khoá chống trùng cũng không');
-- cancelled_by is a uid of auth.users, and 20260504100000 lets every logged-in
-- user read all of profiles — so granting it hands the seller the buyer's real
-- name, avatar and DUPR through profiles.id, and hands the buyer the uid of the
-- staff member who cancelled. Same invariant as buyer_user_id, third column.
-- The timeline needs none of it: it renders metadata->>'actor_kind'.
SELECT ok(NOT (SELECT has_column_privilege('authenticated', 'public.shop_orders', 'cancelled_by', 'SELECT')),
  'ai huỷ đơn cũng không — cancelled_by là uid, không ra ngoài qua REST');
SELECT ok((SELECT has_column_privilege('authenticated', 'public.shop_orders', 'recipient_phone', 'SELECT')),
  'nhưng người bán đọc được SĐT giao hàng — đó là cách họ gọi người mua');

-- Withholding buyer_user_id on shop_orders is not the invariant; withholding
-- the BUYER'S IDENTITY is. The `create` event's actor IS the buyer, and the
-- events read policy admits every party — so a grant on this column would hand
-- the seller, `support` and every member the same uid through another table.
SELECT ok(NOT (SELECT has_column_privilege('authenticated', 'public.shop_order_events', 'actor_user_id', 'SELECT')),
  'nhật ký đơn: actor_user_id KHÔNG cấp cho authenticated — uid người mua không rò qua cột khác');

SELECT ok(NOT (SELECT has_table_privilege('authenticated', 'public.shop_orders', 'INSERT')),
  'client KHÔNG tự tạo đơn bằng INSERT');
SELECT ok(NOT (SELECT has_table_privilege('authenticated', 'public.shop_orders', 'UPDATE')),
  'client KHÔNG tự đổi trạng thái bằng PATCH');
SELECT ok(NOT (SELECT has_table_privilege('authenticated', 'public.shop_orders', 'DELETE')),
  'và KHÔNG xoá được đơn — huỷ là một trạng thái');
SELECT ok(NOT (SELECT has_table_privilege('authenticated', 'public.shop_order_events', 'UPDATE')),
  'nhật ký đơn: không GRANT UPDATE cho ai');
SELECT ok(NOT (SELECT has_table_privilege('authenticated', 'public.shop_order_events', 'DELETE')),
  'nhật ký đơn: không GRANT DELETE cho ai');

SELECT is(
  (SELECT is_generated FROM information_schema.columns
   WHERE table_schema='public' AND table_name='shop_orders' AND column_name='total_vnd'),
  'ALWAYS', 'tổng tiền do CSDL giữ, RPC không bao giờ nhận tổng từ client');
SELECT is(
  (SELECT is_generated FROM information_schema.columns
   WHERE table_schema='public' AND table_name='shop_order_items' AND column_name='line_total_vnd'),
  'ALWAYS', 'thành tiền từng dòng cũng vậy');
SELECT is(
  (SELECT is_generated FROM information_schema.columns
   WHERE table_schema='public' AND table_name='shop_orders' AND column_name='confirm_due_at'),
  'NEVER',
  'confirm_due_at là cột thường — timestamptz + interval là STABLE, generated sẽ bị từ chối 42P17');

-- ─── The buyer places an order ──────────────────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0d110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

-- Two shops in the cart. Only one of them is being ordered from.
INSERT INTO public.shop_cart_items (variant_id, qty) VALUES
  ('01110001-0000-4000-8000-000000000001'::uuid, 2),
  ('01770007-0000-4000-8000-000000000007'::uuid, 1);

INSERT INTO t_ord VALUES ('o1', (public.shop_order_create(
  'tok-o1', 'cod', 'Nguyễn Văn A', '0912345678',
  'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', 'Gọi trước khi giao', 30000,
  pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 2, 1500000)) ->> 'id')::uuid);

-- shop_order_json is SECURITY DEFINER and deliberately NOT granted to
-- authenticated: it takes an order id and would answer for any of them. It is
-- read here as postgres, the way the two RPCs reach it.
SET LOCAL role postgres;

SELECT is(
  (public.shop_order_json((SELECT v FROM t_ord WHERE k='o1'))) ->> 'status',
  'pending', 'đơn mới ở trạng thái chờ shop xác nhận');

SELECT is(
  (public.shop_order_json((SELECT v FROM t_ord WHERE k='o1'))) ->> 'total_vnd',
  '3030000', 'tổng = 2 × 1 500 000 + 30 000 phí ship, do cột generated tính');

SELECT ok(
  NOT ((public.shop_order_json((SELECT v FROM t_ord WHERE k='o1'))) ? 'buyer_user_id'),
  'payload trả về KHÔNG mang buyer_user_id');

SELECT matches(
  (public.shop_order_json((SELECT v FROM t_ord WHERE k='o1'))) ->> 'code',
  '^PH-[0-9]{4}-[0-9A-Z]{4}$',
  'mã đơn dạng PH-YYMM-XXXX, đuôi ngẫu nhiên chứ không tuần tự');

SELECT is(
  (SELECT stock_on_hand FROM public.product_variants WHERE id='01110001-0000-4000-8000-000000000001'::uuid),
  3, 'tồn kho trừ đúng 2');

SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements
   WHERE reason='sale' AND client_token = 'order:' || (SELECT v FROM t_ord WHERE k='o1')::text || ':sale'),
  1, 'đúng một dòng sổ kho reason=sale');

SELECT is(
  (SELECT delta::text || '/' || on_hand_before::text || '/' || on_hand_after::text
   FROM public.inventory_movements
   WHERE reason='sale' AND client_token = 'order:' || (SELECT v FROM t_ord WHERE k='o1')::text || ':sale'),
  '-2/5/3', 'sổ kho ghi cả delta lẫn trước/sau, không chỉ con số cuối');

SELECT is(
  (SELECT count(*)::int FROM public.shop_order_events
   WHERE order_id=(SELECT v FROM t_ord WHERE k='o1') AND action='create' AND to_status='pending'),
  1, 'dòng thời gian bắt đầu bằng đúng một sự kiện create');

SELECT is(
  (SELECT count(*)::int FROM public.audit_logs
   WHERE event_category='shop' AND resource_type='shop_order'
     AND resource_id=(SELECT v FROM t_ord WHERE k='o1')::text AND event_type='shop_order_create'),
  1, 'log_audit_event gọi được — mọi tham số ép kiểu nên không dính 42725 nhập nhằng overload');

SELECT is(
  (SELECT count(*)::int FROM public.social_notifications
   WHERE user_id='0d440004-0000-4000-8000-000000000004'::uuid AND type='shop_order_new'),
  1, 'chủ shop nhận được chuông trong app');

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0d110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

-- Counted by variant id, NOT by joining product_variants: that join is subject
-- to the variants' own RLS, and under it the "shop A cart is empty" assertion
-- passes whether the delete worked or not. A vacuous pass is worse than a red.
SELECT is(
  (SELECT count(*)::int FROM public.shop_cart_items
   WHERE variant_id = '01110001-0000-4000-8000-000000000001'::uuid),
  0, 'giỏ của shop vừa đặt được dọn');

SELECT is(
  (SELECT count(*)::int FROM public.shop_cart_items
   WHERE variant_id = '01770007-0000-4000-8000-000000000007'::uuid),
  1, 'giỏ của shop KHÁC còn nguyên — mỗi shop là một đơn riêng');

-- ─── Idempotency ────────────────────────────────────────────────────────────

SELECT is(
  (public.shop_order_create(
    'tok-o1', 'cod', 'Nguyễn Văn A', '0912345678',
    'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', 'Gọi trước khi giao', 30000,
    pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 2, 1500000))) ->> 'id',
  (SELECT v FROM t_ord WHERE k='o1')::text,
  'gọi lại cùng client_token trả về CHÍNH đơn đó');

SET LOCAL role postgres;

SELECT is((SELECT count(*)::int FROM public.shop_orders), 1, 'không sinh đơn thứ hai');
SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements WHERE reason='sale'),
  1, 'không trừ kho lần thứ hai');
SELECT is(
  (SELECT stock_on_hand FROM public.product_variants WHERE id='01110001-0000-4000-8000-000000000001'::uuid),
  3, 'tồn kho chỉ giảm một lần');

-- ─── Every refusal, by SQLSTATE and by reason ───────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0d110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is(
  pg_temp.err(pg_temp.mk('tok-price', 30000,
    pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 1, 1400000))),
  'PT409|price_changed', 'giá đã đổi: PT409 + reason price_changed');

SELECT is(
  (pg_temp.err_detail(pg_temp.mk('tok-price-2', 30000,
    pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 1, 1400000)))
   - 'reason' - 'variant_id'),
  '{"current": 1500000, "expected": 1400000}'::jsonb,
  'và DETAIL mang cả giá client tưởng lẫn giá thật, để màn hình nói được con số');

SET LOCAL role postgres;
SELECT is((SELECT count(*)::int FROM public.shop_orders), 1,
  'lần từ chối vì giá KHÔNG để lại đơn nào');
SELECT is((SELECT count(*)::int FROM public.shop_order_items), 1,
  'không dòng đơn nào rơi lại');
SELECT is((SELECT count(*)::int FROM public.inventory_movements WHERE reason='sale'), 1,
  'không dòng sổ kho nào rơi lại');
SELECT is(
  (SELECT stock_on_hand FROM public.product_variants WHERE id='01110001-0000-4000-8000-000000000001'::uuid),
  3, 'và không đụng vào tồn kho');
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0d110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is(
  pg_temp.err(pg_temp.mk('tok-ship', 25000,
    pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 1, 1500000))),
  'PT409|shipping_fee_changed', 'phí ship đã đổi: PT409 + reason shipping_fee_changed');

SELECT is(
  (pg_temp.err_detail(pg_temp.mk('tok-ship-2', 25000,
    pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 1, 1500000))) - 'reason'),
  '{"current": 30000, "expected": 25000}'::jsonb,
  'DETAIL của phí ship cũng mang hai con số');

SELECT is(
  pg_temp.err(pg_temp.mk('tok-stock', 30000,
    pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 9, 1500000))),
  'PT409|insufficient_stock', 'không đủ tồn: PT409 + reason insufficient_stock');

SELECT is(
  (pg_temp.err_detail(pg_temp.mk('tok-stock-2', 30000,
    pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 9, 1500000)))
   - 'reason' - 'variant_id'),
  '{"available": 3, "requested": 9}'::jsonb,
  'và nói còn bao nhiêu, xin bao nhiêu');

SELECT is(
  pg_temp.err(pg_temp.mk('tok-retired', 30000,
    pg_temp.one('01330003-0000-4000-8000-000000000003'::uuid, 1, 900000))),
  'PT409|variant_unavailable', 'phiên bản đã nghỉ bán: PT409 + reason variant_unavailable');

SELECT is(
  pg_temp.err(pg_temp.mk('tok-draft', 30000,
    pg_temp.one('01440004-0000-4000-8000-000000000004'::uuid, 1, 500000))),
  'PT409|product_unavailable', 'sản phẩm chưa duyệt/chưa bật bán: PT409 + reason product_unavailable');

SELECT is(
  pg_temp.err(pg_temp.mk('tok-off', 0,
    pg_temp.one('01550005-0000-4000-8000-000000000005'::uuid, 1, 100000))),
  'PT403|ordering_disabled', 'shop chưa bật bán: PT403 + reason ordering_disabled');

SELECT is(
  pg_temp.err(pg_temp.mk('tok-suspended', 0,
    pg_temp.one('01660006-0000-4000-8000-000000000006'::uuid, 1, 100000))),
  'PT403|shop_inactive', 'shop không active: PT403 + reason shop_inactive');

SELECT is(
  pg_temp.err(pg_temp.mk('tok-empty', 30000, '[]'::jsonb)),
  '22023|invalid_payload', 'giỏ rỗng: 22023 + reason invalid_payload');

SELECT is(
  pg_temp.err(pg_temp.mk('tok-dup', 30000,
    pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 1, 1500000) ||
    pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 1, 1500000))),
  '22023|invalid_payload', 'trùng phiên bản: 22023 + reason invalid_payload');

SELECT is(
  pg_temp.err(pg_temp.mk('tok-qty', 30000,
    pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 11, 1500000))),
  '22023|invalid_payload', 'số lượng ngoài 1..10: 22023 + reason invalid_payload');

-- ─── A payload the client got wrong is still IN the contract ────────────────
-- Left bare, these produce 22P02 / 22003 / 23514 — SQLSTATEs with no `reason`
-- in them, which a client that switches on `reason` renders as "unknown error"
-- for a request IT malformed.

SELECT is(
  pg_temp.err3(pg_temp.mk('tok-qty-text', 30000,
    jsonb_build_array(jsonb_build_object(
      'variant_id', '01110001-0000-4000-8000-000000000001'::uuid,
      'qty', 'abc', 'expected_unit_price_vnd', 1500000)))),
  '22023|invalid_payload|items.qty', 'qty là chữ: 22023 + invalid_payload + field items.qty');

SELECT is(
  pg_temp.err3(pg_temp.mk('tok-qty-huge', 30000,
    jsonb_build_array(jsonb_build_object(
      'variant_id', '01110001-0000-4000-8000-000000000001'::uuid,
      'qty', 99999999999::bigint, 'expected_unit_price_vnd', 1500000)))),
  '22023|invalid_payload|items.qty', 'qty tràn int: 22023 + invalid_payload + field items.qty');

SELECT is(
  pg_temp.err3(pg_temp.mk('tok-price-null', 30000,
    jsonb_build_array(jsonb_build_object(
      'variant_id', '01110001-0000-4000-8000-000000000001'::uuid,
      'qty', 1, 'expected_unit_price_vnd', NULL)))),
  '22023|invalid_payload|items.expected_unit_price_vnd',
  'thiếu giá đã hiển thị: 22023 + invalid_payload + field items.expected_unit_price_vnd');

SELECT is(
  pg_temp.err3(pg_temp.mk_ship('tok-phone', 'Nguyễn Văn A', '123',
    'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', NULL)),
  '22023|invalid_payload|recipient_phone',
  'SĐT sai dạng: 22023 + invalid_payload + field recipient_phone (không phải 23514 từ CHECK)');

SELECT is(
  pg_temp.err3(pg_temp.mk_ship('tok-addr', 'Nguyễn Văn A', '0912345678', 'Số 1', NULL)),
  '22023|invalid_payload|shipping_address',
  'địa chỉ quá ngắn: 22023 + invalid_payload + field shipping_address');

SELECT is(
  pg_temp.err3(pg_temp.mk_ship('tok-note', 'Nguyễn Văn A', '0912345678',
    'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', repeat('x', 250))),
  '22023|invalid_payload|delivery_note',
  'ghi chú quá dài: 22023 + invalid_payload + field delivery_note');

SELECT is(
  pg_temp.err(pg_temp.mk('tok-multishop', 30000,
    pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 1, 1500000) ||
    pg_temp.one('01770007-0000-4000-8000-000000000007'::uuid, 1, 100000))),
  '22023|invalid_payload', 'món của hai shop trong một đơn: 22023 + reason invalid_payload');

SELECT is(
  (pg_temp.err_detail(pg_temp.mk('tok-multishop-2', 30000,
    pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 1, 1500000) ||
    pg_temp.one('01770007-0000-4000-8000-000000000007'::uuid, 1, 100000)))) ->> 'field',
  'items.shop_id', 'và DETAIL chỉ đúng trường sai');

-- Every refusal above is also a claim that NOTHING happened. Asserted here
-- once, over the whole block, rather than repeated after each one.
SET LOCAL role postgres;
SELECT is((SELECT count(*)::int FROM public.shop_orders), 1,
  'sau MỌI lần từ chối ở trên, vẫn đúng một đơn tồn tại');
SELECT is((SELECT count(*)::int FROM public.shop_order_items), 1,
  'và đúng một dòng đơn');
SELECT is((SELECT count(*)::int FROM public.inventory_movements WHERE reason='sale'), 1,
  'và đúng một dòng sổ kho sale');
SELECT is(
  (SELECT stock_on_hand FROM public.product_variants WHERE id='01110001-0000-4000-8000-000000000001'::uuid),
  3, 'và tồn kho y nguyên');
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0d110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

-- ─── stock_on_hand IS NULL: orderable, and no ledger row ────────────────────

INSERT INTO t_ord VALUES ('o2', (public.shop_order_create(
  'tok-o2', 'bank_transfer', 'Nguyễn Văn A', '0912345678',
  'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', NULL, 30000,
  pg_temp.one('01220002-0000-4000-8000-000000000002'::uuid, 3, 200000)) ->> 'id')::uuid);

SET LOCAL role postgres;
SELECT is(
  (public.shop_order_json((SELECT v FROM t_ord WHERE k='o2'))) ->> 'status',
  'pending', 'phiên bản KHÔNG đếm tồn vẫn đặt được');

SELECT ok(
  (SELECT stock_on_hand IS NULL FROM public.product_variants
   WHERE id='01220002-0000-4000-8000-000000000002'::uuid),
  'và tồn của nó vẫn là NULL — "không đếm" không bị biến thành 0');
SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements
   WHERE variant_id='01220002-0000-4000-8000-000000000002'::uuid),
  0, 'không sinh dòng sổ kho nào cho phiên bản không đếm');

-- ─── Who may move an order ──────────────────────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0d110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  pg_temp.err(format($$ SELECT public.shop_order_transition(%L::uuid,'confirm','pending',NULL,NULL) $$,
    (SELECT v FROM t_ord WHERE k='o1'))),
  '42501|forbidden', 'người mua KHÔNG tự xác nhận đơn của mình');

SET LOCAL request.jwt.claims TO '{"sub":"0d660006-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
SELECT is(
  pg_temp.err(format($$ SELECT public.shop_order_transition(%L::uuid,'confirm','pending',NULL,NULL) $$,
    (SELECT v FROM t_ord WHERE k='o1'))),
  '42501|forbidden', 'vai support chỉ đọc — không chuyển được trạng thái');

SET LOCAL request.jwt.claims TO '{"sub":"0d880008-0000-4000-8000-000000000008","role":"authenticated","aal":"aal1"}';
SELECT is(
  pg_temp.err(format($$ SELECT public.shop_order_transition(%L::uuid,'confirm','pending',NULL,NULL) $$,
    (SELECT v FROM t_ord WHERE k='o1'))),
  '42501|forbidden', 'chủ shop KHÁC không đụng được đơn của shop này');

SET LOCAL request.jwt.claims TO '{"sub":"0d220002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
SELECT is(
  pg_temp.err(format($$ SELECT public.shop_order_transition(%L::uuid,'cancel','pending','nhầm',NULL) $$,
    (SELECT v FROM t_ord WHERE k='o1'))),
  '42501|forbidden', 'người mua KHÁC không huỷ được đơn này');

SET LOCAL request.jwt.claims TO '{"sub":"0d550005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.shop_order_transition((SELECT v FROM t_ord WHERE k='o1'), 'confirm', 'pending', NULL, NULL)) ->> 'status',
  'confirmed', 'vai fulfillment của ĐÚNG shop xác nhận được đơn');

SELECT is(
  pg_temp.err(format($$ SELECT public.shop_order_transition(%L::uuid,'confirm','pending',NULL,NULL) $$,
    (SELECT v FROM t_ord WHERE k='o1'))),
  'PT409|stale_status', 'bấm lại với trạng thái cũ: PT409 + reason stale_status');

SELECT is(
  (pg_temp.err_detail(format($$ SELECT public.shop_order_transition(%L::uuid,'confirm','pending',NULL,NULL) $$,
    (SELECT v FROM t_ord WHERE k='o1'))) - 'reason'),
  '{"current": "confirmed", "expected": "pending"}'::jsonb,
  'và DETAIL nói trạng thái thật đang là gì');

SET LOCAL request.jwt.claims TO '{"sub":"0d440004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.shop_order_transition((SELECT v FROM t_ord WHERE k='o1'), 'ship', 'confirmed', NULL, 'GHN123456')) ->> 'tracking_code',
  'GHN123456', 'chủ shop gửi hàng và ghi mã vận đơn');

SET LOCAL request.jwt.claims TO '{"sub":"0d110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.shop_order_transition((SELECT v FROM t_ord WHERE k='o1'), 'deliver', 'shipped', NULL, NULL)) ->> 'status',
  'delivered', 'người mua bấm "Tôi đã nhận hàng" (D7) — không có cron nào đóng đơn hộ');

SELECT is(
  pg_temp.err(format($$ SELECT public.shop_order_transition(%L::uuid,'cancel','delivered','đổi ý',NULL) $$,
    (SELECT v FROM t_ord WHERE k='o1'))),
  'PT409|stale_status', 'delivered là trạng thái kết thúc — không có đường ra');

-- ─── Cancelling: the stock comes back exactly once ──────────────────────────

INSERT INTO t_ord VALUES ('o3', (public.shop_order_create(
  'tok-o3', 'cod', 'Nguyễn Văn A', '0912345678',
  'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', NULL, 30000,
  pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 1, 1500000)) ->> 'id')::uuid);

SET LOCAL request.jwt.claims TO '{"sub":"0d440004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
SELECT is(
  pg_temp.err(format($$ SELECT public.shop_order_transition(%L::uuid,'cancel','pending',NULL,NULL) $$,
    (SELECT v FROM t_ord WHERE k='o3'))),
  '22023|invalid_payload', 'người bán huỷ đơn thì BẮT BUỘC có lý do cho người mua');

SELECT is(
  (public.shop_order_transition((SELECT v FROM t_ord WHERE k='o3'), 'cancel', 'pending', 'Hết hàng tại kho', NULL)) ->> 'status',
  'cancelled', 'người bán huỷ đơn kèm lý do');

SET LOCAL role postgres;

SELECT is(
  (SELECT stock_on_hand FROM public.product_variants WHERE id='01110001-0000-4000-8000-000000000001'::uuid),
  3, 'tồn kho về đúng mức trước khi đặt đơn đó');

SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements
   WHERE client_token = 'order:' || (SELECT v FROM t_ord WHERE k='o3')::text || ':return'),
  1, 'hoàn kho bằng ĐÚNG MỘT dòng sổ mới reason=return');

SELECT is(
  (SELECT sum(delta)::int FROM public.inventory_movements
   WHERE client_token LIKE 'order:' || (SELECT v FROM t_ord WHERE k='o3')::text || ':%'),
  0, 'sổ kho của đơn đó cân bằng: -1 rồi +1');

SELECT is(
  (SELECT delta::text FROM public.inventory_movements
   WHERE client_token = 'order:' || (SELECT v FROM t_ord WHERE k='o3')::text || ':sale'),
  '-1', 'dòng sale cũ KHÔNG bị sửa — hoàn kho là ghi thêm, không phải viết lại');

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0d440004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';

SELECT is(
  pg_temp.err(format($$ SELECT public.shop_order_transition(%L::uuid,'cancel','pending','lần hai',NULL) $$,
    (SELECT v FROM t_ord WHERE k='o3'))),
  'PT409|stale_status', 'huỷ lần thứ hai bị guarded transition chặn');

SET LOCAL role postgres;
SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements
   WHERE client_token = 'order:' || (SELECT v FROM t_ord WHERE k='o3')::text || ':return'),
  1, 'nên KHÔNG hoàn kho hai lần');

-- ─── Only an admin cancels something already shipped ────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0d110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
INSERT INTO t_ord VALUES ('o4', (public.shop_order_create(
  'tok-o4', 'cod', 'Nguyễn Văn A', '0912345678',
  'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', NULL, 30000,
  pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 1, 1500000)) ->> 'id')::uuid);

SET LOCAL request.jwt.claims TO '{"sub":"0d440004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.shop_order_transition((SELECT v FROM t_ord WHERE k='o4'), 'confirm', 'pending', NULL, NULL)) ->> 'status',
  'confirmed', 'chủ shop xác nhận đơn thứ hai');
SELECT is(
  (public.shop_order_transition((SELECT v FROM t_ord WHERE k='o4'), 'ship', 'confirmed', NULL, NULL)) ->> 'status',
  'shipped', 'và gửi đi');
SELECT is(
  pg_temp.err(format($$ SELECT public.shop_order_transition(%L::uuid,'cancel','shipped','đổi ý',NULL) $$,
    (SELECT v FROM t_ord WHERE k='o4'))),
  '42501|forbidden', 'người bán KHÔNG huỷ được đơn đã gửi — chỉ quản trị viên');

SET LOCAL request.jwt.claims TO '{"sub":"0d770007-0000-4000-8000-000000000007","role":"authenticated","aal":"aal2"}';
SELECT is(
  (public.shop_order_transition((SELECT v FROM t_ord WHERE k='o4'), 'cancel', 'shipped', 'Hàng thất lạc', NULL)) ->> 'status',
  'cancelled', 'quản trị viên (is_admin ⇒ AAL2) huỷ được đơn đã gửi');

SET LOCAL role postgres;
SELECT is(
  (SELECT count(*)::int FROM public.audit_logs
   WHERE event_category='shop' AND resource_type='shop_order'
     AND resource_id=(SELECT v FROM t_ord WHERE k='o4')::text AND event_type='shop_order_cancel'),
  1, 'và việc đó có dòng audit_logs của riêng nó');

-- ─── The buyer cancels their own pending order ──────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0d110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
INSERT INTO t_ord VALUES ('o5', (public.shop_order_create(
  'tok-o5', 'cod', 'Nguyễn Văn A', '0912345678',
  'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', NULL, 30000,
  pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 1, 1500000)) ->> 'id')::uuid);

SELECT is(
  (public.shop_order_transition((SELECT v FROM t_ord WHERE k='o5'), 'cancel', 'pending', NULL, NULL)) ->> 'status',
  'cancelled', 'người mua huỷ tự do khi đơn còn pending (D5), không cần lý do');

-- ─── Five pending is the ceiling (D8) ───────────────────────────────────────
-- On the uncounted variant, so the ceiling is tested and not the stock.

SET LOCAL request.jwt.claims TO '{"sub":"0d220002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

SELECT is(
  (SELECT count(*)::int FROM (
     SELECT public.shop_order_create(
       'tok-b2-' || g, 'cod', 'Trần Thị B', '0987654321',
       'Số 9, đường Hai, phường 3, quận 4, TP. Hồ Chí Minh', NULL, 30000,
       pg_temp.one('01220002-0000-4000-8000-000000000002'::uuid, 1, 200000))
     FROM generate_series(1, 5) g) t),
  5, 'người mua thứ hai đặt được 5 đơn');

SELECT is(
  pg_temp.err(pg_temp.mk('tok-b2-6', 30000,
    pg_temp.one('01220002-0000-4000-8000-000000000002'::uuid, 1, 200000))),
  'PT429|too_many_pending', 'đơn thứ sáu: PT429 + reason too_many_pending');

SELECT is(
  (pg_temp.err_detail(pg_temp.mk('tok-b2-7', 30000,
    pg_temp.one('01220002-0000-4000-8000-000000000002'::uuid, 1, 200000))) - 'reason'),
  '{"limit": 5, "current": 5}'::jsonb, 'và nói rõ trần là 5, đang giữ 5');

SET LOCAL role postgres;
SELECT is(
  (SELECT count(*)::int FROM public.shop_orders
   WHERE buyer_user_id='0d220002-0000-4000-8000-000000000002'::uuid AND status='pending'),
  5, 'số đơn chờ vẫn đúng 5 — lần bị từ chối không tạo thêm gì');

-- ─── Cancelling gives back only what was actually taken ─────────────────────
-- Order placed while the variant was NOT counted (no deduction, no ledger row),
-- then the seller switches counting on. A cancel that adds qty back here is
-- inventing stock that never left, and the ledger stops reconciling.

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0d110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
INSERT INTO t_ord VALUES ('o7', (public.shop_order_create(
  'tok-o7', 'cod', 'Nguyễn Văn A', '0912345678',
  'Số 1, đường Test, phường 1, quận 1, TP. Hồ Chí Minh', NULL, 30000,
  pg_temp.one('01220002-0000-4000-8000-000000000002'::uuid, 2, 200000)) ->> 'id')::uuid);

SET LOCAL role postgres;
SELECT set_config('shop.stock_write', 'on', true);
UPDATE public.product_variants SET stock_on_hand = 7
WHERE id = '01220002-0000-4000-8000-000000000002'::uuid;
SELECT set_config('shop.stock_write', 'off', true);

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0d110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.shop_order_transition((SELECT v FROM t_ord WHERE k='o7'), 'cancel', 'pending', NULL, NULL)) ->> 'status',
  'cancelled', 'người mua huỷ đơn đặt lúc phiên bản chưa đếm tồn');

SET LOCAL role postgres;
SELECT is(
  (SELECT stock_on_hand FROM public.product_variants
   WHERE id='01220002-0000-4000-8000-000000000002'::uuid),
  7, 'tồn kho vẫn đúng 7 — huỷ KHÔNG hoàn cho món chưa từng bị trừ');
SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements
   WHERE client_token = 'order:' || (SELECT v FROM t_ord WHERE k='o7')::text || ':return'),
  0, 'và không sinh dòng sổ reason=return nào cho đơn đó');

-- ─── A buyer with no profiles row ───────────────────────────────────────────
-- handle_new_user creates one; deleting it explicitly is the only way to reach
-- the case. Both audit_logs.actor_id and social_notifications.user_id
-- reference profiles, and neither is allowed to cost the buyer their order.

DELETE FROM public.profiles WHERE id = '0d330003-0000-4000-8000-000000000003'::uuid;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0d330003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';

-- A COUNTED variant, deliberately. On the uncounted one shop_order_create hits
-- `CONTINUE WHEN … IS NULL` and writes no inventory_movements row at all — so
-- the DELETE below never touches the append-only ledger and this whole section
-- passes with the bug it exists to catch still in place. That is exactly how it
-- was written the first time.
INSERT INTO t_ord VALUES ('o6', (public.shop_order_create(
  'tok-o6', 'cod', 'Lê Văn C', '0900000001',
  'Số 3, đường Ba, phường 5, quận 6, TP. Hồ Chí Minh', NULL, 30000,
  pg_temp.one('01110001-0000-4000-8000-000000000001'::uuid, 1, 1500000)) ->> 'id')::uuid);

SET LOCAL role postgres;
SELECT is(
  (public.shop_order_json((SELECT v FROM t_ord WHERE k='o6'))) ->> 'status',
  'pending', 'người mua chưa có dòng profiles vẫn đặt được đơn');

-- ─── Deleting the account does not delete the seller's history ──────────────
-- Clear the JWT claim first. Deleting the user cascades user_roles, whose
-- audit trigger writes audit_logs.actor_id = auth.uid() — which would still be
-- this buyer, whose profiles row is gone. That is fixture noise, not the
-- behaviour under test.

SELECT set_config('request.jwt.claims', NULL, true);

DELETE FROM auth.users WHERE id = '0d330003-0000-4000-8000-000000000003'::uuid;

SELECT is(
  (SELECT count(*)::int FROM public.shop_orders WHERE id=(SELECT v FROM t_ord WHERE k='o6')),
  1, 'xoá tài khoản người mua KHÔNG xoá đơn (ON DELETE SET NULL, không CASCADE)');
SELECT ok(
  (SELECT buyer_user_id IS NULL FROM public.shop_orders WHERE id=(SELECT v FROM t_ord WHERE k='o6')),
  'và người bán vẫn đọc được đơn qua tên/SĐT đã snapshot');

-- The DELETE above only reaches this far because inventory_movements.actor_user_id
-- is ON DELETE SET NULL and the append-only trigger now lets THAT one update
-- through (20260818110000). Without it the DELETE raises 42501 and
-- delete-account is broken for every buyer of a counted variant.
SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements
   WHERE reason='sale'
     AND client_token = 'order:' || (SELECT v FROM t_ord WHERE k='o6')::text || ':sale'
     AND actor_user_id IS NULL),
  1, 'dòng sổ kho của đơn đó còn nguyên, chỉ mất danh tính người mua');

-- ─── The timeline is append-only even WITH the grant ────────────────────────
-- The grant answers before the trigger does, which is how an append-only
-- assertion once passed with the trigger dropped. So: hand out the grant that
-- production withholds, and show the trigger still refuses. Run as postgres
-- because there is no UPDATE policy either — an `authenticated` UPDATE would
-- match zero rows and never reach the trigger, which is a vacuous pass.

GRANT UPDATE, DELETE ON public.shop_order_events TO authenticated;

SELECT throws_ok(
  $$ UPDATE public.shop_order_events SET action = 'confirm' $$,
  '42501', NULL, 'trigger từ chối UPDATE nhật ký đơn ngay cả khi đã cấp quyền');
SELECT throws_ok(
  $$ DELETE FROM public.shop_order_events $$,
  '42501', NULL, 'và từ chối cả DELETE');

REVOKE UPDATE, DELETE ON public.shop_order_events FROM authenticated;

SELECT ok(NOT (SELECT has_table_privilege('authenticated', 'public.shop_order_events', 'UPDATE')),
  'quyền tạm cấp đã được thu lại — trạng thái cuối vẫn là không ai UPDATE được');

-- ─── shop_last_shipping_address(): prefill that cannot read anybody else ─────
-- Checkout wants the address the buyer used last time. It cannot be done from
-- the client: shop_orders' SELECT policy admits every PARTY to the order, so
-- "the newest order I can read" is, for a seller, their own customer's — and
-- buyer_user_id is not granted, so the client cannot filter it out again.
-- These four assertions are that filter, done in the database.

RESET role;
SELECT set_config('request.jwt.claims', NULL, true);

-- Two orders for buyer 1, one clearly newer, plus one for buyer 2 that must
-- never leak across. Inserted directly: what is under test is the WHERE, not
-- the create path, and the create path is already a hundred assertions above.
INSERT INTO public.shop_orders
  (buyer_user_id, shop_id, code, client_token, payment_method,
   recipient_name, recipient_phone, shipping_address, items_total_vnd, shipping_fee_vnd, created_at)
VALUES
  ('0d110001-0000-4000-8000-000000000001'::uuid, '0e110001-0000-4000-8000-000000000001'::uuid,
   'PH-2699-AAAA', 'addr-old', 'cod', 'Địa Chỉ Cũ', '0900000001',
   'So 1 duong Cu, phuong Cu, quan Cu, Ha Noi', 1000, 0, now() - interval '10 days'),
  ('0d110001-0000-4000-8000-000000000001'::uuid, '0e110001-0000-4000-8000-000000000001'::uuid,
   'PH-2699-BBBB', 'addr-new', 'cod', 'Địa Chỉ Mới', '0900000002',
   -- Later than every order the RPC created above, which all carry the
   -- transaction's now().
   'So 2 duong Moi, phuong Moi, quan Moi, Ha Noi', 1000, 0, now() + interval '1 day'),
  ('0d220002-0000-4000-8000-000000000002'::uuid, '0e110001-0000-4000-8000-000000000001'::uuid,
   'PH-2699-CCCC', 'addr-other', 'cod', 'Người Khác', '0900000003',
   'So 3 duong Khac, phuong Khac, quan Khac, Ha Noi', 1000, 0, now());

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0d110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is(
  public.shop_last_shipping_address(),
  jsonb_build_object(
    'recipient_name',   'Địa Chỉ Mới',
    'recipient_phone',  '0900000002',
    'shipping_address', 'So 2 duong Moi, phuong Moi, quan Moi, Ha Noi'),
  'trả đúng địa chỉ của đơn MỚI NHẤT của chính người gọi, không phải đơn cũ');

-- The rival shop's owner has sold, never bought. If the function keyed off
-- "an order I am a party to" instead of buyer_user_id, this is where somebody
-- else's address would come back.
SET LOCAL request.jwt.claims TO '{"sub":"0d880008-0000-4000-8000-000000000008","role":"authenticated","aal":"aal1"}';

SELECT ok(
  public.shop_last_shipping_address() IS NULL,
  'người chưa từng đặt đơn nhận NULL, kể cả khi họ là chủ một shop khác');

SET LOCAL request.jwt.claims TO '{"sub":"0d440004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';

SELECT ok(
  public.shop_last_shipping_address() IS NULL,
  'chủ shop Đơn A đọc được cả ba đơn trên nhưng vẫn không được điền sẵn địa chỉ của khách');

RESET role;
SELECT set_config('request.jwt.claims', NULL, true);

SELECT ok(
  NOT has_function_privilege('anon', 'public.shop_last_shipping_address()', 'EXECUTE'),
  'khách chưa đăng nhập không gọi được hàm này');

-- ─── my_shop_orders: the SECOND place the identity invariant lives ──────────
-- The view is not security_invoker, so it runs as its owner: neither
-- shop_orders' policy nor its column GRANTs apply to a read through it. The
-- SELECT list and the WHERE are the only things deciding what comes back, and
-- until now nothing tested either. The three orders seeded just above are
-- reused: two belong to buyer 1, one to buyer 2.

SELECT is(
  (SELECT count(*)::int FROM information_schema.columns
   WHERE table_schema='public' AND table_name='my_shop_orders'
     AND column_name IN ('buyer_user_id', 'client_token', 'cancelled_by')),
  0,
  'my_shop_orders KHÔNG phơi buyer_user_id / client_token / cancelled_by — GRANT theo cột không áp cho view');

SELECT ok(NOT (SELECT has_table_privilege('anon', 'public.my_shop_orders', 'SELECT')),
  'khách chưa đăng nhập không đọc được my_shop_orders');

SELECT ok(
  (SELECT reloptions FROM pg_class WHERE oid = 'public.my_shop_orders'::regclass)
    @> ARRAY['security_barrier=true'],
  'view có security_barrier — hàm rẻ của người gọi không chạy trước bộ lọc auth.uid()');

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"0d110001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is(
  (SELECT count(*)::int FROM public.my_shop_orders WHERE code = 'PH-2699-CCCC'),
  0, 'người mua 1 KHÔNG thấy đơn của người mua 2 qua view');
SELECT is(
  (SELECT count(*)::int FROM public.my_shop_orders WHERE code = 'PH-2699-BBBB'),
  1, 'nhưng vẫn thấy đơn của chính mình');

RESET role;
SELECT set_config('request.jwt.claims', NULL, true);

SELECT is(
  (SELECT count(*)::int FROM public.shop_orders WHERE code = 'PH-2699-CCCC'),
  1, 'trong khi đọc bảng nền bằng quyền service thì đơn đó vẫn ở đó — view lọc, không phải fixture rỗng');

DELETE FROM public.shop_orders WHERE client_token IN ('addr-old', 'addr-new', 'addr-other');

SELECT * FROM finish();
ROLLBACK;
