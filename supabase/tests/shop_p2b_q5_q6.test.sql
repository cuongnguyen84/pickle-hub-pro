-- ============================================================================
-- P2b.1b — Q5 (suspended recovery) and Q6 (contact moderation events).
--
-- The question Q5 exists to answer: can a product an admin pulled get back on
-- the storefront without anybody looking at it again. It must not, and the
-- only road back has to run through the seller's editor.
--
-- The question Q6 exists to answer: does a contact decision leave a history
-- somebody can read later, without that history becoming a second place the
-- seller's phone number lives.
-- ============================================================================

BEGIN;

SELECT plan(52);

-- ─── Fixture ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('5f0e0001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'q5-owner@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('5f0e0003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'q5-support@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('5f0e0004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'q5-admin@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('5f0e0005-0000-4000-8000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'q5-rival@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('5f0e0004-0000-4000-8000-000000000004'::uuid, 'admin') ON CONFLICT DO NOTHING;
INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES ('5f0e00f8-0000-4000-8000-000000000008'::uuid, '5f0e0004-0000-4000-8000-000000000004'::uuid,
        'test-totp', 'totp', 'verified', NOW(), NOW(), 'JBSWY3DPEHPK3PXP');

INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('5f0e0001-0000-4000-8000-000000000001'::uuid),
  ('5f0e0003-0000-4000-8000-000000000003'::uuid),
  ('5f0e0005-0000-4000-8000-000000000005'::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id, region, verified_at, verified_method) VALUES
  ('7f000001-0000-4000-8000-000000000001'::uuid, 'q5-shop-a', 'Shop Q5', 'active',
   '5f0e0001-0000-4000-8000-000000000001'::uuid, 'Hà Nội', NOW(), 'giay-phep-kinh-doanh'),
  ('7f000002-0000-4000-8000-000000000002'::uuid, 'q5-shop-b', 'Shop Q5 B', 'active',
   '5f0e0005-0000-4000-8000-000000000005'::uuid, NULL, NULL, NULL);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('7f000001-0000-4000-8000-000000000001'::uuid, '5f0e0001-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('7f000001-0000-4000-8000-000000000001'::uuid, '5f0e0003-0000-4000-8000-000000000003'::uuid, 'support'),
  ('7f000002-0000-4000-8000-000000000002'::uuid, '5f0e0005-0000-4000-8000-000000000005'::uuid, 'owner');

CREATE TEMP TABLE t_q5 (k TEXT PRIMARY KEY, v UUID);
GRANT SELECT, INSERT ON t_q5 TO authenticated, anon;

-- ─── A product that gets all the way to the shelf ───────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5f0e0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

INSERT INTO t_q5 VALUES ('p1',
  (public.product_create('7f000001-0000-4000-8000-000000000001'::uuid, 'tok-q5-0001',
    '{"title":"Vợt Q5","price_vnd":1500000,"category_slug":"vot","description":"Vợt carbon, lõi tổ ong 16mm, cán 4.25 inch, hàng mới nguyên hộp."}'::jsonb)).id);
SELECT ok(
  (public.product_media_upload_init((SELECT v FROM t_q5 WHERE k='p1'), 'image/jpeg', 5000, 'a.jpg', 'tok-q5m1')) ? 'media_id',
  'sản phẩm có ảnh');
INSERT INTO t_q5 VALUES ('m1', (SELECT id FROM public.product_media WHERE client_token='tok-q5m1'));

SET LOCAL role postgres;
UPDATE public.product_media SET verified_at = now() WHERE id=(SELECT v FROM t_q5 WHERE k='m1');
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5f0e0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

-- Từ 20260818170000 người bán bấm một lần là tới `approved`; bước admin duyệt
-- ở giữa không còn tồn tại, và gọi nó bây giờ sẽ raise vì sản phẩm đã approved.
SELECT is(
  (public.product_submit((SELECT v FROM t_q5 WHERE k='p1'),
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_q5 WHERE k='p1')), 'tok-q5s1')) ->> 'status',
  'approved', 'người bán đăng bán, không qua ai');

-- The worker's commit.
SET LOCAL role postgres;
SELECT set_config('shop.privileged_write', 'on', true);
UPDATE public.product_media
SET state = 'approved',
    public_path = shop_id::text || '/' || product_id::text || '/' || id::text || '-v1.webp'
WHERE id = (SELECT v FROM t_q5 WHERE k='m1');
UPDATE public.products SET is_published = true WHERE id=(SELECT v FROM t_q5 WHERE k='p1');
SELECT set_config('shop.privileged_write', 'off', true);
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5f0e0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';

SELECT is(
  (public.product_decide((SELECT v FROM t_q5 WHERE k='p1'), 'suspend',
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_q5 WHERE k='p1')),
     'Sản phẩm nghi hàng nhái, đã tạm gỡ.', 'nội bộ Q5: chờ giấy tờ',
     '[]'::jsonb, 'tok-q5d2')) ->> 'status',
  'suspended', 'quản trị viên gỡ sản phẩm');

-- ─── Q5: there is exactly one exit, and it is not the shelf ─────────────────

SELECT is(
  (public.product_moderation_detail((SELECT v FROM t_q5 WHERE k='p1'))) -> 'allowed_decisions',
  '["reopen"]'::jsonb,
  'sản phẩm bị gỡ chỉ còn MỘT việc làm được: mở lại để sửa');

SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'approve') $$, (SELECT v FROM t_q5 WHERE k='p1')),
  '22023', NULL,
  'KHÔNG có đường suspended → approved: sản phẩm bị gỡ không quay lại kệ vì quản trị viên đổi ý trong cùng một cú bấm');

SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'unpublish', NULL, 'ẩn') $$, (SELECT v FROM t_q5 WHERE k='p1')),
  '22023', NULL, 'và cũng không ẩn/hiện được nữa — nó đã không công khai');

SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'reopen', NULL, NULL, NULL, '[{"section":"media"}]'::jsonb) $$,
    (SELECT v FROM t_q5 WHERE k='p1')),
  '22023', NULL, 'mở lại mà không nhắn gì cho người bán là không hợp lệ');

SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'reopen', NULL, 'Mời anh sửa lại', NULL, '[]'::jsonb) $$,
    (SELECT v FROM t_q5 WHERE k='p1')),
  '22023', NULL,
  'mở lại mà không chỉ chỗ nào cần sửa cũng không hợp lệ — bảo người bán "sửa đi" rồi bắt họ đoán là vô ích');

SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'reopen', 999, 'Mời anh sửa lại', NULL, '[{"section":"media"}]'::jsonb) $$,
    (SELECT v FROM t_q5 WHERE k='p1')),
  'PT409', NULL, 'bản cũ bị từ chối');

SET LOCAL request.jwt.claims TO '{"sub":"5f0e0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'reopen', NULL, 'tự mở', NULL, '[{"section":"media"}]'::jsonb) $$,
    (SELECT v FROM t_q5 WHERE k='p1')),
  '42501', NULL, 'người bán KHÔNG tự mở lại sản phẩm bị gỡ');

SET LOCAL request.jwt.claims TO '{"sub":"5f0e0003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'reopen', NULL, 'tự mở', NULL, '[{"section":"media"}]'::jsonb) $$,
    (SELECT v FROM t_q5 WHERE k='p1')),
  '42501', NULL, 'nhân viên hỗ trợ cũng không');

SET LOCAL request.jwt.claims TO '{"sub":"5f0e0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'reopen', NULL, 'mở lại', NULL, '[{"section":"media"}]'::jsonb) $$,
    (SELECT v FROM t_q5 WHERE k='p1')),
  '42501', NULL, 'quản trị viên chưa qua 2 lớp cũng không');

SET LOCAL request.jwt.claims TO '{"sub":"5f0e0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
SELECT throws_ok(
  format($$ SELECT public.product_decide(%L::uuid, 'reopen', NULL, 'mở lại', NULL, %L::jsonb) $$,
    (SELECT v FROM t_q5 WHERE k='p1'),
    '[{"section":"media","index":1}]'),
  '22023', NULL, 'chỗ cần sửa vẫn phải gọi tên, không được dùng vị trí');

-- The legitimate reopen.
SELECT is(
  (public.product_decide((SELECT v FROM t_q5 WHERE k='p1'), 'reopen',
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_q5 WHERE k='p1')),
     'Gửi em ảnh hoá đơn nhập hàng rồi em mở bán lại giúp anh.',
     'nội bộ Q5: đã gọi điện',
     format('[{"section":"media","media_id":"%s"}]', (SELECT v FROM t_q5 WHERE k='m1'))::jsonb,
     'tok-q5d3')) ->> 'status',
  'needs_changes',
  'mở lại đưa sản phẩm về "cần sửa" — KHÔNG về "đã duyệt"');

SELECT is(
  (SELECT status::text || '/' || is_published::text FROM public.products WHERE id=(SELECT v FROM t_q5 WHERE k='p1')),
  'needs_changes/false', 'và vẫn không công khai');

SELECT is(
  (SELECT count(*)::int FROM public.product_moderation_events
   WHERE product_id=(SELECT v FROM t_q5 WHERE k='p1') AND decision='reopen'),
  1, 'đúng một sự kiện mở lại');

SELECT is(
  (public.product_decide((SELECT v FROM t_q5 WHERE k='p1'), 'reopen', NULL, 'lặp lại', NULL,
     '[{"section":"media"}]'::jsonb, 'tok-q5d3')) ->> 'replayed',
  'true', 'gửi lại cùng mã trả về câu trả lời cũ');
SELECT is(
  (SELECT count(*)::int FROM public.product_moderation_events
   WHERE product_id=(SELECT v FROM t_q5 WHERE k='p1') AND decision='reopen'),
  1, 'và không ghi sự kiện thứ hai');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT throws_ok(
  format($$ SELECT public.product_public_projection(%L::uuid, false) $$, (SELECT v FROM t_q5 WHERE k='p1')),
  'P0002', NULL, 'khách vẫn không thấy sản phẩm sau khi mở lại');

SET LOCAL role postgres;
SELECT is(
  (SELECT count(*)::int FROM public.product_media
   WHERE product_id=(SELECT v FROM t_q5 WHERE k='p1') AND public_path IS NOT NULL),
  0, 'mở lại KHÔNG trả byte công khai về — ảnh chỉ công khai lại sau một lần duyệt mới');

-- ─── The full road back ─────────────────────────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5f0e0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is(
  ((public.product_moderation_history((SELECT v FROM t_q5 WHERE k='p1'))) -> -1) ->> 'applicant_note',
  'Gửi em ảnh hoá đơn nhập hàng rồi em mở bán lại giúp anh.',
  'người bán đọc được lý do mở lại');
SELECT ok(
  (public.product_moderation_history((SELECT v FROM t_q5 WHERE k='p1')))::text NOT LIKE '%đã gọi điện%',
  'và không đọc được ghi chú nội bộ');

-- The seller re-uploads and resubmits through the P2a flow.
SELECT ok(
  (public.product_media_upload_init((SELECT v FROM t_q5 WHERE k='p1'), 'image/jpeg', 5000, 'b.jpg', 'tok-q5m2')) ? 'media_id',
  'người bán thêm ảnh mới');
SET LOCAL role postgres;
UPDATE public.product_media SET verified_at = now() WHERE client_token='tok-q5m2';
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5f0e0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is(
  (public.product_submit((SELECT v FROM t_q5 WHERE k='p1'),
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_q5 WHERE k='p1')), 'tok-q5s2')) ->> 'status',
  'approved', 'người bán sửa xong đăng lại, không qua ai');

-- Bất biến quan trọng nhất của cả migration 20260818170000: chạm tới
-- `approved` bằng tay NGƯỜI BÁN vẫn KHÔNG làm sản phẩm hiện ra. Byte ảnh phải
-- vào bucket công khai đã, và chỉ `product_publish_commit` (service_role) ghi
-- được `is_published`. Bốn tầng khoá không bị nới cái nào — chỉ có trạng thái
-- mà thao tác người bán chạm tới là đổi.
SELECT is(
  (SELECT is_published FROM public.products WHERE id=(SELECT v FROM t_q5 WHERE k='p1')),
  false, 'nhưng vẫn chờ byte lên bucket mới thật sự công khai');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT throws_ok(
  format($$ SELECT public.product_public_projection(%L::uuid, false) $$, (SELECT v FROM t_q5 WHERE k='p1')),
  'P0002', NULL, 'và khách vẫn không thấy nó');

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5f0e0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
-- Đòn gỡ vẫn với tới được. Đây là lý do người bán dừng ở đúng `approved` chứ
-- không đặt ra một trạng thái mới: điều kiện của `suspend` là status='approved'.
SELECT is(
  (public.product_decide((SELECT v FROM t_q5 WHERE k='p1'), 'suspend',
     (SELECT version FROM public.products WHERE id=(SELECT v FROM t_q5 WHERE k='p1')),
     'Gỡ lần hai', NULL, '[]'::jsonb, 'tok-q5d4')) ->> 'status',
  'suspended', 'admin vẫn gỡ được hàng người bán tự đăng');

-- ─── Q6: contact moderation events ──────────────────────────────────────────

SELECT has_table('public', 'shop_contact_moderation_events', 'kênh liên hệ có nhật ký riêng, không nhờ bảng của sản phẩm');
SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='shop_contact_moderation_events'),
  'RLS bật');
SELECT ok(
  NOT (SELECT has_table_privilege('authenticated','public.shop_contact_moderation_events','UPDATE')),
  'không ai cầm JWT sửa được nhật ký này');
SELECT ok(
  NOT (SELECT has_table_privilege('anon','public.shop_contact_moderation_events','SELECT')),
  'và khách không đọc được dòng nào');

SET LOCAL request.jwt.claims TO '{"sub":"5f0e0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
INSERT INTO t_q5 VALUES ('c1',
  (public.shop_contact_upsert('7f000001-0000-4000-8000-000000000001'::uuid,
     'phone', '0912345678', 'Gọi giờ hành chính', true, NULL)).id);

-- Quyết định đem ra thử ở đây là `disable`, không phải `approve`. Từ
-- 20260818160000 kênh trong một shop active sinh ra đã ở `approved`, nên
-- `approve` là lệnh rỗng — hàm idempotent-theo-kết-quả sẽ trả về sớm và KHÔNG
-- ghi sự kiện nào. Câu hỏi của mục này là "một quyết định có để lại lịch sử
-- đọc được không", nên nó phải hỏi bằng một quyết định thật sự đổi thứ gì đó.
SET LOCAL request.jwt.claims TO '{"sub":"5f0e0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
SELECT is(
  (public.shop_contact_decide((SELECT v FROM t_q5 WHERE k='c1'), 'disable',
     (SELECT version FROM public.shop_contact_channels WHERE id=(SELECT v FROM t_q5 WHERE k='c1')),
     'Số này gọi không ai nghe', 'nội bộ: đã gọi thử số này', 'tok-q5c1')) ->> 'state',
  'disabled', 'quản trị viên tắt được một kênh đang hiển thị');

SELECT is(
  (SELECT count(*)::int FROM public.shop_contact_moderation_events
   WHERE contact_channel_id=(SELECT v FROM t_q5 WHERE k='c1') AND action='disable'),
  1, 'đúng một sự kiện được ghi');

SELECT is(
  (public.shop_contact_decide((SELECT v FROM t_q5 WHERE k='c1'), 'disable', NULL, 'lại lý do', NULL, 'tok-q5c1')) ->> 'replayed',
  'true', 'gửi lại cùng mã trả về câu trả lời cũ');
SELECT is(
  (SELECT count(*)::int FROM public.shop_contact_moderation_events
   WHERE contact_channel_id=(SELECT v FROM t_q5 WHERE k='c1')),
  1, 'và không ghi sự kiện thứ hai');

SELECT ok(
  (SELECT count(*) FROM public.shop_contact_moderation_events
   WHERE contact_channel_id=(SELECT v FROM t_q5 WHERE k='c1')
     AND (applicant_note LIKE '%0912345678%' OR internal_note LIKE '%0912345678%'
          OR notify_key LIKE '%0912345678%')) = 0,
  'số điện thoại KHÔNG bị chép vào nhật ký — nhật ký nói "kênh phone", không nói số nào');
SELECT is(
  (SELECT channel_type::text FROM public.shop_contact_moderation_events
   WHERE contact_channel_id=(SELECT v FROM t_q5 WHERE k='c1') AND action='disable'),
  'phone', 'chỉ LOẠI kênh đi theo lịch sử');

-- Seller reads their half; nobody else reads any of it.
SET LOCAL request.jwt.claims TO '{"sub":"5f0e0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT ok(
  jsonb_array_length(public.shop_contact_moderation_history((SELECT v FROM t_q5 WHERE k='c1'))) > 0,
  'người bán đọc được lịch sử kênh của shop mình');
SELECT ok(
  NOT (((public.shop_contact_moderation_history((SELECT v FROM t_q5 WHERE k='c1'))) -> 0) ? 'internal_note'),
  'nhưng không có trường ghi chú nội bộ');
SELECT ok(
  (public.shop_contact_moderation_history((SELECT v FROM t_q5 WHERE k='c1')))::text NOT LIKE '%đã gọi thử%',
  'và nội dung ghi chú nội bộ không lọt ra');
SELECT is(
  (SELECT count(*)::int FROM public.shop_contact_moderation_events),
  0, 'người bán đọc thẳng bảng thì không thấy dòng nào');

SET LOCAL request.jwt.claims TO '{"sub":"5f0e0005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.shop_contact_moderation_history(%L::uuid) $$, (SELECT v FROM t_q5 WHERE k='c1')),
  '42501', NULL, 'chủ shop khác KHÔNG đọc được lịch sử kênh của shop này');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT throws_ok(
  format($$ SELECT public.shop_contact_moderation_history(%L::uuid) $$, (SELECT v FROM t_q5 WHERE k='c1')),
  '42501', NULL, 'khách cũng không');

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5f0e0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
SELECT is(
  ((public.shop_contact_moderation_history((SELECT v FROM t_q5 WHERE k='c1'))) -> 0) ->> 'internal_note',
  'nội bộ: đã gọi thử số này', 'quản trị viên đọc được ghi chú nội bộ');

SELECT throws_ok(
  $$ UPDATE public.shop_contact_moderation_events SET internal_note='sửa' $$,
  NULL, NULL, 'nhật ký kênh liên hệ chỉ ghi thêm');

-- Người bán gõ số khác vào một kênh ĐÃ BỊ TẮT: nó không sống lại. Đây là chỗ
-- duy nhất trigger còn quyết định thay người bán sau 20260818160000, và nó giữ
-- vì lý do khác hẳn cổng duyệt cũ — không phải "chưa ai xem", mà là "đã có
-- người xem và nói không".
SET LOCAL request.jwt.claims TO '{"sub":"5f0e0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.shop_contact_upsert('7f000001-0000-4000-8000-000000000001'::uuid,
     'phone', '0987654321', 'Số mới', true, (SELECT v FROM t_q5 WHERE k='c1'))).state::text,
  'disabled', 'người bán đổi số trên kênh đã bị tắt: nó KHÔNG tự sống lại');
-- Read as postgres: the assertion four tests up proves a seller sees nothing
-- through RLS, so counting the row from the seller's session would measure the
-- policy, not the trigger.
SET LOCAL role postgres;
-- `resubmitted` chỉ được ghi cho bước approved → pending_review, và bước đó
-- không còn tồn tại. Khẳng định 0 chứ không xoá dòng này: nếu một ngày nào đó
-- nó lại > 0 thì cổng duyệt đã quay về mà không ai nói.
SELECT is(
  (SELECT count(*)::int FROM public.shop_contact_moderation_events
   WHERE contact_channel_id=(SELECT v FROM t_q5 WHERE k='c1') AND action='resubmitted'),
  0, 'không còn bước "gửi duyệt lại" nào để ghi — cổng duyệt đã đi');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
-- Was `is(count(*), 0)`: anon held a SELECT grant, and the `TO public` policy
-- (approved AND is_public AND the shop is active) filtered the row away. Since
-- 20260818140000 anon holds no grant on this table at all, so the answer is a
-- refusal rather than an empty count — strictly stronger, and the reason the
-- grant went is that the row is wider than the public door beside it
-- (internal_note, review_note, approved_by, value_raw).
--
-- The error names `shops`, not this table: Postgres checks privileges for every
-- relation in the plan, and the policy's EXISTS pulls `shops` in. Both are
-- denied; only the SQLSTATE is worth asserting.
SELECT throws_ok(
  $$ SELECT count(*)::int FROM public.shop_contact_channels
     WHERE shop_id='7f000001-0000-4000-8000-000000000001'::uuid AND state='approved' $$,
  '42501', NULL,
  'anon không đọc được bảng kênh liên hệ — cửa công khai là shop_public_contacts');

-- The public door still answers, and still hides the channel an admin took
-- down. That is the assertion this section was really making.
SELECT is(
  public.shop_public_contacts('7f000001-0000-4000-8000-000000000001'::uuid),
  '[]'::jsonb,
  'kênh bị admin tắt không còn công khai, kể cả sau khi người bán sửa số');

-- ─── Append-only must not mean undeletable-subject ──────────────────────────
-- Found by the P2a profile suite the moment this table existed: a blanket
-- DELETE refusal blocks the ON DELETE CASCADE, so a channel that was ever
-- moderated could never be removed — taking account deletion and the QA
-- teardown with it. Same shape as the P2a inventory-ledger fix.

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5f0e0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
SELECT throws_ok(
  $$ DELETE FROM public.shop_contact_moderation_events $$,
  NULL, NULL, 'không xoá lẻ được một dòng lịch sử khi kênh vẫn còn');

SET LOCAL request.jwt.claims TO '{"sub":"5f0e0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT ok(
  public.shop_contact_delete((SELECT v FROM t_q5 WHERE k='c1')),
  'nhưng người bán vẫn xoá được kênh của mình — lịch sử đi cùng chủ thể, không chặn chủ thể');
SET LOCAL role postgres;
SELECT is(
  (SELECT count(*)::int FROM public.shop_contact_moderation_events
   WHERE contact_channel_id=(SELECT v FROM t_q5 WHERE k='c1')),
  0, 'và lịch sử của kênh đó đi theo, không bỏ lại dòng mồ côi');

SELECT * FROM finish();
ROLLBACK;
