-- Shop marketplace P2a step 7 — preview projection, preflight, submit/resubmit.
--
-- What this file is really asking:
--   * can the seller preview and the future public PDP ever disagree, because
--     they read different SQL;
--   * can a private field reach a projection somebody renders;
--   * can a product reach the queue without a photo, a price or a category;
--   * can a retry produce two audit events, or a stale tab produce a silent
--     overwrite.

BEGIN;

SELECT plan(84);

-- ─── Fixture ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('50080001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sub-owner@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('50080002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sub-manager@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('50080003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sub-support@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('50080004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sub-rival@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('50080005-0000-4000-8000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sub-admin@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('50080006-0000-4000-8000-000000000006'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sub-nonpilot@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('50080005-0000-4000-8000-000000000005'::uuid, 'admin') ON CONFLICT DO NOTHING;
INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES ('5f000008-0000-4000-8000-000000000008'::uuid, '50080005-0000-4000-8000-000000000005'::uuid,
        'test-totp', 'totp', 'verified', NOW(), NOW(), 'JBSWY3DPEHPK3PXP');

INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('50080001-0000-4000-8000-000000000001'::uuid),
  ('50080002-0000-4000-8000-000000000002'::uuid),
  ('50080003-0000-4000-8000-000000000003'::uuid),
  ('50080004-0000-4000-8000-000000000004'::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id, region, shipping_note, return_note, verified_at, verified_method) VALUES
  ('7e000001-0000-4000-8000-000000000001'::uuid, 'gui-duyet', 'Shop Gửi Duyệt', 'active',
   '50080001-0000-4000-8000-000000000001'::uuid, 'TP. Hồ Chí Minh', 'Giao trong 2 ngày', 'Đổi trong 7 ngày',
   NOW(), 'giay-phep-kinh-doanh'),
  ('7e000002-0000-4000-8000-000000000002'::uuid, 'shop-doi-thu', 'Shop Đối Thủ', 'active',
   '50080004-0000-4000-8000-000000000004'::uuid, NULL, NULL, NULL, NULL, NULL);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('7e000001-0000-4000-8000-000000000001'::uuid, '50080001-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('7e000001-0000-4000-8000-000000000001'::uuid, '50080002-0000-4000-8000-000000000002'::uuid, 'manager'),
  ('7e000001-0000-4000-8000-000000000001'::uuid, '50080003-0000-4000-8000-000000000003'::uuid, 'support'),
  ('7e000001-0000-4000-8000-000000000001'::uuid, '50080006-0000-4000-8000-000000000006'::uuid, 'manager'),
  ('7e000002-0000-4000-8000-000000000002'::uuid, '50080004-0000-4000-8000-000000000004'::uuid, 'owner');

CREATE TEMP TABLE t_sub (k TEXT PRIMARY KEY, v UUID);
GRANT SELECT, INSERT ON t_sub TO authenticated, anon;

-- ─── Shape ──────────────────────────────────────────────────────────────────

SELECT has_table('public', 'product_submission_events', 'submissions have their own append-only history');
SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='product_submission_events'),
  'RLS enabled on product_submission_events');
SELECT ok(
  NOT (SELECT has_table_privilege('authenticated','public.product_submission_events','INSERT')),
  'a seller cannot write their own submission history');
SELECT ok(
  (SELECT has_table_privilege('authenticated','public.product_submission_events','SELECT')),
  'but can read it');
SELECT ok(
  array_length(public.product_edit_sections(), 1) >= 10,
  'the deep-link sections are named, and there are enough of them to point at anything');

-- ─── A product that is not ready ────────────────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50080001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

INSERT INTO t_sub VALUES ('p1',
  (public.product_create('7e000001-0000-4000-8000-000000000001'::uuid, 'tok-sub-0001',
    '{"title":"Vợt gửi duyệt thử","price_vnd":1500000}'::jsonb)).id);

SELECT ok(
  jsonb_array_length(public.product_submit_preflight((SELECT v FROM t_sub WHERE k='p1'))) >= 3,
  'sản phẩm mới thiếu nhiều thứ, và preflight kể ra HẾT chứ không dừng ở cái đầu tiên');

SELECT ok(
  public.product_submit_preflight((SELECT v FROM t_sub WHERE k='p1')) @> '[{"code":"category_missing","section":"category"}]'::jsonb,
  'thiếu ngành hàng: có mã lỗi và chỉ đúng phần cần mở');
SELECT ok(
  public.product_submit_preflight((SELECT v FROM t_sub WHERE k='p1')) @> '[{"code":"description_missing","section":"description"}]'::jsonb,
  'chưa có mô tả: chỉ đúng phần mô tả');
SELECT ok(
  public.product_submit_preflight((SELECT v FROM t_sub WHERE k='p1')) @> '[{"code":"no_media","section":"media"}]'::jsonb,
  'chưa có ảnh: chỉ đúng phần ảnh');

-- Submit returns the list rather than raising: the checklist needs all of it.
SELECT is(
  (public.product_submit((SELECT v FROM t_sub WHERE k='p1'),
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_sub WHERE k='p1')), NULL)) ->> 'ok',
  'false', 'gửi duyệt khi chưa đủ trả về kết quả có cấu trúc, không ném lỗi');
SELECT ok(
  jsonb_array_length(((public.product_submit((SELECT v FROM t_sub WHERE k='p1'),
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_sub WHERE k='p1')), NULL)) -> 'problems')) > 0,
  'và mang theo danh sách vấn đề');
SELECT is(
  (SELECT status::text FROM public.products WHERE id=(SELECT v FROM t_sub WHERE k='p1')),
  'draft', 'trạng thái KHÔNG đổi khi chưa đủ điều kiện');
SELECT is(
  (SELECT count(*)::int FROM public.product_submission_events WHERE product_id=(SELECT v FROM t_sub WHERE k='p1')),
  0, 'và không ghi sự kiện nào');

-- ─── Make it ready ──────────────────────────────────────────────────────────

SELECT lives_ok(
  format($$ SELECT public.product_update(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '{"category_slug":"vot","description":"Vợt carbon T700, lõi tổ ong 16mm, cán 4.25 inch. Hàng mới nguyên hộp."}'::jsonb,
      NULL) $$,
    (SELECT v FROM t_sub WHERE k='p1'), (SELECT v FROM t_sub WHERE k='p1')),
  'điền ngành hàng và mô tả');

SELECT ok(
  (public.product_media_upload_init((SELECT v FROM t_sub WHERE k='p1'), 'image/jpeg', 5000, 'a.jpg', 'tok-sm1')) ? 'media_id',
  'thêm một ảnh');
INSERT INTO t_sub VALUES ('m1', (SELECT id FROM public.product_media WHERE client_token='tok-sm1'));

SELECT ok(
  public.product_submit_preflight((SELECT v FROM t_sub WHERE k='p1')) @> '[{"code":"media_unverified"}]'::jsonb,
  'ảnh chưa xác minh vẫn chặn — tải dở không phải là ảnh');

-- Verify it the way finalize would, from a role that may.
SET LOCAL role postgres;
UPDATE public.product_media SET verified_at = now() WHERE id=(SELECT v FROM t_sub WHERE k='m1');
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50080001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is(
  jsonb_array_length(public.product_submit_preflight((SELECT v FROM t_sub WHERE k='p1'))),
  0, 'giờ thì không còn vấn đề nào');

-- ─── Projection: one derivation, two readers ────────────────────────────────

SELECT is(
  (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) ->> 'title',
  'Vợt gửi duyệt thử', 'người bán xem trước được bản nháp của chính mình');
SELECT is(
  (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) ->> 'is_preview',
  'true', 'và phép chiếu nói rõ đây là bản xem trước');
SELECT is(
  ((public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) -> 'shop') ->> 'name',
  'Shop Gửi Duyệt', 'kèm tóm tắt shop');
SELECT is(
  ((public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) -> 'shop') ->> 'verified',
  'true', 'xác minh là một sự kiện, phát biểu như vậy');
SELECT is(
  ((public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) -> 'category') ->> 'name',
  'Vợt pickleball', 'ngành hàng có tên tiếng Việt, không phải slug trần');
SELECT is(
  jsonb_array_length((public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) -> 'variants'),
  1, 'đúng một phiên bản đang bán');
SELECT is(
  jsonb_array_length((public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) -> 'media'),
  1, 'và một ảnh đã xác minh');
SELECT is(
  (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) ->> 'primary_media_id',
  (SELECT (v)::text FROM t_sub WHERE k='m1'),
  'ảnh chính là ảnh ở vị trí 0 — cùng một luật với màn hình sửa');

-- The allowlist, checked by absence. These are the fields that must never
-- reach anything that renders.
SELECT ok(
  NOT ((public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) ? 'internal_note'),
  'phép chiếu KHÔNG mang ghi chú nội bộ của quản trị');
SELECT ok(
  NOT ((public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) ? 'client_token'),
  'KHÔNG mang mã chống trùng');
SELECT ok(
  NOT ((public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) ? 'variants_token'),
  'KHÔNG mang mã chống trùng của ma trận');
SELECT ok(
  (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true))::text NOT LIKE '%draft_path%',
  'KHÔNG mang đường dẫn ảnh gốc riêng tư');
SELECT ok(
  (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true))::text NOT LIKE '%/original%',
  'và không mang chính đối tượng gốc — chỉ bản đã xử lý');
SELECT ok(
  (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true))::text NOT LIKE '%token=%',
  'KHÔNG mang URL đã ký — cấp URL là việc của caller, không phải của hàng dữ liệu');
SELECT ok(
  NOT (((public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) -> 'shop') ? 'owner_user_id'),
  'tóm tắt shop KHÔNG mang danh tính chủ shop');

-- A draft is invisible to the public reader — same function, no second rule.
SELECT throws_ok(
  format($$ SELECT public.product_public_projection(%L::uuid, false) $$, (SELECT v FROM t_sub WHERE k='p1')),
  'P0002', NULL, 'phép chiếu công khai KHÔNG thấy bản nháp — và trả "không tìm thấy", không tiết lộ là có tồn tại');

SET LOCAL request.jwt.claims TO '{"sub":"50080004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_public_projection(%L::uuid, true) $$, (SELECT v FROM t_sub WHERE k='p1')),
  '42501', NULL, 'người bán shop khác KHÔNG xem trước được sản phẩm của shop này');
SELECT throws_ok(
  format($$ SELECT public.product_submit_preflight(%L::uuid) $$, (SELECT v FROM t_sub WHERE k='p1')),
  '42501', NULL, 'và KHÔNG chạy được preflight');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT throws_ok(
  format($$ SELECT public.product_public_projection(%L::uuid, true) $$, (SELECT v FROM t_sub WHERE k='p1')),
  '42501', NULL, 'khách KHÔNG mượn được cờ xem trước để đọc bản nháp');

-- ─── Submit ─────────────────────────────────────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50080003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_submit(%L::uuid, 1, NULL) $$, (SELECT v FROM t_sub WHERE k='p1')),
  '42501', NULL, 'support KHÔNG gửi duyệt được');

SET LOCAL request.jwt.claims TO '{"sub":"50080006-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_submit(%L::uuid, 1, NULL) $$, (SELECT v FROM t_sub WHERE k='p1')),
  '42501', NULL, 'quản lý ngoài danh sách thí điểm KHÔNG gửi duyệt được');

SET LOCAL request.jwt.claims TO '{"sub":"50080001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_submit(%L::uuid, 1, NULL) $$, (SELECT v FROM t_sub WHERE k='p1')),
  'PT409', NULL, 'phiên bản cũ bị từ chối bằng 409, không treo và không giả thành lỗi kiểm tra');

SELECT is(
  (public.product_submit((SELECT v FROM t_sub WHERE k='p1'),
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_sub WHERE k='p1')),
     'tok-submit-0001')) ->> 'ok',
  'true', 'chủ shop gửi duyệt được');
SELECT is(
  (SELECT status::text FROM public.products WHERE id=(SELECT v FROM t_sub WHERE k='p1')),
  'pending_review', 'và trạng thái chuyển sang chờ duyệt');
SELECT ok(
  (SELECT submitted_at IS NOT NULL FROM public.products WHERE id=(SELECT v FROM t_sub WHERE k='p1')),
  'có mốc thời gian gửi');
SELECT is(
  (SELECT event FROM public.product_submission_events WHERE product_id=(SELECT v FROM t_sub WHERE k='p1')),
  'submitted', 'lần đầu ghi sự kiện "submitted"');
SELECT is(
  (SELECT actor_user_id FROM public.product_submission_events WHERE product_id=(SELECT v FROM t_sub WHERE k='p1')),
  '50080001-0000-4000-8000-000000000001'::uuid, 'ghi rõ ai gửi');
SELECT is(
  (SELECT from_status::text || '->' || to_status::text FROM public.product_submission_events
   WHERE product_id=(SELECT v FROM t_sub WHERE k='p1')),
  'draft->pending_review', 'ghi cả hai đầu của bước chuyển');
SELECT ok(
  (SELECT metadata::text NOT LIKE '%token=%' AND metadata::text NOT LIKE '%/original%'
   FROM public.product_submission_events WHERE product_id=(SELECT v FROM t_sub WHERE k='p1')),
  'và nhật ký KHÔNG chứa URL đã ký hay đường dẫn riêng tư');

-- The replay. This is why the token exists.
SELECT is(
  (public.product_submit((SELECT v FROM t_sub WHERE k='p1'), 999, 'tok-submit-0001')) ->> 'replayed',
  'true', 'gửi lại cùng mã chống trùng trả về kết quả cũ');
SELECT is(
  (SELECT count(*)::int FROM public.product_submission_events WHERE product_id=(SELECT v FROM t_sub WHERE k='p1')),
  1, 'và KHÔNG ghi sự kiện thứ hai');

-- A different token on an already-pending product is not a second submit. It
-- comes back as a structured refusal rather than an exception, because "this
-- is already in the queue" is something the screen should say, not throw.
SELECT is(
  (public.product_submit((SELECT v FROM t_sub WHERE k='p1'),
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_sub WHERE k='p1')),
     'tok-submit-0002')) ->> 'ok',
  'false', 'mã khác trên sản phẩm đang chờ duyệt vẫn bị từ chối');
SELECT is(
  (SELECT count(*)::int FROM public.product_submission_events WHERE product_id=(SELECT v FROM t_sub WHERE k='p1')),
  1, 'và vẫn chỉ có một bản ghi lịch sử');

-- ─── Pending review is read-only ────────────────────────────────────────────

SELECT throws_ok(
  format($$ SELECT public.product_update(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid),
      '{"title":"Sửa trong lúc chờ duyệt"}'::jsonb, NULL) $$,
    (SELECT v FROM t_sub WHERE k='p1'), (SELECT v FROM t_sub WHERE k='p1')),
  '22023', NULL, 'đang chờ duyệt thì KHÔNG sửa nội dung được qua API');
SELECT throws_ok(
  format($$ SELECT public.product_media_reorder(%L::uuid,
      (SELECT version FROM public.products WHERE id = %L::uuid), ARRAY[%L]::uuid[]) $$,
    (SELECT v FROM t_sub WHERE k='p1'), (SELECT v FROM t_sub WHERE k='p1'),
    (SELECT v FROM t_sub WHERE k='m1')),
  '22023', NULL, 'và KHÔNG sắp xếp lại ảnh được');
SELECT lives_ok(
  format($$ SELECT public.product_public_projection(%L::uuid, true) $$, (SELECT v FROM t_sub WHERE k='p1')),
  'nhưng vẫn xem trước được — chờ duyệt không phải là mất quyền nhìn');

-- ─── Needs changes → resubmit ───────────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50080005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
SELECT is(
  public.product_decide((SELECT v FROM t_sub WHERE k='p1'), 'request_changes',
    'Ảnh mờ quá, chụp lại giúp em.', 'nội bộ: ảnh kém', ARRAY['media'])::text,
  'needs_changes', 'quản trị viên yêu cầu sửa');

SET LOCAL request.jwt.claims TO '{"sub":"50080001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) ->> 'applicant_note',
  'Ảnh mờ quá, chụp lại giúp em.',
  'người bán đọc được lý do trong bản xem trước');
SELECT ok(
  NOT ((public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true))::text LIKE '%nội bộ%'),
  'nhưng KHÔNG đọc được ghi chú nội bộ của quản trị');

SELECT is(
  (public.product_submit((SELECT v FROM t_sub WHERE k='p1'),
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_sub WHERE k='p1')),
     'tok-resubmit-0001')) ->> 'event',
  'resubmitted', 'gửi lại sau khi sửa ghi sự kiện "resubmitted", không phải "submitted"');
SELECT is(
  (SELECT count(*)::int FROM public.product_submission_events WHERE product_id=(SELECT v FROM t_sub WHERE k='p1')),
  2, 'lịch sử có đủ hai bước, không ghi đè bước cũ');
SELECT is(
  (SELECT applicant_note FROM public.products WHERE id=(SELECT v FROM t_sub WHERE k='p1')),
  'Ảnh mờ quá, chụp lại giúp em.',
  'lý do yêu cầu sửa KHÔNG bị xoá khi gửi lại — người bán vẫn biết mình đã được nhắc gì');
SELECT is(
  (SELECT array_length(requested_fields, 1) FROM public.products WHERE id=(SELECT v FROM t_sub WHERE k='p1')),
  NULL, 'nhưng danh sách trường cần sửa thì được dọn: yêu cầu đó đã được trả lời');

-- Audit is append-only, and not the actor's to rewrite.
SELECT throws_ok(
  $$ UPDATE public.product_submission_events SET event = 'submitted' $$,
  '42501', NULL, 'người bán KHÔNG sửa được lịch sử gửi duyệt');
SET LOCAL role postgres;
SELECT throws_ok(
  $$ UPDATE public.product_submission_events SET event = 'submitted' $$,
  '42501', 'lịch sử gửi duyệt chỉ ghi thêm, không sửa',
  'và ngay cả quyền cao nhất cũng không — trigger, không phải GRANT');
SELECT throws_ok(
  $$ DELETE FROM public.product_submission_events $$,
  '42501', 'lịch sử gửi duyệt chỉ ghi thêm, không xoá', 'không xoá được khi sản phẩm vẫn còn');

-- ─── Withdraw, and the wrong-state cases ────────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50080001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  public.product_withdraw_submission((SELECT v FROM t_sub WHERE k='p1'))::text,
  'draft', 'rút lại được khi đang chờ duyệt');
SELECT is(
  (SELECT count(*)::int FROM public.product_submission_events
   WHERE product_id=(SELECT v FROM t_sub WHERE k='p1') AND event='withdrawn'),
  1, 'và việc rút lại cũng được ghi');
SELECT throws_ok(
  format($$ SELECT public.product_withdraw_submission(%L::uuid) $$, (SELECT v FROM t_sub WHERE k='p1')),
  '22023', NULL, 'rút lại lần nữa khi đang là nháp thì bị từ chối');

-- Archived cannot be submitted.
SELECT is(public.product_archive((SELECT v FROM t_sub WHERE k='p1'))::text, 'archived', 'ngừng bán');
SELECT ok(
  public.product_submit_preflight((SELECT v FROM t_sub WHERE k='p1')) @> '[{"code":"wrong_status"}]'::jsonb,
  'sản phẩm đã ngừng bán không gửi duyệt được, và preflight nói đúng lý do');
SELECT is(
  (public.product_submit((SELECT v FROM t_sub WHERE k='p1'),
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_sub WHERE k='p1')), NULL)) ->> 'ok',
  'false', 'và gửi duyệt bị chặn');

-- A suspended shop blocks it too, before anything else is even looked at.
SELECT is(public.product_unarchive((SELECT v FROM t_sub WHERE k='p1'))::text, 'draft', 'bật bán lại');
SET LOCAL request.jwt.claims TO '{"sub":"50080005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
UPDATE public.shops SET state='restricted' WHERE id='7e000001-0000-4000-8000-000000000001'::uuid;
SET LOCAL request.jwt.claims TO '{"sub":"50080001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_submit(%L::uuid, 1, NULL) $$, (SELECT v FROM t_sub WHERE k='p1')),
  '22023', NULL, 'shop bị hạn chế thì KHÔNG gửi duyệt được');

-- ─── The public reader, once a product really is public ────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50080005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
UPDATE public.shops SET state='active' WHERE id='7e000001-0000-4000-8000-000000000001'::uuid;

SET LOCAL request.jwt.claims TO '{"sub":"50080001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.product_submit((SELECT v FROM t_sub WHERE k='p1'),
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_sub WHERE k='p1')),
     'tok-submit-0003')) ->> 'ok',
  'true', 'gửi duyệt lại lần nữa');

SET LOCAL request.jwt.claims TO '{"sub":"50080005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
SELECT is(
  public.product_decide((SELECT v FROM t_sub WHERE k='p1'), 'approve')::text,
  'approved', 'quản trị viên duyệt');

-- Publishing for real needs the worker to copy bytes, which SQL cannot do and
-- product_set_published says so. For the purposes of "is the public reader the
-- same function", the state is set the way the worker's commit would leave it.
SET LOCAL role postgres;
SELECT set_config('shop.privileged_write', 'on', true);
UPDATE public.products SET is_published = true WHERE id=(SELECT v FROM t_sub WHERE k='p1');
SELECT set_config('shop.privileged_write', 'off', true);
SELECT ok(
  (SELECT is_published FROM public.products WHERE id=(SELECT v FROM t_sub WHERE k='p1')),
  'sản phẩm đã ở trạng thái công khai');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is(
  (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), false)) ->> 'title',
  'Vợt gửi duyệt thử', 'giờ khách đọc được — CÙNG một hàm, chỉ khác cờ');
SELECT is(
  (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), false)) ->> 'status',
  NULL, 'nhưng KHÔNG thấy trạng thái kiểm duyệt');
SELECT is(
  (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), false)) ->> 'applicant_note',
  NULL, 'KHÔNG thấy lời nhắn của quản trị gửi người bán');
SELECT is(
  ((public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), false)) -> 'variants' -> 0) ->> 'stock_on_hand',
  NULL, 'và KHÔNG thấy số tồn kho thật — chỉ nhãn còn/hết hàng');
SELECT is(
  ((public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), false)) -> 'variants' -> 0) ->> 'availability',
  'unknown',
  'nhãn tình trạng do máy chủ suy ra — người bán không đếm kho nên là "không rõ", không phải "còn hàng"');
SELECT is(
  (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), false)) ->> 'is_preview',
  'false', 'phép chiếu công khai không tự nhận là bản xem trước');

-- The two readers agree on everything that is not authorisation.
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50080001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) -> 'media',
  (SELECT (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), false)) -> 'media'),
  'ảnh: người bán xem trước và khách thấy CÙNG một danh sách');
SELECT is(
  (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) -> 'option_groups',
  (SELECT (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), false)) -> 'option_groups'),
  'bộ tuỳ chọn: giống hệt');
SELECT is(
  ((public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) -> 'variants' -> 0) ->> 'price_vnd',
  ((SELECT (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), false)) -> 'variants' -> 0) ->> 'price_vnd'),
  'giá: giống hệt — xem trước không thể hiện một con số khác với con số người mua thấy');
SELECT is(
  (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), true)) ->> 'primary_media_id',
  ((SELECT (public.product_public_projection((SELECT v FROM t_sub WHERE k='p1'), false)) ->> 'primary_media_id')),
  'ảnh chính: giống hệt');

SELECT * FROM finish();
ROLLBACK;
