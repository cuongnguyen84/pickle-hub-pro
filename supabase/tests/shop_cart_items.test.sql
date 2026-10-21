-- ============================================================================
-- Shop Phase 3 — S1: the cart.
--
-- What this file is really asking:
--   * can a client write a column it was never given (user_id, variant_id);
--   * can one buyer see, change or steal another buyer's cart line;
--   * does the UPDATE policy carry BOTH halves, or only the readable one;
--   * does one product being taken down blank the whole cart;
--   * does the cart tell the buyer WHY a line cannot be bought, per line.
-- ============================================================================

BEGIN;

SELECT plan(27);

-- ─── Fixture ────────────────────────────────────────────────────────────────
-- A buyer · B buyer · C shop owner. First 12 hex chars differ per user:
-- handle_new_user derives profiles.profile_slug from them (unique index).

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('c1a10001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cart-a@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('c1a20002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cart-b@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('c1a30003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cart-owner@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.shop_pilot_members (user_id)
VALUES ('c1a30003-0000-4000-8000-000000000003'::uuid) ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id, ordering_enabled, shipping_fee_vnd) VALUES
  ('c1b10001-0000-4000-8000-000000000001'::uuid, 'cart-shop-a', 'Shop Giỏ A', 'active',
   'c1a30003-0000-4000-8000-000000000003'::uuid, true,  30000),
  ('c1b20002-0000-4000-8000-000000000002'::uuid, 'cart-shop-b', 'Shop Giỏ B', 'active',
   'c1a30003-0000-4000-8000-000000000003'::uuid, false, 0),
  ('c1b30003-0000-4000-8000-000000000003'::uuid, 'cart-shop-c', 'Shop Giỏ C', 'suspended',
   'c1a30003-0000-4000-8000-000000000003'::uuid, true,  0);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('c1b10001-0000-4000-8000-000000000001'::uuid, 'c1a30003-0000-4000-8000-000000000003'::uuid, 'owner'),
  ('c1b20002-0000-4000-8000-000000000002'::uuid, 'c1a30003-0000-4000-8000-000000000003'::uuid, 'owner'),
  ('c1b30003-0000-4000-8000-000000000003'::uuid, 'c1a30003-0000-4000-8000-000000000003'::uuid, 'owner');

SELECT set_config('shop.privileged_write', 'on', true);
INSERT INTO public.products (id, shop_id, slug, title, description, category_slug, status, is_published) VALUES
  ('c1c10001-0000-4000-8000-000000000001'::uuid, 'c1b10001-0000-4000-8000-000000000001'::uuid,
   'cart-vot-song', 'Vợt Đang Bán', 'Vợt carbon T700, lõi tổ ong 16mm.', 'vot', 'approved', true),
  ('c1c20002-0000-4000-8000-000000000002'::uuid, 'c1b10001-0000-4000-8000-000000000001'::uuid,
   'cart-vot-nhap', 'Vợt Bản Nháp', 'Chưa gửi duyệt.', 'vot', 'draft', false),
  ('c1c30003-0000-4000-8000-000000000003'::uuid, 'c1b20002-0000-4000-8000-000000000002'::uuid,
   'cart-vot-tat-ban', 'Vợt Shop Tắt Bán', 'Shop chưa bật bán.', 'vot', 'approved', true),
  ('c1c40004-0000-4000-8000-000000000004'::uuid, 'c1b30003-0000-4000-8000-000000000003'::uuid,
   'cart-vot-shop-go', 'Vợt Shop Bị Gỡ', 'Shop đang bị gỡ.', 'vot', 'approved', true),
  -- Its own product: uniq_product_variants_default allows exactly one
  -- option-less variant per product, retired or not.
  ('c1c50005-0000-4000-8000-000000000005'::uuid, 'c1b10001-0000-4000-8000-000000000001'::uuid,
   'cart-vot-nghi-ban', 'Vợt Nghỉ Bán', 'Phiên bản đã nghỉ bán.', 'vot', 'approved', true);
SELECT set_config('shop.privileged_write', 'off', true);

INSERT INTO public.product_variants (id, product_id, shop_id, price_vnd, stock_on_hand, position, retired_at) VALUES
  ('c1d10001-0000-4000-8000-000000000001'::uuid, 'c1c10001-0000-4000-8000-000000000001'::uuid,
   'c1b10001-0000-4000-8000-000000000001'::uuid, 1500000, 5, 0, NULL),
  ('c1d20002-0000-4000-8000-000000000002'::uuid, 'c1c50005-0000-4000-8000-000000000005'::uuid,
   'c1b10001-0000-4000-8000-000000000001'::uuid,  900000, 1, 0, NULL),
  ('c1d30003-0000-4000-8000-000000000003'::uuid, 'c1c20002-0000-4000-8000-000000000002'::uuid,
   'c1b10001-0000-4000-8000-000000000001'::uuid,  500000, 5, 0, NULL),
  ('c1d40004-0000-4000-8000-000000000004'::uuid, 'c1c30003-0000-4000-8000-000000000003'::uuid,
   'c1b20002-0000-4000-8000-000000000002'::uuid,  100000, 5, 0, NULL),
  ('c1d50005-0000-4000-8000-000000000005'::uuid, 'c1c40004-0000-4000-8000-000000000004'::uuid,
   'c1b30003-0000-4000-8000-000000000003'::uuid,  100000, 5, 0, NULL);

-- Retired AFTER insert: the options guard runs on the way in and a retired row
-- is still a row it validates.
UPDATE public.product_variants SET retired_at = now()
WHERE id = 'c1d20002-0000-4000-8000-000000000002'::uuid;

-- Reads one line out of the grouped cart payload, so an assertion names the
-- variant it is about rather than a position in an array.
CREATE OR REPLACE FUNCTION pg_temp.cart_line(_variant UUID)
RETURNS JSONB LANGUAGE sql AS $$
  SELECT l
  FROM jsonb_array_elements(public.shop_cart_view()) g,
       jsonb_array_elements(g -> 'lines') l
  WHERE (l ->> 'variant_id')::uuid = _variant
$$;

-- ─── Shape and grants ───────────────────────────────────────────────────────

SELECT has_table('public', 'shop_cart_items', 'giỏ hàng có bảng riêng');
SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='shop_cart_items'),
  'RLS bật trên shop_cart_items');
SELECT ok(
  NOT (SELECT has_table_privilege('anon', 'public.shop_cart_items', 'SELECT')),
  'khách chưa đăng nhập không có quyền gì trên giỏ hàng');
SELECT ok(
  NOT (SELECT has_table_privilege('authenticated', 'public.shop_cart_items', 'UPDATE')),
  'KHÔNG có GRANT UPDATE trần — quyền sửa là theo cột');
SELECT ok(
  (SELECT has_column_privilege('authenticated', 'public.shop_cart_items', 'qty', 'UPDATE')),
  'người mua sửa được số lượng');
SELECT ok(
  NOT (SELECT has_column_privilege('authenticated', 'public.shop_cart_items', 'variant_id', 'UPDATE')),
  'nhưng KHÔNG đổi được phiên bản — đó là một sản phẩm khác đội lốt cùng một dòng');
SELECT ok(
  NOT (SELECT has_column_privilege('authenticated', 'public.shop_cart_items', 'user_id', 'INSERT')),
  'và KHÔNG tự khai user_id khi thêm vào giỏ');

-- ─── Buyer A ────────────────────────────────────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"c1a10001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

INSERT INTO public.shop_cart_items (variant_id, qty)
VALUES ('c1d10001-0000-4000-8000-000000000001'::uuid, 2);

SELECT is(
  (SELECT count(id)::int FROM public.shop_cart_items),
  1, 'thêm vào giỏ được, và user_id do máy chủ điền');

SELECT throws_ok(
  $$ INSERT INTO public.shop_cart_items (variant_id, qty)
     VALUES ('c1d10001-0000-4000-8000-000000000001'::uuid, 3) $$,
  '23505', NULL, 'thêm lại đúng phiên bản đó là MỘT dòng, không phải hai');

SELECT throws_ok(
  $$ INSERT INTO public.shop_cart_items (variant_id, qty)
     VALUES ('c1d30003-0000-4000-8000-000000000003'::uuid, 11) $$,
  '23514', NULL, 'số lượng trên 10 bị CSDL từ chối, không chỉ ô nhập');

-- WITH CHECK, not merely USING: without it this UPDATE succeeds and the line
-- lands in somebody else's cart.
SELECT throws_ok(
  $$ UPDATE public.shop_cart_items SET user_id = 'c1a20002-0000-4000-8000-000000000002'::uuid $$,
  '42501', NULL, 'không đẩy được dòng giỏ sang người khác');

INSERT INTO public.shop_cart_items (variant_id, qty) VALUES
  ('c1d20002-0000-4000-8000-000000000002'::uuid, 1),   -- variant retired
  ('c1d30003-0000-4000-8000-000000000003'::uuid, 1),   -- product draft
  ('c1d40004-0000-4000-8000-000000000004'::uuid, 1),   -- shop ordering off
  ('c1d50005-0000-4000-8000-000000000005'::uuid, 1);   -- shop suspended

-- ─── Buyer B sees nothing of A's ────────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"c1a20002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

SELECT is(
  (SELECT count(id)::int FROM public.shop_cart_items),
  0, 'người mua khác không thấy dòng nào trong giỏ của A');

SELECT is(
  (SELECT count(*)::int FROM (
     SELECT public.shop_cart_view() AS v) t
   WHERE t.v = '[]'::jsonb),
  1, 'và shop_cart_view của họ rỗng — hàm không nhận user_id, nó đọc auth.uid()');

WITH bumped AS (
  UPDATE public.shop_cart_items SET qty = 9 RETURNING 1)
SELECT is((SELECT count(*)::int FROM bumped), 0,
  'người mua khác không sửa được số lượng của A');

-- ─── The cart read model ────────────────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"c1a10001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is(
  jsonb_array_length(public.shop_cart_view()), 3,
  'giỏ nhóm theo shop — ba shop, ba nhóm');

SELECT is(
  (pg_temp.cart_line('c1d10001-0000-4000-8000-000000000001'::uuid)) ->> 'unavailable_reason',
  NULL, 'món mua được không mang lý do nào');

SELECT is(
  (pg_temp.cart_line('c1d10001-0000-4000-8000-000000000001'::uuid)) ->> 'product_title',
  'Vợt Đang Bán', 'và mang dữ liệu hiển thị lấy từ projection công khai');

SELECT is(
  (pg_temp.cart_line('c1d20002-0000-4000-8000-000000000002'::uuid)) ->> 'unavailable_reason',
  'variant_retired', 'phiên bản đã nghỉ bán được nói thẳng ra ở đúng dòng đó');

-- product_public_projection RAISEs no_data_found for anything not public. If
-- that were not caught per line, this one product would blank the whole cart —
-- the other four assertions in this block are what prove it did not.
SELECT is(
  (pg_temp.cart_line('c1d30003-0000-4000-8000-000000000003'::uuid)) ->> 'unavailable_reason',
  'product_unavailable', 'sản phẩm bị gỡ chỉ hỏng ĐÚNG dòng của nó');

SELECT is(
  (pg_temp.cart_line('c1d40004-0000-4000-8000-000000000004'::uuid)) ->> 'unavailable_reason',
  'ordering_disabled', 'shop chưa bật bán: dòng được đánh dấu, không bị xoá');

SELECT is(
  (pg_temp.cart_line('c1d50005-0000-4000-8000-000000000005'::uuid)) ->> 'unavailable_reason',
  'shop_inactive', 'shop bị gỡ: cũng vậy');

UPDATE public.shop_cart_items SET qty = 10
WHERE variant_id = 'c1d10001-0000-4000-8000-000000000001'::uuid;

SELECT is(
  (pg_temp.cart_line('c1d10001-0000-4000-8000-000000000001'::uuid)) ->> 'unavailable_reason',
  'out_of_stock', 'đặt nhiều hơn số đang có: out_of_stock');

-- §B.S5: the cart stores no reference price, so it cannot claim one changed.
-- The single place a price change is caught is shop_order_create.
SELECT ok(
  (public.shop_cart_view())::text NOT LIKE '%price_changed%',
  'giỏ KHÔNG có cờ price_changed — nó không lưu giá tham chiếu để so');

SELECT is(
  (pg_temp.cart_line('c1d10001-0000-4000-8000-000000000001'::uuid)) ->> 'unit_price_vnd',
  '1500000', 'giá hiển thị là giá HIỆN TẠI, đọc thẳng từ phiên bản');

SELECT is(
  (SELECT g -> 'shop' ->> 'shipping_fee_vnd'
   FROM jsonb_array_elements(public.shop_cart_view()) g
   WHERE g -> 'shop' ->> 'slug' = 'cart-shop-a'),
  '30000', 'mỗi nhóm mang phí ship của shop đó, để trang giỏ khỏi đoán');

-- ─── Deleting, and the anonymous door ───────────────────────────────────────

DELETE FROM public.shop_cart_items
WHERE variant_id = 'c1d50005-0000-4000-8000-000000000005'::uuid;

SELECT is(
  (SELECT count(id)::int FROM public.shop_cart_items),
  4, 'người mua xoá được dòng của chính mình');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';

SELECT throws_ok(
  $$ SELECT public.shop_cart_view() $$,
  '42501', NULL, 'khách chưa đăng nhập không gọi được shop_cart_view');

SELECT * FROM finish();
ROLLBACK;
