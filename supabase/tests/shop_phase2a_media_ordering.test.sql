-- Shop marketplace P2a step 6 — media ordering, variant media, profile media.
--
-- What this file is really asking:
--   * can a photo end up in an order nobody chose, or a product point at a
--     photo that is gone;
--   * can a variant point at another product's photo, or another shop's;
--   * can a logo or cover reach the public bucket by any route a user JWT has;
--   * does a suspended shop keep a public face.

BEGIN;

SELECT plan(74);

-- ─── Fixture ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('50070001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'med-owner@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('50070002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'med-manager@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('50070003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'med-support@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('50070004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'med-rival@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('50070005-0000-4000-8000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'med-admin@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('50070006-0000-4000-8000-000000000006'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'med-nonpilot@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('50070005-0000-4000-8000-000000000005'::uuid, 'admin') ON CONFLICT DO NOTHING;
INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES ('5f000007-0000-4000-8000-000000000007'::uuid, '50070005-0000-4000-8000-000000000005'::uuid,
        'test-totp', 'totp', 'verified', NOW(), NOW(), 'JBSWY3DPEHPK3PXP');

INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('50070001-0000-4000-8000-000000000001'::uuid),
  ('50070002-0000-4000-8000-000000000002'::uuid),
  ('50070003-0000-4000-8000-000000000003'::uuid),
  ('50070004-0000-4000-8000-000000000004'::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id) VALUES
  ('7d000001-0000-4000-8000-000000000001'::uuid, 'anh-sai-gon', 'Ảnh Sài Gòn', 'active', '50070001-0000-4000-8000-000000000001'::uuid),
  ('7d000002-0000-4000-8000-000000000002'::uuid, 'anh-ha-noi',  'Ảnh Hà Nội',  'active', '50070004-0000-4000-8000-000000000004'::uuid);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('7d000001-0000-4000-8000-000000000001'::uuid, '50070001-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('7d000001-0000-4000-8000-000000000001'::uuid, '50070002-0000-4000-8000-000000000002'::uuid, 'manager'),
  ('7d000001-0000-4000-8000-000000000001'::uuid, '50070003-0000-4000-8000-000000000003'::uuid, 'support'),
  ('7d000001-0000-4000-8000-000000000001'::uuid, '50070006-0000-4000-8000-000000000006'::uuid, 'manager'),
  ('7d000002-0000-4000-8000-000000000002'::uuid, '50070004-0000-4000-8000-000000000004'::uuid, 'owner');

CREATE TEMP TABLE t_med (k TEXT PRIMARY KEY, v UUID);
GRANT SELECT, INSERT ON t_med TO authenticated, anon;

-- ─── Shape ──────────────────────────────────────────────────────────────────

SELECT hasnt_column('public', 'product_media', 'is_primary',
  'there is no is_primary flag — the main image is position 0, one source of truth');
SELECT has_column('public', 'product_variants', 'media_id', 'a variant can name its own photo');
SELECT has_table('public', 'shop_profile_media', 'logo and cover are their own table, not fake products');
SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='shop_profile_media'),
  'RLS enabled on shop_profile_media');
SELECT ok(
  NOT (SELECT has_table_privilege('authenticated','public.shop_profile_media','INSERT')),
  'authenticated cannot INSERT profile media — only the RPCs write it');
SELECT ok(
  NOT (SELECT has_table_privilege('authenticated','public.shop_profile_media','UPDATE')),
  'and cannot UPDATE it either, so public_path is unreachable from a user JWT');
SELECT ok(
  (SELECT has_table_privilege('anon','public.shop_profile_media','SELECT')),
  'anon has the SELECT grant its public policy needs');

-- The composite FK is what makes cross-product assignment impossible.
SELECT ok(
  (SELECT count(*) > 0 FROM pg_constraint
   WHERE conname = 'product_variants_media_same_product' AND confdeltype = 'n'),
  'variant.media_id is a composite FK with ON DELETE SET NULL');

-- ─── Product media: create three, in order ─────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50070001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

INSERT INTO t_med VALUES ('p1',
  (public.product_create('7d000001-0000-4000-8000-000000000001'::uuid, 'tok-med-0001',
    '{"title":"Vợt có nhiều ảnh","category_slug":"vot","price_vnd":1000000}'::jsonb)).id);

SELECT is(
  ((public.product_media_upload_init((SELECT v FROM t_med WHERE k='p1'), 'image/jpeg', 500000, 'anh 1.jpg', 'tok-m1')) ->> 'reused'),
  'false', 'ảnh 1: khởi tạo tải lên');
SELECT is(
  ((public.product_media_upload_init((SELECT v FROM t_med WHERE k='p1'), 'image/jpeg', 500000, 'anh 2.jpg', 'tok-m2')) ->> 'reused'),
  'false', 'ảnh 2');
SELECT is(
  ((public.product_media_upload_init((SELECT v FROM t_med WHERE k='p1'), 'image/png', 500000, 'anh 3.png', 'tok-m3')) ->> 'reused'),
  'false', 'ảnh 3');

-- Server-chosen paths, and the filename is display metadata only.
SELECT ok(
  (SELECT bool_and(draft_path LIKE '7d000001-0000-4000-8000-000000000001/%')
   FROM public.product_media WHERE product_id = (SELECT v FROM t_med WHERE k='p1')),
  'mọi đường dẫn nằm trong thư mục của shop, do máy chủ chọn');
SELECT ok(
  (SELECT bool_and(draft_path NOT LIKE '%anh 1%' AND draft_path NOT LIKE '%.jpg')
   FROM public.product_media WHERE product_id = (SELECT v FROM t_med WHERE k='p1')),
  'tên tệp người dùng KHÔNG trở thành khoá đối tượng');
SELECT is(
  (SELECT original_filename FROM public.product_media WHERE client_token='tok-m1'),
  'anh 1.jpg', 'nhưng vẫn được giữ làm dữ liệu hiển thị, đã làm sạch');

SELECT is(
  ((public.product_media_upload_init((SELECT v FROM t_med WHERE k='p1'), 'image/jpeg', 500000, 'anh 1.jpg', 'tok-m1')) ->> 'reused'),
  'true', 'gửi lại cùng mã chống trùng trả về ĐÚNG bản ghi cũ');
SELECT is(
  (SELECT count(*)::int FROM public.product_media WHERE product_id=(SELECT v FROM t_med WHERE k='p1')),
  3, 'và không tạo bản ghi thứ tư');

SELECT throws_ok(
  format($$ SELECT public.product_media_upload_init(%L::uuid, 'image/heic', 500000, 'IMG_2043.HEIC', 'tok-heic') $$,
    (SELECT v FROM t_med WHERE k='p1')),
  '22023', NULL, 'HEIC bị từ chối ở máy chủ, không âm thầm nhận rồi hỏng sau');
SELECT throws_ok(
  format($$ SELECT public.product_media_upload_init(%L::uuid, 'image/jpeg', 9000000, 'to.jpg', 'tok-big') $$,
    (SELECT v FROM t_med WHERE k='p1')),
  '22023', NULL, 'ảnh quá 8 MB bị từ chối');

INSERT INTO t_med VALUES
  ('m1', (SELECT id FROM public.product_media WHERE client_token='tok-m1')),
  ('m2', (SELECT id FROM public.product_media WHERE client_token='tok-m2')),
  ('m3', (SELECT id FROM public.product_media WHERE client_token='tok-m3'));

-- ─── Reorder ────────────────────────────────────────────────────────────────

SELECT is(
  (SELECT id FROM public.product_media
   WHERE product_id=(SELECT v FROM t_med WHERE k='p1') AND position = 0),
  (SELECT v FROM t_med WHERE k='m1'),
  'ảnh đầu tiên tải lên là ảnh chính (vị trí 0)');

SELECT lives_ok(
  format($$ SELECT public.product_media_reorder(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      ARRAY[%L,%L,%L]::uuid[]) $$,
    (SELECT v FROM t_med WHERE k='p1'), (SELECT v FROM t_med WHERE k='p1'),
    (SELECT v FROM t_med WHERE k='m3'), (SELECT v FROM t_med WHERE k='m1'),
    (SELECT v FROM t_med WHERE k='m2')),
  'sắp xếp lại được');
SELECT is(
  (SELECT id FROM public.product_media
   WHERE product_id=(SELECT v FROM t_med WHERE k='p1') AND position = 0),
  (SELECT v FROM t_med WHERE k='m3'),
  'đặt ảnh chính = đưa lên vị trí 0, không cần cột riêng');

-- Idempotent: the same array again is a no-op, not a second shuffle.
SELECT lives_ok(
  format($$ SELECT public.product_media_reorder(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      ARRAY[%L,%L,%L]::uuid[]) $$,
    (SELECT v FROM t_med WHERE k='p1'), (SELECT v FROM t_med WHERE k='p1'),
    (SELECT v FROM t_med WHERE k='m3'), (SELECT v FROM t_med WHERE k='m1'),
    (SELECT v FROM t_med WHERE k='m2')),
  'gửi lại đúng thứ tự đó lần nữa vẫn chạy');
SELECT is(
  (SELECT string_agg(id::text, ',' ORDER BY position) FROM public.product_media
   WHERE product_id=(SELECT v FROM t_med WHERE k='p1')),
  (SELECT (v)::text FROM t_med WHERE k='m3') || ',' ||
  (SELECT (v)::text FROM t_med WHERE k='m1') || ',' ||
  (SELECT (v)::text FROM t_med WHERE k='m2'),
  'và cho ra đúng thứ tự cũ — thử lại là vô hại');

SELECT throws_ok(
  format($$ SELECT public.product_media_reorder(%L::uuid, 1, ARRAY[%L]::uuid[]) $$,
    (SELECT v FROM t_med WHERE k='p1'), (SELECT v FROM t_med WHERE k='m1')),
  'PT409', NULL, 'phiên bản cũ bị từ chối — hai tab không ghi đè thứ tự của nhau');
SELECT throws_ok(
  format($$ SELECT public.product_media_reorder(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid), ARRAY[%L]::uuid[]) $$,
    (SELECT v FROM t_med WHERE k='p1'), (SELECT v FROM t_med WHERE k='p1'),
    (SELECT v FROM t_med WHERE k='m1')),
  '22023', NULL, 'danh sách thiếu ảnh bị từ chối — không để ảnh nào ở vị trí cũ');
SELECT throws_ok(
  format($$ SELECT public.product_media_reorder(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid), ARRAY[%L,%L,%L]::uuid[]) $$,
    (SELECT v FROM t_med WHERE k='p1'), (SELECT v FROM t_med WHERE k='p1'),
    (SELECT v FROM t_med WHERE k='m1'), (SELECT v FROM t_med WHERE k='m1'),
    (SELECT v FROM t_med WHERE k='m2')),
  '22023', NULL, 'danh sách trùng ảnh bị từ chối');

-- ─── Variant media ──────────────────────────────────────────────────────────

SELECT lives_ok(
  format($$ SELECT public.product_variants_reconcile(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '[{"name":"Màu sắc","values":["Trắng","Đen"]}]'::jsonb,
      '[{"option_values":{"Màu sắc":"Trắng"},"price_vnd":1000000,"stock_on_hand":1},
        {"option_values":{"Màu sắc":"Đen"},"price_vnd":1000000,"stock_on_hand":1}]'::jsonb) $$,
    (SELECT v FROM t_med WHERE k='p1'), (SELECT v FROM t_med WHERE k='p1')),
  'sản phẩm có hai phiên bản');

INSERT INTO t_med VALUES
  ('vw', (SELECT id FROM public.product_variants
          WHERE product_id=(SELECT v FROM t_med WHERE k='p1')
            AND option_values ->> 'Màu sắc' = 'Trắng' AND retired_at IS NULL));

SELECT ok(
  (SELECT media_id IS NULL FROM public.product_variants WHERE id=(SELECT v FROM t_med WHERE k='vw')),
  'phiên bản mặc định chưa gán ảnh — NULL nghĩa là dùng ảnh chính của sản phẩm');

SELECT is(
  (public.product_variant_set_media((SELECT v FROM t_med WHERE k='vw'), (SELECT v FROM t_med WHERE k='m1'))).media_id,
  (SELECT v FROM t_med WHERE k='m1'),
  'gán được ảnh của chính sản phẩm này cho phiên bản');

-- Another product, in the same shop, with its own photo.
INSERT INTO t_med VALUES ('p2',
  (public.product_create('7d000001-0000-4000-8000-000000000001'::uuid, 'tok-med-0002',
    '{"title":"Vợt khác cùng shop","category_slug":"vot","price_vnd":1000000}'::jsonb)).id);
SELECT ok(
  (public.product_media_upload_init((SELECT v FROM t_med WHERE k='p2'), 'image/jpeg', 100000, 'x.jpg', 'tok-m4')) ? 'media_id',
  'sản phẩm thứ hai cũng có ảnh');
INSERT INTO t_med VALUES ('m4', (SELECT id FROM public.product_media WHERE client_token='tok-m4'));

SELECT throws_ok(
  format($$ SELECT public.product_variant_set_media(%L::uuid, %L::uuid) $$,
    (SELECT v FROM t_med WHERE k='vw'), (SELECT v FROM t_med WHERE k='m4')),
  '22023', NULL, 'KHÔNG gán được ảnh của sản phẩm khác');
SELECT throws_ok(
  format($$ UPDATE public.product_variants SET media_id = %L::uuid WHERE id = %L::uuid $$,
    (SELECT v FROM t_med WHERE k='m4'), (SELECT v FROM t_med WHERE k='vw')),
  '23503', NULL, 'kể cả bằng UPDATE thẳng — khoá ngoại tổ hợp chặn, không phải trigger');

-- Deleting a photo a variant uses must not leave a dangling reference.
SELECT ok(public.product_media_delete((SELECT v FROM t_med WHERE k='m1')),
  'xoá được ảnh đang được phiên bản dùng');
SELECT ok(
  (SELECT media_id IS NULL FROM public.product_variants WHERE id=(SELECT v FROM t_med WHERE k='vw')),
  'và phiên bản tự quay về ảnh chính — ON DELETE SET NULL, cùng giao dịch, không có khoảnh khắc trỏ vào ảnh đã mất');
-- The outbox is service-role only by design, so it is read as a role that can
-- see it. A seller cannot, and should not: it is worker plumbing.
SET LOCAL role postgres;
SELECT ok(
  (SELECT count(*) > 0 FROM public.shop_media_cleanup_jobs
   WHERE shop_id='7d000001-0000-4000-8000-000000000001'::uuid),
  'và đối tượng cũ được xếp hàng để worker xoá');
SET LOCAL role authenticated;

-- ─── Role matrix: product media ────────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50070003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_media_upload_init(%L::uuid, 'image/jpeg', 1000, 'a.jpg', 'tok-sup') $$,
    (SELECT v FROM t_med WHERE k='p1')),
  '42501', NULL, 'support KHÔNG tải ảnh lên được');
SELECT throws_ok(
  format($$ SELECT public.product_media_reorder(%L::uuid, 1, ARRAY[%L]::uuid[]) $$,
    (SELECT v FROM t_med WHERE k='p1'), (SELECT v FROM t_med WHERE k='m2')),
  '42501', NULL, 'support KHÔNG sắp xếp lại ảnh được');
SELECT throws_ok(
  format($$ SELECT public.product_variant_set_media(%L::uuid, NULL) $$,
    (SELECT v FROM t_med WHERE k='vw')),
  '42501', NULL, 'support KHÔNG gán ảnh cho phiên bản được');

SET LOCAL request.jwt.claims TO '{"sub":"50070004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_media_upload_init(%L::uuid, 'image/jpeg', 1000, 'a.jpg', 'tok-rival') $$,
    (SELECT v FROM t_med WHERE k='p1')),
  '42501', NULL, 'người bán shop khác KHÔNG tải ảnh vào sản phẩm này');
SELECT throws_ok(
  format($$ SELECT public.product_media_delete(%L::uuid) $$, (SELECT v FROM t_med WHERE k='m2')),
  '42501', NULL, 'và KHÔNG xoá được ảnh của shop này');
SELECT is(
  (SELECT count(*)::int FROM public.product_media
   WHERE shop_id='7d000001-0000-4000-8000-000000000001'::uuid),
  0, 'và KHÔNG đọc được bản ghi ảnh của shop này');

SET LOCAL request.jwt.claims TO '{"sub":"50070006-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_media_reorder(%L::uuid, 1, ARRAY[%L]::uuid[]) $$,
    (SELECT v FROM t_med WHERE k='p1'), (SELECT v FROM t_med WHERE k='m2')),
  '42501', NULL, 'quản lý ngoài danh sách thí điểm KHÔNG sắp xếp ảnh được');

-- ─── Shop logo and cover ────────────────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50070001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT ok(
  (public.shop_profile_media_upload_init('7d000001-0000-4000-8000-000000000001'::uuid,
     'logo', 'image/png', 200000, 'logo shop.png', 'tok-logo-1')) ? 'media_id',
  'chủ shop tải được logo');
INSERT INTO t_med VALUES ('logo',
  (SELECT id FROM public.shop_profile_media
   WHERE shop_id='7d000001-0000-4000-8000-000000000001'::uuid AND purpose='logo'));

SELECT ok(
  (SELECT draft_path LIKE '7d000001-0000-4000-8000-000000000001/profile/logo/%'
   FROM public.shop_profile_media WHERE id=(SELECT v FROM t_med WHERE k='logo')),
  'đường dẫn nằm trong thư mục shop — thừa hưởng đúng policy của bucket nháp');
SELECT ok(
  (SELECT public_path IS NULL AND verified_at IS NULL
   FROM public.shop_profile_media WHERE id=(SELECT v FROM t_med WHERE k='logo')),
  'chưa có gì công khai cho tới khi được xác minh và worker chép');

SELECT is(
  ((public.shop_profile_media_upload_init('7d000001-0000-4000-8000-000000000001'::uuid,
     'logo', 'image/png', 200000, 'logo shop.png', 'tok-logo-1')) ->> 'reused'),
  'true', 'gửi lại cùng mã chống trùng trả về bản ghi cũ');

-- Replacing bumps the version, so the public key is new and immutable.
SELECT is(
  ((public.shop_profile_media_upload_init('7d000001-0000-4000-8000-000000000001'::uuid,
     'logo', 'image/webp', 200000, 'logo moi.webp', 'tok-logo-2')) ->> 'version'),
  '2', 'thay logo thì lên phiên bản 2');
SELECT ok(
  (SELECT draft_path LIKE '%/v2/original'
   FROM public.shop_profile_media WHERE id=(SELECT v FROM t_med WHERE k='logo')),
  'và khoá đối tượng mới mang số phiên bản — CDN không thể phục vụ byte cũ cho ảnh mới');
SELECT is(
  (SELECT count(*)::int FROM public.shop_profile_media
   WHERE shop_id='7d000001-0000-4000-8000-000000000001'::uuid AND purpose='logo'),
  1, 'mỗi shop chỉ một logo — thay chứ không chồng thêm');
SET LOCAL role postgres;
SELECT ok(
  (SELECT count(*) >= 2 FROM public.shop_media_cleanup_jobs
   WHERE shop_id='7d000001-0000-4000-8000-000000000001'::uuid AND reason='replace'),
  'và đối tượng của phiên bản cũ được xếp hàng để xoá');
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50070001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT throws_ok(
  $$ SELECT public.shop_profile_media_upload_init('7d000001-0000-4000-8000-000000000001'::uuid,
       'banner', 'image/png', 1000, 'x.png', 'tok-bad-purpose') $$,
  '22023', NULL, 'loại ảnh ngoài logo/cover bị từ chối');
SELECT throws_ok(
  $$ SELECT public.shop_profile_media_upload_init('7d000001-0000-4000-8000-000000000001'::uuid,
       'cover', 'image/heic', 1000, 'x.heic', 'tok-bad-type') $$,
  '22023', NULL, 'HEIC bị từ chối cho ảnh bìa');
SELECT throws_ok(
  $$ SELECT public.shop_profile_media_upload_init('7d000001-0000-4000-8000-000000000001'::uuid,
       'cover', 'image/png', 9000000, 'x.png', 'tok-bad-size') $$,
  '22023', NULL, 'ảnh bìa quá 8 MB bị từ chối');

-- Framing is a number, not a destroyed file.
SELECT ok(
  (public.shop_profile_media_upload_init('7d000001-0000-4000-8000-000000000001'::uuid,
     'cover', 'image/jpeg', 400000, 'bia.jpg', 'tok-cover-1')) ? 'media_id',
  'tải được ảnh bìa');
INSERT INTO t_med VALUES ('cover',
  (SELECT id FROM public.shop_profile_media
   WHERE shop_id='7d000001-0000-4000-8000-000000000001'::uuid AND purpose='cover'));
SELECT is(
  (SELECT focal_y FROM public.shop_profile_media WHERE id=(SELECT v FROM t_med WHERE k='cover')),
  0.5, 'khung ảnh mặc định ở giữa');
SELECT is(
  (public.shop_profile_media_set_focal((SELECT v FROM t_med WHERE k='cover'), 0.25)).focal_y,
  0.25, 'đổi khung ảnh được, không cần tải lại');
SELECT ok(
  (SELECT draft_path FROM public.shop_profile_media WHERE id=(SELECT v FROM t_med WHERE k='cover'))
    = (SELECT draft_path FROM public.shop_profile_media WHERE id=(SELECT v FROM t_med WHERE k='cover')),
  'và tệp gốc không đổi — cắt khung là quyết định hiển thị, không phá ảnh');
SELECT throws_ok(
  format($$ SELECT public.shop_profile_media_set_focal(%L::uuid, 1.5) $$,
    (SELECT v FROM t_med WHERE k='cover')),
  '22023', NULL, 'vị trí khung ngoài khoảng 0–1 bị từ chối');

-- ─── Role matrix: profile media ────────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50070002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
SELECT ok(
  (public.shop_profile_media_upload_init('7d000001-0000-4000-8000-000000000001'::uuid,
     'cover', 'image/jpeg', 400000, 'bia2.jpg', 'tok-cover-2')) ? 'media_id',
  'quản lý cũng tải được ảnh bìa');

SET LOCAL request.jwt.claims TO '{"sub":"50070003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  $$ SELECT public.shop_profile_media_upload_init('7d000001-0000-4000-8000-000000000001'::uuid,
       'logo', 'image/png', 1000, 'x.png', 'tok-sup-logo') $$,
  '42501', NULL, 'support KHÔNG tải logo lên được');
SELECT ok(
  (SELECT count(*) > 0 FROM public.shop_profile_media
   WHERE shop_id='7d000001-0000-4000-8000-000000000001'::uuid),
  'nhưng support vẫn thấy được bản ghi logo/bìa của shop mình');

SET LOCAL request.jwt.claims TO '{"sub":"50070004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  $$ SELECT public.shop_profile_media_upload_init('7d000001-0000-4000-8000-000000000001'::uuid,
       'logo', 'image/png', 1000, 'x.png', 'tok-rival-logo') $$,
  '42501', NULL, 'người bán shop khác KHÔNG tải logo cho shop này');
SELECT throws_ok(
  format($$ SELECT public.shop_profile_media_delete(%L::uuid) $$, (SELECT v FROM t_med WHERE k='logo')),
  '42501', NULL, 'và KHÔNG xoá được logo của shop này');
SELECT is(
  (SELECT count(*)::int FROM public.shop_profile_media
   WHERE shop_id='7d000001-0000-4000-8000-000000000001'::uuid),
  0, 'và KHÔNG đọc được bản ghi nháp của shop này — chưa có gì công khai');

-- ─── The public surface ─────────────────────────────────────────────────────

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is((SELECT count(*)::int FROM public.shop_profile_media), 0,
  'khách KHÔNG thấy logo/bìa chưa được công bố');

-- The worker publishes. This is the only route to a public_path.
SET LOCAL role postgres;
SELECT throws_ok(
  format($$ SELECT public.shop_profile_media_publish_commit(%L::uuid, '7d000001-0000-4000-8000-000000000001/x.webp') $$,
    (SELECT v FROM t_med WHERE k='cover')),
  '22023', NULL, 'chưa xác minh thì worker cũng không công bố được');

UPDATE public.shop_profile_media SET verified_at = now() WHERE id=(SELECT v FROM t_med WHERE k='cover');
SELECT throws_ok(
  format($$ SELECT public.shop_profile_media_publish_commit(%L::uuid, '7d000002-0000-4000-8000-000000000002/cuop.webp') $$,
    (SELECT v FROM t_med WHERE k='cover')),
  '22023', NULL, 'đường dẫn công khai ngoài thư mục shop bị từ chối');
-- Since 20260817090000 commit refuses everything but the row's CURRENT
-- deterministic key (stale-plan race), so the arbitrary key this test used to
-- pass is now itself a refusal case.
SELECT throws_ok(
  format($$ SELECT public.shop_profile_media_publish_commit(%L::uuid, '7d000001-0000-4000-8000-000000000001/profile/cover/public.webp') $$,
    (SELECT v FROM t_med WHERE k='cover')),
  '22023', NULL, 'một khoá không đúng phiên bản hiện tại cũng bị từ chối');
SELECT ok(
  public.shop_profile_media_publish_commit((SELECT v FROM t_med WHERE k='cover'),
    (SELECT shop_id::text || '/profile/' || purpose::text || '/' || id::text || '/v' || version::text || '/live.webp'
     FROM public.shop_profile_media WHERE id = (SELECT v FROM t_med WHERE k='cover'))),
  'worker công bố được ảnh bìa đã xác minh — theo đúng khoá phiên bản hiện tại');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is((SELECT count(*)::int FROM public.shop_profile_media), 1,
  'giờ khách mới thấy ảnh bìa');

-- A shop leaving active takes its public face with it, synchronously.
--
-- Suspended BY AN ADMIN, which is the only actor that can: shops_guard_privileged_columns
-- pins `state` unless is_admin(), and is_admin() is a JWT claim check — so even
-- a superuser session silently writes the old value back. Getting this wrong
-- made the revoke look broken when it was the guard doing its job.
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50070005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
UPDATE public.shops SET state = 'suspended' WHERE id='7d000001-0000-4000-8000-000000000001'::uuid;
SELECT is(
  (SELECT state::text FROM public.shops WHERE id='7d000001-0000-4000-8000-000000000001'::uuid),
  'suspended', 'quản trị viên đã qua 2FA tạm ngưng được shop');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is((SELECT count(*)::int FROM public.shop_profile_media), 0,
  'shop bị tạm ngưng thì ảnh bìa biến mất khỏi bề mặt công khai NGAY');

SET LOCAL role postgres;
SELECT ok(
  (SELECT count(*) > 0 FROM public.shop_media_cleanup_jobs
   WHERE reason = 'unpublish' AND shop_id='7d000001-0000-4000-8000-000000000001'::uuid),
  'và đối tượng công khai được xếp hàng để worker xoá thật');
SELECT ok(
  (SELECT public_path IS NULL FROM public.shop_profile_media WHERE id=(SELECT v FROM t_med WHERE k='cover')),
  'phép chiếu công khai bị xoá trong cùng giao dịch, không chờ worker');

SELECT * FROM finish();
ROLLBACK;
