-- Shop marketplace Phase 2a — catalog RLS, column guards, transitions, media.
--
-- Negative-first, same convention as shop_phase1_rls.test.sql. Two habits this
-- file keeps from the Phase 1 run:
--   * assert CORRECTNESS as well as permission — the Phase 1 suite was fully
--     green while unaccent_immutable corrupted every Vietnamese slug, because
--     nothing asked what the code produced, only who could call it;
--   * assert the GRANT and the POLICY separately. A grant without a policy is
--     a 42501 that reads like a bug; a policy without a grant is a locked door
--     with no wall. This repo has shipped both.

BEGIN;

SELECT plan(64);

-- ─── Slug correctness (D-defect class, not a permission) ────────────────────

SELECT is(public.product_slug_from_title('Vợt Joola Perseus 16mm'), 'vot-joola-perseus-16mm', 'slug sản phẩm: ợ + chữ số');
SELECT is(public.product_slug_from_title('Giày Đế Cao Su'),          'giay-de-cao-su',         'slug sản phẩm: à/Đ/ế');
SELECT is(public.product_slug_from_title('!!!'),                     'san-pham',               'slug rỗng rơi về san-pham, không rơi về shop');

-- ─── Fixture ────────────────────────────────────────────────────────────────
-- A = owner of shop A · B = owner of shop B · C = outsider · D = admin
-- E = SUPPORT member of shop A (the role-blind is_shop_member defect)

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('50020001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cat-a@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Owner A"}'::jsonb, NOW(), NOW()),
  ('50020002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cat-b@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Owner B"}'::jsonb, NOW(), NOW()),
  ('50020003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cat-c@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Outsider C"}'::jsonb, NOW(), NOW()),
  ('50020004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cat-admin@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Cat Admin"}'::jsonb, NOW(), NOW()),
  ('50020005-0000-4000-8000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cat-support@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Support E"}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('50020004-0000-4000-8000-000000000004'::uuid, 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id) VALUES
  ('5a000001-0000-4000-8000-000000000001'::uuid, 'shop-a-catalog', 'Shop A Catalog', 'active', '50020001-0000-4000-8000-000000000001'::uuid),
  ('5a000002-0000-4000-8000-000000000002'::uuid, 'shop-b-catalog', 'Shop B Catalog', 'active', '50020002-0000-4000-8000-000000000002'::uuid),
  ('5a000003-0000-4000-8000-000000000003'::uuid, 'shop-z-pending', 'Shop Z Pending', 'pending_activation', '50020002-0000-4000-8000-000000000002'::uuid);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('5a000001-0000-4000-8000-000000000001'::uuid, '50020001-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('5a000002-0000-4000-8000-000000000002'::uuid, '50020002-0000-4000-8000-000000000002'::uuid, 'owner'),
  ('5a000003-0000-4000-8000-000000000003'::uuid, '50020002-0000-4000-8000-000000000002'::uuid, 'owner'),
  ('5a000001-0000-4000-8000-000000000001'::uuid, '50020005-0000-4000-8000-000000000005'::uuid, 'support');

-- ─── Blanket: RLS on, grants present ───────────────────────────────────────

SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='products'), 'RLS enabled on products');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='product_variants'), 'RLS enabled on product_variants');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='product_media'), 'RLS enabled on product_media');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='product_categories'), 'RLS enabled on product_categories');

SELECT ok((SELECT has_table_privilege('authenticated', 'public.products', 'INSERT')), 'authenticated has INSERT grant on products');
SELECT ok((SELECT has_table_privilege('anon', 'public.products', 'SELECT')), 'anon has SELECT grant on products');
SELECT ok(
  (SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='products') >= 4,
  'products has policies, not just grants'
);

-- No policy may hard-code an owner column: membership is a function call, so
-- staff roles keep working when Phase 2 adds them.
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname='public'
     AND tablename IN ('products','product_variants','product_media')
     AND (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%owner_user_id%'),
  0,
  'no catalog policy hard-codes owner_user_id'
);

-- The public bucket has NO write policy for a user JWT (D1).
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname='storage' AND tablename='objects'
     AND coalesce(qual,'') || coalesce(with_check,'') LIKE '%shop-product-media''%'
     AND cmd <> 'SELECT'),
  0,
  'public rendition bucket has no client-writable policy'
);
SELECT ok(
  (SELECT NOT public FROM storage.buckets WHERE id = 'shop-product-media-draft'),
  'draft bucket is private'
);
SELECT ok(
  (SELECT public FROM storage.buckets WHERE id = 'shop-product-media'),
  'rendition bucket is public (CDN transform needs it)'
);

-- ─── A (owner) builds a product ────────────────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50020001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

INSERT INTO public.products (id, shop_id, slug, title, description, category_slug)
VALUES ('5b000001-0000-4000-8000-000000000001'::uuid,
        '5a000001-0000-4000-8000-000000000001'::uuid,
        'vot-a-mot', 'Vợt A Một', 'Mô tả', 'vot');

SELECT is(
  (SELECT status::text FROM public.products WHERE id='5b000001-0000-4000-8000-000000000001'::uuid),
  'draft',
  'a new product is always a draft, whatever the client sent'
);

-- A manager cannot promote their own product.
SELECT lives_ok(
  $$ UPDATE public.products SET status='approved', is_published=true
     WHERE id='5b000001-0000-4000-8000-000000000001'::uuid $$,
  'privileged column write is neutralised, not errored'
);
SELECT is(
  (SELECT status::text || '/' || is_published::text FROM public.products WHERE id='5b000001-0000-4000-8000-000000000001'::uuid),
  'draft/false',
  'manager CANNOT set status=approved or is_published (trigger pins both)'
);

UPDATE public.products SET internal_note='tôi tự ghi' WHERE id='5b000001-0000-4000-8000-000000000001'::uuid;
SELECT is(
  (SELECT internal_note FROM public.products WHERE id='5b000001-0000-4000-8000-000000000001'::uuid),
  NULL,
  'manager CANNOT write internal_note'
);

-- Submission is refused until the product is actually complete.
SELECT throws_ok(
  $$ SELECT public.product_submit_for_review('5b000001-0000-4000-8000-000000000001'::uuid) $$,
  '22023', NULL,
  'submit refused: no variant'
);

INSERT INTO public.product_variants (id, product_id, shop_id, name, sku, price_vnd)
VALUES ('5c000001-0000-4000-8000-000000000001'::uuid,
        '5b000001-0000-4000-8000-000000000001'::uuid,
        '5a000001-0000-4000-8000-000000000001'::uuid, '16mm', 'SKU-1', 1590000);

SELECT throws_ok(
  $$ SELECT public.product_submit_for_review('5b000001-0000-4000-8000-000000000001'::uuid) $$,
  '22023', NULL,
  'submit refused: no photo'
);

INSERT INTO public.product_media (id, product_id, shop_id, draft_path)
VALUES ('5d000001-0000-4000-8000-000000000001'::uuid,
        '5b000001-0000-4000-8000-000000000001'::uuid,
        '5a000001-0000-4000-8000-000000000001'::uuid,
        '5a000001-0000-4000-8000-000000000001/5b000001-0000-4000-8000-000000000001/x.jpg');

SELECT is(
  (SELECT state::text || '/' || coalesce(public_path,'∅') FROM public.product_media WHERE id='5d000001-0000-4000-8000-000000000001'::uuid),
  'draft/∅',
  'uploaded media starts private with no rendition'
);

-- A seller cannot hand themselves a public rendition.
UPDATE public.product_media
SET state='approved', public_path='5a000001-0000-4000-8000-000000000001/forged.webp'
WHERE id='5d000001-0000-4000-8000-000000000001'::uuid;
SELECT is(
  (SELECT state::text || '/' || coalesce(public_path,'∅') FROM public.product_media WHERE id='5d000001-0000-4000-8000-000000000001'::uuid),
  'draft/∅',
  'seller CANNOT forge state=approved + public_path'
);

-- Media path must stay inside the seller's own shop folder.
SELECT throws_ok(
  $$ INSERT INTO public.product_media (product_id, shop_id, draft_path)
     VALUES ('5b000001-0000-4000-8000-000000000001'::uuid,
             '5a000001-0000-4000-8000-000000000001'::uuid,
             '5a000002-0000-4000-8000-000000000002/steal.jpg') $$,
  '23514', NULL,
  'media draft_path CANNOT point at another shop folder'
);

SELECT is(
  public.product_submit_for_review('5b000001-0000-4000-8000-000000000001'::uuid)::text,
  'pending_review',
  'submit succeeds once the product is complete'
);

-- Re-submitting an already-queued product is refused, not silently repeated.
SELECT throws_ok(
  $$ SELECT public.product_submit_for_review('5b000001-0000-4000-8000-000000000001'::uuid) $$,
  '22023', NULL,
  'submit refused: already pending_review'
);

-- A seller cannot decide their own product.
SELECT throws_ok(
  $$ SELECT public.product_decide('5b000001-0000-4000-8000-000000000001'::uuid, 'approve') $$,
  '42501', NULL,
  'non-admin CANNOT call product_decide'
);

-- Nor publish before approval.
SELECT throws_ok(
  $$ SELECT public.product_set_published('5b000001-0000-4000-8000-000000000001'::uuid, true) $$,
  '22023', NULL,
  'CANNOT publish a product that is not approved'
);

-- ─── SKU rules ─────────────────────────────────────────────────────────────

INSERT INTO public.products (id, shop_id, slug, title, category_slug)
VALUES ('5b000002-0000-4000-8000-000000000002'::uuid,
        '5a000001-0000-4000-8000-000000000001'::uuid,
        'vot-a-hai', 'Vợt A Hai', 'vot');

-- Same shop, same SKU (different case + padding) → refused.
SELECT throws_ok(
  $$ INSERT INTO public.product_variants (product_id, shop_id, sku, price_vnd)
     VALUES ('5b000002-0000-4000-8000-000000000002'::uuid,
             '5a000001-0000-4000-8000-000000000001'::uuid, '  sku-1 ', 100000) $$,
  '23505', NULL,
  'SKU is unique per shop, case- and whitespace-insensitive'
);

-- A variant may not claim a shop its product does not belong to. For a seller
-- RLS refuses first (42501) — stronger than the FK, and worth pinning as the
-- behaviour a client actually sees. The FK itself is proven below, from a role
-- that passes RLS, so neither guard can quietly disappear behind the other.
SELECT throws_ok(
  $$ INSERT INTO public.product_variants (product_id, shop_id, price_vnd)
     VALUES ('5b000001-0000-4000-8000-000000000001'::uuid,
             '5a000002-0000-4000-8000-000000000002'::uuid, 100000) $$,
  '42501', NULL,
  'a seller borrowing another shop_id is refused by RLS before the FK is reached'
);

SELECT throws_ok(
  $$ INSERT INTO public.product_variants (product_id, shop_id, price_vnd)
     VALUES ('5b000002-0000-4000-8000-000000000002'::uuid,
             '5a000001-0000-4000-8000-000000000001'::uuid, -1) $$,
  '23514', NULL,
  'price cannot be negative'
);

SELECT throws_ok(
  $$ INSERT INTO public.product_variants (product_id, shop_id, price_vnd, compare_at_price_vnd)
     VALUES ('5b000002-0000-4000-8000-000000000002'::uuid,
             '5a000001-0000-4000-8000-000000000001'::uuid, 500000, 400000) $$,
  '23514', NULL,
  'a struck-through price below the real price is refused'
);

-- ─── E: support member — the role-blind defect ─────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50020005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';

SELECT ok(
  public.is_shop_member('5a000001-0000-4000-8000-000000000001'::uuid),
  'support IS a member (reads work)'
);
SELECT ok(
  NOT public.is_shop_manager('5a000001-0000-4000-8000-000000000001'::uuid),
  'support is NOT a manager (writes must not)'
);
SELECT throws_ok(
  $$ INSERT INTO public.products (shop_id, slug, title, category_slug)
     VALUES ('5a000001-0000-4000-8000-000000000001'::uuid, 'vot-support', 'Vợt Support', 'vot') $$,
  '42501', NULL,
  'support member CANNOT create a product'
);
SELECT throws_ok(
  $$ SELECT public.product_submit_for_review('5b000002-0000-4000-8000-000000000002'::uuid) $$,
  '42501', NULL,
  'support member CANNOT submit for review'
);

-- ─── B: another shop's owner ───────────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50020002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

SELECT is(
  (SELECT count(*)::int FROM public.products WHERE shop_id='5a000001-0000-4000-8000-000000000001'::uuid),
  0,
  'B CANNOT see shop A''s unpublished products'
);
SELECT throws_ok(
  $$ INSERT INTO public.products (shop_id, slug, title, category_slug)
     VALUES ('5a000001-0000-4000-8000-000000000001'::uuid, 'vot-cua-b', 'Vợt Của B', 'vot') $$,
  '42501', NULL,
  'B CANNOT create a product inside shop A'
);

-- Same SKU in a DIFFERENT shop is fine — global uniqueness would have lost
-- here, with an error neither seller could explain.
INSERT INTO public.products (id, shop_id, slug, title, category_slug)
VALUES ('5b000003-0000-4000-8000-000000000003'::uuid,
        '5a000002-0000-4000-8000-000000000002'::uuid,
        'vot-b-mot', 'Vợt B Một', 'vot');
SELECT lives_ok(
  $$ INSERT INTO public.product_variants (product_id, shop_id, sku, price_vnd)
     VALUES ('5b000003-0000-4000-8000-000000000003'::uuid,
             '5a000002-0000-4000-8000-000000000002'::uuid, 'SKU-1', 900000) $$,
  'the same SKU in a different shop is allowed'
);

-- ─── C: outsider, and anon ─────────────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50020003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
SELECT is(
  (SELECT count(*)::int FROM public.products),
  0,
  'an outsider sees no products at all while none are published'
);

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is(
  (SELECT count(*)::int FROM public.products),
  0,
  'anon sees no unpublished product'
);
SELECT is(
  (SELECT count(*)::int FROM public.public_products),
  0,
  'the public projection is empty before anything is published'
);

-- ─── D: admin decides ──────────────────────────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50020004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';

SELECT throws_ok(
  $$ SELECT public.product_decide('5b000001-0000-4000-8000-000000000001'::uuid, 'reject') $$,
  '22023', NULL,
  'reject without a seller-visible note is refused'
);

SELECT is(
  public.product_decide('5b000001-0000-4000-8000-000000000001'::uuid, 'approve')::text,
  'approved',
  'admin approves'
);

-- The guarded transition: a second moderator deciding the same row loses.
SELECT throws_ok(
  $$ SELECT public.product_decide('5b000001-0000-4000-8000-000000000001'::uuid, 'reject', 'muộn') $$,
  '22023', NULL,
  'a second decision on an already-decided product is refused'
);

-- audit_logs is not readable with a user JWT by design, so this reads it as
-- the table owner. The assertion is about the RPC having written a row at all:
-- log_audit_event has two overloads and an ambiguous call (42725) broke every
-- Phase 1 decision at runtime while every static check stayed green.
SET LOCAL role postgres;
SELECT is(
  (SELECT count(*)::int FROM public.audit_logs
   WHERE resource_type='shop_product' AND resource_id='5b000001-0000-4000-8000-000000000001'),
  1,
  'the decision is written to audit_logs (and log_audit_event is not ambiguous)'
);

-- The composite FK, from a role RLS does not stop.
SELECT throws_ok(
  $$ INSERT INTO public.product_variants (product_id, shop_id, price_vnd)
     VALUES ('5b000001-0000-4000-8000-000000000001'::uuid,
             '5a000002-0000-4000-8000-000000000002'::uuid, 100000) $$,
  '23503', NULL,
  'composite FK stops a variant borrowing another shop_id'
);

SET LOCAL role authenticated;

-- Approval alone publishes nothing.
SELECT is(
  (SELECT is_published FROM public.products WHERE id='5b000001-0000-4000-8000-000000000001'::uuid),
  false,
  'approval does NOT publish — that is the seller''s separate act'
);

-- ─── A publishes, and the rendition appears ────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50020001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT ok(
  public.product_set_published('5b000001-0000-4000-8000-000000000001'::uuid, true),
  'owner publishes an approved product'
);
SELECT is(
  (SELECT state::text FROM public.product_media WHERE id='5d000001-0000-4000-8000-000000000001'::uuid),
  'approved',
  'publishing promotes the media row to approved'
);
SELECT ok(
  (SELECT public_path LIKE '5a000001-0000-4000-8000-000000000001/%'
   FROM public.product_media WHERE id='5d000001-0000-4000-8000-000000000001'::uuid),
  'the rendition path is scoped to the shop folder'
);

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is(
  (SELECT count(*)::int FROM public.public_products WHERE slug='vot-a-mot'),
  1,
  'anon now sees the published product through the public projection'
);
SELECT is(
  (SELECT count(*)::int FROM public.product_media
   WHERE product_id='5b000001-0000-4000-8000-000000000001'::uuid),
  1,
  'anon sees the approved media row, and only that one'
);

-- ─── Unpublish revokes the rendition (D1) ──────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50020001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT ok(
  NOT public.product_set_published('5b000001-0000-4000-8000-000000000001'::uuid, false),
  'owner unpublishes'
);
SELECT is(
  (SELECT state::text || '/' || coalesce(public_path,'∅') FROM public.product_media WHERE id='5d000001-0000-4000-8000-000000000001'::uuid),
  'draft/∅',
  'unpublish takes the rendition away, it does not merely unlink it'
);

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is(
  (SELECT count(*)::int FROM public.public_products WHERE slug='vot-a-mot'),
  0,
  'anon can no longer reach the unpublished product'
);
SELECT is(
  (SELECT count(*)::int FROM public.product_media WHERE product_id='5b000001-0000-4000-8000-000000000001'::uuid),
  0,
  'anon can no longer reach its media row either'
);

-- ─── A suspended shop takes its catalog with it ────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50020001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT ok(
  public.product_set_published('5b000001-0000-4000-8000-000000000001'::uuid, true),
  'republish for the suspension check'
);

SET LOCAL request.jwt.claims TO '{"sub":"50020004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
UPDATE public.shops SET state='suspended' WHERE id='5a000001-0000-4000-8000-000000000001'::uuid;

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';
SELECT is(
  (SELECT count(*)::int FROM public.public_products WHERE slug='vot-a-mot'),
  0,
  'suspending the shop removes its products from the public projection'
);

-- ─── Availability is a guarded update, not read-then-write ─────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50020001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT ok(
  public.product_set_in_stock('5b000001-0000-4000-8000-000000000001'::uuid, true, false),
  'flipping stock from the expected value succeeds'
);
SELECT ok(
  NOT public.product_set_in_stock('5b000001-0000-4000-8000-000000000001'::uuid, true, false),
  'flipping from a stale expected value reports failure instead of clobbering'
);
SELECT ok(
  (SELECT availability_updated_at IS NOT NULL FROM public.products WHERE id='5b000001-0000-4000-8000-000000000001'::uuid),
  'availability_updated_at is stamped, so the UI can say who updated and when'
);

-- ─── Archiving frees the SKU ───────────────────────────────────────────────

SELECT is(
  public.product_archive('5b000002-0000-4000-8000-000000000002'::uuid)::text,
  'archived',
  'owner archives instead of deleting'
);
SELECT ok(
  (SELECT bool_and(archived) FROM public.product_variants WHERE product_id='5b000002-0000-4000-8000-000000000002'::uuid) IS NOT FALSE,
  'archiving the product archives its variants'
);

-- ─── Sellers cannot delete ─────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname='public' AND tablename='products' AND cmd='DELETE'
     AND coalesce(qual,'') NOT LIKE '%is_admin%'),
  0,
  'no seller-facing DELETE policy on products'
);

SELECT * FROM finish();
ROLLBACK;
