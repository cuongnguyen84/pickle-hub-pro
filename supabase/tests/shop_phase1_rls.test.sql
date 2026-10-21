-- Shop marketplace Phase 1 — RLS + RPC authorization matrix.
--
-- Every case here is a NEGATIVE one except where noted: the point is proving
-- what an actor cannot do, because "the client never calls that" is not a
-- security control. Convention follows rls_auth_matrix.test.sql (this pgTAP
-- build lacks the *_policy helpers, so assert against catalogs + behaviour).

BEGIN;

SELECT plan(39);

-- ─── Slug correctness ───────────────────────────────────────────────────────
-- Not a permission test, and that is the point: all the other assertions here
-- check WHO may do what, none checked whether what they produce is right. The
-- first version of unaccent_immutable corrupted every Vietnamese slug and this
-- suite stayed green, because the fixture below is ASCII.

SELECT is(public.shop_slug_from_name('Đồ Pickleball Sài Gòn'), 'do-pickleball-sai-gon', 'slug: Đồ/ò/ơ');
SELECT is(public.shop_slug_from_name('Thể thao Hùng Cường'),   'the-thao-hung-cuong',   'slug: ể/ù/ườ');
SELECT is(public.shop_slug_from_name('Vợt Đỉnh Cao 16mm'),     'vot-dinh-cao-16mm',     'slug: ợ/Đ/ỉ + chữ số');
SELECT is(public.shop_slug_from_name('CỬA HÀNG THỂ THAO'),     'cua-hang-the-thao',     'slug: hoa toàn phần');
SELECT is(public.shop_slug_from_name('Shop  --  Nháp!!'),      'shop-nhap',             'slug: gộp ký tự lạ, cắt gạch thừa');
SELECT is(public.shop_slug_from_name('!!!'),                   'shop',                  'slug: rỗng thì rơi về "shop"');

-- ─── Fixture: pilot member A, pilot member B, outsider C, admin D ───────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('50010001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'shop-a@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Shop A"}'::jsonb, NOW(), NOW()),
  ('50010002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'shop-b@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Shop B"}'::jsonb, NOW(), NOW()),
  ('50010003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'shop-c@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Outsider C"}'::jsonb, NOW(), NOW()),
  ('50010004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'shop-admin@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Shop Admin"}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('50010004-0000-4000-8000-000000000004'::uuid, 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('50010001-0000-4000-8000-000000000001'::uuid),
  ('50010002-0000-4000-8000-000000000002'::uuid);

-- Migration 20260814100000 publishes the real seller rules with an effective
-- date. The submit assertions further down are about consent, not about the
-- calendar, so this file starts from "nothing is published" and publishes its
-- own test document — otherwise every one of them would change meaning the
-- moment the real document takes effect. Rolled back with the transaction.
DELETE FROM public.legal_documents WHERE document_key = 'seller-rules';

-- ─── Blanket: RLS actually on ──────────────────────────────────────────────

SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='shop_applications'), 'RLS enabled on shop_applications');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='shop_application_events'), 'RLS enabled on shop_application_events');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='shops'), 'RLS enabled on shops');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='shop_members'), 'RLS enabled on shop_members');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='shop_pilot_members'), 'RLS enabled on shop_pilot_members');

-- A grant without a policy is a locked door with no wall; a policy without a
-- grant is a 42501 that reads like a bug. Since 20260814140000 the SELECT
-- grant is column-scoped: everything except internal_note (CP27 case 6c —
-- the applicant could read the moderator's note straight off the table).
SELECT ok(
  (SELECT has_column_privilege('authenticated', 'public.shop_applications', 'id', 'SELECT')),
  'authenticated has column-level SELECT on shop_applications'
);
SELECT ok(
  (SELECT NOT has_column_privilege('authenticated', 'public.shop_applications', 'internal_note', 'SELECT')),
  'but NOT on internal_note'
);

-- ─── A creates a draft ─────────────────────────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50010001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

INSERT INTO public.shop_applications (applicant_user_id, seller_type, full_name, phone, shop_name, city)
VALUES ('50010001-0000-4000-8000-000000000001'::uuid, 'ca-nhan', 'Nguyen Van A', '0901234567', 'Shop Cua A', 'TP. Ho Chi Minh');

SELECT is(
  (SELECT count(*)::int FROM public.shop_applications),
  1,
  'A sees exactly their own application'
);

-- 1. An applicant cannot promote their own application.
SELECT lives_ok(
  $$ UPDATE public.shop_applications SET status = 'approved' WHERE applicant_user_id = auth.uid() $$,
  'status write is silently neutralised rather than erroring'
);
SELECT is(
  (SELECT status::text FROM public.shop_applications WHERE applicant_user_id = auth.uid()),
  'draft',
  'applicant CANNOT set status=approved (trigger pins it)'
);

-- 2. An applicant cannot write moderator fields. Since 20260814140000 they
-- cannot READ internal_note either, so the verification read happens as
-- postgres — the write path under test is still the applicant's.
UPDATE public.shop_applications SET internal_note = 'tôi tự ghi' WHERE applicant_user_id = auth.uid();
RESET role;
SELECT is(
  (SELECT internal_note FROM public.shop_applications
   WHERE applicant_user_id = '50010001-0000-4000-8000-000000000001'::uuid),
  NULL,
  'applicant CANNOT write internal_note'
);
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50010001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

-- 3. The applicant-facing view does not expose internal_note at all.
SELECT is(
  (SELECT count(*)::int FROM information_schema.columns
   WHERE table_schema='public' AND table_name='my_shop_application' AND column_name='internal_note'),
  0,
  'my_shop_application view has no internal_note column'
);

-- 4. An applicant cannot forge an event row.
SELECT throws_ok(
  $$ INSERT INTO public.shop_application_events (application_id, actor_kind, event)
     SELECT id, 'admin', 'approved' FROM public.shop_applications LIMIT 1 $$,
  '42501',
  NULL,
  'applicant CANNOT insert into the append-only event log'
);

-- 5. An applicant cannot create a shop directly.
SELECT throws_ok(
  $$ INSERT INTO public.shops (slug, name, owner_user_id) VALUES ('tu-tao', 'Tu Tao', auth.uid()) $$,
  '42501',
  NULL,
  'applicant CANNOT insert a shop (no INSERT policy)'
);

-- 6. An applicant cannot make themselves a member of anything.
SELECT throws_ok(
  $$ INSERT INTO public.shop_members (shop_id, user_id, role)
     VALUES (gen_random_uuid(), auth.uid(), 'owner') $$,
  '42501',
  NULL,
  'applicant CANNOT insert shop_members'
);

-- 7. A non-admin cannot decide an application.
SELECT throws_ok(
  $$ SELECT public.shop_application_decide(
       (SELECT id FROM public.shop_applications LIMIT 1), 'approve') $$,
  '42501',
  NULL,
  'non-admin CANNOT call shop_application_decide'
);

-- ─── B cannot see or touch A's application ─────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50010002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

SELECT is(
  (SELECT count(*)::int FROM public.shop_applications),
  0,
  'B CANNOT read A''s application'
);

UPDATE public.shop_applications SET shop_name = 'bi chiem' WHERE true;
SET LOCAL request.jwt.claims TO '{"sub":"50010001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  (SELECT shop_name FROM public.shop_applications WHERE applicant_user_id = auth.uid()),
  'Shop Cua A',
  'B CANNOT update A''s application'
);

-- ─── Outsider C is not on the pilot allowlist ──────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50010003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';

SELECT ok(NOT public.shop_pilot_has_access(), 'outsider has no pilot access');

SELECT throws_ok(
  $$ INSERT INTO public.shop_applications (applicant_user_id, shop_name)
     VALUES (auth.uid(), 'Ngoai pilot') $$,
  '42501',
  NULL,
  'non-pilot user CANNOT create an application'
);

-- ─── Submit is server-validated and idempotent ─────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50010001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

-- Since migration 20260814090000 a complete application is not a submittable
-- one: the server also requires an accepted seller-rules version. Proven here
-- as well as in shop_seller_rules_acceptance.test.sql, because this file is
-- where a reader comes to learn what "A can submit" means.
SELECT throws_ok(
  'SELECT public.shop_application_submit()', 'P0002', NULL,
  'complete but no seller rules published — the submit refuses');

RESET role;
-- approved_by/approved_at are not decoration: legal_current_document() refuses
-- to serve an unapproved row, so a fixture without them is a draft and the
-- submit stays shut.
INSERT INTO public.legal_documents (document_key, version, title, body, effective_at, approved_by, approved_at)
VALUES ('seller-rules', 'v1', 'Quy chế người bán (TEST)',
        repeat('Điều khoản thử nghiệm dùng cho pgTAP. Đây không phải văn bản pháp lý. ', 6),
        now() - interval '1 day', 'pgTAP', now() - interval '1 day');
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50010001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT throws_ok(
  'SELECT public.shop_application_submit()', '23514', NULL,
  'published but unsigned — still refused');

SELECT lives_ok(
  $$SELECT public.legal_accept('seller-rules','v1',
      (SELECT content_hash FROM public.legal_documents
        WHERE document_key='seller-rules' AND version='v1'))$$,
  'A accepts the effective seller rules');

SELECT is(public.shop_application_submit()::text, 'submitted', 'A can submit a complete application');
SELECT is(public.shop_application_submit()::text, 'submitted', 'submitting twice is idempotent, not a second row');
SELECT is(
  (SELECT count(*)::int FROM public.shop_application_events WHERE event = 'submitted'),
  1,
  'double submit logs exactly one event'
);

-- ─── Admin decides ─────────────────────────────────────────────────────────
-- aal2 because is_admin() requires it (migration 20260730090000).

SET LOCAL request.jwt.claims TO '{"sub":"50010004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';

SELECT throws_ok(
  $$ SELECT public.shop_application_decide(
       (SELECT id FROM public.shop_applications LIMIT 1), 'request-changes', 'Anh chup lai giay to giup em nhe') $$,
  '23514',
  NULL,
  'request-changes without a target field is refused'
);

SELECT lives_ok(
  $$ SELECT public.shop_application_decide(
       (SELECT id FROM public.shop_applications LIMIT 1),
       'approve', 'Da duyet', 'gap truc tiep 11/08') $$,
  'admin can approve'
);

SELECT is(
  (SELECT count(*)::int FROM public.shops WHERE owner_user_id = '50010001-0000-4000-8000-000000000001'::uuid),
  1,
  'approval creates exactly one shop'
);

-- Deciding again must not mint a second shop — this is the concurrency case.
SELECT lives_ok(
  $$ SELECT public.shop_application_decide(
       (SELECT id FROM public.shop_applications LIMIT 1), 'approve', 'Da duyet lai') $$,
  'replaying approve is idempotent'
);
SELECT is(
  (SELECT count(*)::int FROM public.shops WHERE owner_user_id = '50010001-0000-4000-8000-000000000001'::uuid),
  1,
  'replaying approve does NOT create a second shop'
);

-- ─── A new shop is pending_activation, therefore invisible to the public ───

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';

-- Until 20260818130000 anon held a SELECT grant on shops, and this asserted
-- the weaker "the policy hides it": zero rows rather than an error. It was the
-- grant that let `?select=owner_user_id` answer with a real uid on production.
-- anon now holds no grant at all, so the answer is a hard 42501 — the same
-- shape as shop_applications below, and a stronger thing to assert.
SELECT throws_ok(
  $$ SELECT count(*) FROM public.shops $$,
  '42501',
  NULL,
  'anon CANNOT read shops at all — not even to be told the row is hidden'
);

-- shop_applications has NO grant for anon at all, so this is a hard 42501
-- rather than an empty result. Stronger than "returns no rows" — assert the
-- stronger thing.
SELECT throws_ok(
  $$ SELECT count(*) FROM public.shop_applications $$,
  '42501',
  NULL,
  'anon CANNOT read applications at all (no grant, not merely no rows)'
);

SELECT * FROM finish();
ROLLBACK;
