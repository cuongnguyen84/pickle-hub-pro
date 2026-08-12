-- ============================================================================
-- P2b step 0 — security closure on product_public_projection(_id, _as_seller).
-- ----------------------------------------------------------------------------
-- P2b puts this function on a PUBLIC route. Before that happens, the second
-- argument has to be proven inert: it is a plain boolean, it arrives from a
-- client, and a SECURITY DEFINER function runs with the definer's rights. If
-- passing `true` bought anything the caller did not already have, every draft
-- in the marketplace would be one PostgREST call away from a stranger.
--
-- The P2a suite covers three cases (anon with true, a rival seller with true,
-- the public reader on a draft). This file states and proves the whole rule
-- instead of a list of examples:
--
--     projection(id, true) succeeds  IFF  the caller can already SELECT that
--     product row under RLS.
--
-- Proving the equivalence per actor is stronger than enumerating roles,
-- because it stays true for roles nobody has invented yet. Each actor below
-- is asked BOTH questions and the two answers are compared.
--
-- The two cases the P2a suite never pinned down are also settled here, and
-- they are settled as OBSERVED BEHAVIOUR, not as a wish:
--
--   * a `support` member and
--   * a shop member who is NOT on the pilot allowlist
--
-- both CAN preview their own shop's draft. That is not the projection being
-- generous — `products_select_member` grants exactly the same read, so the
-- flag adds nothing. The pilot allowlist gates seller ACTIONS (create,
-- update, submit), not reads of a shop you are already a member of. If the
-- Product Owner wants reads gated too, that is a change to
-- `products_select_member` first and this function second; changing only this
-- function would leave PostgREST serving the same rows directly.
-- ============================================================================

BEGIN;

SELECT plan(25);

-- ─── Fixture ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('5b0b0001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p2b-owner@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('5b0b0002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p2b-manager@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('5b0b0003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p2b-support@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('5b0b0004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p2b-rival@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('5b0b0005-0000-4000-8000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p2b-admin@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('5b0b0006-0000-4000-8000-000000000006'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p2b-nonpilot@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('5b0b0007-0000-4000-8000-000000000007'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p2b-stranger@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('5b0b0005-0000-4000-8000-000000000005'::uuid, 'admin') ON CONFLICT DO NOTHING;
INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES ('5b0b00f8-0000-4000-8000-000000000008'::uuid, '5b0b0005-0000-4000-8000-000000000005'::uuid,
        'test-totp', 'totp', 'verified', NOW(), NOW(), 'JBSWY3DPEHPK3PXP');

-- 5b0b0006 is a MANAGER of shop A and deliberately absent from this list.
INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('5b0b0001-0000-4000-8000-000000000001'::uuid),
  ('5b0b0002-0000-4000-8000-000000000002'::uuid),
  ('5b0b0003-0000-4000-8000-000000000003'::uuid),
  ('5b0b0004-0000-4000-8000-000000000004'::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id, region, verified_at, verified_method) VALUES
  ('7b000001-0000-4000-8000-000000000001'::uuid, 'p2b-shop-a', 'Shop A', 'active',
   '5b0b0001-0000-4000-8000-000000000001'::uuid, 'TP. Hồ Chí Minh', NOW(), 'giay-phep-kinh-doanh'),
  ('7b000002-0000-4000-8000-000000000002'::uuid, 'p2b-shop-b', 'Shop B', 'active',
   '5b0b0004-0000-4000-8000-000000000004'::uuid, NULL, NULL, NULL);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('7b000001-0000-4000-8000-000000000001'::uuid, '5b0b0001-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('7b000001-0000-4000-8000-000000000001'::uuid, '5b0b0002-0000-4000-8000-000000000002'::uuid, 'manager'),
  ('7b000001-0000-4000-8000-000000000001'::uuid, '5b0b0003-0000-4000-8000-000000000003'::uuid, 'support'),
  ('7b000001-0000-4000-8000-000000000001'::uuid, '5b0b0006-0000-4000-8000-000000000006'::uuid, 'manager'),
  ('7b000002-0000-4000-8000-000000000002'::uuid, '5b0b0004-0000-4000-8000-000000000004'::uuid, 'owner');

CREATE TEMP TABLE t_authz (k TEXT PRIMARY KEY, v UUID);
GRANT SELECT, INSERT ON t_authz TO authenticated, anon;

-- Shop A's draft — the thing that must not leak.
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5b0b0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
INSERT INTO t_authz VALUES ('draft',
  (public.product_create('7b000001-0000-4000-8000-000000000001'::uuid, 'tok-p2b-draft',
    '{"title":"Vợt bản nháp chưa duyệt","price_vnd":2000000}'::jsonb)).id);

-- ─── The shape of the contract ──────────────────────────────────────────────

SELECT is(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='product_public_projection'),
  true,
  'phép chiếu chạy bằng quyền của người định nghĩa — nên nó PHẢI tự kiểm tra quyền');

SELECT ok(
  NOT has_function_privilege('public', 'public.product_public_projection(uuid, boolean)', 'EXECUTE'),
  'PUBLIC không được gọi — quyền được cấp tường minh, không thừa kế');

-- ─── The rule: the flag buys nothing RLS did not already give ───────────────
-- Each actor answers two questions. `expected` is what RLS says; the
-- projection must agree. A future role added to shop_members inherits this
-- test without anybody editing it.

CREATE TEMP TABLE t_probe (who TEXT, claims TEXT, rls_visible BOOLEAN, projection_ok BOOLEAN);

DO $probe$
DECLARE
  _pid  UUID := (SELECT v FROM t_authz WHERE k='draft');
  _rec  RECORD;
  _seen BOOLEAN;
  _ok   BOOLEAN;
BEGIN
  FOR _rec IN
    SELECT * FROM (VALUES
      ('chủ shop A',              '{"sub":"5b0b0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}'),
      ('quản lý shop A',          '{"sub":"5b0b0002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}'),
      ('nhân viên hỗ trợ shop A', '{"sub":"5b0b0003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}'),
      ('quản lý NGOÀI thí điểm',  '{"sub":"5b0b0006-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}'),
      ('chủ shop B (đối thủ)',    '{"sub":"5b0b0004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}'),
      ('người lạ đã đăng nhập',   '{"sub":"5b0b0007-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}')
    ) AS v(who, claims)
  LOOP
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', _rec.claims, true);

    SELECT EXISTS (SELECT 1 FROM public.products WHERE id = _pid) INTO _seen;

    BEGIN
      PERFORM public.product_public_projection(_pid, true);
      _ok := true;
    EXCEPTION WHEN OTHERS THEN
      _ok := false;
    END;

    PERFORM set_config('role', 'postgres', true);
    INSERT INTO t_probe VALUES (_rec.who, _rec.claims, _seen, _ok);
  END LOOP;
END
$probe$;

SET LOCAL role postgres;

SELECT is(
  (SELECT count(*)::int FROM t_probe WHERE rls_visible IS DISTINCT FROM projection_ok),
  0,
  'cờ _as_seller KHÔNG mua thêm quyền: ai đọc được dòng qua RLS thì xem trước được, và chỉ những người đó');

-- Then the individual answers, spelled out, so a future reader sees WHICH way
-- each actor resolved rather than only that the two columns matched.
SELECT is((SELECT projection_ok FROM t_probe WHERE who='chủ shop A'), true,
  'chủ shop xem trước được bản nháp của chính mình');
SELECT is((SELECT projection_ok FROM t_probe WHERE who='quản lý shop A'), true,
  'quản lý cũng vậy');
SELECT is((SELECT projection_ok FROM t_probe WHERE who='nhân viên hỗ trợ shop A'), true,
  'nhân viên hỗ trợ CŨNG xem trước được — giống hệt quyền products_select_member đã cho, không phải lỗ hổng của hàm');
SELECT is((SELECT projection_ok FROM t_probe WHERE who='quản lý NGOÀI thí điểm'), true,
  'thành viên ngoài danh sách thí điểm CŨNG xem trước được — danh sách thí điểm chặn HÀNH ĐỘNG, không chặn đọc shop mình là thành viên');
SELECT is((SELECT projection_ok FROM t_probe WHERE who='chủ shop B (đối thủ)'), false,
  'chủ shop khác KHÔNG xem trước được bản nháp của shop này');
SELECT is((SELECT projection_ok FROM t_probe WHERE who='người lạ đã đăng nhập'), false,
  'người lạ đã đăng nhập KHÔNG xem trước được');

-- ─── Anonymous cannot borrow the flag ───────────────────────────────────────

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';

SELECT throws_ok(
  format($$ SELECT public.product_public_projection(%L::uuid, true) $$, (SELECT v FROM t_authz WHERE k='draft')),
  '42501', NULL, 'khách KHÔNG mượn được cờ xem trước');
SELECT throws_ok(
  format($$ SELECT public.product_public_projection(%L::uuid, false) $$, (SELECT v FROM t_authz WHERE k='draft')),
  'P0002', NULL, 'và đường công khai trả "không tìm thấy" — không hé lộ rằng bản nháp có tồn tại');
SELECT is(
  (SELECT count(*)::int FROM public.products WHERE id=(SELECT v FROM t_authz WHERE k='draft')),
  0, 'khách cũng không đọc thẳng bảng được');

-- ─── The public path only opens for approved + published + active ───────────

SET LOCAL role postgres;
SELECT set_config('shop.privileged_write', 'on', true);
UPDATE public.products SET status='approved', is_published=true
  WHERE id=(SELECT v FROM t_authz WHERE k='draft');
SELECT set_config('shop.privileged_write', 'off', true);

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is(
  (public.product_public_projection((SELECT v FROM t_authz WHERE k='draft'), false)) ->> 'title',
  'Vợt bản nháp chưa duyệt', 'đã duyệt + đã công khai + shop đang hoạt động: khách đọc được');
SELECT is(
  (public.product_public_projection((SELECT v FROM t_authz WHERE k='draft'), false)) ->> 'status',
  NULL, 'nhưng trạng thái kiểm duyệt vẫn không lộ');
SELECT ok(
  NOT ((public.product_public_projection((SELECT v FROM t_authz WHERE k='draft'), false)) ? 'internal_note'),
  'ghi chú nội bộ không có mặt');
SELECT ok(
  NOT (((public.product_public_projection((SELECT v FROM t_authz WHERE k='draft'), false)) -> 'shop') ? 'owner_user_id'),
  'danh tính chủ shop không có mặt');

-- Each of the three conditions, withdrawn one at a time.
SET LOCAL role postgres;
SELECT set_config('shop.privileged_write', 'on', true);
UPDATE public.products SET is_published=false WHERE id=(SELECT v FROM t_authz WHERE k='draft');
SELECT set_config('shop.privileged_write', 'off', true);
SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT throws_ok(
  format($$ SELECT public.product_public_projection(%L::uuid, false) $$, (SELECT v FROM t_authz WHERE k='draft')),
  'P0002', NULL, 'gỡ công khai: biến mất khỏi đường công khai ngay');

SET LOCAL role postgres;
SELECT set_config('shop.privileged_write', 'on', true);
-- `products` has no 'suspended' label. Moderation reverses an approval with
-- 'rejected' and the seller withdraws with 'archived' — and the dangerous
-- middle state, "no longer approved but still flagged public", is not merely
-- filtered out downstream, it is UNREPRESENTABLE. Proving the constraint is
-- worth more than proving the projection filters a row that cannot exist.
UPDATE public.products SET is_published=true WHERE id=(SELECT v FROM t_authz WHERE k='draft');
SELECT throws_ok(
  format($$ UPDATE public.products SET status='rejected' WHERE id=%L::uuid $$, (SELECT v FROM t_authz WHERE k='draft')),
  '23514', NULL,
  'không thể vừa "thôi được duyệt" vừa "đang công khai" — CSDL từ chối, nên không có gì để lọc');

UPDATE public.products SET status='rejected', is_published=false WHERE id=(SELECT v FROM t_authz WHERE k='draft');
SELECT set_config('shop.privileged_write', 'off', true);
SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT throws_ok(
  format($$ SELECT public.product_public_projection(%L::uuid, false) $$, (SELECT v FROM t_authz WHERE k='draft')),
  'P0002', NULL, 'quản trị thu hồi phê duyệt: biến mất khỏi đường công khai');

SET LOCAL role postgres;
SELECT set_config('shop.privileged_write', 'on', true);
UPDATE public.products SET status='approved' WHERE id=(SELECT v FROM t_authz WHERE k='draft');
SELECT set_config('shop.privileged_write', 'off', true);
UPDATE public.shops SET state='suspended' WHERE id='7b000001-0000-4000-8000-000000000001'::uuid;
SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT throws_ok(
  format($$ SELECT public.product_public_projection(%L::uuid, false) $$, (SELECT v FROM t_authz WHERE k='draft')),
  'P0002', NULL, 'đình chỉ shop: mọi sản phẩm của shop biến mất khỏi đường công khai');

-- ─── A product that does not exist answers the same as one you may not see ──
-- Otherwise the error code itself is an oracle for "this id is real".

SELECT throws_ok(
  $$ SELECT public.product_public_projection('7b0000ff-0000-4000-8000-0000000000ff'::uuid, false) $$,
  'P0002', NULL, 'id không tồn tại trả CÙNG mã lỗi với id bị cấm — không dò được id thật');

-- ─── The seller path never renders as if it were the public one ─────────────

SET LOCAL role postgres;
UPDATE public.shops SET state='active' WHERE id='7b000001-0000-4000-8000-000000000001'::uuid;
SELECT set_config('shop.privileged_write', 'on', true);
UPDATE public.products SET status='approved', is_published=true WHERE id=(SELECT v FROM t_authz WHERE k='draft');
SELECT set_config('shop.privileged_write', 'off', true);
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"5b0b0001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  (public.product_public_projection((SELECT v FROM t_authz WHERE k='draft'), true)) ->> 'is_preview',
  'true', 'bản xem trước tự khai là bản xem trước');
SELECT is(
  (public.product_public_projection((SELECT v FROM t_authz WHERE k='draft'), false)) ->> 'is_preview',
  'false', 'đường công khai thì không');

-- ─── Admin ──────────────────────────────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"5b0b0005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
SELECT lives_ok(
  format($$ SELECT public.product_public_projection(%L::uuid, true) $$, (SELECT v FROM t_authz WHERE k='draft')),
  'quản trị viên có aal2 xem trước được — đây là thứ màn duyệt của P2b sẽ đọc');

SET LOCAL request.jwt.claims TO '{"sub":"5b0b0005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  format($$ SELECT public.product_public_projection(%L::uuid, true) $$, (SELECT v FROM t_authz WHERE k='draft')),
  '42501', NULL,
  'quản trị viên CHƯA qua 2 lớp (aal1) thì KHÔNG — is_admin() đòi aal2, và phép chiếu thừa hưởng điều đó');

SELECT * FROM finish();
ROLLBACK;
