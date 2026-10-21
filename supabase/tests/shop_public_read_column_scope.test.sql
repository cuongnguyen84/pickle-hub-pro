-- Wave 0 found the anon key reading sku + stock_on_hand (and internal_note,
-- decided_by, draft_path) straight off the catalog TABLES: RLS scopes rows,
-- never columns, and the `TO public` policies existed only so the invoker
-- view could work. These assertions pin the fix (20260815090000): the base
-- tables carry no public policy and no anon grant AT ALL, and the definer
-- view is the only anonymous read. Re-granting anon or re-adding a public
-- policy — the one-liner that reopens the hole — turns this file red.
--
-- That sweep listed three tables and forgot the fourth. `shops` kept its anon
-- grant until 20260818130000, and a probe against production returned
-- owner_user_id for the live storefront. The shops assertions live HERE rather
-- than in a file of their own precisely because this file was the guard that
-- was supposed to catch it: a table missing from the list is the failure mode.

BEGIN;

SELECT plan(16);

-- ─── Fixture: one active shop, one published product, real private values ───

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('50030001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'colscope-owner@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('50030002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'colscope-buyer@thepicklehub.test', '', NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.shops (id, slug, name, state, owner_user_id)
VALUES ('70030001-0000-4000-8000-000000000001'::uuid, 'colscope-shop', 'Colscope Shop', 'active',
        '50030001-0000-4000-8000-000000000001'::uuid);
INSERT INTO public.shop_members (shop_id, user_id, role)
VALUES ('70030001-0000-4000-8000-000000000001'::uuid, '50030001-0000-4000-8000-000000000001'::uuid, 'owner');

-- The insert-defaults trigger pins new rows to draft/unpublished no matter
-- what the INSERT claims, so the published state is written the way the
-- decide/publish RPCs write it: under the privileged flag.
INSERT INTO public.products (id, shop_id, slug, title, category_slug)
VALUES ('60030001-0000-4000-8000-000000000001'::uuid, '70030001-0000-4000-8000-000000000001'::uuid,
        'colscope-vot', 'Vợt colscope', 'vot');
SELECT set_config('shop.privileged_write', 'on', true);
UPDATE public.products
SET status = 'approved', is_published = true, internal_note = 'pgTAP moderator-only note 4737'
WHERE id = '60030001-0000-4000-8000-000000000001'::uuid;
SELECT set_config('shop.privileged_write', 'off', true);

INSERT INTO public.product_variants (id, product_id, shop_id, price_vnd, stock_on_hand, sku)
VALUES ('61030001-0000-4000-8000-000000000001'::uuid, '60030001-0000-4000-8000-000000000001'::uuid,
        '70030001-0000-4000-8000-000000000001'::uuid, 4737000, 4737, 'COLSCOPE-4737');

-- ─── The grant layer ────────────────────────────────────────────────────────

SELECT is(has_table_privilege('anon', 'public.products',         'SELECT'), false, 'anon holds no SELECT on products');
SELECT is(has_table_privilege('anon', 'public.product_variants', 'SELECT'), false, 'anon holds no SELECT on product_variants');
SELECT is(has_table_privilege('anon', 'public.product_media',    'SELECT'), false, 'anon holds no SELECT on product_media');
SELECT is(has_table_privilege('anon', 'public.shops',            'SELECT'), false, 'anon holds no SELECT on shops');

SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE tablename IN ('products', 'product_variants', 'product_media')
     AND policyname LIKE '%select_public%'),
  0,
  'the TO-public base-table policies are gone'
);

-- ─── The anonymous request, as PostgREST would run it ───────────────────────

SET LOCAL role anon;

SELECT throws_ok($$ SELECT sku, stock_on_hand FROM public.product_variants $$, '42501', NULL,
  'the Wave-0 probe (sku + stock via anon) is refused outright');
SELECT throws_ok($$ SELECT internal_note, decided_by FROM public.products $$, '42501', NULL,
  'internal_note / decided_by are unreachable for anon');
SELECT throws_ok($$ SELECT draft_path FROM public.product_media $$, '42501', NULL,
  'draft paths are unreachable for anon');
SELECT throws_ok($$ SELECT owner_user_id FROM public.shops $$, '42501', NULL,
  'the storefront no longer hands anon a join key into profiles');

-- The public storefront still works — through the allowlist, as designed.
SELECT is(
  public.shop_public_shop('colscope-shop') -> 'found',
  'true'::jsonb,
  'the definer RPC still serves the active shop to anon'
);
SELECT ok(
  NOT (public.shop_public_shop('colscope-shop') -> 'shop' ? 'owner_user_id'),
  'and its allowlist carries no owner_user_id'
);

SELECT is(
  (SELECT count(*)::int FROM public.public_products WHERE slug = 'colscope-vot'),
  1,
  'the definer view still serves the published product to anon'
);
SELECT is(
  (SELECT count(*)::int FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'public_products'
     AND column_name IN ('internal_note', 'decided_by', 'stock_on_hand', 'draft_path')),
  0,
  'and its column list carries none of the private fields'
);

-- ─── A signed-in stranger: zero rows, not an error, and never the values ────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50030002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

SELECT is((SELECT count(*)::int FROM public.products), 0, 'a signed-in non-member sees zero product rows');
SELECT is((SELECT count(*)::int FROM public.product_variants), 0, 'and zero variant rows');

-- ─── The owner still runs their shop ────────────────────────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50030001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT is(
  (SELECT stock_on_hand FROM public.product_variants WHERE sku = 'COLSCOPE-4737'),
  4737,
  'the owner still reads their own stock through the member policy'
);

SELECT * FROM finish();
ROLLBACK;
