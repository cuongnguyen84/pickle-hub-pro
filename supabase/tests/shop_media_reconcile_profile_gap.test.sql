-- B13 — the orphan sweep does not know shop profile media exists.
--
-- DIAGNOSTIC, found while working out what account deletion does to images.
-- It changes nothing; it pins current behaviour so the defect cannot be
-- rediscovered as a surprise on the day the cron first runs.
--
-- shop_media_reconcile() sweeps the PUBLIC bucket for objects that no live
-- media row points at, and asks exactly one table: product_media. Profile
-- media — a shop's logo and cover — arrived two migrations later
-- (20260811220000) and lives in the same bucket, and nothing went back to
-- teach the sweep about it.
--
-- So a published logo older than the one-hour grace is, by that function's
-- definition, an orphan. It gets queued for deletion while it is live on the
-- shop page.
--
-- It has never happened, for one reason only: the reconcile cron has never
-- been deployed anywhere (Packet C). The first environment to run it loses
-- every shop logo and cover an hour after upload. That makes this a Packet C
-- blocker rather than an incident.
--
-- 🔴 THE ASSERTIONS BELOW DESCRIBE A DEFECT. Fixing it means teaching the
-- sweep about shop_profile_media, and then inverting the last one.

BEGIN;

SELECT plan(4);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'b1300001-0000-4000-8000-0000000000b1'::uuid, '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'b13-owner@thepicklehub.test', '', NOW(),
  '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.shops (id, slug, name, owner_user_id, city, state)
VALUES ('b1300002-0000-4000-8000-0000000000b2'::uuid, 'b13-gap-shop', 'B13 Gap',
        'b1300001-0000-4000-8000-0000000000b1'::uuid, 'Hà Nội', 'active');

-- A logo in exactly the state shop_profile_media_commit leaves it in: verified,
-- published, serving.
INSERT INTO public.shop_profile_media (
  shop_id, purpose, draft_path, rendition_source_path, public_path,
  content_type, byte_size, width, height, verified_at
) VALUES (
  'b1300002-0000-4000-8000-0000000000b2'::uuid, 'logo',
  'b1300002-0000-4000-8000-0000000000b2/logo/draft.webp',
  'b1300002-0000-4000-8000-0000000000b2/logo/src.webp',
  'b1300002-0000-4000-8000-0000000000b2/logo/live.webp',
  'image/webp', 1000, 400, 400, now() - interval '2 hours');

-- The object itself, uploaded two hours ago — past the one-hour grace the
-- sweep leaves for uploads still in flight.
INSERT INTO storage.objects (bucket_id, name, owner, created_at, updated_at, metadata)
VALUES ('shop-product-media', 'b1300002-0000-4000-8000-0000000000b2/logo/live.webp',
        NULL, now() - interval '2 hours', now() - interval '2 hours', '{}'::jsonb);

SELECT is(
  (SELECT count(*)::int FROM public.shop_profile_media
    WHERE shop_id = 'b1300002-0000-4000-8000-0000000000b2'::uuid
      AND public_path IS NOT NULL AND verified_at IS NOT NULL),
  1,
  'the logo is published and verified — a live image, not a leftover');

SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs
    WHERE object_path = 'b1300002-0000-4000-8000-0000000000b2/logo/live.webp'),
  0,
  'nothing has queued it for deletion yet');

SELECT ok(
  (public.shop_media_reconcile() ->> 'orphans_queued')::int >= 1,
  'the sweep finds something to remove');

-- 🔴 The defect, stated as plainly as it can be stated.
SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs
    WHERE object_path = 'b1300002-0000-4000-8000-0000000000b2/logo/live.webp'
      AND reason = 'orphan'),
  1,
  'B13: the sweep queues a LIVE shop logo for deletion — invert this assertion when it learns about shop_profile_media');

SELECT * FROM finish();
ROLLBACK;
