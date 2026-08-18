-- ============================================================================
-- Shop P2b step 3 — the public read model.
--
-- What this file is really asking:
--   * can anything a moderator has not published reach a buyer, through ANY
--     of the five surfaces;
--   * can a private storage path reach a buyer;
--   * can a buyer learn that a private product exists, from a status code or
--     an error message;
--   * can the cursor skip a row or show one twice;
--   * can a public function be asked a privileged question.
-- ============================================================================

BEGIN;

SELECT plan(73);

-- ─── Fixture ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('60000001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pub-owner@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('60000002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pub-rival@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('60000003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pub-buyer@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('60000001-0000-4000-8000-000000000001'::uuid),
  ('60000002-0000-4000-8000-000000000002'::uuid) ON CONFLICT DO NOTHING;

-- ordering_enabled / shipping_fee_vnd are set at INSERT because the guard
-- trigger is BEFORE UPDATE only, and it pins ordering_enabled for anybody who
-- is not an admin.
INSERT INTO public.shops (id, slug, name, state, owner_user_id, region, intro, verified_at, verified_method,
                          ordering_enabled, shipping_fee_vnd) VALUES
  ('61000001-0000-4000-8000-000000000001'::uuid, 'pub-shop-a', 'Shop Công Khai', 'active',
   '60000001-0000-4000-8000-000000000001'::uuid, 'Hà Nội', 'Chuyên vợt', NOW(), 'giay-phep-kinh-doanh',
   true, 30000),
  ('61000002-0000-4000-8000-000000000002'::uuid, 'pub-shop-b', 'Shop Bị Gỡ', 'suspended',
   '60000002-0000-4000-8000-000000000002'::uuid, NULL, NULL, NULL, NULL,
   false, 0);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('61000001-0000-4000-8000-000000000001'::uuid, '60000001-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('61000002-0000-4000-8000-000000000002'::uuid, '60000002-0000-4000-8000-000000000002'::uuid, 'owner');

-- Four products in shop A, built directly so every combination the visibility
-- rule cares about is represented, plus one in the suspended shop.
CREATE TEMP TABLE t_pub (k TEXT PRIMARY KEY, v UUID);
GRANT SELECT, INSERT ON t_pub TO authenticated, anon;

SELECT set_config('shop.privileged_write', 'on', true);

INSERT INTO public.products (id, shop_id, slug, title, description, category_slug, status, is_published, created_at)
VALUES
  ('62000001-0000-4000-8000-000000000001'::uuid, '61000001-0000-4000-8000-000000000001'::uuid,
   'vot-cong-khai', 'Vợt Công Khai Joola', 'Vợt carbon T700 lõi tổ ong 16mm.', 'vot', 'approved', true, now() - interval '3 h'),
  ('62000002-0000-4000-8000-000000000002'::uuid, '61000001-0000-4000-8000-000000000001'::uuid,
   'vot-ban-nhap', 'Vợt Bản Nháp', 'Chưa gửi duyệt.', 'vot', 'draft', false, now() - interval '2 h'),
  ('62000003-0000-4000-8000-000000000003'::uuid, '61000001-0000-4000-8000-000000000001'::uuid,
   'vot-chua-co-byte', 'Vợt Chưa Có Byte', 'Đã duyệt nhưng worker chưa chạy.', 'vot', 'approved', true, now() - interval '1 h'),
  ('62000004-0000-4000-8000-000000000004'::uuid, '61000001-0000-4000-8000-000000000001'::uuid,
   'giay-cong-khai', 'Giày Công Khai', 'Giày sân cứng, đế bám tốt.', 'giay', 'approved', true, now() - interval '30 min'),
  ('62000005-0000-4000-8000-000000000005'::uuid, '61000002-0000-4000-8000-000000000002'::uuid,
   'vot-shop-bi-go', 'Vợt Shop Bị Gỡ', 'Shop này đang bị gỡ.', 'vot', 'approved', true, now() - interval '10 min');

INSERT INTO public.product_variants (product_id, shop_id, price_vnd, stock_on_hand, position)
SELECT p.id, p.shop_id, 1500000, 5, 0 FROM public.products p
WHERE p.id IN ('62000001-0000-4000-8000-000000000001'::uuid, '62000002-0000-4000-8000-000000000002'::uuid,
               '62000003-0000-4000-8000-000000000003'::uuid, '62000004-0000-4000-8000-000000000004'::uuid,
               '62000005-0000-4000-8000-000000000005'::uuid);

-- Committed public renditions for everything EXCEPT 62000003 (the worker has
-- not run) — that product is the whole point of the "bytes exist" rule.
INSERT INTO public.product_media (product_id, shop_id, draft_path, rendition_source_path, public_path, state, verified_at, position)
SELECT p.id, p.shop_id,
       p.shop_id::text || '/' || p.id::text || '/orig.jpg',
       p.shop_id::text || '/' || p.id::text || '/rendition.webp',
       p.shop_id::text || '/' || p.id::text || '/pub-v1.webp',
       'approved', now(), 0
FROM public.products p
WHERE p.id <> '62000003-0000-4000-8000-000000000003'::uuid;

INSERT INTO public.product_media (product_id, shop_id, draft_path, rendition_source_path, public_path, state, verified_at, position)
VALUES ('62000003-0000-4000-8000-000000000003'::uuid, '61000001-0000-4000-8000-000000000001'::uuid,
        '61000001-0000-4000-8000-000000000001/62000003-0000-4000-8000-000000000003/orig.jpg',
        '61000001-0000-4000-8000-000000000001/62000003-0000-4000-8000-000000000003/rendition.webp',
        NULL, 'draft', now(), 0);

-- A slug this product used to live at.
INSERT INTO public.product_slug_history (slug, product_id)
VALUES ('vot-ten-cu', '62000001-0000-4000-8000-000000000001'::uuid),
       ('nhap-ten-cu', '62000002-0000-4000-8000-000000000002'::uuid);

-- Contacts: one approved+public, one approved but not public, one pending.
INSERT INTO public.shop_contact_channels (shop_id, type, value_raw, value_normalized, is_public, state, approved_at)
VALUES
  ('61000001-0000-4000-8000-000000000001'::uuid, 'phone', '0912345678', '+84912345678', true,  'approved', now()),
  ('61000001-0000-4000-8000-000000000001'::uuid, 'zalo',  '0912345679', 'https://zalo.me/912345679', false, 'approved', now()),
  ('61000001-0000-4000-8000-000000000001'::uuid, 'messenger', 'shopa', 'https://m.me/shopa', true, 'pending_review', NULL);

SELECT set_config('shop.privileged_write', 'off', true);

-- ─── The public API takes no privilege flag ─────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname LIKE 'shop\_public\_%'
     AND pg_get_function_identity_arguments(p.oid) ILIKE '%as_seller%'),
  0,
  'không hàm public nào nhận cờ nâng quyền — lớp escalation bị bỏ ở rìa API, không phải chống đỡ ở giữa');

-- ─── Anonymous ──────────────────────────────────────────────────────────────

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';

SELECT is(
  ((public.shop_public_product('vot-cong-khai')) -> 'product') ->> 'title',
  'Vợt Công Khai Joola', 'khách đọc được sản phẩm công khai bằng đường dẫn');

SELECT is(
  (public.shop_public_product('vot-ban-nhap')) ->> 'found',
  'false', 'bản nháp: không tìm thấy');
SELECT is(
  (public.shop_public_product('khong-bao-gio-ton-tai')) ->> 'found',
  'false', 'đường dẫn chưa từng có: cũng không tìm thấy');
SELECT is(
  public.shop_public_product('vot-ban-nhap'),
  public.shop_public_product('khong-bao-gio-ton-tai'),
  'HAI câu trả lời GIỐNG HỆT NHAU — mã lỗi không được thành máy dò đường dẫn riêng tư');

SELECT is(
  (public.shop_public_product('nhap-ten-cu')) ->> 'redirect_to',
  NULL,
  'đường dẫn cũ của một bản nháp KHÔNG chuyển hướng — nếu có thì nó vừa xác nhận bản nháp tồn tại');
SELECT is(
  (public.shop_public_product('vot-ten-cu')) ->> 'redirect_to',
  'vot-cong-khai', 'đường dẫn cũ của sản phẩm công khai thì chuyển hướng đúng');

SELECT is(
  (public.shop_public_product('vot-chua-co-byte')) ->> 'found',
  'false',
  'đã duyệt + đã bật công khai nhưng worker CHƯA đưa ảnh lên: chưa hiện, vì hiện là hiện một ảnh vỡ');

SELECT is(
  (public.shop_public_product('vot-shop-bi-go')) ->> 'found',
  'false', 'sản phẩm của shop bị gỡ: không hiện');

-- ─── No private path, no private field, ever ────────────────────────────────

SELECT ok(
  (public.shop_public_product('vot-cong-khai'))::text NOT LIKE '%rendition.webp%',
  'khách KHÔNG nhận đường dẫn bản dựng trong kho nháp');
SELECT ok(
  (public.shop_public_product('vot-cong-khai'))::text NOT LIKE '%orig.jpg%',
  'và không nhận đường dẫn ảnh gốc');
SELECT ok(
  (public.shop_public_product('vot-cong-khai'))::text NOT LIKE '%token=%',
  'và không nhận URL đã ký');
SELECT ok(
  ((public.shop_public_product('vot-cong-khai')) -> 'product' -> 'variants' -> 0) ->> 'stock_on_hand' IS NULL,
  'và KHÔNG nhận số tồn kho thật');
SELECT is(
  ((public.shop_public_product('vot-cong-khai')) -> 'product' -> 'variants' -> 0) ->> 'availability',
  'in_stock', 'chỉ nhận nhãn tình trạng do máy chủ suy ra');
SELECT ok(
  NOT (((public.shop_public_product('vot-cong-khai')) -> 'product') ? 'internal_note'),
  'không có ghi chú nội bộ');
SELECT is(
  ((public.shop_public_product('vot-cong-khai')) -> 'product') ->> 'status',
  NULL, 'không lộ trạng thái kiểm duyệt');
SELECT ok(
  NOT (((public.shop_public_product('vot-cong-khai')) -> 'product' -> 'shop') ? 'owner_user_id'),
  'không lộ danh tính chủ shop');

-- ─── Contacts ───────────────────────────────────────────────────────────────

SELECT is(
  jsonb_array_length((public.shop_public_product('vot-cong-khai')) -> 'contacts'),
  1, 'chỉ MỘT kênh liên hệ công khai — approved + is_public + shop active');
SELECT is(
  ((public.shop_public_product('vot-cong-khai')) -> 'contacts' -> 0) ->> 'href',
  '+84912345678', 'và điểm đến là giá trị đã chuẩn hoá do máy chủ suy ra');
SELECT ok(
  (public.shop_public_product('vot-cong-khai'))::text NOT LIKE '%zalo.me/912345679%',
  'kênh đã duyệt nhưng người bán KHÔNG bật công khai: không lộ');
SELECT ok(
  (public.shop_public_product('vot-cong-khai'))::text NOT LIKE '%m.me/shopa%',
  'kênh chờ duyệt: không lộ');

-- ─── Search / discovery ─────────────────────────────────────────────────────

SELECT is(
  ((public.shop_public_search()) -> 'total')::int,
  2, 'khám phá chỉ trả 2 sản phẩm thật sự công khai trong 5 dòng đã dựng');
SELECT ok(
  (public.shop_public_search())::text NOT LIKE '%Bản Nháp%',
  'bản nháp không có trong danh sách');
SELECT ok(
  (public.shop_public_search())::text NOT LIKE '%Chưa Có Byte%',
  'sản phẩm chưa có byte công khai cũng không');
SELECT ok(
  (public.shop_public_search())::text NOT LIKE '%Shop Bị Gỡ%',
  'sản phẩm của shop bị gỡ cũng không');
SELECT ok(
  (public.shop_public_search())::text NOT LIKE '%rendition.webp%',
  'và không dòng nào mang đường dẫn riêng tư');

SELECT is(
  ((public.shop_public_search('vot')) -> 'total')::int,
  1, 'tìm "vot" KHÔNG dấu ra đúng cái vợt — unaccent làm việc');
SELECT is(
  ((public.shop_public_search('vợt')) -> 'total')::int,
  1, 'tìm "vợt" CÓ dấu ra cùng kết quả');
SELECT is(
  ((public.shop_public_search('Joola')) -> 'total')::int,
  1, 'tìm theo thương hiệu trong tên');
SELECT is(
  ((public.shop_public_search('carbon')) -> 'total')::int,
  1, 'tìm theo từ trong mô tả');
SELECT is(
  ((public.shop_public_search('khongcotutunay')) -> 'total')::int,
  0, 'từ không có thì trả rỗng, không trả tất cả');
SELECT lives_ok(
  $$ SELECT public.shop_public_search('"chưa đóng ngoặc') $$,
  'truy vấn hỏng cú pháp không làm nổ hàm — websearch_to_tsquery nuốt được');

SELECT is(
  ((public.shop_public_search(NULL, 'giay')) -> 'total')::int,
  1, 'lọc theo ngành hàng');
SELECT is(
  ((public.shop_public_search(NULL, NULL, 'pub-shop-a')) -> 'total')::int,
  2, 'lọc theo shop');
SELECT is(
  ((public.shop_public_search(NULL, NULL, 'pub-shop-b')) -> 'total')::int,
  0, 'shop bị gỡ không có gì để xem');

SELECT throws_ok(
  $$ SELECT public.shop_public_search(NULL, NULL, NULL, NULL, false, 'gia_re_nhat') $$,
  '22023', NULL, 'kiểu sắp xếp lạ bị từ chối, không âm thầm rơi về mặc định');

-- ─── Cursor ─────────────────────────────────────────────────────────────────
-- One row per page over the two visible products: the pages must partition
-- them exactly, with no repeat and no gap.

SELECT is(
  jsonb_array_length((public.shop_public_search(NULL, NULL, NULL, NULL, false, 'recent', NULL, NULL, 1)) -> 'rows'),
  1, 'trang đầu 1 dòng');

CREATE TEMP TABLE t_page AS
SELECT ((public.shop_public_search(NULL, NULL, NULL, NULL, false, 'recent', NULL, NULL, 1)) -> 'rows' -> 0) AS r1;

SELECT is(
  ((SELECT r1 FROM t_page) ->> 'slug'),
  'giay-cong-khai', 'sắp xếp mới nhất trước, và tất định');

SELECT is(
  (((public.shop_public_search(NULL, NULL, NULL, NULL, false, 'recent',
      ((SELECT r1 FROM t_page) ->> 'created_at')::timestamptz,
      ((SELECT r1 FROM t_page) ->> 'id')::uuid, 1)) -> 'rows' -> 0) ->> 'slug'),
  'vot-cong-khai', 'trang sau tiếp đúng chỗ — không lặp lại dòng vừa xem');

SELECT is(
  ((public.shop_public_search(NULL, NULL, NULL, NULL, false, 'recent',
      ((SELECT r1 FROM t_page) ->> 'created_at')::timestamptz,
      ((SELECT r1 FROM t_page) ->> 'id')::uuid, 1)) -> 'has_more')::text,
  'false', 'và biết là hết');

-- ─── The tie-breaker earns its place ────────────────────────────────────────
-- The three products above have distinct created_at, so a cursor comparing on
-- created_at ALONE partitions them correctly and the assertions above stay
-- green with the tie-breaker deleted. Proven by deleting it.
--
-- Two rows sharing a timestamp is what makes the difference visible, and it is
-- not a contrived case: a seller publishing a batch, or a worker committing
-- several products in one transaction, produces exactly this.

SET LOCAL role postgres;
SELECT set_config('shop.privileged_write', 'on', true);
INSERT INTO public.products (id, shop_id, slug, title, description, category_slug, status, is_published, created_at)
VALUES
  ('62000010-0000-4000-8000-000000000010'::uuid, '61000001-0000-4000-8000-000000000001'::uuid,
   'lo-hang-mot', 'Lô Hàng Một', 'Đăng cùng lúc với lô hàng hai.', 'vot', 'approved', true, '2026-08-01 10:00:00+07'),
  ('62000011-0000-4000-8000-000000000011'::uuid, '61000001-0000-4000-8000-000000000001'::uuid,
   'lo-hang-hai', 'Lô Hàng Hai', 'Đăng cùng lúc với lô hàng một.', 'vot', 'approved', true, '2026-08-01 10:00:00+07');
INSERT INTO public.product_variants (product_id, shop_id, price_vnd, stock_on_hand, position)
SELECT p.id, p.shop_id, 900000, 3, 0 FROM public.products p
WHERE p.id IN ('62000010-0000-4000-8000-000000000010'::uuid, '62000011-0000-4000-8000-000000000011'::uuid);
INSERT INTO public.product_media (product_id, shop_id, draft_path, rendition_source_path, public_path, state, verified_at, position)
SELECT p.id, p.shop_id,
       p.shop_id::text || '/' || p.id::text || '/orig.jpg',
       p.shop_id::text || '/' || p.id::text || '/rendition.webp',
       p.shop_id::text || '/' || p.id::text || '/pub-v1.webp',
       'approved', now(), 0
FROM public.products p
WHERE p.id IN ('62000010-0000-4000-8000-000000000010'::uuid, '62000011-0000-4000-8000-000000000011'::uuid);
SELECT set_config('shop.privileged_write', 'off', true);

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';

-- Page through ALL of them one at a time and collect what came back. With a
-- correct cursor this is exactly the four visible products, each once.
CREATE TEMP TABLE t_walk (n INT, slug TEXT, at TIMESTAMPTZ, id UUID);

DO $walk$
DECLARE
  _at TIMESTAMPTZ := NULL;
  _id UUID := NULL;
  _r  JSONB;
  _i  INT := 0;
BEGIN
  LOOP
    _i := _i + 1;
    EXIT WHEN _i > 12;                       -- a loop guard, never reached
    _r := public.shop_public_search(NULL, NULL, NULL, NULL, false, 'recent', _at, _id, 1);
    EXIT WHEN jsonb_array_length(_r -> 'rows') = 0;
    INSERT INTO t_walk
    VALUES (_i, (_r -> 'rows' -> 0) ->> 'slug',
            ((_r -> 'rows' -> 0) ->> 'created_at')::timestamptz,
            ((_r -> 'rows' -> 0) ->> 'id')::uuid);
    _at := ((_r -> 'rows' -> 0) ->> 'created_at')::timestamptz;
    _id := ((_r -> 'rows' -> 0) ->> 'id')::uuid;
    EXIT WHEN NOT (_r ->> 'has_more')::boolean;
  END LOOP;
END
$walk$;

SELECT is(
  (SELECT count(*)::int FROM t_walk),
  4, 'đi hết bằng con trỏ, mỗi trang 1 dòng: ra đúng 4 sản phẩm công khai');
SELECT is(
  (SELECT count(DISTINCT slug)::int FROM t_walk),
  4, 'KHÔNG dòng nào lặp lại — hai sản phẩm đăng cùng một thời điểm vẫn tách được nhờ khoá phụ là id');
SELECT ok(
  (SELECT bool_and(slug IS NOT NULL) FROM t_walk) AND
  (SELECT count(*)::int FROM t_walk WHERE slug IN ('lo-hang-mot', 'lo-hang-hai')) = 2,
  'và không dòng nào bị bỏ qua');

-- ─── Shop page ──────────────────────────────────────────────────────────────

SELECT is(
  ((public.shop_public_shop('pub-shop-a')) -> 'shop') ->> 'name',
  'Shop Công Khai', 'trang shop đọc được');
SELECT is(
  (((public.shop_public_shop('pub-shop-a')) -> 'shop') ->> 'product_count')::int,
  4, 'và đếm đúng số sản phẩm thật sự công khai (2 ban đầu + 2 lô hàng)');
SELECT is(
  (public.shop_public_shop('pub-shop-b')) ->> 'found',
  'false', 'shop bị gỡ: không tìm thấy');
SELECT is(
  public.shop_public_shop('pub-shop-b'),
  public.shop_public_shop('shop-khong-ton-tai'),
  'và trả lời giống hệt shop chưa từng tồn tại');
SELECT ok(
  NOT (((public.shop_public_shop('pub-shop-a')) -> 'shop') ? 'owner_user_id'),
  'trang shop không mang danh tính chủ shop');

-- ─── Taxonomy ───────────────────────────────────────────────────────────────

SELECT is(
  (SELECT (c ->> 'product_count')::int FROM jsonb_array_elements(public.shop_public_categories()) c
   WHERE c ->> 'slug' = 'vot'),
  3, 'đếm ngành hàng lấy từ sản phẩm thật sự công khai — không quảng cáo 5 rồi mở ra 3');

SET LOCAL role postgres;
UPDATE public.product_categories SET is_active = false WHERE slug = 'vot';
SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';

SELECT ok(
  (public.shop_public_categories())::text NOT LIKE '%"vot"%',
  'ngành hàng bị tắt biến khỏi danh sách');
SELECT is(
  (public.shop_public_product('vot-cong-khai')) ->> 'found',
  'false', 'và mọi sản phẩm trong đó biến khỏi trang sản phẩm');
SELECT is(
  ((public.shop_public_search()) -> 'total')::int,
  1, 'và khỏi khám phá');

SET LOCAL role postgres;
UPDATE public.product_categories SET is_active = true WHERE slug = 'vot';

-- ─── A logged-in buyer gets nothing extra ───────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"60000003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.shop_public_product('vot-ban-nhap')) ->> 'found',
  'false', 'người mua đã đăng nhập KHÔNG thấy thêm gì');
SELECT is(
  ((public.shop_public_search()) -> 'total')::int,
  4, 'và đếm ra đúng con số của khách');

-- A seller cannot borrow the public door to read a rival's private shop.
SET LOCAL request.jwt.claims TO '{"sub":"60000002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.shop_public_product('vot-ban-nhap')) ->> 'found',
  'false', 'người bán shop khác cũng không mượn được cửa công khai để đọc bản nháp');

-- ─── Shop slug history (P2b.5) ──────────────────────────────────────────────
-- Products got this in Q2. A shop rename breaks just as many shared links.

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"60000001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is(
  public.shop_slug_update('61000001-0000-4000-8000-000000000001'::uuid, 'pub-shop-a-moi'),
  'pub-shop-a-moi', 'chủ shop đổi đường dẫn');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';

SELECT is(
  (public.shop_public_shop('pub-shop-a')) ->> 'redirect_to',
  'pub-shop-a-moi', 'đường dẫn cũ chuyển hướng sang đường dẫn mới');
SELECT is(
  ((public.shop_public_shop('pub-shop-a-moi')) -> 'shop') ->> 'name',
  'Shop Công Khai', 'đường dẫn mới trả nội dung');
SELECT is(
  (public.shop_public_shop('shop-chua-tung-co')) ->> 'redirect_to',
  NULL, 'đường dẫn chưa từng tồn tại thì không chuyển hướng đi đâu cả');

-- The suspended shop must not become discoverable through its history either.
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"60000002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
-- The rename itself is allowed: hiding a suspended shop is the READER's job,
-- not the slug function's. What matters is that the retired slug gains no
-- visibility from it.
SELECT lives_ok(
  $$ SELECT public.shop_slug_update('61000002-0000-4000-8000-000000000002'::uuid, 'ten-moi-cua-shop-bi-go') $$,
  'shop bị gỡ vẫn đổi được đường dẫn — chặn hiển thị là việc của phía đọc');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is(
  (public.shop_public_shop('pub-shop-b')) ->> 'redirect_to',
  NULL,
  'đường dẫn cũ của shop BỊ GỠ không chuyển hướng — nếu có thì nó vừa xác nhận shop đó có thật');
SELECT is(
  public.shop_public_shop('pub-shop-b'),
  public.shop_public_shop('shop-chua-tung-co'),
  'và trả lời giống hệt một shop chưa từng tồn tại');

-- Reclaiming a slug the shop used before must stop it redirecting to itself.
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"60000001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  public.shop_slug_update('61000001-0000-4000-8000-000000000001'::uuid, 'pub-shop-a'),
  'pub-shop-a', 'đổi ngược về đường dẫn cũ');
SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is(
  (public.shop_public_shop('pub-shop-a')) ->> 'redirect_to',
  NULL, 'không còn là chuyển hướng trỏ về chính nó — vòng lặp bị chặn ngay tại dữ liệu');
SELECT is(
  ((public.shop_public_shop('pub-shop-a')) -> 'shop') ->> 'slug',
  'pub-shop-a', 'và nó lại là đường dẫn đang dùng');

-- ─── The two keys Phase 3 added to the projection (20260818120000) ──────────
-- Without them the product page has no way to know a shop paused selling: it
-- renders "Thêm vào giỏ", the buyer presses it, and the refusal arrives two
-- screens later. Neither key is a secret — both are facts a buyer needs
-- BEFORE they type an address.

-- "Không phải hằng số trong hàm" is a claim about the FUNCTION, not about the
-- caller: product_public_projection is SECURITY DEFINER, so it returns the same
-- JSON to anyone allowed to call it. The role is dropped for these two because
-- since 20260818130000 anon holds no SELECT on `shops` at all, so the
-- comparison side of the assertion would raise 42501 and abort the whole file.
-- The property that genuinely needs anon is "an anonymous buyer can READ these
-- keys", and that is the pair below, back under the role.
RESET ROLE;
SELECT is(
  (public.product_public_projection('62000001-0000-4000-8000-000000000001'::uuid, false)) -> 'shop' -> 'ordering_enabled',
  to_jsonb((SELECT ordering_enabled FROM public.shops WHERE id = '61000001-0000-4000-8000-000000000001'::uuid)),
  'giá trị lấy thẳng từ bảng shops, không phải hằng số trong hàm');
SELECT is(
  (public.product_public_projection('62000001-0000-4000-8000-000000000001'::uuid, false)) -> 'shop' -> 'shipping_fee_vnd',
  to_jsonb((SELECT shipping_fee_vnd FROM public.shops WHERE id = '61000001-0000-4000-8000-000000000001'::uuid)),
  'phí ship cũng vậy');

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';

SELECT is(
  ((public.product_public_projection('62000001-0000-4000-8000-000000000001'::uuid, false)) -> 'shop') ->> 'ordering_enabled',
  'true', 'người mua ẩn danh đọc được công tắc bán hàng của shop');
SELECT is(
  ((public.product_public_projection('62000001-0000-4000-8000-000000000001'::uuid, false)) -> 'shop') ->> 'shipping_fee_vnd',
  '30000', 'và phí vận chuyển của shop');

-- …and the table itself stays shut to them, which is the other half of the
-- same guarantee: the projection is the door, not one door among several.
SELECT throws_ok(
  $$ SELECT ordering_enabled FROM public.shops $$, '42501', NULL,
  'nhưng KHÔNG đọc được thẳng bảng shops');

-- The public door inherits both, because it calls the same projection.
SELECT is(
  (((public.shop_public_product('vot-cong-khai')) -> 'product') -> 'shop') ->> 'shipping_fee_vnd',
  '30000', 'shop_public_product kế thừa cả hai khoá mà không cần sửa gì');

-- Old keys, unchanged, on BOTH doors. A key list rather than a spot check:
-- the failure mode of CREATE OR REPLACE is dropping something, not mistyping
-- the thing you were adding.
SELECT is(
  (SELECT array_agg(k ORDER BY k)
   FROM jsonb_object_keys((public.product_public_projection('62000001-0000-4000-8000-000000000001'::uuid, false)) -> 'shop') k),
  ARRAY['name','ordering_enabled','region','return_note','shipping_fee_vnd','shipping_note','slug','verified'],
  'đường công khai: 6 khoá cũ còn nguyên, chỉ thêm đúng 2 khoá mới');

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"60000001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is(
  (SELECT array_agg(k ORDER BY k)
   FROM jsonb_object_keys((public.product_public_projection('62000001-0000-4000-8000-000000000001'::uuid, true)) -> 'shop') k),
  ARRAY['name','ordering_enabled','region','return_note','shipping_fee_vnd','shipping_note','slug','verified'],
  'đường _as_seller cũng vậy — hai đường không lệch khoá');

SELECT * FROM finish();
ROLLBACK;
