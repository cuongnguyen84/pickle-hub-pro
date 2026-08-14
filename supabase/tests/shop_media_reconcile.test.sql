-- The orphan sweep, against both media domains — B13.
--
-- Replaces shop_media_reconcile_profile_gap.test.sql, which pinned the defect
-- and whose last assertion said to invert it once the sweep learned about
-- shop_profile_media. This is that inversion, plus the rest of the contract.
--
-- The fixture is one world containing every case the sweep has to tell apart,
-- because the interesting failures are not "does it delete an orphan" but
-- "does it delete an orphan AND leave the nine things next to it alone".
--
--   1  logo, live            2  cover, live          3  product original
--   4  product rendition,    5  profile original +    6  orphan, draft bucket
--      live and public          rendition source
--   7  orphan, public        8  object with an open   9  object mid-publish,
--      bucket                   cleanup job              plus one inside grace
--  10  an active shop and a suspended one
--
-- Everything runs as the migration role, which is what the cron does. No user
-- JWT is involved anywhere, and none is granted.

BEGIN;

SELECT plan(17);

-- ─── Fixture ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'b1300001-0000-4000-8000-0000000000b1'::uuid, '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'b13-owner@thepicklehub.test', '', NOW(),
  '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, NOW(), NOW());

-- 10. Two shops: one serving, one suspended.
INSERT INTO public.shops (id, slug, name, owner_user_id, city, state) VALUES
  ('b1300002-0000-4000-8000-0000000000b2'::uuid, 'b13-active', 'B13 Active',
   'b1300001-0000-4000-8000-0000000000b1'::uuid, 'Hà Nội', 'active'),
  ('b1300003-0000-4000-8000-0000000000b3'::uuid, 'b13-suspended', 'B13 Suspended',
   'b1300001-0000-4000-8000-0000000000b1'::uuid, 'Hà Nội', 'suspended');

INSERT INTO public.products (id, shop_id, slug, title, condition, status, is_published)
VALUES ('b1300004-0000-4000-8000-0000000000b4'::uuid,
        'b1300002-0000-4000-8000-0000000000b2'::uuid,
        'b13-vot', 'Vợt B13', 'new', 'approved', true);

-- 3 + 4. A published product image: original and rendition source in the draft
-- bucket, the versioned rendition live in the public bucket.
INSERT INTO public.product_media (
  id, product_id, shop_id, draft_path, rendition_source_path, public_path,
  content_type, verified_at, version, position, state
) VALUES (
  'b1300005-0000-4000-8000-0000000000b5'::uuid,
  'b1300004-0000-4000-8000-0000000000b4'::uuid,
  'b1300002-0000-4000-8000-0000000000b2'::uuid,
  'b1300002-0000-4000-8000-0000000000b2/b1300004-0000-4000-8000-0000000000b4/b1300005-0000-4000-8000-0000000000b5/original',
  'b1300002-0000-4000-8000-0000000000b2/b1300004-0000-4000-8000-0000000000b4/b1300005-0000-4000-8000-0000000000b5/rendition.webp',
  'b1300002-0000-4000-8000-0000000000b2/b1300004-0000-4000-8000-0000000000b4/b1300005-0000-4000-8000-0000000000b5-v1.webp',
  'image/webp', now() - interval '3 days', 1, 0, 'approved');

-- 9. A second image, verified but NOT yet committed: the worker has copied the
-- bytes to the deterministic key and product_publish_commit has not run. Old
-- code covered this with an hour of hope; the referenced set covers it exactly.
INSERT INTO public.product_media (
  id, product_id, shop_id, draft_path, rendition_source_path,
  content_type, verified_at, version, position, state
) VALUES (
  'b1300006-0000-4000-8000-0000000000b6'::uuid,
  'b1300004-0000-4000-8000-0000000000b4'::uuid,
  'b1300002-0000-4000-8000-0000000000b2'::uuid,
  'b1300002-0000-4000-8000-0000000000b2/b1300004-0000-4000-8000-0000000000b4/b1300006-0000-4000-8000-0000000000b6/original',
  'b1300002-0000-4000-8000-0000000000b2/b1300004-0000-4000-8000-0000000000b4/b1300006-0000-4000-8000-0000000000b6/rendition.webp',
  'image/webp', now() - interval '3 days', 2, 1, 'draft');

-- 1 + 2 + 5. Logo and cover on the active shop: original, rendition source and
-- a published public path — every column that can hold a key.
INSERT INTO public.shop_profile_media (
  id, shop_id, purpose, draft_path, rendition_source_path, public_path,
  content_type, verified_at, version
) VALUES
  ('b1300007-0000-4000-8000-0000000000b7'::uuid,
   'b1300002-0000-4000-8000-0000000000b2'::uuid, 'logo',
   'b1300002-0000-4000-8000-0000000000b2/profile/logo/v1/original',
   'b1300002-0000-4000-8000-0000000000b2/profile/logo/v1/rendition.webp',
   'b1300002-0000-4000-8000-0000000000b2/profile/logo/v1/live.webp',
   'image/webp', now() - interval '3 days', 1),
  ('b1300008-0000-4000-8000-0000000000b8'::uuid,
   'b1300002-0000-4000-8000-0000000000b2'::uuid, 'cover',
   'b1300002-0000-4000-8000-0000000000b2/profile/cover/v1/original',
   'b1300002-0000-4000-8000-0000000000b2/profile/cover/v1/rendition.webp',
   'b1300002-0000-4000-8000-0000000000b2/profile/cover/v1/live.webp',
   'image/webp', now() - interval '3 days', 1);

-- 10. The suspended shop keeps a logo whose original is still in the draft
-- bucket. Suspension is reversible, so the seller's source image must survive.
INSERT INTO public.shop_profile_media (
  id, shop_id, purpose, draft_path, rendition_source_path, public_path,
  content_type, verified_at, version
) VALUES (
  'b1300009-0000-4000-8000-0000000000b9'::uuid,
  'b1300003-0000-4000-8000-0000000000b3'::uuid, 'logo',
  'b1300003-0000-4000-8000-0000000000b3/profile/logo/v1/original',
  'b1300003-0000-4000-8000-0000000000b3/profile/logo/v1/rendition.webp',
  'b1300003-0000-4000-8000-0000000000b3/profile/logo/v1/live.webp',
  'image/webp', now() - interval '3 days', 1);

-- Take it off the public surface the way the product does. Called directly
-- rather than by flipping shops.state, because shops_guard_privileged_columns
-- silently reverts `state` unless is_admin() — a plain UPDATE here would be a
-- no-op and the revoke trigger would never fire. That trap is written into the
-- offboarding runbook for the same reason.
SELECT public.shop_profile_media_revoke('b1300003-0000-4000-8000-0000000000b3'::uuid);

-- ─── The objects themselves ─────────────────────────────────────────────────

INSERT INTO storage.objects (bucket_id, name, owner, created_at, updated_at, metadata)
VALUES
  -- draft bucket, all past the 24h grace
  ('shop-product-media-draft', 'b1300002-0000-4000-8000-0000000000b2/b1300004-0000-4000-8000-0000000000b4/b1300005-0000-4000-8000-0000000000b5/original',       NULL, now() - interval '3 days', now(), '{}'::jsonb),
  ('shop-product-media-draft', 'b1300002-0000-4000-8000-0000000000b2/b1300004-0000-4000-8000-0000000000b4/b1300005-0000-4000-8000-0000000000b5/rendition.webp', NULL, now() - interval '3 days', now(), '{}'::jsonb),
  ('shop-product-media-draft', 'b1300002-0000-4000-8000-0000000000b2/profile/logo/v1/original',        NULL, now() - interval '3 days', now(), '{}'::jsonb),
  ('shop-product-media-draft', 'b1300002-0000-4000-8000-0000000000b2/profile/logo/v1/rendition.webp',  NULL, now() - interval '3 days', now(), '{}'::jsonb),
  ('shop-product-media-draft', 'b1300002-0000-4000-8000-0000000000b2/profile/cover/v1/original',       NULL, now() - interval '3 days', now(), '{}'::jsonb),
  ('shop-product-media-draft', 'b1300003-0000-4000-8000-0000000000b3/profile/logo/v1/original',        NULL, now() - interval '3 days', now(), '{}'::jsonb),
  -- 6. a genuine draft orphan: an upload_init whose upload never finished, or
  -- a row deleted underneath it
  ('shop-product-media-draft', 'b1300002-0000-4000-8000-0000000000b2/mo-coi/nhap/original',            NULL, now() - interval '3 days', now(), '{}'::jsonb),

  -- public bucket, all past the 1h grace
  ('shop-product-media', 'b1300002-0000-4000-8000-0000000000b2/b1300004-0000-4000-8000-0000000000b4/b1300005-0000-4000-8000-0000000000b5-v1.webp', NULL, now() - interval '3 days', now(), '{}'::jsonb),
  -- 9. mid-publish: bytes at the deterministic key, commit has not run
  ('shop-product-media', 'b1300002-0000-4000-8000-0000000000b2/b1300004-0000-4000-8000-0000000000b4/b1300006-0000-4000-8000-0000000000b6-v2.webp', NULL, now() - interval '3 days', now(), '{}'::jsonb),
  ('shop-product-media', 'b1300002-0000-4000-8000-0000000000b2/profile/logo/v1/live.webp',  NULL, now() - interval '3 days', now(), '{}'::jsonb),
  ('shop-product-media', 'b1300002-0000-4000-8000-0000000000b2/profile/cover/v1/live.webp', NULL, now() - interval '3 days', now(), '{}'::jsonb),
  -- the suspended shop's revoked rendition: unreferenced now, but already has
  -- an open job from the revoke above
  ('shop-product-media', 'b1300003-0000-4000-8000-0000000000b3/profile/logo/v1/live.webp',  NULL, now() - interval '3 days', now(), '{}'::jsonb),
  -- 7. a genuine public orphan
  ('shop-product-media', 'b1300002-0000-4000-8000-0000000000b2/mo-coi/cong-khai.webp',      NULL, now() - interval '3 days', now(), '{}'::jsonb),
  -- 9b. inside the grace window: a copy that may still be in flight
  ('shop-product-media', 'b1300002-0000-4000-8000-0000000000b2/vua-moi/copy.webp',          NULL, now() - interval '5 minutes', now(), '{}'::jsonb);

-- 8. An object already queued by an earlier revocation. It must not be counted
-- or queued a second time.
SELECT public.shop_media_enqueue_cleanup(
  'shop-product-media', 'b1300002-0000-4000-8000-0000000000b2/da-xep-hang.webp',
  'b1300002-0000-4000-8000-0000000000b2'::uuid, NULL, NULL, 'unpublish');
INSERT INTO storage.objects (bucket_id, name, owner, created_at, updated_at, metadata)
VALUES ('shop-product-media', 'b1300002-0000-4000-8000-0000000000b2/da-xep-hang.webp',
        NULL, now() - interval '3 days', now(), '{}'::jsonb);

CREATE TEMP TABLE t_b13 (k TEXT PRIMARY KEY, v INTEGER);

-- ─── The definition itself ──────────────────────────────────────────────────

SELECT ok(
  EXISTS (SELECT 1 FROM public.shop_media_referenced_objects()
           WHERE object_path = 'b1300002-0000-4000-8000-0000000000b2/profile/logo/v1/original'),
  'the referenced set knows a logo original exists — the whole of B13 in one row');

SELECT ok(
  EXISTS (SELECT 1 FROM public.shop_media_referenced_objects()
           WHERE object_path = 'b1300002-0000-4000-8000-0000000000b2/b1300004-0000-4000-8000-0000000000b4/b1300006-0000-4000-8000-0000000000b6-v2.webp'),
  'and the key an uncommitted publish is copying to, computed the same way product_publish_prepare computes it');

-- ─── First sweep ────────────────────────────────────────────────────────────

INSERT INTO t_b13 SELECT 'first', (public.shop_media_reconcile() ->> 'orphans_queued')::int;

SELECT is((SELECT v FROM t_b13 WHERE k = 'first'), 2,
  'exactly two objects are orphans — one per bucket, and nothing else');

SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs
    WHERE reason = 'orphan' AND object_path = 'b1300002-0000-4000-8000-0000000000b2/mo-coi/nhap/original'),
  1, 'the draft orphan is queued');

SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs
    WHERE reason = 'orphan' AND object_path = 'b1300002-0000-4000-8000-0000000000b2/mo-coi/cong-khai.webp'),
  1, 'the public orphan is queued');

-- ─── Nothing live was touched ───────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs j
    WHERE j.object_path IN (
      'b1300002-0000-4000-8000-0000000000b2/profile/logo/v1/live.webp',
      'b1300002-0000-4000-8000-0000000000b2/profile/cover/v1/live.webp')),
  0, 'a published logo and cover are not queued — the assertion B13 existed to invert');

SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs j
    WHERE j.object_path IN (
      'b1300002-0000-4000-8000-0000000000b2/profile/logo/v1/original',
      'b1300002-0000-4000-8000-0000000000b2/profile/logo/v1/rendition.webp',
      'b1300002-0000-4000-8000-0000000000b2/profile/cover/v1/original')),
  0, 'nor their originals and rendition sources in the draft bucket — the case that was reachable today');

SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs j
    WHERE j.object_path LIKE '%b1300005-0000-4000-8000-0000000000b5%'),
  0, 'a live product image is untouched in both buckets');

SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs j
    WHERE j.object_path = 'b1300002-0000-4000-8000-0000000000b2/b1300004-0000-4000-8000-0000000000b4/b1300006-0000-4000-8000-0000000000b6-v2.webp'),
  0, 'a rendition mid-publish is not deleted underneath the commit that is about to point at it');

SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs j
    WHERE j.object_path = 'b1300002-0000-4000-8000-0000000000b2/vua-moi/copy.webp'),
  0, 'an object inside the grace window is left alone');

SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs j
    WHERE j.object_path = 'b1300003-0000-4000-8000-0000000000b3/profile/logo/v1/original'),
  0, 'a SUSPENDED shop keeps its source images — suspension is reversible, deletion is not');

-- ─── The suspended shop''s public object: revoked, queued once, not twice ───

SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs j
    WHERE j.object_path = 'b1300003-0000-4000-8000-0000000000b3/profile/logo/v1/live.webp'),
  1, 'the revoked public rendition has exactly one job');

SELECT is(
  (SELECT reason FROM public.shop_media_cleanup_jobs
    WHERE object_path = 'b1300003-0000-4000-8000-0000000000b3/profile/logo/v1/live.webp'),
  'unpublish',
  'and it keeps the reason the lifecycle gave it — the sweep did not relabel it as an orphan');

SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs
    WHERE object_path = 'b1300002-0000-4000-8000-0000000000b2/da-xep-hang.webp'),
  1, 'an object with an open job is not queued a second time');

-- ─── Idempotent ─────────────────────────────────────────────────────────────

INSERT INTO t_b13 SELECT 'jobs_after_first', count(*)::int FROM public.shop_media_cleanup_jobs;
INSERT INTO t_b13 SELECT 'second', (public.shop_media_reconcile() ->> 'orphans_queued')::int;

SELECT is((SELECT v FROM t_b13 WHERE k = 'second'), 0,
  'running it again finds nothing new');

SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs),
  (SELECT v FROM t_b13 WHERE k = 'jobs_after_first'),
  'and adds no rows — replay is a no-op, not a duplicate');

-- ─── The response says nothing it should not ────────────────────────────────

SELECT is(
  (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(public.shop_media_reconcile()) k),
  'orphans_queued,unstuck',
  'the result is two counts — no object path ever reaches an ops log through it');

SELECT * FROM finish();
ROLLBACK;
