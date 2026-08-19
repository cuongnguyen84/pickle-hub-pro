-- ============================================================================
-- Shop P2b step 1 — moderation backend.
--
-- What this file is really asking:
--   * can anybody who is not an admin with 2FA move a product;
--   * can an admin approve something they did not read, or something that
--     stopped being approvable while it sat in the queue;
--   * can a retry produce two decisions, two events, or two cleanup jobs;
--   * can a moderator write a correction target that points into somebody
--     else's catalogue, or at a position that will have moved by the time the
--     seller reads it;
--   * can the seller read the internal note;
--   * can a queue row carry a storage path.
-- ============================================================================

BEGIN;

SELECT plan(78);

-- ─── Fixture ────────────────────────────────────────────────────────────────
-- A owner · B manager · C support · D admin · E rival shop owner

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('5c0d0001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mod-owner@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('5c0d0002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mod-manager@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('5c0d0003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mod-support@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('5c0d0004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mod-admin@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('5c0d0005-0000-4000-8000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mod-rival@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('5c0d0004-0000-4000-8000-000000000004'::uuid, 'admin') ON CONFLICT DO NOTHING;
INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES ('5c0d00f8-0000-4000-8000-000000000008'::uuid, '5c0d0004-0000-4000-8000-000000000004'::uuid,
        'test-totp', 'totp', 'verified', NOW(), NOW(), 'JBSWY3DPEHPK3PXP');

INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('5c0d0001-0000-4000-8000-000000000001'::uuid),
  ('5c0d0002-0000-4000-8000-000000000002'::uuid),
  ('5c0d0003-0000-4000-8000-000000000003'::uuid),
  ('5c0d0005-0000-4000-8000-000000000005'::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id, region, shipping_note, return_note, verified_at, verified_method) VALUES
  ('7c000001-0000-4000-8000-000000000001'::uuid, 'mod-shop-a', 'Shop Kiểm Duyệt', 'active',
   '5c0d0001-0000-4000-8000-000000000001'::uuid, 'TP. Hồ Chí Minh', 'Giao 2 ngày', 'Đổi 7 ngày', NOW(), 'giay-phep-kinh-doanh'),
  ('7c000002-0000-4000-8000-000000000002'::uuid, 'mod-shop-b', 'Shop Đối Thủ', 'active',
   '5c0d0005-0000-4000-8000-000000000005'::uuid, NULL, NULL, NULL, NULL, NULL);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('7c000001-0000-4000-8000-000000000001'::uuid, '5c0d0001-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('7c000001-0000-4000-8000-000000000001'::uuid, '5c0d0002-0000-4000-8000-000000000002'::uuid, 'manager'),
  ('7c000001-0000-4000-8000-000000000001'::uuid, '5c0d0003-0000-4000-8000-000000000003'::uuid, 'support'),
  ('7c000002-0000-4000-8000-000000000002'::uuid, '5c0d0005-0000-4000-8000-000000000005'::uuid, 'owner');

CREATE TEMP TABLE t_mod (k TEXT PRIMARY KEY, v UUID);
GRANT SELECT, INSERT ON t_mod TO authenticated, anon;

-- ─── Shape ──────────────────────────────────────────────────────────────────

SELECT has_table('public', 'product_moderation_events', 'moderation decisions have their own history');
SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='product_moderation_events'),
  'RLS enabled on product_moderation_events');
SELECT ok(
  NOT (SELECT has_table_privilege('authenticated','public.product_moderation_events','UPDATE')),
  'nobody holding a user JWT may UPDATE the moderation history');
SELECT ok(
  NOT (SELECT has_table_privilege('authenticated','public.product_moderation_events','DELETE')),
  'nor DELETE it');
SELECT ok(
  NOT (SELECT has_table_privilege('authenticated','public.product_moderation_events','INSERT')),
  'nor INSERT — rows arrive through product_decide()');
SELECT has_table('public', 'product_slug_history', 'a renamed product leaves a forwarding address');
SELECT ok(
  (SELECT has_table_privilege('anon','public.product_slug_history','SELECT')),
  'and an anonymous visitor can be redirected by it');

-- ─── A complete product, ready to be judged ─────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5c0d0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

INSERT INTO t_mod VALUES ('p1',
  (public.product_create('7c000001-0000-4000-8000-000000000001'::uuid, 'tok-mod-0001',
    '{"title":"Vợt kiểm duyệt","price_vnd":1800000,"category_slug":"vot","description":"Vợt carbon T700, lõi tổ ong 16mm, cán 4.25 inch. Hàng mới nguyên hộp."}'::jsonb)).id);
-- A second product in the SAME shop: its variant and photo are what a
-- cross-product correction target would try to borrow.
INSERT INTO t_mod VALUES ('p2',
  (public.product_create('7c000001-0000-4000-8000-000000000001'::uuid, 'tok-mod-0002',
    '{"title":"Vợt thứ hai","price_vnd":900000,"category_slug":"vot","description":"Vợt tập cho người mới, khung nhôm, nặng 220g, kèm bao đựng."}'::jsonb)).id);

SELECT ok(
  (public.product_media_upload_init((SELECT v FROM t_mod WHERE k='p1'), 'image/jpeg', 5000, 'a.jpg', 'tok-mm1')) ? 'media_id',
  'sản phẩm có ảnh');
INSERT INTO t_mod VALUES ('m1', (SELECT id FROM public.product_media WHERE client_token='tok-mm1'));
SELECT ok(
  (public.product_media_upload_init((SELECT v FROM t_mod WHERE k='p2'), 'image/jpeg', 5000, 'b.jpg', 'tok-mm2')) ? 'media_id',
  'sản phẩm thứ hai cũng có ảnh');
INSERT INTO t_mod VALUES ('m2', (SELECT id FROM public.product_media WHERE client_token='tok-mm2'));

SET LOCAL role postgres;
UPDATE public.product_media SET verified_at = now()
WHERE id IN ((SELECT v FROM t_mod WHERE k='m1'), (SELECT v FROM t_mod WHERE k='m2'));
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5c0d0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

INSERT INTO t_mod VALUES ('v1',
  (SELECT id FROM public.product_variants WHERE product_id=(SELECT v FROM t_mod WHERE k='p1') LIMIT 1));
INSERT INTO t_mod VALUES ('v2',
  (SELECT id FROM public.product_variants WHERE product_id=(SELECT v FROM t_mod WHERE k='p2') LIMIT 1));

SELECT is(
  (public.product_submit((SELECT v FROM t_mod WHERE k='p1'),
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_mod WHERE k='p1')), 'tok-sub-p1')) ->> 'ok',
  'true', 'người bán đăng bán');

-- Từ 20260818170000 thao tác người bán đi thẳng tới `approved`, nên KHÔNG còn
-- luồng nào sinh ra `pending_review`. File này kiểm cỗ máy kiểm duyệt của
-- admin, thứ vẫn còn nguyên và vẫn phải chạy: cho hàng cũ đang kẹt ở hàng đợi,
-- và cho lúc cần bật lại cổng. Nên trạng thái ấy được DỰNG THẲNG ở fixture thay
-- vì nhờ một luồng người bán không còn tạo ra nó — một fixture đi vòng qua
-- luồng đã đổi là một fixture kiểm sai thứ.
SET LOCAL role postgres;
SELECT set_config('shop.privileged_write', 'on', true);
UPDATE public.products SET status = 'pending_review'
WHERE id = (SELECT v FROM t_mod WHERE k='p1');
SELECT set_config('shop.privileged_write', 'off', true);
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5c0d0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

-- ─── Nobody but an admin with 2FA decides ───────────────────────────────────

SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'approve') $$, (SELECT v FROM t_mod WHERE k='p1')),
  '42501', NULL, 'chủ shop KHÔNG tự duyệt sản phẩm của mình');

-- Every one of these tries a decision OTHER than approve as well. Approve is
-- the one decision with a second lock on it — product_approve_preflight() also
-- demands is_admin() — so a suite that only ever tries approve would still be
-- green with product_decide's own guard deleted. Found by doing exactly that.
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'request_changes', NULL, 'tự sửa', NULL, '[{"section":"media"}]'::jsonb) $$,
    (SELECT v FROM t_mod WHERE k='p1')),
  '42501', NULL, 'chủ shop KHÔNG tự yêu cầu sửa sản phẩm của mình');
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'suspend', NULL, 'tự gỡ') $$, (SELECT v FROM t_mod WHERE k='p1')),
  '42501', NULL, 'chủ shop KHÔNG tự gỡ');

SET LOCAL request.jwt.claims TO '{"sub":"5c0d0002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'approve') $$, (SELECT v FROM t_mod WHERE k='p1')),
  '42501', NULL, 'quản lý shop KHÔNG duyệt');
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'reject', NULL, 'không đạt') $$, (SELECT v FROM t_mod WHERE k='p1')),
  '42501', NULL, 'quản lý shop KHÔNG từ chối');

SET LOCAL request.jwt.claims TO '{"sub":"5c0d0003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'approve') $$, (SELECT v FROM t_mod WHERE k='p1')),
  '42501', NULL, 'nhân viên hỗ trợ KHÔNG duyệt');

SET LOCAL request.jwt.claims TO '{"sub":"5c0d0005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'approve') $$, (SELECT v FROM t_mod WHERE k='p1')),
  '42501', NULL, 'chủ shop khác KHÔNG duyệt');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'approve') $$, (SELECT v FROM t_mod WHERE k='p1')),
  '42501', NULL, 'khách KHÔNG duyệt');
SELECT throws_ok(
  format($$ SELECT public.product_moderation_queue() $$),
  '42501', NULL, 'khách KHÔNG đọc được hàng đợi');

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5c0d0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'approve') $$, (SELECT v FROM t_mod WHERE k='p1')),
  '42501', NULL, 'quản trị viên CHƯA qua 2 lớp KHÔNG duyệt — is_admin() đòi aal2');
SELECT throws_ok(
  format($$ SELECT public.product_moderation_detail(%L::uuid) $$, (SELECT v FROM t_mod WHERE k='p1')),
  '42501', NULL, 'và KHÔNG mở được hồ sơ duyệt');

-- ─── The stale review ───────────────────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"5c0d0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'approve', 1) $$, (SELECT v FROM t_mod WHERE k='p1')),
  'PT409', NULL,
  'bản cũ bị từ chối: người bán đã gửi lại từ lúc mở duyệt thì quyết định đang nói về nội dung chưa ai đọc');

-- ─── Request changes ────────────────────────────────────────────────────────

SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'request_changes', NULL, NULL, NULL, '[{"section":"media"}]'::jsonb) $$,
    (SELECT v FROM t_mod WHERE k='p1')),
  '22023', NULL, 'yêu cầu sửa mà không nhắn gì cho người bán là không hợp lệ');

SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'request_changes', NULL, 'Sửa giúp em', NULL, '[]'::jsonb) $$,
    (SELECT v FROM t_mod WHERE k='p1')),
  '22023', NULL, 'yêu cầu sửa mà không chỉ chỗ nào cần sửa là không hợp lệ');

SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'request_changes', NULL, 'Sửa giúp em', NULL,
             '[{"section":"khong-co-that"}]'::jsonb) $$, (SELECT v FROM t_mod WHERE k='p1')),
  '22023', NULL, 'phần không tồn tại trong trình sửa bị từ chối');

-- The cross-product injections. A moderator writing p2's variant id onto p1's
-- request would hand the seller a deep link that lands on a different product.
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'request_changes', NULL, 'Sửa giá', NULL,
             %L::jsonb) $$,
    (SELECT v FROM t_mod WHERE k='p1'),
    format('[{"section":"price","variant_id":"%s"}]', (SELECT v FROM t_mod WHERE k='v2'))),
  '22023', NULL, 'phiên bản của sản phẩm KHÁC không được nhận làm chỗ cần sửa');

SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'request_changes', NULL, 'Sửa ảnh', NULL,
             %L::jsonb) $$,
    (SELECT v FROM t_mod WHERE k='p1'),
    format('[{"section":"media","media_id":"%s"}]', (SELECT v FROM t_mod WHERE k='m2'))),
  '22023', NULL, 'ảnh của sản phẩm KHÁC cũng không được');

SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'request_changes', NULL, 'Sửa ảnh', NULL,
             '[{"section":"media","index":2}]'::jsonb) $$, (SELECT v FROM t_mod WHERE k='p1')),
  '22023', NULL,
  'vị trí bị từ chối: "ảnh thứ hai" trỏ sang ảnh khác ngay khi người bán kéo thả lại');

-- The legitimate one.
SELECT is(
  (public.product_decide((SELECT v FROM t_mod WHERE k='p1'), 'request_changes',
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_mod WHERE k='p1')),
     'Ảnh mờ quá, chụp lại giúp em.', 'nội bộ: ảnh kém, để ý shop này',
     format('[{"section":"media","media_id":"%s"},{"section":"basics","field":"name"}]',
            (SELECT v FROM t_mod WHERE k='m1'))::jsonb,
     'tok-dec-1')) ->> 'status',
  'needs_changes', 'quản trị viên yêu cầu sửa, có chỗ cần sửa gọi tên rõ ràng');

SELECT is(
  (SELECT count(*)::int FROM public.product_moderation_events
   WHERE product_id=(SELECT v FROM t_mod WHERE k='p1')),
  1, 'đúng MỘT sự kiện được ghi');

-- Replay. The response was lost; the client retries with the same token.
SELECT is(
  (public.product_decide((SELECT v FROM t_mod WHERE k='p1'), 'request_changes', NULL,
     'Ảnh mờ quá, chụp lại giúp em.', NULL, '[{"section":"media"}]'::jsonb, 'tok-dec-1')) ->> 'replayed',
  'true', 'gửi lại cùng một mã trả về câu trả lời cũ, không phải lỗi');
SELECT is(
  (SELECT count(*)::int FROM public.product_moderation_events
   WHERE product_id=(SELECT v FROM t_mod WHERE k='p1')),
  1, 'và KHÔNG ghi sự kiện thứ hai');

SELECT is(
  (SELECT to_status::text FROM public.product_moderation_events
   WHERE product_id=(SELECT v FROM t_mod WHERE k='p1')),
  'needs_changes', 'sự kiện ghi đúng trạng thái đích');

-- The seller-visible half, and the half they must never see.
SET LOCAL request.jwt.claims TO '{"sub":"5c0d0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  ((public.product_moderation_history((SELECT v FROM t_mod WHERE k='p1'))) -> 0) ->> 'applicant_note',
  'Ảnh mờ quá, chụp lại giúp em.', 'người bán đọc được lời nhắn gửi cho mình');
SELECT ok(
  NOT (((public.product_moderation_history((SELECT v FROM t_mod WHERE k='p1'))) -> 0) ? 'internal_note'),
  'nhưng KHÔNG có trường ghi chú nội bộ — vắng mặt theo thiết kế, không phải bị xoá');
SELECT ok(
  (public.product_moderation_history((SELECT v FROM t_mod WHERE k='p1')))::text NOT LIKE '%để ý shop này%',
  'và nội dung ghi chú nội bộ không lọt ra ở bất kỳ đâu trong kết quả');
SELECT is(
  (SELECT count(*)::int FROM public.product_moderation_events),
  0, 'người bán đọc thẳng bảng nhật ký kiểm duyệt thì không thấy dòng nào');

SET LOCAL request.jwt.claims TO '{"sub":"5c0d0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
SELECT is(
  ((public.product_moderation_history((SELECT v FROM t_mod WHERE k='p1'))) -> 0) ->> 'internal_note',
  'nội bộ: ảnh kém, để ý shop này', 'quản trị viên đọc được ghi chú nội bộ');

-- Append-only, with the trigger AND the missing grant both in the way.
SELECT throws_ok(
  $$ UPDATE public.product_moderation_events SET internal_note = 'sửa lại' $$,
  NULL, NULL, 'không sửa được nhật ký kiểm duyệt');
SELECT throws_ok(
  $$ DELETE FROM public.product_moderation_events $$,
  NULL, NULL, 'không xoá được');

-- ─── Approve refuses what it cannot check off ───────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"5c0d0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.product_submit((SELECT v FROM t_mod WHERE k='p1'),
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_mod WHERE k='p1')), 'tok-sub-p1b')) ->> 'ok',
  'true', 'người bán sửa xong và đăng lại');

-- Q3: the taxonomy moved underneath the queue.
-- Trạng thái hàng đợi lại được dựng thẳng, cùng lý do như ở trên: câu hỏi của
-- mục này là "preflight duyệt của admin có bắt được ngành hàng vừa bị tắt
-- không", và nó cần một hàng đang ở `pending_review` để hỏi.
SET LOCAL role postgres;
SELECT set_config('shop.privileged_write', 'on', true);
UPDATE public.products SET status = 'pending_review'
WHERE id = (SELECT v FROM t_mod WHERE k='p1');
SELECT set_config('shop.privileged_write', 'off', true);
UPDATE public.product_categories SET is_active = false WHERE slug = 'vot';
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5c0d0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';

SELECT ok(
  public.product_approve_preflight((SELECT v FROM t_mod WHERE k='p1'))
    @> '[{"code":"category_inactive","section":"category"}]'::jsonb,
  'ngành hàng bị tắt sau khi gửi duyệt: preflight duyệt bắt được');
SELECT is(
  (public.product_decide((SELECT v FROM t_mod WHERE k='p1'), 'approve')) ->> 'ok',
  'false', 'và duyệt bị chặn — trả về danh sách vấn đề, không ném lỗi');
SELECT is(
  (SELECT status::text FROM public.products WHERE id=(SELECT v FROM t_mod WHERE k='p1')),
  'pending_review', 'trạng thái KHÔNG đổi');
SELECT is(
  (SELECT count(*)::int FROM public.product_moderation_events
   WHERE product_id=(SELECT v FROM t_mod WHERE k='p1')),
  1, 'và KHÔNG ghi thêm sự kiện nào');

SET LOCAL role postgres;
UPDATE public.product_categories SET is_active = true WHERE slug = 'vot';
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5c0d0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';

-- ─── Approve ────────────────────────────────────────────────────────────────

SELECT is(
  (public.product_decide((SELECT v FROM t_mod WHERE k='p1'), 'approve',
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_mod WHERE k='p1')),
     NULL, NULL, '[]'::jsonb, 'tok-dec-2')) ->> 'status',
  'approved', 'quản trị viên duyệt');

-- The three ideas, kept apart.
SELECT is(
  (SELECT is_published FROM public.products WHERE id=(SELECT v FROM t_mod WHERE k='p1')),
  false,
  'duyệt KHÔNG bật công khai: byte chưa nằm ở kho công khai, bật lúc này là trỏ URL vào chỗ trống');
SELECT is(
  ((public.product_moderation_detail((SELECT v FROM t_mod WHERE k='p1'))) -> 'moderation_state') ->> 'decided',
  'true', 'hồ sơ duyệt nói: đã quyết định');
SELECT is(
  ((public.product_moderation_detail((SELECT v FROM t_mod WHERE k='p1'))) -> 'moderation_state') ->> 'publicly_visible',
  'false', 'nhưng chưa hiển thị công khai — hai việc khác nhau, và màn hình đọc được cả hai');

SELECT is(
  (SELECT count(*)::int FROM public.product_moderation_events
   WHERE product_id=(SELECT v FROM t_mod WHERE k='p1') AND decision='approve'),
  1, 'đúng một sự kiện duyệt');

-- audit_logs is the platform's own log; a shop admin has no direct SELECT on
-- it, which is itself correct. Read it as postgres to assert the write landed.
SET LOCAL role postgres;
SELECT is(
  (SELECT count(*)::int FROM public.audit_logs
   WHERE resource_id = (SELECT v FROM t_mod WHERE k='p1')::text AND event_type = 'shop_product_approve'),
  1, 'và một dòng nhật ký quản trị — log_audit_event không bị nhập nhằng hai bản nạp chồng');
SELECT ok(
  (SELECT coalesce(metadata::text, '') NOT LIKE '%để ý shop này%' FROM public.audit_logs
   WHERE resource_id = (SELECT v FROM t_mod WHERE k='p1')::text AND event_type = 'shop_product_approve'),
  'nhật ký quản trị KHÔNG chứa ghi chú nội bộ');
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5c0d0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';

-- A decided product is not decidable again.
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'reject', NULL, 'muộn rồi') $$, (SELECT v FROM t_mod WHERE k='p1')),
  '22023', NULL, 'quyết định thứ hai trên sản phẩm đã xử lý bị từ chối');

-- ─── Unpublish and suspend ──────────────────────────────────────────────────

SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'unpublish', NULL, 'ẩn đi') $$, (SELECT v FROM t_mod WHERE k='p1')),
  '22023', NULL, 'chưa hiển thị công khai thì không có gì để ẩn');

-- The worker's commit is what makes it public: it copies the bytes into the
-- public bucket, writes public_path, and only then is the product published.
-- Standing in for both halves matters — a suspend with no public_path has
-- nothing to revoke, and the test would pass by having nothing to do.
SET LOCAL role postgres;
SELECT set_config('shop.privileged_write', 'on', true);
-- state and public_path move together: product_media_public_requires_approved
-- makes "approved with no bytes" and "draft with public bytes" both
-- unrepresentable, which is the media half of the same idea the products
-- table enforces for publication.
UPDATE public.product_media
SET state = 'approved',
    public_path = shop_id::text || '/' || product_id::text || '/' || id::text || '-v1.webp'
WHERE id = (SELECT v FROM t_mod WHERE k='m1');
UPDATE public.products SET is_published = true WHERE id=(SELECT v FROM t_mod WHERE k='p1');
SELECT set_config('shop.privileged_write', 'off', true);
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5c0d0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';

SELECT is(
  ((public.product_moderation_detail((SELECT v FROM t_mod WHERE k='p1'))) -> 'moderation_state') ->> 'publicly_visible',
  'true', 'giờ mới thật sự hiển thị công khai');
SELECT is(
  (public.product_moderation_detail((SELECT v FROM t_mod WHERE k='p1'))) -> 'allowed_decisions',
  '["suspend","unpublish"]'::jsonb,
  'và những việc còn làm được suy ra từ trạng thái, không do màn hình tự đoán');

SELECT is(
  (public.product_decide((SELECT v FROM t_mod WHERE k='p1'), 'suspend',
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_mod WHERE k='p1')),
     'Sản phẩm vi phạm quy định, đã tạm gỡ.', 'nội bộ: ảnh nghi hàng nhái',
     '[]'::jsonb, 'tok-dec-3')) ->> 'status',
  'suspended', 'quản trị viên gỡ sản phẩm đang bán');

SELECT is(
  (SELECT status::text || '/' || is_published::text FROM public.products WHERE id=(SELECT v FROM t_mod WHERE k='p1')),
  'suspended/false',
  'gỡ là gỡ hẳn khỏi công khai — ràng buộc CSDL không cho "hết duyệt nhưng vẫn hiện"');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT throws_ok(
  format($$ SELECT public.product_public_projection(%L::uuid, false) $$, (SELECT v FROM t_mod WHERE k='p1')),
  'P0002', NULL, 'khách không còn thấy sản phẩm bị gỡ, ngay lập tức');

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5c0d0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
SELECT ok(
  (SELECT count(*) FROM public.shop_media_cleanup_jobs
   WHERE product_id = (SELECT v FROM t_mod WHERE k='p1')) > 0,
  'và byte công khai được xếp hàng thu hồi — không chỉ gỡ liên kết (D1)');

-- Q5 (signed 2026-08-12) answered what P2b.1 left open. The exit exists now,
-- but it goes to the seller's editor: `reopen` → needs_changes. There is still
-- no path from suspended back to approved. See shop_p2b_q5_q6.test.sql.
SELECT is(
  (public.product_moderation_detail((SELECT v FROM t_mod WHERE k='p1'))) -> 'allowed_decisions',
  '["reopen"]'::jsonb,
  'sản phẩm đã gỡ chỉ mở lại được để SỬA — không có đường quay thẳng về kệ');

-- ─── Queue ──────────────────────────────────────────────────────────────────

SELECT is(
  ((public.product_moderation_queue()) -> 'counts') ->> 'suspended',
  '1', 'số liệu hàng đợi do máy chủ đếm, không do màn hình cộng các dòng nó đang cầm');
SELECT ok(
  (public.product_moderation_queue())::text NOT LIKE '%shop-product-media-draft%',
  'dòng hàng đợi KHÔNG mang đường dẫn kho lưu trữ');
SELECT ok(
  (public.product_moderation_queue())::text NOT LIKE '%token=%',
  'và không mang URL đã ký');

SET LOCAL request.jwt.claims TO '{"sub":"5c0d0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  $$ SELECT public.product_moderation_queue() $$,
  '42501', NULL, 'người bán KHÔNG đọc được hàng đợi kiểm duyệt');
SELECT throws_ok(
  format($$ SELECT public.product_moderation_detail(%L::uuid) $$, (SELECT v FROM t_mod WHERE k='p1')),
  '42501', NULL, 'và KHÔNG mở được hồ sơ duyệt');

-- ─── Contact moderation ─────────────────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"5c0d0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
INSERT INTO t_mod VALUES ('c1',
  (public.shop_contact_upsert('7c000001-0000-4000-8000-000000000001'::uuid,
     'phone', '0912345678', 'Gọi ban ngày', true, NULL)).id);

SET LOCAL request.jwt.claims TO '{"sub":"5c0d0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
SELECT throws_ok(
  format($$ SELECT public.shop_contact_decide(%L::uuid, 'reject') $$, (SELECT v FROM t_mod WHERE k='c1')),
  '22023', NULL, 'từ chối kênh liên hệ mà không nói lý do là không hợp lệ');

SELECT throws_ok(
  format($$ SELECT public.shop_contact_decide(%L::uuid, 'approve', 99) $$, (SELECT v FROM t_mod WHERE k='c1')),
  'PT409', NULL, 'bản cũ của kênh liên hệ bị từ chối');

SELECT is(
  (public.shop_contact_decide((SELECT v FROM t_mod WHERE k='c1'), 'approve',
     (SELECT version FROM public.shop_contact_channels WHERE id=(SELECT v FROM t_mod WHERE k='c1')),
     NULL, 'nội bộ: đã gọi thử')) ->> 'state',
  'approved', 'quản trị viên duyệt kênh liên hệ');

SELECT is(
  (public.shop_contact_decide((SELECT v FROM t_mod WHERE k='c1'), 'approve')) ->> 'replayed',
  'true', 'duyệt lại một kênh đã duyệt là câu trả lời người gọi muốn, không phải lỗi');

-- The value is re-checked against the seller's own normaliser at DECISION
-- time. A row edited around the RPC is not something to send a buyer to.
SET LOCAL role postgres;
SELECT set_config('shop.privileged_write', 'on', true);
UPDATE public.shop_contact_channels
SET state='pending_review', approved_at=NULL, approved_by=NULL,
    value_normalized='javascript:alert(1)'
WHERE id=(SELECT v FROM t_mod WHERE k='c1');
SELECT set_config('shop.privileged_write', 'off', true);
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5c0d0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';

SELECT throws_ok(
  format($$ SELECT public.shop_contact_decide(%L::uuid, 'approve') $$, (SELECT v FROM t_mod WHERE k='c1')),
  '22023', NULL,
  'giá trị không an toàn KHÔNG duyệt được — kiểm lại đúng byte đang nằm trong dòng, không phải byte đã gửi hôm trước');

SELECT ok(
  NOT public.shop_contact_value_is_safe('phone', 'javascript:alert(1)'),
  'và hàm kiểm tra nói thẳng điều đó');

SET LOCAL request.jwt.claims TO '{"sub":"5c0d0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.shop_contact_decide(%L::uuid, 'approve') $$, (SELECT v FROM t_mod WHERE k='c1')),
  '42501', NULL, 'người bán KHÔNG tự duyệt kênh liên hệ của mình');

-- ─── Slug history (Q2) ──────────────────────────────────────────────────────

SELECT is(
  public.product_slug_update((SELECT v FROM t_mod WHERE k='p2'), 'vot-thu-hai-moi'),
  'vot-thu-hai-moi', 'người bán đổi đường dẫn');
SELECT is(
  (SELECT product_id FROM public.product_slug_history WHERE slug = 'vot-thu-hai'),
  (SELECT v FROM t_mod WHERE k='p2'),
  'đường dẫn cũ để lại địa chỉ chuyển tiếp, ghi trong CÙNG giao dịch với việc đổi tên');

SELECT is(
  public.product_slug_update((SELECT v FROM t_mod WHERE k='p2'), 'vot-thu-hai'),
  'vot-thu-hai', 'đổi ngược về đường dẫn cũ');
SELECT is(
  (SELECT count(*)::int FROM public.product_slug_history WHERE slug = 'vot-thu-hai'),
  0, 'đường dẫn đang dùng không còn là chuyển hướng trỏ về chính nó');

SELECT throws_ok(
  format($$ SELECT public.product_slug_update(%L::uuid, 'vot-thu-hai-moi') $$, (SELECT v FROM t_mod WHERE k='p1')),
  '23505', NULL,
  'đường dẫn đã nghỉ hưu của sản phẩm KHÁC không cấp lại được — nó vẫn đang chuyển hướng người mua sang chỗ khác');

SELECT * FROM finish();
ROLLBACK;
