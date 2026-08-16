-- Shop media — JPEG rendition fallback (iOS Safari, 2026-08-16).
--
-- iOS Safari cannot encode WebP through a canvas, so the client falls back to
-- JPEG. This file is the POSITIVE half of the widened contract: a rendition
-- whose storage.objects mimetype is image/jpeg finalizes for both product and
-- profile media, while everything outside the {webp, jpeg} allowlist is still
-- refused. The negative "client lies about re-encoding" case stays in
-- shop_phase2a_media_lifecycle.test.sql (now on image/png).
--
-- The object key keeps its .webp suffix even when the bytes are JPEG:
-- extension is a claim; the MIME in storage.objects is the truth.

BEGIN;

SELECT plan(9);

-- ─── Fixture ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('50040001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'jpeg-owner@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Jpeg Owner"}'::jsonb, NOW(), NOW());

INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('50040001-0000-4000-8000-000000000001'::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id) VALUES
  ('6c000001-0000-4000-8000-000000000001'::uuid, 'jpeg-shop', 'Jpeg Shop', 'active',
   '50040001-0000-4000-8000-000000000001'::uuid);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('6c000001-0000-4000-8000-000000000001'::uuid, '50040001-0000-4000-8000-000000000001'::uuid, 'owner');

INSERT INTO public.products (id, shop_id, slug, title, description, category_slug, status) VALUES
  ('6d000001-0000-4000-8000-000000000001'::uuid, '6c000001-0000-4000-8000-000000000001'::uuid,
   'jpeg-prod', 'Jpeg Prod', 'Mô tả JPEG', 'vot', 'draft');

-- ─── The allowlist itself ───────────────────────────────────────────────────

SELECT ok(
  (public.shop_media_limits() -> 'rendition_content_types') ? 'image/webp'
  AND (public.shop_media_limits() -> 'rendition_content_types') ? 'image/jpeg'
  -- length too, or "exactly the two" would still pass with a third entry
  AND jsonb_array_length(public.shop_media_limits() -> 'rendition_content_types') = 2,
  'the rendition allowlist holds exactly the two canvas outputs: webp and jpeg'
);
SELECT is(
  public.shop_media_limits() ->> 'rendition_content_type',
  'image/webp',
  'the singular preferred-type key survives for readers that predate the list'
);

-- ─── Product media: a JPEG rendition finalizes ──────────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50040001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

CREATE TEMP TABLE _initj AS SELECT public.product_media_upload_init(
  '6d000001-0000-4000-8000-000000000001'::uuid, 'image/jpeg', 3000000,
  'anh-iphone.jpg', 'tok-JPG') AS r;

SELECT ok(
  (SELECT (r ->> 'rendition_path') LIKE '%.webp' FROM _initj),
  'the object key keeps its .webp suffix even though the bytes will be JPEG'
);

SET LOCAL role postgres;
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'shop-product-media-draft', draft_path,
       jsonb_build_object('size', 3000000, 'mimetype', 'image/jpeg')
FROM public.product_media WHERE client_token='tok-JPG';
-- iOS Safari's canvas output: a JPEG under the .webp key, honestly declared.
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'shop-product-media-draft', rendition_source_path,
       jsonb_build_object('size', 240000, 'mimetype', 'image/jpeg')
FROM public.product_media WHERE client_token='tok-JPG';
SET LOCAL role authenticated;

SELECT ok(
  (public.product_media_finalize(
     (SELECT id FROM public.product_media WHERE client_token='tok-JPG'), 1200, 900) ->> 'verified')::boolean,
  'a JPEG rendition finalizes — the iOS Safari seller can upload again'
);
SELECT is(
  (SELECT byte_size FROM public.product_media WHERE client_token='tok-JPG'),
  240000,
  'byte_size is still read back from storage, never taken from the client'
);

-- ─── The allowlist is two entries, not a hole ───────────────────────────────

CREATE TEMP TABLE _initg AS SELECT public.product_media_upload_init(
  '6d000001-0000-4000-8000-000000000001'::uuid, 'image/jpeg', 3000000,
  'anh-2.jpg', 'tok-GIF') AS r;

SET LOCAL role postgres;
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'shop-product-media-draft', draft_path,
       jsonb_build_object('size', 3000000, 'mimetype', 'image/jpeg')
FROM public.product_media WHERE client_token='tok-GIF';
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'shop-product-media-draft', rendition_source_path,
       jsonb_build_object('size', 240000, 'mimetype', 'image/gif')
FROM public.product_media WHERE client_token='tok-GIF';
SET LOCAL role authenticated;

SELECT throws_ok(
  $$ SELECT public.product_media_finalize((SELECT id FROM public.product_media WHERE client_token='tok-GIF')) $$,
  '22023', NULL,
  'a GIF rendition is still refused — widening to JPEG did not open the gate'
);

-- ─── Profile media: logo/cover takes the same fallback ──────────────────────

CREATE TEMP TABLE _initp AS SELECT public.shop_profile_media_upload_init(
  '6c000001-0000-4000-8000-000000000001'::uuid, 'logo', 'image/jpeg', 2000000,
  'logo.jpg', 'tok-LOGO') AS r;

SELECT ok(
  (SELECT (r ->> 'rendition_path') LIKE '%.webp' FROM _initp),
  'the profile rendition key keeps its .webp suffix too'
);

SET LOCAL role postgres;
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'shop-product-media-draft', draft_path,
       jsonb_build_object('size', 2000000, 'mimetype', 'image/jpeg')
FROM public.shop_profile_media WHERE client_token='tok-LOGO';
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'shop-product-media-draft', rendition_source_path,
       jsonb_build_object('size', 180000, 'mimetype', 'image/jpeg')
FROM public.shop_profile_media WHERE client_token='tok-LOGO';
SET LOCAL role authenticated;

SELECT ok(
  (public.shop_profile_media_finalize(
     (SELECT id FROM public.shop_profile_media WHERE client_token='tok-LOGO'), 512, 512) ->> 'verified')::boolean,
  'a JPEG logo rendition finalizes'
);
SELECT is(
  (SELECT byte_size FROM public.shop_profile_media WHERE client_token='tok-LOGO'),
  180000,
  'profile byte_size comes from storage as well'
);

SELECT * FROM finish();
ROLLBACK;
