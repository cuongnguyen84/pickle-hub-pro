-- Shop marketplace P2a step 5 — variants, SKU and inventory.
--
-- What this file is really asking:
--   * can a combination lose its identity, or gain a twin;
--   * can a variant exist that the option editor says is impossible;
--   * can stock move without a row in the ledger, or the ledger be edited;
--   * can a retry double a matrix save or a stock adjustment;
--   * does switching single<->multi ever destroy what the seller entered.

BEGIN;

SELECT plan(90);

-- ─── Fixture ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('50060001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'var-owner@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Owner"}'::jsonb, NOW(), NOW()),
  ('50060002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'var-manager@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Manager"}'::jsonb, NOW(), NOW()),
  ('50060003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'var-support@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Support"}'::jsonb, NOW(), NOW()),
  ('50060004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'var-rival@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Rival"}'::jsonb, NOW(), NOW()),
  ('50060005-0000-4000-8000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'var-admin@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Admin"}'::jsonb, NOW(), NOW()),
  ('50060006-0000-4000-8000-000000000006'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'var-nonpilot@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"NonPilot"}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('50060005-0000-4000-8000-000000000005'::uuid, 'admin') ON CONFLICT DO NOTHING;

INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES ('5f000006-0000-4000-8000-000000000006'::uuid, '50060005-0000-4000-8000-000000000005'::uuid,
        'test-totp', 'totp', 'verified', NOW(), NOW(), 'JBSWY3DPEHPK3PXP');

INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('50060001-0000-4000-8000-000000000001'::uuid),
  ('50060002-0000-4000-8000-000000000002'::uuid),
  ('50060003-0000-4000-8000-000000000003'::uuid),
  ('50060004-0000-4000-8000-000000000004'::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id) VALUES
  ('7c000001-0000-4000-8000-000000000001'::uuid, 'giay-sai-gon', 'Giày Sài Gòn', 'active', '50060001-0000-4000-8000-000000000001'::uuid),
  ('7c000002-0000-4000-8000-000000000002'::uuid, 'giay-ha-noi',  'Giày Hà Nội',  'active', '50060004-0000-4000-8000-000000000004'::uuid);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('7c000001-0000-4000-8000-000000000001'::uuid, '50060001-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('7c000001-0000-4000-8000-000000000001'::uuid, '50060002-0000-4000-8000-000000000002'::uuid, 'manager'),
  ('7c000001-0000-4000-8000-000000000001'::uuid, '50060003-0000-4000-8000-000000000003'::uuid, 'support'),
  ('7c000001-0000-4000-8000-000000000001'::uuid, '50060006-0000-4000-8000-000000000006'::uuid, 'manager'),
  ('7c000002-0000-4000-8000-000000000002'::uuid, '50060004-0000-4000-8000-000000000004'::uuid, 'owner');

CREATE TEMP TABLE t_var (k TEXT PRIMARY KEY, v UUID);
GRANT SELECT, INSERT ON t_var TO authenticated, anon;

-- ─── Shape ──────────────────────────────────────────────────────────────────

SELECT has_column('public', 'product_variants', 'stock_on_hand',
  'stock is named for what it is: units on hand, not units available');
SELECT hasnt_column('public', 'product_variants', 'stock',
  'the ambiguous name is gone rather than kept as an alias nobody maintains');
SELECT has_column('public', 'product_variants', 'option_key', 'combination identity is a column');
SELECT has_column('public', 'product_variants', 'retired_at',
  'a variant retired by the seller is distinct from a product being archived');
SELECT has_table('public', 'inventory_movements', 'the ledger exists');
SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='inventory_movements'),
  'RLS enabled on inventory_movements');
SELECT ok(
  NOT (SELECT has_table_privilege('authenticated','public.inventory_movements','INSERT')),
  'authenticated cannot INSERT a movement — only the RPC writes the ledger');
SELECT ok(
  (SELECT has_table_privilege('authenticated','public.inventory_movements','SELECT')),
  'but can read its own shop history, with the policy to match');

-- ─── Identity: order-independent, normalised ───────────────────────────────

SELECT is(
  public.product_option_key('{"Kích cỡ":"40","Màu sắc":"Trắng"}'::jsonb),
  public.product_option_key('{"Màu sắc":"Trắng","Kích cỡ":"40"}'::jsonb),
  'thứ tự nhóm KHÔNG đổi danh tính tổ hợp — kéo thả cột chỉ là hiển thị');
SELECT is(
  public.product_option_key('{"Màu sắc":" TRẮNG "}'::jsonb),
  public.product_option_key('{"màu sắc":"trắng"}'::jsonb),
  'hoa/thường và khoảng trắng không tạo ra danh tính thứ hai');
SELECT isnt(
  public.product_option_key('{"Màu sắc":"Trắng"}'::jsonb),
  public.product_option_key('{"Màu sắc":"Trang"}'::jsonb),
  'nhưng dấu tiếng Việt thì CÓ phân biệt — Trắng và Trang là hai màu');
SELECT is(public.product_option_key('{}'::jsonb), NULL, 'không tuỳ chọn = phiên bản mặc định');

-- ─── Pilot limits ───────────────────────────────────────────────────────────

SELECT ok(public.product_option_groups_valid('[]'::jsonb), 'không nhóm nào là hợp lệ (sản phẩm đơn)');
SELECT ok(
  public.product_option_groups_valid('[{"name":"Màu sắc","values":["Trắng","Đen"]},{"name":"Kích cỡ","values":["39","40","41"]}]'::jsonb),
  '2 nhóm 6 tổ hợp là hợp lệ');
SELECT ok(
  NOT public.product_option_groups_valid('[{"name":"A","values":["1"]},{"name":"B","values":["1"]},{"name":"C","values":["1"]},{"name":"D","values":["1"]}]'::jsonb),
  'quá 3 nhóm bị từ chối');
SELECT ok(
  NOT public.product_option_groups_valid('[{"name":"A","values":["1","2","3","4","5","6","7","8","9","10","11"]},{"name":"B","values":["1","2","3","4","5","6","7","8","9","10"]}]'::jsonb),
  'quá 100 tổ hợp bị từ chối');
SELECT ok(
  public.product_option_groups_valid('[{"name":"A","values":["1","2","3","4","5","6","7","8","9","10"]},{"name":"B","values":["1","2","3","4","5","6","7","8","9","10"]}]'::jsonb),
  'đúng 100 tổ hợp vẫn được — ranh giới nằm ở 100, không phải 99');
SELECT ok(
  NOT public.product_option_groups_valid('[{"name":"Màu","values":["Trắng"]},{"name":" màu ","values":["Đen"]}]'::jsonb),
  'trùng tên nhóm sau chuẩn hoá bị từ chối');
SELECT ok(
  NOT public.product_option_groups_valid('[{"name":"Màu","values":["Trắng"," trắng "]}]'::jsonb),
  'trùng giá trị trong cùng nhóm sau chuẩn hoá bị từ chối');
SELECT ok(
  NOT public.product_option_groups_valid(('[{"name":"' || repeat('x', 41) || '","values":["1"]}]')::jsonb),
  'tên nhóm quá 40 ký tự bị từ chối');
SELECT ok(
  NOT public.product_option_groups_valid(('[{"name":"A","values":["' || repeat('x', 41) || '"]}]')::jsonb),
  'giá trị quá 40 ký tự bị từ chối');
SELECT ok(
  NOT public.product_option_groups_valid('[{"name":"A","values":[]}]'::jsonb),
  'nhóm rỗng bị từ chối — không phải nhóm, là sửa dở');

-- ─── Single product: create writes the opening movement ────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50060001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

INSERT INTO t_var VALUES ('p1',
  (public.product_create('7c000001-0000-4000-8000-000000000001'::uuid, 'tok-var-0001',
    '{"title":"Giày pickleball Court Pro","category_slug":"giay","price_vnd":1290000,"stock_on_hand":5}'::jsonb)).id);

SELECT is(
  (SELECT stock_on_hand FROM public.product_variants WHERE product_id=(SELECT v FROM t_var WHERE k='p1')),
  5, 'sản phẩm đơn vẫn có đúng một phiên bản mặc định, mang tồn kho');
SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements WHERE product_id=(SELECT v FROM t_var WHERE k='p1')),
  1, 'và số mở đầu được ghi vào sổ kho, không xuất hiện từ hư không');
SELECT is(
  (SELECT reason FROM public.inventory_movements WHERE product_id=(SELECT v FROM t_var WHERE k='p1')),
  'opening', 'với đúng lý do');

-- ─── Stock is the ledger's to move ─────────────────────────────────────────

SELECT throws_ok(
  format($$ UPDATE public.product_variants SET stock_on_hand = 999 WHERE product_id = %L::uuid $$,
    (SELECT v FROM t_var WHERE k='p1')),
  '42501', NULL, 'KHÔNG sửa thẳng được tồn kho — sổ kho sửa được là sổ kho sẽ bị sửa');

INSERT INTO t_var VALUES ('v1',
  (SELECT id FROM public.product_variants WHERE product_id=(SELECT v FROM t_var WHERE k='p1')));

SELECT is(
  (public.product_variant_adjust_stock((SELECT v FROM t_var WHERE k='v1'), 3, 'restock', 'Nhập thêm')).stock_on_hand,
  8, 'điều chỉnh kho cộng đúng');
SELECT is(
  (SELECT on_hand_before || '->' || on_hand_after FROM public.inventory_movements
   WHERE variant_id=(SELECT v FROM t_var WHERE k='v1') ORDER BY created_at DESC LIMIT 1),
  '5->8', 'và ghi cả hai đầu, nên sổ đối chiếu được với bộ đếm');
SELECT is(
  (SELECT actor_user_id FROM public.inventory_movements
   WHERE variant_id=(SELECT v FROM t_var WHERE k='v1') ORDER BY created_at DESC LIMIT 1),
  '50060001-0000-4000-8000-000000000001'::uuid, 'ai làm cũng được ghi');

SELECT throws_ok(
  format($$ SELECT public.product_variant_adjust_stock(%L::uuid, -100, 'correction') $$,
    (SELECT v FROM t_var WHERE k='v1')),
  '22023', NULL, 'tồn kho không thể âm');
SELECT is(
  (SELECT stock_on_hand FROM public.product_variants WHERE id=(SELECT v FROM t_var WHERE k='v1')),
  8, 'và lần từ chối đó không để lại thay đổi một nửa');
SELECT throws_ok(
  format($$ SELECT public.product_variant_adjust_stock(%L::uuid, 0, 'correction') $$,
    (SELECT v FROM t_var WHERE k='v1')),
  '22023', NULL, 'điều chỉnh 0 bị từ chối — không phải sự kiện');

-- Idempotency: the same token twice is one movement.
SELECT is(
  (public.product_variant_adjust_stock((SELECT v FROM t_var WHERE k='v1'), 2, 'restock', NULL, 'tok-adj-0001')).stock_on_hand,
  10, 'điều chỉnh có mã chống trùng chạy lần đầu');
SELECT is(
  (public.product_variant_adjust_stock((SELECT v FROM t_var WHERE k='v1'), 2, 'restock', NULL, 'tok-adj-0001')).stock_on_hand,
  10, 'gửi lại cùng mã KHÔNG cộng lần thứ hai');
SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements
   WHERE variant_id=(SELECT v FROM t_var WHERE k='v1') AND client_token='tok-adj-0001'),
  1, 'và sổ kho chỉ có một dòng cho lần đó');

-- Append-only, enforced — and enforced TWICE, which is why this is tested
-- twice. The seller is stopped by the missing grant; the trigger is what stops
-- everything else, including a future edge function holding service_role and
-- anyone with a psql prompt. Dropping the trigger left the first pair of
-- assertions green (the grant answered first), so on its own that pair proves
-- nothing about the trigger at all.
SELECT throws_ok(
  $$ UPDATE public.inventory_movements SET delta = 999 $$,
  '42501', NULL, 'người bán không sửa được sổ kho — không có GRANT');
SELECT throws_ok(
  $$ DELETE FROM public.inventory_movements $$,
  '42501', NULL, 'người bán không xoá được sổ kho — không có GRANT');

SET LOCAL role postgres;
SELECT throws_ok(
  $$ UPDATE public.inventory_movements SET delta = 999 $$,
  '42501', 'sổ kho chỉ ghi thêm, không sửa',
  'và ngay cả quyền cao nhất cũng không sửa được — trigger, không phải GRANT');
SELECT throws_ok(
  $$ DELETE FROM public.inventory_movements $$,
  '42501', 'sổ kho chỉ ghi thêm, không xoá',
  'và không xoá được khi thứ nó ghi sổ vẫn còn');
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50060001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

-- ─── Single -> multi ────────────────────────────────────────────────────────

SELECT lives_ok(
  format($$ SELECT public.product_variants_reconcile(
      %L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '[{"name":"Màu sắc","values":["Trắng","Đen"]},{"name":"Kích cỡ","values":["39","40"]}]'::jsonb,
      '[{"option_values":{"Màu sắc":"Trắng","Kích cỡ":"39"},"price_vnd":1290000,"stock_on_hand":2,"sku":"CP-W39"},
        {"option_values":{"Màu sắc":"Trắng","Kích cỡ":"40"},"price_vnd":1290000,"stock_on_hand":3,"sku":"CP-W40"},
        {"option_values":{"Màu sắc":"Đen","Kích cỡ":"39"},"price_vnd":1350000,"stock_on_hand":0,"sku":"CP-B39"},
        {"option_values":{"Màu sắc":"Đen","Kích cỡ":"40"},"price_vnd":1350000,"stock_on_hand":null,"sku":"CP-B40"}]'::jsonb,
      'tok-matrix-0001') $$,
    (SELECT v FROM t_var WHERE k='p1'), (SELECT v FROM t_var WHERE k='p1')),
  'bật nhiều phiên bản sinh đủ 4 tổ hợp');

SELECT is(
  (SELECT count(*)::int FROM public.product_variants
   WHERE product_id=(SELECT v FROM t_var WHERE k='p1') AND retired_at IS NULL),
  4, 'đúng 4 phiên bản đang hoạt động');
SELECT is(
  (SELECT retired_at IS NOT NULL FROM public.product_variants WHERE id=(SELECT v FROM t_var WHERE k='v1')),
  true, 'phiên bản mặc định cũ được cho nghỉ, KHÔNG bị xoá');
SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements WHERE variant_id=(SELECT v FROM t_var WHERE k='v1')),
  3, 'và lịch sử kho của nó còn nguyên: mở đầu 5, nhập 3, nhập 2 — ba dòng, đúng ba lần thật sự có gì đó chuyển động');
SELECT is(
  (SELECT stock_on_hand FROM public.product_variants
   WHERE product_id=(SELECT v FROM t_var WHERE k='p1') AND sku='CP-W40'),
  3, 'tồn kho mở đầu của phiên bản mới được ghi nhận');
SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements m
   JOIN public.product_variants v ON v.id=m.variant_id
   WHERE v.sku='CP-W40' AND m.reason='opening'),
  1, 'qua sổ kho, không phải gán thẳng');
SELECT ok(
  (SELECT stock_on_hand IS NULL FROM public.product_variants
   WHERE product_id=(SELECT v FROM t_var WHERE k='p1') AND sku='CP-B40'),
  'phiên bản không đếm tồn kho vẫn giữ NULL — "không đếm" khác "hết hàng"');
SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements m
   JOIN public.product_variants v ON v.id=m.variant_id WHERE v.sku='CP-B40'),
  0, 'và không sinh dòng sổ kho giả cho nó');

-- Replay of the matrix save.
SELECT is(
  (SELECT count(*)::int FROM public.product_variants_reconcile(
     (SELECT v FROM t_var WHERE k='p1'),
     -- deliberately a stale version: the replay must be answered by the token
     -- BEFORE the version is compared, or a legitimate retry looks like a
     -- conflict and the seller is asked to resolve one that does not exist.
     1,
     '[{"name":"Màu sắc","values":["Trắng","Đen"]},{"name":"Kích cỡ","values":["39","40"]}]'::jsonb,
     '[{"option_values":{"Màu sắc":"Trắng","Kích cỡ":"39"},"price_vnd":1,"stock_on_hand":0}]'::jsonb,
     'tok-matrix-0001')),
  4, 'gửi lại cùng mã chống trùng trả về ma trận cũ, không đối chiếu lại');

-- ─── Identity survives a reorder ────────────────────────────────────────────

INSERT INTO t_var VALUES ('w39',
  (SELECT id FROM public.product_variants
   WHERE product_id=(SELECT v FROM t_var WHERE k='p1') AND sku='CP-W39'));

SELECT lives_ok(
  format($$ SELECT public.product_variants_reconcile(
      %L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '[{"name":"Kích cỡ","values":["40","39"]},{"name":"Màu sắc","values":["Đen","Trắng"]}]'::jsonb,
      '[{"option_values":{"Kích cỡ":"39","Màu sắc":"Trắng"},"price_vnd":1290000,"stock_on_hand":2,"sku":"CP-W39"},
        {"option_values":{"Kích cỡ":"40","Màu sắc":"Trắng"},"price_vnd":1290000,"stock_on_hand":3,"sku":"CP-W40"},
        {"option_values":{"Kích cỡ":"39","Màu sắc":"Đen"},"price_vnd":1350000,"stock_on_hand":0,"sku":"CP-B39"},
        {"option_values":{"Kích cỡ":"40","Màu sắc":"Đen"},"price_vnd":1350000,"stock_on_hand":null,"sku":"CP-B40"}]'::jsonb,
      'tok-matrix-0002') $$,
    (SELECT v FROM t_var WHERE k='p1'), (SELECT v FROM t_var WHERE k='p1')),
  'đảo thứ tự nhóm và giá trị vẫn lưu được');
SELECT is(
  (SELECT id FROM public.product_variants
   WHERE product_id=(SELECT v FROM t_var WHERE k='p1') AND sku='CP-W39' AND retired_at IS NULL),
  (SELECT v FROM t_var WHERE k='w39'),
  'và Trắng/39 vẫn là ĐÚNG phiên bản cũ — id không đổi, lịch sử không mất');
SELECT is(
  (SELECT count(*)::int FROM public.product_variants
   WHERE product_id=(SELECT v FROM t_var WHERE k='p1') AND retired_at IS NULL),
  4, 'đảo thứ tự không sinh tổ hợp giả');

-- ─── Adding a value adds only what is new ──────────────────────────────────

SELECT lives_ok(
  format($$ SELECT public.product_variants_reconcile(
      %L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '[{"name":"Màu sắc","values":["Trắng","Đen"]},{"name":"Kích cỡ","values":["39","40","41"]}]'::jsonb,
      '[{"option_values":{"Màu sắc":"Trắng","Kích cỡ":"39"},"price_vnd":1290000,"stock_on_hand":2,"sku":"CP-W39"},
        {"option_values":{"Màu sắc":"Trắng","Kích cỡ":"40"},"price_vnd":1290000,"stock_on_hand":3,"sku":"CP-W40"},
        {"option_values":{"Màu sắc":"Trắng","Kích cỡ":"41"},"price_vnd":1290000,"stock_on_hand":null,"sku":"CP-W41"},
        {"option_values":{"Màu sắc":"Đen","Kích cỡ":"39"},"price_vnd":1350000,"stock_on_hand":0,"sku":"CP-B39"},
        {"option_values":{"Màu sắc":"Đen","Kích cỡ":"40"},"price_vnd":1350000,"stock_on_hand":null,"sku":"CP-B40"},
        {"option_values":{"Màu sắc":"Đen","Kích cỡ":"41"},"price_vnd":1350000,"stock_on_hand":null,"sku":"CP-B41"}]'::jsonb,
      'tok-matrix-0003') $$,
    (SELECT v FROM t_var WHERE k='p1'), (SELECT v FROM t_var WHERE k='p1')),
  'thêm một giá trị vào nhóm');
SELECT is(
  (SELECT count(*)::int FROM public.product_variants
   WHERE product_id=(SELECT v FROM t_var WHERE k='p1') AND retired_at IS NULL),
  6, 'sinh đúng 6 tổ hợp');
SELECT is(
  (SELECT id FROM public.product_variants
   WHERE product_id=(SELECT v FROM t_var WHERE k='p1') AND sku='CP-W39' AND retired_at IS NULL),
  (SELECT v FROM t_var WHERE k='w39'),
  'và 4 tổ hợp cũ giữ nguyên id — thêm tuỳ chọn chỉ tạo cái thực sự mới');
SELECT is(
  (SELECT stock_on_hand FROM public.product_variants
   WHERE product_id=(SELECT v FROM t_var WHERE k='p1') AND sku='CP-W40'),
  3, 'tồn kho của tổ hợp cũ không bị lần lưu này viết lại');

-- ─── The graph is checked, not trusted ─────────────────────────────────────

SELECT throws_ok(
  format($$ SELECT public.product_variants_reconcile(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '[{"name":"Màu sắc","values":["Trắng"]}]'::jsonb,
      '[{"option_values":{"Màu sắc":"Trắng"},"price_vnd":1,"stock_on_hand":0},
        {"option_values":{"Màu sắc":" trắng "},"price_vnd":2,"stock_on_hand":0}]'::jsonb) $$,
    (SELECT v FROM t_var WHERE k='p1'), (SELECT v FROM t_var WHERE k='p1')),
  '23505', NULL, 'hai dòng cùng một tổ hợp (sau chuẩn hoá) bị từ chối');

SELECT throws_ok(
  format($$ SELECT public.product_variants_reconcile(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '[{"name":"Màu sắc","values":["Trắng"]},{"name":"Kích cỡ","values":["39"]}]'::jsonb,
      '[{"option_values":{"Màu sắc":"Trắng"},"price_vnd":1,"stock_on_hand":0}]'::jsonb) $$,
    (SELECT v FROM t_var WHERE k='p1'), (SELECT v FROM t_var WHERE k='p1')),
  '22023', NULL, 'phiên bản thiếu một nhóm tuỳ chọn bị từ chối');

SELECT throws_ok(
  format($$ SELECT public.product_variants_reconcile(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '[{"name":"Màu sắc","values":["Trắng"]}]'::jsonb,
      '[{"option_values":{"Màu sắc":"Hồng"},"price_vnd":1,"stock_on_hand":0}]'::jsonb) $$,
    (SELECT v FROM t_var WHERE k='p1'), (SELECT v FROM t_var WHERE k='p1')),
  '22023', NULL, 'giá trị không nằm trong danh sách đã khai bị từ chối');

SELECT throws_ok(
  format($$ SELECT public.product_variants_reconcile(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '[{"name":"A","values":["1"]},{"name":"B","values":["1"]},{"name":"C","values":["1"]},{"name":"D","values":["1"]}]'::jsonb,
      '[{"option_values":{"A":"1","B":"1","C":"1","D":"1"},"price_vnd":1,"stock_on_hand":0}]'::jsonb) $$,
    (SELECT v FROM t_var WHERE k='p1'), (SELECT v FROM t_var WHERE k='p1')),
  '22023', NULL, 'quá 3 nhóm bị từ chối ở RPC, không chỉ ở CHECK');

SELECT throws_ok(
  format($$ SELECT public.product_variants_reconcile(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '[{"name":"Màu sắc","values":["Trắng","Đen"]},{"name":"Kích cỡ","values":["39","40","41"]}]'::jsonb,
      '[{"option_values":{"Màu sắc":"Trắng","Kích cỡ":"39"},"price_vnd":-1,"stock_on_hand":0}]'::jsonb) $$,
    (SELECT v FROM t_var WHERE k='p1'), (SELECT v FROM t_var WHERE k='p1')),
  '22023', NULL, 'giá âm bị từ chối');

SELECT throws_ok(
  format($$ SELECT public.product_variants_reconcile(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '[{"name":"Màu sắc","values":["Trắng","Đen"]},{"name":"Kích cỡ","values":["39","40","41"]}]'::jsonb,
      '[{"option_values":{"Màu sắc":"Trắng","Kích cỡ":"39"},"price_vnd":100,"stock_on_hand":-3}]'::jsonb) $$,
    (SELECT v FROM t_var WHERE k='p1'), (SELECT v FROM t_var WHERE k='p1')),
  '22023', NULL, 'tồn kho âm bị từ chối');

SELECT is(
  (SELECT count(*)::int FROM public.product_variants
   WHERE product_id=(SELECT v FROM t_var WHERE k='p1') AND retired_at IS NULL),
  6, 'không lần từ chối nào ở trên để lại ma trận sửa dở');

-- ─── SKU ────────────────────────────────────────────────────────────────────

INSERT INTO t_var VALUES ('p2',
  (public.product_create('7c000001-0000-4000-8000-000000000001'::uuid, 'tok-var-0002',
    '{"title":"Giày pickleball Court Lite","category_slug":"giay","price_vnd":990000}'::jsonb)).id);

SELECT throws_ok(
  format($$ UPDATE public.product_variants SET sku = ' cp-w39 ' WHERE product_id = %L::uuid $$,
    (SELECT v FROM t_var WHERE k='p2')),
  '23505', NULL, 'mã hàng trùng trong cùng shop bị chặn, kể cả khác hoa/thường và khoảng trắng');

SET LOCAL request.jwt.claims TO '{"sub":"50060004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
INSERT INTO t_var VALUES ('p3',
  (public.product_create('7c000002-0000-4000-8000-000000000002'::uuid, 'tok-var-0003',
    '{"title":"Giày shop khác","category_slug":"giay","price_vnd":990000}'::jsonb)).id);
SELECT lives_ok(
  format($$ UPDATE public.product_variants SET sku = 'CP-W39' WHERE product_id = %L::uuid $$,
    (SELECT v FROM t_var WHERE k='p3')),
  'nhưng shop KHÁC dùng lại đúng mã đó thì được — phạm vi là theo shop, đúng như proposal chốt');

-- ─── Role matrix ────────────────────────────────────────────────────────────

SELECT throws_ok(
  format($$ SELECT public.product_variants_reconcile(%L::uuid, 1,
      '[{"name":"Màu sắc","values":["Trắng"]}]'::jsonb,
      '[{"option_values":{"Màu sắc":"Trắng"},"price_vnd":1,"stock_on_hand":0}]'::jsonb) $$,
    (SELECT v FROM t_var WHERE k='p1')),
  '42501', NULL, 'người bán shop khác KHÔNG sửa được ma trận của shop này');
SELECT throws_ok(
  format($$ SELECT public.product_variant_adjust_stock(%L::uuid, 1, 'restock') $$,
    (SELECT v FROM t_var WHERE k='w39')),
  '42501', NULL, 'và KHÔNG điều chỉnh được kho của shop này');
SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements
   WHERE shop_id='7c000001-0000-4000-8000-000000000001'::uuid),
  0, 'và KHÔNG đọc được sổ kho của shop này');

SET LOCAL request.jwt.claims TO '{"sub":"50060003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_variants_reconcile(%L::uuid, 1,
      '[{"name":"Màu sắc","values":["Trắng"]}]'::jsonb,
      '[{"option_values":{"Màu sắc":"Trắng"},"price_vnd":1,"stock_on_hand":0}]'::jsonb) $$,
    (SELECT v FROM t_var WHERE k='p1')),
  '42501', NULL, 'support KHÔNG sửa được ma trận');
SELECT throws_ok(
  format($$ SELECT public.product_variant_adjust_stock(%L::uuid, 1, 'restock') $$,
    (SELECT v FROM t_var WHERE k='w39')),
  '42501', NULL, 'support KHÔNG điều chỉnh được kho');
SELECT ok(
  (SELECT count(*) FROM public.inventory_movements
   WHERE shop_id='7c000001-0000-4000-8000-000000000001'::uuid) > 0,
  'nhưng support ĐỌC được sổ kho của shop mình');

SET LOCAL request.jwt.claims TO '{"sub":"50060006-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_variant_adjust_stock(%L::uuid, 1, 'restock') $$,
    (SELECT v FROM t_var WHERE k='w39')),
  '42501', NULL, 'quản lý ngoài danh sách thí điểm KHÔNG điều chỉnh được kho');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
-- Stronger than an empty result: anon has no GRANT on the ledger at all, so
-- the table is not reachable rather than merely filtered. A shop's stock
-- history is not a thing the public gets to ask about.
SELECT throws_ok(
  $$ SELECT count(*) FROM public.inventory_movements $$,
  '42501', NULL, 'khách KHÔNG chạm được tới sổ kho — thiếu cả GRANT, không chỉ policy');
SELECT is((SELECT count(*)::int FROM public.product_variants), 0,
  'khách KHÔNG đọc được phiên bản của sản phẩm nháp');

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50060005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
SELECT ok(
  (SELECT count(*) FROM public.inventory_movements
   WHERE shop_id='7c000001-0000-4000-8000-000000000001'::uuid) > 0,
  'quản trị viên đã qua 2FA đọc được sổ kho');
SET LOCAL request.jwt.claims TO '{"sub":"50060005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements
   WHERE shop_id='7c000001-0000-4000-8000-000000000001'::uuid),
  0, 'quản trị viên chưa qua 2FA thì không — is_admin() không mở cửa ở aal1');

-- ─── Manager can, and the stale version cannot ─────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50060002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
SELECT lives_ok(
  format($$ SELECT public.product_variant_adjust_stock(%L::uuid, 1, 'restock') $$,
    (SELECT v FROM t_var WHERE k='w39')),
  'quản lý điều chỉnh được kho');

SELECT throws_ok(
  format($$ SELECT public.product_variants_reconcile(%L::uuid, 1,
      '[{"name":"Màu sắc","values":["Trắng"]}]'::jsonb,
      '[{"option_values":{"Màu sắc":"Trắng"},"price_vnd":1,"stock_on_hand":0}]'::jsonb) $$,
    (SELECT v FROM t_var WHERE k='p1')),
  '40001', NULL, 'phiên bản cũ bị từ chối, không ghi đè ma trận mới hơn');
SELECT is(
  (SELECT count(*)::int FROM public.product_variants
   WHERE product_id=(SELECT v FROM t_var WHERE k='p1') AND retired_at IS NULL),
  6, 'và ma trận vẫn nguyên 6 dòng sau lần từ chối đó');

-- ─── Multi -> single ────────────────────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50060001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT throws_ok(
  format($$ SELECT public.product_variants_reconcile(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '[]'::jsonb,
      '[{"price_vnd":1290000,"stock_on_hand":2}]'::jsonb) $$,
    (SELECT v FROM t_var WHERE k='p1'), (SELECT v FROM t_var WHERE k='p1')),
  '22023', NULL, 'tắt nhiều phiên bản mà không chọn phiên bản giữ lại thì bị từ chối');

SELECT lives_ok(
  format($$ SELECT public.product_variants_reconcile(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '[]'::jsonb,
      '[{"price_vnd":1290000,"stock_on_hand":2,"sku":"CP-W39"}]'::jsonb,
      NULL, %L::uuid) $$,
    (SELECT v FROM t_var WHERE k='p1'), (SELECT v FROM t_var WHERE k='p1'),
    (SELECT v FROM t_var WHERE k='w39')),
  'chọn rõ phiên bản giữ lại thì tắt được');
SELECT is(
  (SELECT count(*)::int FROM public.product_variants
   WHERE product_id=(SELECT v FROM t_var WHERE k='p1') AND retired_at IS NULL),
  1, 'còn đúng một phiên bản mặc định');
SELECT is(
  (SELECT id FROM public.product_variants
   WHERE product_id=(SELECT v FROM t_var WHERE k='p1') AND retired_at IS NULL),
  (SELECT v FROM t_var WHERE k='w39'),
  'và là ĐÚNG phiên bản người bán chọn, giữ nguyên id');
SELECT ok(
  (SELECT option_key IS NULL AND option_values IS NULL FROM public.product_variants
   WHERE id=(SELECT v FROM t_var WHERE k='w39')),
  'phiên bản còn lại trở về dạng mặc định, không mang tuỳ chọn mồ côi');
SELECT is(
  (SELECT count(*)::int FROM public.product_variants
   WHERE product_id=(SELECT v FROM t_var WHERE k='p1') AND retired_at IS NOT NULL),
  6, 'năm tổ hợp kia được cho nghỉ, KHÔNG bị xoá — đơn hàng Phase 3 còn tham chiếu được');
SELECT is(
  (SELECT option_groups FROM public.products WHERE id=(SELECT v FROM t_var WHERE k='p1')),
  '[]'::jsonb, 'và bộ tuỳ chọn được dọn theo');

-- A retired combination can come back without tripping the unique index.
SELECT lives_ok(
  format($$ SELECT public.product_variants_reconcile(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '[{"name":"Màu sắc","values":["Trắng","Đen"]}]'::jsonb,
      '[{"option_values":{"Màu sắc":"Trắng"},"price_vnd":1290000,"stock_on_hand":1},
        {"option_values":{"Màu sắc":"Đen"},"price_vnd":1350000,"stock_on_hand":1}]'::jsonb) $$,
    (SELECT v FROM t_var WHERE k='p1'), (SELECT v FROM t_var WHERE k='p1')),
  'bật lại nhiều phiên bản sau khi đã tắt vẫn chạy — dòng đã nghỉ không chặn tổ hợp mới');

-- ─── A variant with options cannot survive its product losing them ─────────

-- Pinned, not refused: the guard rewrites the column back to OLD, so the write
-- succeeds and changes nothing. That is the same shape as every other
-- privileged column on products, and the assertion that matters is the next
-- one — what the row says afterwards.
SELECT lives_ok(
  format($$ UPDATE public.products SET option_groups = '[]'::jsonb WHERE id = %L::uuid $$,
    (SELECT v FROM t_var WHERE k='p1')),
  'client sửa thẳng bộ tuỳ chọn thì không lỗi…');
SELECT ok(
  (SELECT jsonb_array_length(option_groups) FROM public.products WHERE id=(SELECT v FROM t_var WHERE k='p1')) = 1,
  '…nhưng bộ tuỳ chọn vẫn còn nguyên — cột bị ghim, không phải bị chặn');

-- …but the shop itself must still be deletable, cascade and all. A ledger that
-- makes its own shop undeletable is not protecting history, it is a leak: it
-- breaks account deletion, admin cleanup and the QA teardown. Found by the QA
-- run silently leaving six shops behind, not by reading the trigger.
-- As a role that is allowed to delete a shop at all: only service_role and
-- admin tooling ever do this, and a seller has no DELETE grant on shops.
SET LOCAL role postgres;
SELECT lives_ok(
  $$ DELETE FROM public.shops WHERE id = '7c000002-0000-4000-8000-000000000002'::uuid $$,
  'xoá shop vẫn chạy được dù shop đó đã có sổ kho');
SELECT is(
  (SELECT count(*)::int FROM public.inventory_movements
   WHERE shop_id = '7c000002-0000-4000-8000-000000000002'::uuid),
  0, 'và sổ kho của shop đó đi theo — cascade chứ không phải tỉa từng dòng');

SELECT * FROM finish();
ROLLBACK;
