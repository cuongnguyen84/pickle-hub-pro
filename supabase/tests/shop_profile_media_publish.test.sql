-- ============================================================================
-- Shop profile media — the publish leg (round 5, migration 20260817090000).
--
-- What this file is really asking:
--   * can anyone but a manager get a copies plan for a shop's logo/cover;
--   * can a plan be made — or committed — for a shop that is not live;
--   * can a STALE plan (v1 key after a re-upload to v2) overwrite the pointer;
--   * does commit clear the pending cleanup job that would otherwise delete
--     the freshly published object (suspend → reactivate → republish race);
--   * does shop_public_shop expose exactly the published paths — never a
--     verified-but-unpublished one — while keeping every pre-existing key and
--     the suspended-shop anti-enumeration answer byte-identical;
--   * does the orphan-sweep allowlist reserve the deterministic pending target
--     computed the same way prepare computes it.
-- ============================================================================

BEGIN;

SELECT plan(20);

-- ─── Fixture ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('a5000001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'r5-owner@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('a5000002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'r5-rival@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.shops (id, slug, name, state, owner_user_id) VALUES
  -- A: active, will get a published logo (v2) + cover (v1, focal 0.25).
  ('a5100001-0000-4000-8000-000000000001'::uuid, 'r5-shop-anh',   'R5 Shop Ảnh',   'active',
   'a5000001-0000-4000-8000-000000000001'::uuid),
  -- B: active, logo verified but never published.
  ('a5100002-0000-4000-8000-000000000002'::uuid, 'r5-shop-tho',   'R5 Shop Thô',   'active',
   'a5000001-0000-4000-8000-000000000001'::uuid),
  -- C: active, no profile media at all.
  ('a5100003-0000-4000-8000-000000000003'::uuid, 'r5-shop-trong', 'R5 Shop Trống', 'active',
   'a5000001-0000-4000-8000-000000000001'::uuid),
  -- D: suspended, with a verified logo — the prepare/commit refusals.
  ('a5100004-0000-4000-8000-000000000004'::uuid, 'r5-shop-treo',  'R5 Shop Treo',  'suspended',
   'a5000001-0000-4000-8000-000000000001'::uuid);

INSERT INTO public.shop_members (shop_id, user_id, role)
SELECT s.id, 'a5000001-0000-4000-8000-000000000001'::uuid, 'owner'
FROM public.shops s WHERE s.slug LIKE 'r5-shop-%';

-- Verified rows, inserted at the point finalize leaves them: verified_at set,
-- public_path still NULL. The logo sits at VERSION 2 so the stale-plan test
-- has a real v1 key to be refused with.
INSERT INTO public.shop_profile_media (
  id, shop_id, purpose, draft_path, rendition_source_path,
  content_type, verified_at, version, focal_y
) VALUES
  ('a5200001-0000-4000-8000-000000000001'::uuid, 'a5100001-0000-4000-8000-000000000001'::uuid, 'logo',
   'a5100001-0000-4000-8000-000000000001/profile/logo/a5200001-0000-4000-8000-000000000001/v2/original',
   'a5100001-0000-4000-8000-000000000001/profile/logo/a5200001-0000-4000-8000-000000000001/v2/rendition.webp',
   'image/webp', now(), 2, 0.5),
  ('a5200002-0000-4000-8000-000000000002'::uuid, 'a5100001-0000-4000-8000-000000000001'::uuid, 'cover',
   'a5100001-0000-4000-8000-000000000001/profile/cover/a5200002-0000-4000-8000-000000000002/v1/original',
   'a5100001-0000-4000-8000-000000000001/profile/cover/a5200002-0000-4000-8000-000000000002/v1/rendition.webp',
   'image/webp', now(), 1, 0.25),
  ('a5200003-0000-4000-8000-000000000003'::uuid, 'a5100002-0000-4000-8000-000000000002'::uuid, 'logo',
   'a5100002-0000-4000-8000-000000000002/profile/logo/a5200003-0000-4000-8000-000000000003/v1/original',
   'a5100002-0000-4000-8000-000000000002/profile/logo/a5200003-0000-4000-8000-000000000003/v1/rendition.webp',
   'image/webp', now(), 1, 0.5),
  ('a5200004-0000-4000-8000-000000000004'::uuid, 'a5100004-0000-4000-8000-000000000004'::uuid, 'logo',
   'a5100004-0000-4000-8000-000000000004/profile/logo/a5200004-0000-4000-8000-000000000004/v1/original',
   'a5100004-0000-4000-8000-000000000004/profile/logo/a5200004-0000-4000-8000-000000000004/v1/rendition.webp',
   'image/webp', now(), 1, 0.5);

-- ─── Who may even ask ───────────────────────────────────────────────────────

SELECT ok(
  NOT has_function_privilege('anon', 'public.shop_profile_media_publish_prepare(uuid)', 'EXECUTE'),
  'anon cannot ask for a copies plan at all');

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.shop_profile_media_publish_commit(uuid, text)', 'EXECUTE'),
  'commit stays service_role only — a user JWT can never set public_path');

-- ─── Prepare, under the caller''s own JWT ───────────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"a5000001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT is(
  public.shop_profile_media_publish_prepare('a5100001-0000-4000-8000-000000000001'::uuid) -> 'copies',
  jsonb_build_array(
    jsonb_build_object(
      'media_id', 'a5200001-0000-4000-8000-000000000001',
      'source', 'a5100001-0000-4000-8000-000000000001/profile/logo/a5200001-0000-4000-8000-000000000001/v2/rendition.webp',
      'target', 'a5100001-0000-4000-8000-000000000001/profile/logo/a5200001-0000-4000-8000-000000000001/v2/live.webp'),
    jsonb_build_object(
      'media_id', 'a5200002-0000-4000-8000-000000000002',
      'source', 'a5100001-0000-4000-8000-000000000001/profile/cover/a5200002-0000-4000-8000-000000000002/v1/rendition.webp',
      'target', 'a5100001-0000-4000-8000-000000000001/profile/cover/a5200002-0000-4000-8000-000000000002/v1/live.webp')),
  'the plan carries every verified row with its deterministic versioned target');

SELECT is(
  (SELECT (r ->> 'draft_bucket') || '|' || (r ->> 'public_bucket')
   FROM public.shop_profile_media_publish_prepare('a5100001-0000-4000-8000-000000000001'::uuid) r),
  'shop-product-media-draft|shop-product-media',
  'the buckets come from shop_media_limits, not from the client');

SELECT throws_ok(
  $$ SELECT public.shop_profile_media_publish_prepare('a5100004-0000-4000-8000-000000000004'::uuid) $$,
  '22023', NULL,
  'a suspended shop gets no plan — publishing needs a live public face');

SELECT throws_ok(
  $$ SELECT public.shop_profile_media_publish_prepare('a5100003-0000-4000-8000-000000000003'::uuid) $$,
  '22023', NULL,
  'a shop with nothing verified gets told so, not an empty plan');

SET LOCAL request.jwt.claims TO '{"sub":"a5000002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

SELECT throws_ok(
  $$ SELECT public.shop_profile_media_publish_prepare('a5100001-0000-4000-8000-000000000001'::uuid) $$,
  '42501', NULL,
  'a non-manager gets no copy plan for somebody else''s shop');

SET LOCAL role postgres;

-- ─── Commit: the worker''s half ─────────────────────────────────────────────

-- The stale-plan race: the row is at v2; a delayed commit of the v1 key must
-- fail rather than point the live logo at yesterday's object.
SELECT throws_ok(
  $$ SELECT public.shop_profile_media_publish_commit(
       'a5200001-0000-4000-8000-000000000001'::uuid,
       'a5100001-0000-4000-8000-000000000001/profile/logo/a5200001-0000-4000-8000-000000000001/v1/live.webp') $$,
  '22023', NULL,
  'a target for a superseded version is refused — the stale-plan race is closed');

-- Suspend → reactivate → republish: an unpublish job for this very key is
-- still pending. Commit must clear it in the same transaction, or the cleanup
-- worker deletes the object minutes after a successful publish.
SELECT public.shop_media_enqueue_cleanup(
  'shop-product-media',
  'a5100001-0000-4000-8000-000000000001/profile/logo/a5200001-0000-4000-8000-000000000001/v2/live.webp',
  'a5100001-0000-4000-8000-000000000001'::uuid, NULL,
  'a5200001-0000-4000-8000-000000000001'::uuid, 'unpublish');

SELECT ok(
  public.shop_profile_media_publish_commit(
    'a5200001-0000-4000-8000-000000000001'::uuid,
    'a5100001-0000-4000-8000-000000000001/profile/logo/a5200001-0000-4000-8000-000000000001/v2/live.webp'),
  'the current version''s key commits');

SELECT is(
  (SELECT public_path FROM public.shop_profile_media
   WHERE id = 'a5200001-0000-4000-8000-000000000001'::uuid),
  'a5100001-0000-4000-8000-000000000001/profile/logo/a5200001-0000-4000-8000-000000000001/v2/live.webp',
  'and the pointer now names exactly that object');

SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs
   WHERE object_path = 'a5100001-0000-4000-8000-000000000001/profile/logo/a5200001-0000-4000-8000-000000000001/v2/live.webp'
     AND state <> 'done'),
  0, 'the pending cleanup job for the committed key died in the same transaction');

SELECT ok(
  public.shop_profile_media_publish_commit(
    'a5200001-0000-4000-8000-000000000001'::uuid,
    'a5100001-0000-4000-8000-000000000001/profile/logo/a5200001-0000-4000-8000-000000000001/v2/live.webp'),
  'a retried commit of the same key is idempotent, not an error');

SELECT ok(
  public.shop_profile_media_publish_commit(
    'a5200002-0000-4000-8000-000000000002'::uuid,
    'a5100001-0000-4000-8000-000000000001/profile/cover/a5200002-0000-4000-8000-000000000002/v1/live.webp'),
  'the cover commits independently of the logo');

-- The prepare-then-suspend window, from commit's side.
SELECT throws_ok(
  $$ SELECT public.shop_profile_media_publish_commit(
       'a5200004-0000-4000-8000-000000000004'::uuid,
       'a5100004-0000-4000-8000-000000000004/profile/logo/a5200004-0000-4000-8000-000000000004/v1/live.webp') $$,
  '22023', NULL,
  'commit refuses once the shop is no longer active, even with the right key');

-- ─── The orphan-sweep allowlist reserves the pending target ─────────────────

SELECT ok(
  EXISTS (SELECT 1 FROM public.shop_media_referenced_objects()
          WHERE bucket_id = 'shop-product-media'
            AND object_path = 'a5100002-0000-4000-8000-000000000002/profile/logo/a5200003-0000-4000-8000-000000000003/v1/live.webp'),
  'a verified-but-unpublished logo''s deterministic target is referenced — computed the same way prepare computes it');

-- ─── What the public reader now says ────────────────────────────────────────

SET LOCAL role anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';

SELECT is(
  public.shop_public_shop('r5-shop-anh') #>> '{shop,logo_path}',
  'a5100001-0000-4000-8000-000000000001/profile/logo/a5200001-0000-4000-8000-000000000001/v2/live.webp',
  'a published logo path reaches the public shop payload');

SELECT ok(
  (public.shop_public_shop('r5-shop-anh') #>> '{shop,cover_path}')
    = 'a5100001-0000-4000-8000-000000000001/profile/cover/a5200002-0000-4000-8000-000000000002/v1/live.webp'
  AND (public.shop_public_shop('r5-shop-anh') #>> '{shop,cover_focal_y}')::numeric = 0.25,
  'so do the cover path and its focal framing');

SELECT ok(
  (public.shop_public_shop('r5-shop-tho') #> '{shop,logo_path}') = 'null'::jsonb
  AND (public.shop_public_shop('r5-shop-tho') #> '{shop,cover_path}') = 'null'::jsonb
  AND (public.shop_public_shop('r5-shop-tho') #> '{shop,cover_focal_y}') = 'null'::jsonb,
  'verified-but-unpublished media is NOT exposed — public_path is the only wall SECURITY DEFINER leaves standing');

SELECT is(
  (SELECT string_agg(k, ',' ORDER BY k)
   FROM jsonb_object_keys(public.shop_public_shop('r5-shop-trong') -> 'shop') k),
  'cover_focal_y,cover_path,intro,logo_path,name,primary_category_slug,product_count,region,return_note,shipping_note,slug,verified,verified_at',
  'the three image keys were ADDED — every pre-existing key of the contract survives, none renamed');

SELECT is(
  public.shop_public_shop('r5-shop-treo'),
  public.shop_public_shop('r5-khong-he-ton-tai'),
  'a suspended shop still answers exactly like one that never existed');

SELECT * FROM finish();
ROLLBACK;
