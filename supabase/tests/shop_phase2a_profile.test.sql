-- Shop marketplace P2a step 3 — seller shop profile: authorization, slug,
-- contact channels, concurrency.
--
-- The three questions this file is really asking:
--   * can anybody but an owner/manager change the shop record, by any route;
--   * does a URL ever move without somebody asking for it to;
--   * can an approval badge outlive the value it was granted for.

BEGIN;

SELECT plan(77);

-- ─── Fixture ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('50040001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'prof-owner@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Owner"}'::jsonb, NOW(), NOW()),
  ('50040002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'prof-manager@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Manager"}'::jsonb, NOW(), NOW()),
  ('50040003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'prof-support@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Support"}'::jsonb, NOW(), NOW()),
  ('50040004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'prof-other@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Other"}'::jsonb, NOW(), NOW()),
  ('50040005-0000-4000-8000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'prof-admin@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Admin"}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('50040005-0000-4000-8000-000000000005'::uuid, 'admin') ON CONFLICT DO NOTHING;

INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('50040001-0000-4000-8000-000000000001'::uuid),
  ('50040002-0000-4000-8000-000000000002'::uuid),
  ('50040003-0000-4000-8000-000000000003'::uuid),
  ('50040004-0000-4000-8000-000000000004'::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id) VALUES
  ('7a000001-0000-4000-8000-000000000001'::uuid, 'do-pickleball-sai-gon', 'Đồ Pickleball Sài Gòn', 'active', '50040001-0000-4000-8000-000000000001'::uuid),
  ('7a000002-0000-4000-8000-000000000002'::uuid, 'shop-khac', 'Shop Khác', 'active', '50040004-0000-4000-8000-000000000004'::uuid);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('7a000001-0000-4000-8000-000000000001'::uuid, '50040001-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('7a000001-0000-4000-8000-000000000001'::uuid, '50040002-0000-4000-8000-000000000002'::uuid, 'manager'),
  ('7a000001-0000-4000-8000-000000000001'::uuid, '50040003-0000-4000-8000-000000000003'::uuid, 'support'),
  ('7a000002-0000-4000-8000-000000000002'::uuid, '50040004-0000-4000-8000-000000000004'::uuid, 'owner');

-- ─── Shape ──────────────────────────────────────────────────────────────────

SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='shop_contact_channels'),
  'RLS enabled on shop_contact_channels');
SELECT ok((SELECT has_table_privilege('authenticated','public.shop_contact_channels','INSERT')),
  'authenticated has an INSERT grant to go with the policy');
SELECT ok((SELECT has_table_privilege('anon','public.shop_contact_channels','SELECT')),
  'anon has the SELECT grant its public policy needs');

-- The Phase 1 policy name said "owner" while the rule said "manager".
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname='public' AND tablename='shops' AND policyname='shops_update_owner'),
  0,
  'the misleading shops_update_owner policy name is gone'
);
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname='public' AND tablename='shops' AND policyname='shops_update_manager'
     AND qual LIKE '%is_shop_manager%'),
  1,
  'shops_update_manager says what it does'
);

-- ─── Normalization: what a channel is allowed to be ─────────────────────────

-- Mobile.
SELECT is(public.shop_contact_normalize('phone', '0901 234 567'), '+84901234567', 'phone: khoảng trắng + số 0 đầu');
SELECT is(public.shop_contact_normalize('phone', '0901.234.567'), '+84901234567', 'phone: dấu chấm');
SELECT is(public.shop_contact_normalize('phone', '0901-234-567'), '+84901234567', 'phone: dấu gạch');
SELECT is(public.shop_contact_normalize('phone', '+84901234567'), '+84901234567', 'phone: đã E.164 thì giữ nguyên');
SELECT is(public.shop_contact_normalize('phone', '84901234567'),  '+84901234567', 'phone: thiếu dấu +');
SELECT is(public.shop_contact_normalize('phone', '0084901234567'), '+84901234567', 'phone: tiền tố quốc tế 00');
-- A real Vinaphone number whose national form starts with the digits 84.
-- Reading those as a country code leaves 7 digits and rejects a valid number.
SELECT is(public.shop_contact_normalize('phone', '0847123456'), '+84847123456',
  'phone: 084xxxxxxx không bị đọc nhầm thành mã quốc gia');

-- Landline. D2 asks for a BUSINESS phone, and a shop line is a business phone.
-- Every Vietnamese area code starts with 2 and the national number is always
-- 10 digits, two-digit area code (24 Hà Nội) or three (225 Hải Phòng) alike.
SELECT is(public.shop_contact_normalize('phone', '024 3825 1234'), '+842438251234', 'phone: số bàn Hà Nội');
SELECT is(public.shop_contact_normalize('phone', '(024) 3825-1234'), '+842438251234', 'phone: số bàn có ngoặc và gạch');
SELECT is(public.shop_contact_normalize('phone', '02838221234'),   '+842838221234', 'phone: số bàn TP.HCM');
SELECT is(public.shop_contact_normalize('phone', '+84 24 3825 1234'), '+842438251234', 'phone: số bàn dạng +84');
SELECT is(public.shop_contact_normalize('phone', '0225 3823 456'), '+842253823456', 'phone: mã vùng 3 chữ số');

SELECT throws_ok($$ SELECT public.shop_contact_normalize('phone', '012345') $$, '22023', NULL,
  'phone: số quá ngắn bị từ chối');
SELECT throws_ok($$ SELECT public.shop_contact_normalize('phone', '09123456789') $$, '22023', NULL,
  'phone: di động thừa chữ số bị từ chối');
SELECT throws_ok($$ SELECT public.shop_contact_normalize('phone', '0243825123') $$, '22023', NULL,
  'phone: số bàn thiếu chữ số bị từ chối');
SELECT throws_ok($$ SELECT public.shop_contact_normalize('phone', '024382512345') $$, '22023', NULL,
  'phone: số bàn thừa chữ số bị từ chối');
SELECT throws_ok($$ SELECT public.shop_contact_normalize('phone', '0201234567') $$, '22023', NULL,
  'phone: mã vùng không có thật bị từ chối');
SELECT throws_ok($$ SELECT public.shop_contact_normalize('phone', '113') $$, '22023', NULL,
  'phone: số dịch vụ ngắn bị từ chối');
-- Named rather than left to fail on digit count, so the seller is told why.
SELECT throws_ok($$ SELECT public.shop_contact_normalize('phone', '19001234') $$,
  '22023', 'đầu số 1900/1800 chưa hỗ trợ — dùng số di động hoặc số bàn của shop',
  'phone: 1900 bị từ chối bằng đúng lý do của nó');
SELECT throws_ok($$ SELECT public.shop_contact_normalize('phone', '1800 1080') $$,
  '22023', 'đầu số 1900/1800 chưa hỗ trợ — dùng số di động hoặc số bàn của shop',
  'phone: 1800 bị từ chối bằng đúng lý do của nó');

SELECT is(public.shop_contact_normalize('zalo', 'https://zalo.me/shopcuatoi'), 'https://zalo.me/shopcuatoi', 'zalo: link giữ handle');
SELECT is(public.shop_contact_normalize('zalo', 'zalo.me/shopcuatoi?utm=x'),   'https://zalo.me/shopcuatoi', 'zalo: cắt query');
SELECT is(public.shop_contact_normalize('zalo', '0901234567'),                 'https://zalo.me/84901234567', 'zalo: số điện thoại thành link');
-- The reason the two rules had to separate: this exact value is a valid shop
-- phone and an impossible Zalo account, and the seller must be told which.
SELECT throws_ok($$ SELECT public.shop_contact_normalize('zalo', '024 3825 1234') $$,
  '22023', 'số Zalo không hợp lệ — số bàn không đăng ký được Zalo, nhập số di động hoặc liên kết zalo.me/…',
  'zalo: số bàn bị từ chối bằng lời của Zalo, không mượn lời của phone');

SELECT is(public.shop_contact_normalize('messenger', 'https://m.me/shop.pickle'), 'https://m.me/shop.pickle', 'messenger: m.me');
SELECT is(public.shop_contact_normalize('messenger', 'facebook.com/shop.pickle'), 'https://m.me/shop.pickle', 'messenger: facebook.com → m.me');
SELECT is(public.shop_contact_normalize('messenger', 'shop.pickle'),              'https://m.me/shop.pickle', 'messenger: handle trần');

SELECT throws_ok($$ SELECT public.shop_contact_normalize('messenger', 'javascript:alert(1)') $$, '22023', NULL,
  'javascript: bị chặn');
SELECT throws_ok($$ SELECT public.shop_contact_normalize('zalo', 'data:text/html,<script>') $$, '22023', NULL,
  'data: bị chặn');
SELECT throws_ok($$ SELECT public.shop_contact_normalize('messenger', 'https://m.me/a b') $$, '22023', NULL,
  'khoảng trắng trong handle bị chặn');
SELECT throws_ok($$ SELECT public.shop_contact_normalize('email', 'a@b.com') $$, '22023', NULL,
  'kênh ngoài danh sách bị từ chối — không có nhánh dự phòng lưu bừa');

-- ─── Owner edits ────────────────────────────────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50040001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is(
  (public.shop_profile_update('7a000001-0000-4000-8000-000000000001'::uuid, 1,
     '{"name":"Đồ Pickleball Sài Gòn 2","region":"TP. Hồ Chí Minh","primary_category_slug":"vot"}'::jsonb)).name,
  'Đồ Pickleball Sài Gòn 2',
  'owner cập nhật được hồ sơ'
);
SELECT is(
  (SELECT version FROM public.shops WHERE id='7a000001-0000-4000-8000-000000000001'::uuid),
  2,
  'mỗi lần ghi tăng version'
);

-- Renaming must not move the URL.
SELECT is(
  (SELECT slug FROM public.shops WHERE id='7a000001-0000-4000-8000-000000000001'::uuid),
  'do-pickleball-sai-gon',
  'đổi tên KHÔNG âm thầm đổi đường dẫn'
);

-- The stale tab.
SELECT throws_ok(
  $$ SELECT public.shop_profile_update('7a000001-0000-4000-8000-000000000001'::uuid, 1, '{"name":"Ghi đè"}'::jsonb) $$,
  'PT409', NULL,
  'phiên bản cũ bị từ chối thay vì ghi đè im lặng'
);
SELECT is(
  (SELECT name FROM public.shops WHERE id='7a000001-0000-4000-8000-000000000001'::uuid),
  'Đồ Pickleball Sài Gòn 2',
  'và dữ liệu của người ghi trước vẫn còn'
);

-- Privileged columns stay privileged whatever route is used.
SELECT lives_ok(
  $$ UPDATE public.shops SET state='active', verified_method='gap-truc-tiep', verified_at=now(),
       owner_user_id='50040004-0000-4000-8000-000000000004'::uuid, slug='cuop-duong-dan'
     WHERE id='7a000001-0000-4000-8000-000000000001'::uuid $$,
  'ghi cột đặc quyền không lỗi, chỉ bị vô hiệu'
);
SELECT is(
  (SELECT slug || '/' || coalesce(verified_method,'∅') || '/' || owner_user_id::text
   FROM public.shops WHERE id='7a000001-0000-4000-8000-000000000001'::uuid),
  'do-pickleball-sai-gon/∅/50040001-0000-4000-8000-000000000001',
  'slug, verified_method và owner_user_id đều bị ghim'
);

-- ─── Slug is explicit, validated, and unique ────────────────────────────────

SELECT is(
  public.shop_slug_update('7a000001-0000-4000-8000-000000000001'::uuid, 'Vợt Đỉnh Cao Sài Gòn'),
  'vot-dinh-cao-sai-gon',
  'slug tiếng Việt có dấu chuyển đúng'
);
SELECT throws_ok(
  $$ SELECT public.shop_slug_update('7a000001-0000-4000-8000-000000000001'::uuid, 'admin') $$,
  '22023', NULL,
  'từ khoá hệ thống bị chặn'
);
SELECT throws_ok(
  $$ SELECT public.shop_slug_update('7a000001-0000-4000-8000-000000000001'::uuid, 'seller') $$,
  '22023', NULL,
  '"seller" cũng là route thật, cũng bị chặn'
);
SELECT throws_ok(
  $$ SELECT public.shop_slug_update('7a000001-0000-4000-8000-000000000001'::uuid, 'ab') $$,
  '22023', NULL,
  'slug quá ngắn bị chặn'
);
SELECT throws_ok(
  $$ SELECT public.shop_slug_update('7a000001-0000-4000-8000-000000000001'::uuid, '!!!') $$,
  '22023', NULL,
  'slug rỗng sau khi chuẩn hoá bị chặn thay vì rơi về "shop"'
);
SELECT throws_ok(
  $$ SELECT public.shop_slug_update('7a000001-0000-4000-8000-000000000001'::uuid, 'Shop  Khác') $$,
  '23505', NULL,
  'trùng slug shop khác bị chặn — kể cả khi gõ khác hoa/thường/khoảng trắng'
);
-- audit_logs is not readable with a user JWT by design; read it as the owner.
SET LOCAL role postgres;
SELECT is(
  (SELECT count(*)::int FROM public.audit_logs
   WHERE event_type='shop_slug_changed' AND resource_id='7a000001-0000-4000-8000-000000000001'),
  1,
  'đổi đường dẫn được ghi audit'
);
SET LOCAL role authenticated;

-- ─── Contact channels ───────────────────────────────────────────────────────

SELECT is(
  (public.shop_contact_upsert('7a000001-0000-4000-8000-000000000001'::uuid, 'zalo', '0901234567', 'Zalo shop', true)).state::text,
  'draft',
  'kênh mới luôn bắt đầu ở draft — chọn công khai là quyền người bán, duyệt thì không'
);
SELECT is(
  (SELECT value_normalized FROM public.shop_contact_channels WHERE shop_id='7a000001-0000-4000-8000-000000000001'::uuid),
  'https://zalo.me/84901234567',
  'giá trị được chuẩn hoá phía máy chủ'
);
SELECT ok(
  (SELECT NOT EXISTS (SELECT 1 FROM public.shop_contact_channels
    WHERE value_normalized LIKE '%prof-owner@thepicklehub.test%')),
  'email tài khoản KHÔNG bao giờ tự thành kênh liên hệ'
);

-- The seller cannot approve their own channel.
UPDATE public.shop_contact_channels
SET state='approved', approved_at=now(), review_note='tự duyệt'
WHERE shop_id='7a000001-0000-4000-8000-000000000001'::uuid;
SELECT is(
  (SELECT state::text || '/' || coalesce(review_note,'∅') FROM public.shop_contact_channels
   WHERE shop_id='7a000001-0000-4000-8000-000000000001'::uuid),
  'draft/∅',
  'người bán KHÔNG tự duyệt được kênh của mình'
);

-- Re-adding the same channel updates rather than erroring on the unique index.
SELECT is(
  (SELECT count(*)::int FROM (
     SELECT public.shop_contact_upsert('7a000001-0000-4000-8000-000000000001'::uuid, 'zalo', 'zalo.me/84901234567', 'Zalo', true)) x),
  1,
  'thêm lại đúng kênh đó là cập nhật, không phải lỗi trùng'
);
SELECT is(
  (SELECT count(*)::int FROM public.shop_contact_channels WHERE shop_id='7a000001-0000-4000-8000-000000000001'::uuid),
  1,
  'và không sinh dòng thứ hai'
);

-- Anonymous sees nothing until it is both public and approved.
SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is(
  (SELECT count(*)::int FROM public.shop_contact_channels),
  0,
  'khách vãng lai không thấy kênh chưa duyệt'
);

-- Admin approves.
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50040005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
SELECT throws_ok(
  $$ SELECT public.shop_contact_decide(
       (SELECT id FROM public.shop_contact_channels LIMIT 1), 'reject') $$,
  '22023', NULL,
  'từ chối mà không có lý do cho người bán là không hợp lệ'
);
SELECT is(
  public.shop_contact_decide((SELECT id FROM public.shop_contact_channels LIMIT 1), 'approve')::text,
  'approved',
  'admin duyệt kênh'
);

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is(
  (SELECT count(*)::int FROM public.shop_contact_channels),
  1,
  'sau khi duyệt + công khai thì khách mới thấy'
);

-- Editing an approved value must drop the badge.
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50040001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.shop_contact_upsert('7a000001-0000-4000-8000-000000000001'::uuid, 'zalo', '0987654321', 'Zalo', true,
     (SELECT id FROM public.shop_contact_channels LIMIT 1))).state::text,
  'pending_review',
  'sửa giá trị đã duyệt thì huy hiệu duyệt bị thu lại'
);
SELECT ok(
  (SELECT approved_at IS NULL AND approved_by IS NULL FROM public.shop_contact_channels LIMIT 1),
  'và dấu vết duyệt cũ bị xoá, không treo lại trên giá trị mới'
);

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is(
  (SELECT count(*)::int FROM public.shop_contact_channels),
  0,
  'khách không còn thấy kênh vừa bị đưa lại hàng chờ'
);

-- Same rule for the business phone, with a value class that did not exist
-- before this migration: an approved mobile edited into the shop's landline is
-- still a different number, and the badge cannot follow it across.
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50040001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.shop_contact_upsert('7a000001-0000-4000-8000-000000000001'::uuid, 'phone', '0912345678', 'Hotline', true, NULL)).value_normalized,
  '+84912345678',
  'phone: kênh mới lưu bản chuẩn hoá'
);

SET LOCAL request.jwt.claims TO '{"sub":"50040005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
SELECT is(
  public.shop_contact_decide(
    (SELECT id FROM public.shop_contact_channels WHERE type='phone' LIMIT 1), 'approve')::text,
  'approved',
  'phone: quản trị viên duyệt được số di động'
);

SET LOCAL request.jwt.claims TO '{"sub":"50040001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.shop_contact_upsert('7a000001-0000-4000-8000-000000000001'::uuid, 'phone', '028 3822 1234', 'Hotline', true,
     (SELECT id FROM public.shop_contact_channels WHERE type='phone' LIMIT 1))).state::text,
  'pending_review',
  'phone: đổi từ di động sang số bàn thì quay lại hàng chờ duyệt'
);
SELECT is(
  (SELECT value_normalized FROM public.shop_contact_channels WHERE type='phone' LIMIT 1),
  '+842838221234',
  'phone: và số bàn được lưu ở dạng E.164'
);

-- ─── Manager yes, support no, outsider no ──────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50040002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
SELECT ok(
  (public.shop_profile_update('7a000001-0000-4000-8000-000000000001'::uuid,
     (SELECT version FROM public.shops WHERE id='7a000001-0000-4000-8000-000000000001'::uuid),
     '{"shipping_note":"Giao trong 2 ngày ở TP.HCM"}'::jsonb)).shipping_note IS NOT NULL,
  'manager cũng sửa được hồ sơ'
);

SET LOCAL request.jwt.claims TO '{"sub":"50040003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
SELECT ok(
  (SELECT count(*) FROM public.shops WHERE id='7a000001-0000-4000-8000-000000000001'::uuid) = 1,
  'support vẫn ĐỌC được shop của mình'
);
SELECT throws_ok(
  $$ SELECT public.shop_profile_update('7a000001-0000-4000-8000-000000000001'::uuid, 99, '{"name":"Support sửa"}'::jsonb) $$,
  '42501', NULL,
  'support KHÔNG sửa được hồ sơ'
);
SELECT throws_ok(
  $$ SELECT public.shop_slug_update('7a000001-0000-4000-8000-000000000001'::uuid, 'support-doi') $$,
  '42501', NULL,
  'support KHÔNG đổi được đường dẫn'
);
SELECT throws_ok(
  $$ SELECT public.shop_contact_upsert('7a000001-0000-4000-8000-000000000001'::uuid, 'phone', '0901111222') $$,
  '42501', NULL,
  'support KHÔNG thêm được kênh liên hệ'
);

SET LOCAL request.jwt.claims TO '{"sub":"50040004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  $$ SELECT public.shop_profile_update('7a000001-0000-4000-8000-000000000001'::uuid, 99, '{"name":"Shop khác sửa"}'::jsonb) $$,
  '42501', NULL,
  'chủ shop khác KHÔNG sửa được'
);
SELECT is(
  (SELECT count(*)::int FROM public.shop_contact_channels WHERE shop_id='7a000001-0000-4000-8000-000000000001'::uuid),
  0,
  'chủ shop khác không đọc được kênh liên hệ chưa công khai'
);
SELECT throws_ok(
  $$ SELECT public.shop_contact_decide((SELECT id FROM public.shop_contact_channels LIMIT 1), 'approve') $$,
  '42501', NULL,
  'người bán KHÔNG gọi được hàm duyệt'
);

-- ─── Deleting ───────────────────────────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50040001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT ok(
  public.shop_contact_delete((SELECT id FROM public.shop_contact_channels WHERE shop_id='7a000001-0000-4000-8000-000000000001'::uuid LIMIT 1)),
  'chủ shop xoá được kênh của mình'
);
SELECT ok(
  public.shop_contact_delete('00000000-0000-4000-8000-0000000000fe'::uuid),
  'xoá kênh không còn tồn tại vẫn là thành công'
);

SELECT * FROM finish();
ROLLBACK;
