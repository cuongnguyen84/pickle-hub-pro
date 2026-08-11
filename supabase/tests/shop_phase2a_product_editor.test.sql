-- Shop marketplace P2a step 4 — the seller product editor.
--
-- What this file is actually asking:
--   * can a product ever exist without the default variant that carries its
--     price, by any route including a failed retry;
--   * can anybody but an owner/manager of THIS shop write to it;
--   * can a client set a column the moderation flow owns;
--   * does a stale tab overwrite a newer save.
--
-- Route guards are not evidence for any of this. Every assertion below goes
-- through the database with a real role and real JWT claims.

BEGIN;

SELECT plan(70);

-- ─── Fixture ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('50050001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'prod-owner@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Owner"}'::jsonb, NOW(), NOW()),
  ('50050002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'prod-manager@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Manager"}'::jsonb, NOW(), NOW()),
  ('50050003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'prod-support@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Support"}'::jsonb, NOW(), NOW()),
  ('50050004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'prod-rival@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Rival"}'::jsonb, NOW(), NOW()),
  ('50050005-0000-4000-8000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'prod-admin@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Admin"}'::jsonb, NOW(), NOW()),
  -- A manager of the shop who is NOT on the pilot list. Membership can outlive
  -- the list, and Phase 1 decided the list is the gate.
  ('50050006-0000-4000-8000-000000000006'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'prod-nonpilot@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"NonPilot"}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('50050005-0000-4000-8000-000000000005'::uuid, 'admin') ON CONFLICT DO NOTHING;

-- The 2FA requirement is self-activating: it applies once the admin HAS a
-- verified factor. Without this row an aal1 session is legitimately admin, and
-- the assertion below would pass for the wrong reason.
INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES ('5f000005-0000-4000-8000-000000000005'::uuid, '50050005-0000-4000-8000-000000000005'::uuid,
        'test-totp', 'totp', 'verified', NOW(), NOW(), 'JBSWY3DPEHPK3PXP');

INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('50050001-0000-4000-8000-000000000001'::uuid),
  ('50050002-0000-4000-8000-000000000002'::uuid),
  ('50050003-0000-4000-8000-000000000003'::uuid),
  ('50050004-0000-4000-8000-000000000004'::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id) VALUES
  ('7b000001-0000-4000-8000-000000000001'::uuid, 'vot-sai-gon', 'Vợt Sài Gòn', 'active', '50050001-0000-4000-8000-000000000001'::uuid),
  ('7b000002-0000-4000-8000-000000000002'::uuid, 'vot-ha-noi',  'Vợt Hà Nội',  'active', '50050004-0000-4000-8000-000000000004'::uuid),
  ('7b000003-0000-4000-8000-000000000003'::uuid, 'vot-tam-ngung', 'Vợt Tạm Ngưng', 'suspended', '50050001-0000-4000-8000-000000000001'::uuid);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('7b000001-0000-4000-8000-000000000001'::uuid, '50050001-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('7b000001-0000-4000-8000-000000000001'::uuid, '50050002-0000-4000-8000-000000000002'::uuid, 'manager'),
  ('7b000001-0000-4000-8000-000000000001'::uuid, '50050003-0000-4000-8000-000000000003'::uuid, 'support'),
  ('7b000001-0000-4000-8000-000000000001'::uuid, '50050006-0000-4000-8000-000000000006'::uuid, 'manager'),
  ('7b000002-0000-4000-8000-000000000002'::uuid, '50050004-0000-4000-8000-000000000004'::uuid, 'owner'),
  ('7b000003-0000-4000-8000-000000000003'::uuid, '50050001-0000-4000-8000-000000000001'::uuid, 'owner');

-- ─── Shape ──────────────────────────────────────────────────────────────────

SELECT has_column('public', 'products', 'version', 'products carries a concurrency token');
SELECT has_column('public', 'products', 'client_token', 'products carries the create idempotency key');
SELECT ok(
  (SELECT indexdef LIKE '%UNIQUE%' FROM pg_indexes
   WHERE schemaname='public' AND indexname='uniq_products_client_token'),
  'the idempotency key is enforced by an index, not by the RPC remembering to look'
);

-- ─── Create: the product and its default variant, or neither ───────────────

-- Ids parked outside RLS. Later assertions run as a rival seller and as anon,
-- who cannot SELECT this shop's products — which is the point of those tests,
-- and would otherwise turn a subquery into NULL and the assertion into noise.
CREATE TEMP TABLE t_ids (k TEXT PRIMARY KEY, v UUID);
GRANT SELECT, INSERT ON t_ids TO authenticated, anon;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50050001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is(
  (public.product_create('7b000001-0000-4000-8000-000000000001'::uuid, 'tok-owner-0001',
     '{"title":"Vợt pickleball carbon T700 16mm","category_slug":"vot","price_vnd":2450000,"stock":4}'::jsonb)).title,
  'Vợt pickleball carbon T700 16mm',
  'chủ shop tạo được sản phẩm'
);

SELECT is(
  (SELECT count(*)::int FROM public.product_variants v
   JOIN public.products p ON p.id = v.product_id
   WHERE p.client_token = 'tok-owner-0001'),
  1,
  'tạo sản phẩm sinh đúng MỘT phiên bản mặc định trong cùng giao dịch'
);

SELECT is(
  (SELECT v.price_vnd FROM public.product_variants v
   JOIN public.products p ON p.id = v.product_id WHERE p.client_token = 'tok-owner-0001'),
  2450000,
  'giá nằm trên phiên bản, không nằm trên sản phẩm'
);

SELECT is(
  (SELECT status::text FROM public.products WHERE client_token = 'tok-owner-0001'),
  'draft',
  'sản phẩm mới luôn là bản nháp, bất kể client gửi gì'
);

SELECT is(
  (SELECT slug FROM public.products WHERE client_token = 'tok-owner-0001'),
  'vot-pickleball-carbon-t700-16mm',
  'slug sinh từ tên tiếng Việt, không mất dấu thành ký tự lạ'
);

-- The replay. This is the assertion the idempotency key exists for.
SELECT is(
  (public.product_create('7b000001-0000-4000-8000-000000000001'::uuid, 'tok-owner-0001',
     '{"title":"Tên hoàn toàn khác","category_slug":"vot","price_vnd":9990000}'::jsonb)).id,
  (SELECT id FROM public.products WHERE client_token = 'tok-owner-0001'),
  'gửi lại cùng mã chống trùng trả về ĐÚNG sản phẩm cũ'
);
SELECT is(
  (SELECT count(*)::int FROM public.products WHERE shop_id='7b000001-0000-4000-8000-000000000001'::uuid),
  1,
  'và không tạo sản phẩm thứ hai'
);
SELECT is(
  (SELECT title FROM public.products WHERE client_token = 'tok-owner-0001'),
  'Vợt pickleball carbon T700 16mm',
  'lần gửi lại cũng không ghi đè nội dung bằng payload mới'
);

-- Slug collision: a second product with the same title cannot take the URL.
SELECT is(
  (public.product_create('7b000001-0000-4000-8000-000000000001'::uuid, 'tok-owner-0002',
     '{"title":"Vợt pickleball carbon T700 16mm","category_slug":"vot","price_vnd":2450000}'::jsonb)).slug,
  'vot-pickleball-carbon-t700-16mm-1',
  'trùng tên thì slug được thêm hậu tố, không lỗi trước mặt người bán'
);

-- Price is money, and money is not a float.
SELECT throws_ok(
  $$ SELECT public.product_create('7b000001-0000-4000-8000-000000000001'::uuid, 'tok-bad-price-1',
       '{"title":"Vợt giá lẻ","price_vnd":12.5}'::jsonb) $$,
  '22023', NULL, 'giá thập phân bị từ chối — VND không có đơn vị lẻ');
SELECT throws_ok(
  $$ SELECT public.product_create('7b000001-0000-4000-8000-000000000001'::uuid, 'tok-bad-price-2',
       '{"title":"Vợt giá âm","price_vnd":-100}'::jsonb) $$,
  '22023', NULL, 'giá âm bị từ chối');
SELECT throws_ok(
  $$ SELECT public.product_create('7b000001-0000-4000-8000-000000000001'::uuid, 'tok-bad-price-3',
       '{"title":"Vợt giá mũ","price_vnd":"1e6"}'::jsonb) $$,
  '22023', NULL, 'ký hiệu khoa học bị từ chối, không âm thầm thành 1000000');
SELECT throws_ok(
  $$ SELECT public.product_create('7b000001-0000-4000-8000-000000000001'::uuid, 'tok-bad-price-4',
       '{"title":"Vợt không giá"}'::jsonb) $$,
  '22023', NULL, 'thiếu giá bị từ chối — phiên bản mặc định phải có giá');
SELECT throws_ok(
  $$ SELECT public.product_create('7b000001-0000-4000-8000-000000000001'::uuid, 'tok-bad-title',
       '{"title":"Vợ","price_vnd":100000}'::jsonb) $$,
  '22023', NULL, 'tên quá ngắn bị từ chối');
SELECT throws_ok(
  $$ SELECT public.product_create('7b000001-0000-4000-8000-000000000001'::uuid, '',
       '{"title":"Vợt thiếu mã","price_vnd":100000}'::jsonb) $$,
  '22023', NULL, 'thiếu mã chống trùng bị từ chối — nếu không thì retry sinh sản phẩm thừa');

-- Nothing above left a half-written product behind.
SELECT is(
  (SELECT count(*)::int FROM public.products
   WHERE shop_id='7b000001-0000-4000-8000-000000000001'::uuid
     AND id NOT IN (SELECT product_id FROM public.product_variants)),
  0,
  'không có sản phẩm nào tồn tại mà thiếu phiên bản mặc định'
);

-- Stock is a third answer, not a zero.
SELECT ok(
  (SELECT stock IS NULL FROM public.product_variants v JOIN public.products p ON p.id=v.product_id
   WHERE p.client_token='tok-owner-0002'),
  'bỏ trống tồn kho lưu NULL — "không đếm" khác "hết hàng"'
);

INSERT INTO t_ids VALUES
  ('p1', (SELECT id FROM public.products WHERE client_token='tok-owner-0001')),
  ('p2', (SELECT id FROM public.products WHERE client_token='tok-owner-0002'));

-- ─── Update: version, editability, and the default variant ─────────────────

SELECT is(
  (public.product_update(
     (SELECT id FROM public.products WHERE client_token='tok-owner-0001'),
     (SELECT version FROM public.products WHERE client_token='tok-owner-0001'),
     '{"description":"Mặt carbon T700, lõi tổ ong 16mm."}'::jsonb,
     '{"price_vnd":2390000,"stock":6}'::jsonb)).description,
  'Mặt carbon T700, lõi tổ ong 16mm.',
  'chủ shop sửa được bản nháp'
);
SELECT is(
  (SELECT v.price_vnd FROM public.product_variants v JOIN public.products p ON p.id=v.product_id
   WHERE p.client_token='tok-owner-0001'),
  2390000,
  'và giá trên phiên bản mặc định đi cùng lần lưu đó'
);

-- Renaming must not move the URL.
SELECT is(
  (SELECT slug FROM public.products WHERE client_token='tok-owner-0001'),
  'vot-pickleball-carbon-t700-16mm',
  'đổi tên không đổi đường dẫn'
);
SELECT is(
  (public.product_update(
     (SELECT id FROM public.products WHERE client_token='tok-owner-0001'),
     (SELECT version FROM public.products WHERE client_token='tok-owner-0001'),
     '{"title":"Vợt carbon T700 bản 2026"}'::jsonb, NULL)).slug,
  'vot-pickleball-carbon-t700-16mm',
  'kể cả khi tên đã đổi hẳn'
);

-- The stale tab.
SELECT throws_ok(
  format($$ SELECT public.product_update(%L::uuid, 1, '{"title":"Bản cũ ghi đè"}'::jsonb, NULL) $$,
    (SELECT id FROM public.products WHERE client_token='tok-owner-0001')),
  '40001', NULL, 'phiên bản cũ bị từ chối chứ không ghi đè bản mới');
SELECT is(
  (SELECT title FROM public.products WHERE client_token='tok-owner-0001'),
  'Vợt carbon T700 bản 2026',
  'và nội dung mới vẫn nguyên vẹn sau lần từ chối đó'
);

-- ─── Slug: explicit, normalised, reserved, unique ──────────────────────────

SELECT is(
  public.product_slug_update((SELECT id FROM public.products WHERE client_token='tok-owner-0001'),
    'Vợt Carbon T700 Bản 2026'),
  'vot-carbon-t700-ban-2026',
  'đổi đường dẫn là hành động riêng, và được chuẩn hoá'
);
SELECT is(
  public.product_slug_update((SELECT id FROM public.products WHERE client_token='tok-owner-0001'),
    '  VOT---carbon   T700  '),
  'vot-carbon-t700',
  'hoa/thường, khoảng trắng và gạch thừa không lách được uniqueness'
);
SELECT throws_ok(
  format($$ SELECT public.product_slug_update(%L::uuid, 'admin') $$,
    (SELECT id FROM public.products WHERE client_token='tok-owner-0001')),
  '22023', NULL, 'từ khoá hệ thống bị từ chối');
SELECT throws_ok(
  format($$ SELECT public.product_slug_update(%L::uuid, %L) $$,
    (SELECT id FROM public.products WHERE client_token='tok-owner-0001'),
    (SELECT slug FROM public.products WHERE client_token='tok-owner-0002')),
  '23505', NULL, 'slug đã có sản phẩm khác dùng bị từ chối');
SELECT throws_ok(
  format($$ SELECT public.product_slug_update(%L::uuid, 'ab') $$,
    (SELECT id FROM public.products WHERE client_token='tok-owner-0001')),
  '22023', NULL, 'slug quá ngắn bị từ chối');

-- ─── Column guards: what a client may never write ──────────────────────────

SELECT lives_ok(
  format($$ UPDATE public.products SET in_stock = false WHERE id = %L::uuid $$,
    (SELECT id FROM public.products WHERE client_token='tok-owner-0001')),
  'người bán vẫn tự bật/tắt còn hàng được — không phải việc của hàng chờ duyệt');

-- Each of these is a PostgREST PATCH away, so each is pinned in the trigger.
UPDATE public.products
SET status = 'approved', is_published = true, internal_note = 'tự duyệt',
    requested_fields = ARRAY['title'], decided_by = '50050001-0000-4000-8000-000000000001'::uuid,
    shop_id = '7b000002-0000-4000-8000-000000000002'::uuid,
    slug = 'cuop-slug', client_token = 'tok-khac'
WHERE client_token = 'tok-owner-0001';

SELECT is((SELECT status::text FROM public.products WHERE client_token='tok-owner-0001'), 'draft',
  'client KHÔNG tự duyệt được sản phẩm của mình');
SELECT ok((SELECT NOT is_published FROM public.products WHERE client_token='tok-owner-0001'),
  'client KHÔNG tự xuất bản được');
SELECT ok((SELECT internal_note IS NULL FROM public.products WHERE client_token='tok-owner-0001'),
  'client KHÔNG ghi được ghi chú nội bộ của quản trị');
SELECT is((SELECT array_length(requested_fields,1) FROM public.products WHERE client_token='tok-owner-0001'), NULL,
  'client KHÔNG tự đặt được danh sách trường cần sửa');
SELECT ok((SELECT decided_by IS NULL FROM public.products WHERE client_token='tok-owner-0001'),
  'client KHÔNG tự ghi người duyệt');
SELECT is((SELECT shop_id FROM public.products WHERE client_token='tok-owner-0001'),
  '7b000001-0000-4000-8000-000000000001'::uuid,
  'sản phẩm KHÔNG chuyển được sang shop khác');
SELECT is((SELECT slug FROM public.products WHERE client_token='tok-owner-0001'), 'vot-carbon-t700',
  'slug KHÔNG đổi được bằng UPDATE thẳng — chỉ qua RPC');
SELECT is((SELECT client_token FROM public.products WHERE client_token IS NOT NULL
           AND id = (SELECT id FROM public.products WHERE slug='vot-carbon-t700')), 'tok-owner-0001',
  'mã chống trùng KHÔNG viết lại được — nếu không thì replay sinh sản phẩm thứ hai');

-- The variant cannot walk to another shop. RLS refuses before the composite FK
-- is even consulted — two independent walls, and the outer one answers first.
-- The FK itself is proved below, from the rival's side where RLS lets the write
-- through and only the key stops it.
SELECT throws_ok(
  format($$ UPDATE public.product_variants SET shop_id = %L::uuid WHERE product_id = %L::uuid $$,
    '7b000002-0000-4000-8000-000000000002'::uuid,
    (SELECT id FROM public.products WHERE client_token='tok-owner-0001')),
  '42501', NULL, 'phiên bản KHÔNG chuyển được sang shop khác (RLS chặn trước)');

-- ─── Role matrix ────────────────────────────────────────────────────────────

-- Manager: yes.
SET LOCAL request.jwt.claims TO '{"sub":"50050002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.product_create('7b000001-0000-4000-8000-000000000001'::uuid, 'tok-manager-0001',
     '{"title":"Giày pickleball nam size 41","category_slug":"giay","price_vnd":1290000}'::jsonb)).title,
  'Giày pickleball nam size 41',
  'quản lý tạo được sản phẩm');

-- Support: reads, writes nothing.
SET LOCAL request.jwt.claims TO '{"sub":"50050003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
SELECT ok(
  (SELECT count(*) FROM public.products WHERE shop_id='7b000001-0000-4000-8000-000000000001'::uuid) > 0,
  'support đọc được danh mục của shop mình');
SELECT throws_ok(
  $$ SELECT public.product_create('7b000001-0000-4000-8000-000000000001'::uuid, 'tok-support-0001',
       '{"title":"Support tạo hộ","price_vnd":100000}'::jsonb) $$,
  '42501', NULL, 'support KHÔNG tạo được sản phẩm');
SELECT throws_ok(
  format($$ SELECT public.product_update(%L::uuid, %s, '{"title":"Support sửa hộ"}'::jsonb, NULL) $$,
    (SELECT id FROM public.products WHERE client_token='tok-owner-0002'),
    (SELECT version FROM public.products WHERE client_token='tok-owner-0002')),
  '42501', NULL, 'support KHÔNG sửa được sản phẩm');
SELECT throws_ok(
  format($$ SELECT public.product_archive(%L::uuid) $$,
    (SELECT id FROM public.products WHERE client_token='tok-owner-0002')),
  '42501', NULL, 'support KHÔNG ngừng bán được sản phẩm');
SELECT throws_ok(
  format($$ SELECT public.product_slug_update(%L::uuid, 'support-doi-slug') $$,
    (SELECT id FROM public.products WHERE client_token='tok-owner-0002')),
  '42501', NULL, 'support KHÔNG đổi được đường dẫn');

-- A rival shop's owner: sees nothing private, writes nothing.
SET LOCAL request.jwt.claims TO '{"sub":"50050004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
SELECT is(
  (SELECT count(*)::int FROM public.products WHERE shop_id='7b000001-0000-4000-8000-000000000001'::uuid),
  0,
  'người bán shop khác KHÔNG đọc được danh mục nháp của shop này');
SELECT is(
  (SELECT count(*)::int FROM public.product_variants
   WHERE shop_id='7b000001-0000-4000-8000-000000000001'::uuid),
  0,
  'và KHÔNG đọc được giá của shop này');
SELECT throws_ok(
  $$ SELECT public.product_create('7b000001-0000-4000-8000-000000000001'::uuid, 'tok-rival-0001',
       '{"title":"Hàng cắm nhờ","price_vnd":100000}'::jsonb) $$,
  '42501', NULL, 'người bán shop khác KHÔNG tạo được sản phẩm trong shop này');

-- Cross-shop FK injection: the rival writes a variant that passes RLS — the
-- shop_id is genuinely theirs — but names another shop's product. Nothing here
-- is checking membership any more; the composite FK (product_id, shop_id) is
-- the only thing left, and it is what refuses.
SELECT throws_ok(
  format($$ INSERT INTO public.product_variants (product_id, shop_id, price_vnd)
            VALUES (%L::uuid, '7b000002-0000-4000-8000-000000000002'::uuid, 1) $$,
    (SELECT v FROM t_ids WHERE k='p1')),
  '23503', NULL, 'không gắn được phiên bản của shop mình vào sản phẩm shop khác');

-- Not on the pilot list, even as a manager.
SET LOCAL request.jwt.claims TO '{"sub":"50050006-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  $$ SELECT public.product_create('7b000001-0000-4000-8000-000000000001'::uuid, 'tok-nonpilot-0001',
       '{"title":"Ngoài danh sách thí điểm","price_vnd":100000}'::jsonb) $$,
  '42501', NULL, 'quản lý ngoài danh sách thí điểm KHÔNG tạo được sản phẩm');

-- Anonymous: nothing that is not approved AND published AND in an active shop.
SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is(
  (SELECT count(*)::int FROM public.products), 0,
  'khách KHÔNG đọc được sản phẩm nháp');
SELECT is(
  (SELECT count(*)::int FROM public.product_variants), 0,
  'khách KHÔNG đọc được giá của sản phẩm nháp');
SELECT is(
  (SELECT count(*)::int FROM public.public_products), 0,
  'và projection công khai cũng rỗng');

-- Admin without aal2 is not an admin.
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50050005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'approve') $$, (SELECT v FROM t_ids WHERE k='p1')),
  '42501', NULL, 'quản trị viên chưa qua 2FA thì không duyệt được sản phẩm');

SET LOCAL request.jwt.claims TO '{"sub":"50050005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
SELECT is(
  (SELECT count(*)::int FROM public.products WHERE shop_id='7b000001-0000-4000-8000-000000000001'::uuid) > 0,
  true,
  'quản trị viên đã qua 2FA đọc được toàn bộ danh mục');

-- ─── Shop state gates the editor ───────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50050001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  $$ SELECT public.product_create('7b000003-0000-4000-8000-000000000003'::uuid, 'tok-suspended-0001',
       '{"title":"Shop tạm ngưng vẫn đăng","price_vnd":100000}'::jsonb) $$,
  '22023', NULL, 'shop bị tạm ngưng KHÔNG đăng được sản phẩm mới');

-- ─── State machine: what is editable, and coming back from archived ────────

SELECT ok(public.product_status_is_editable('draft'), 'draft sửa được');
SELECT ok(public.product_status_is_editable('needs_changes'), 'needs_changes sửa được');
SELECT ok(NOT public.product_status_is_editable('pending_review'),
  'pending_review KHÔNG sửa được — quyết định phải rơi vào đúng thứ đã được xem');
SELECT ok(NOT public.product_status_is_editable('approved'), 'approved KHÔNG sửa nội dung tại đây');
SELECT ok(NOT public.product_status_is_editable('archived'), 'archived KHÔNG sửa được');

SELECT is(
  public.product_archive((SELECT id FROM public.products WHERE client_token='tok-owner-0002'))::text,
  'archived', 'chủ shop ngừng bán được');
SELECT throws_ok(
  format($$ SELECT public.product_update(%L::uuid, %s, '{"title":"Sửa hàng đã ngừng"}'::jsonb, NULL) $$,
    (SELECT id FROM public.products WHERE client_token='tok-owner-0002'),
    (SELECT version FROM public.products WHERE client_token='tok-owner-0002')),
  '22023', NULL, 'sản phẩm đã ngừng bán thì không sửa nội dung được');
SELECT is(
  public.product_unarchive((SELECT id FROM public.products WHERE client_token='tok-owner-0002'))::text,
  'draft', 'và bật bán lại được — ngừng bán là đảo ngược được, đúng như đã hứa');
SELECT ok(
  (SELECT NOT is_published AND submitted_at IS NULL FROM public.products WHERE client_token='tok-owner-0002'),
  'bật lại quay về nháp, không quay về đã duyệt');

-- ─── Submit-for-review still demands a photo ───────────────────────────────
-- Step 6 builds the upload. This asserts step 4 did NOT relax the rule to make
-- itself look finished.

SELECT throws_ok(
  format($$ SELECT public.product_submit_for_review(%L::uuid) $$,
    (SELECT id FROM public.products WHERE client_token='tok-owner-0001')),
  '22023', NULL, 'chưa có ảnh thì chưa gửi duyệt được — luật không bị nới ra cho bước 4');

-- ─── Counts come from the data ─────────────────────────────────────────────

SELECT is(
  (public.product_status_counts('7b000001-0000-4000-8000-000000000001'::uuid)) ->> 'draft',
  '3',
  'đếm theo trạng thái lấy từ truy vấn thật, không phải số cứng');
SELECT is(
  (public.product_status_counts('7b000002-0000-4000-8000-000000000002'::uuid)),
  '{}'::jsonb,
  'shop chưa có sản phẩm thì đếm ra rỗng, không phải rác của shop khác');

SELECT * FROM finish();
ROLLBACK;
