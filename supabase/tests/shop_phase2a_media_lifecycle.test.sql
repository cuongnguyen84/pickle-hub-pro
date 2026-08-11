-- Shop marketplace P2a.2 — media lifecycle: authorization, verification,
-- revocation, the cleanup outbox, retry/backoff and reconciliation.
--
-- The question this file exists to answer is not "did we clear a column".
-- It is "after a revocation, is there a durable, retryable promise that the
-- object will actually be deleted" — because clearing a column while the file
-- stays reachable by URL is exactly the failure D1 was written to prevent.
--
-- Storage-API behaviour (a real upload, a real anonymous fetch) is NOT
-- assertable from pgTAP; that half lives in
-- scripts/shop-media-integration.test.mjs and runs against the local stack.

BEGIN;

SELECT plan(54);

-- ─── Fixture ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('50030001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'med-a@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Owner A"}'::jsonb, NOW(), NOW()),
  ('50030002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'med-b@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Owner B"}'::jsonb, NOW(), NOW()),
  ('50030003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'med-support@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Support"}'::jsonb, NOW(), NOW()),
  ('50030004-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'med-nopilot@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"No Pilot"}'::jsonb, NOW(), NOW()),
  ('50030005-0000-4000-8000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'med-admin@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Admin"}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('50030005-0000-4000-8000-000000000005'::uuid, 'admin') ON CONFLICT DO NOTHING;

INSERT INTO public.shop_pilot_members (user_id) VALUES
  ('50030001-0000-4000-8000-000000000001'::uuid),
  ('50030002-0000-4000-8000-000000000002'::uuid),
  ('50030003-0000-4000-8000-000000000003'::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id) VALUES
  ('6a000001-0000-4000-8000-000000000001'::uuid, 'med-shop-a', 'Med Shop A', 'active', '50030001-0000-4000-8000-000000000001'::uuid),
  ('6a000002-0000-4000-8000-000000000002'::uuid, 'med-shop-b', 'Med Shop B', 'active', '50030002-0000-4000-8000-000000000002'::uuid);

INSERT INTO public.shop_members (shop_id, user_id, role) VALUES
  ('6a000001-0000-4000-8000-000000000001'::uuid, '50030001-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('6a000002-0000-4000-8000-000000000002'::uuid, '50030002-0000-4000-8000-000000000002'::uuid, 'owner'),
  ('6a000001-0000-4000-8000-000000000001'::uuid, '50030003-0000-4000-8000-000000000003'::uuid, 'support');

INSERT INTO public.products (id, shop_id, slug, title, category_slug, status) VALUES
  ('6b000001-0000-4000-8000-000000000001'::uuid, '6a000001-0000-4000-8000-000000000001'::uuid, 'med-prod-a', 'Med Prod A', 'vot', 'draft'),
  ('6b000002-0000-4000-8000-000000000002'::uuid, '6a000002-0000-4000-8000-000000000002'::uuid, 'med-prod-b', 'Med Prod B', 'vot', 'draft'),
  ('6b000003-0000-4000-8000-000000000003'::uuid, '6a000001-0000-4000-8000-000000000001'::uuid, 'med-prod-locked', 'Med Prod Locked', 'vot', 'draft');

-- The insert trigger forces every new product to 'draft', including this one,
-- so the queued state has to be set the way the RPCs set it.
SELECT set_config('shop.privileged_write', 'on', true);
UPDATE public.products SET status='pending_review' WHERE id='6b000003-0000-4000-8000-000000000003'::uuid;
SELECT set_config('shop.privileged_write', 'off', true);

-- ─── The outbox exists and is not client-writable ──────────────────────────

SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='shop_media_cleanup_jobs'),
  'RLS enabled on shop_media_cleanup_jobs');
SELECT ok(NOT (SELECT has_table_privilege('authenticated', 'public.shop_media_cleanup_jobs', 'INSERT')),
  'no client JWT may INSERT a cleanup job');
SELECT ok(NOT (SELECT has_table_privilege('authenticated', 'public.shop_media_cleanup_jobs', 'UPDATE')),
  'no client JWT may UPDATE a cleanup job');
SELECT ok(NOT (SELECT has_table_privilege('anon', 'public.shop_media_cleanup_jobs', 'SELECT')),
  'anon cannot even read the queue');

SELECT ok(NOT (SELECT has_function_privilege('authenticated', 'public.shop_media_cleanup_claim(integer)', 'EXECUTE')),
  'a client cannot claim cleanup jobs');
SELECT ok(NOT (SELECT has_function_privilege('authenticated', 'public.shop_media_cleanup_complete(uuid,boolean,text)', 'EXECUTE')),
  'a client cannot mark a cleanup job done');
SELECT ok(NOT (SELECT has_function_privilege('authenticated', 'public.product_publish_commit(uuid,jsonb)', 'EXECUTE')),
  'a client cannot commit a publish — that would publish unverified bytes');
SELECT ok(NOT (SELECT has_function_privilege('authenticated', 'public.shop_media_enqueue_cleanup(text,text,uuid,uuid,uuid,text)', 'EXECUTE')),
  'a client cannot enqueue arbitrary object deletions');
SELECT ok(NOT (SELECT has_function_privilege('authenticated', 'public.shop_media_reconcile()', 'EXECUTE')),
  'a client cannot run reconciliation');

-- ─── Upload authorization ──────────────────────────────────────────────────

SET LOCAL role authenticated;

-- Not on the pilot allowlist.
SET LOCAL request.jwt.claims TO '{"sub":"50030004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  $$ SELECT public.product_media_upload_init('6b000001-0000-4000-8000-000000000001'::uuid, 'image/jpeg', 100000) $$,
  '42501', NULL,
  'a user outside the closed pilot CANNOT start an upload'
);

-- Support member: in the pilot, in the shop, still not a writer.
SET LOCAL request.jwt.claims TO '{"sub":"50030003-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  $$ SELECT public.product_media_upload_init('6b000001-0000-4000-8000-000000000001'::uuid, 'image/jpeg', 100000) $$,
  '42501', NULL,
  'a support member CANNOT upload media'
);

-- Another shop's owner.
SET LOCAL request.jwt.claims TO '{"sub":"50030002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  $$ SELECT public.product_media_upload_init('6b000001-0000-4000-8000-000000000001'::uuid, 'image/jpeg', 100000) $$,
  '42501', NULL,
  'a manager of another shop CANNOT upload into this product'
);

SET LOCAL request.jwt.claims TO '{"sub":"50030001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT throws_ok(
  $$ SELECT public.product_media_upload_init('6b000001-0000-4000-8000-000000000001'::uuid, 'image/heic', 100000) $$,
  '22023', NULL,
  'HEIC is refused outright rather than half-supported'
);
SELECT throws_ok(
  $$ SELECT public.product_media_upload_init('6b000001-0000-4000-8000-000000000001'::uuid, 'image/jpeg', 20000000) $$,
  '22023', NULL,
  'an oversized input is refused before a byte is uploaded'
);
SELECT throws_ok(
  $$ SELECT public.product_media_upload_init('6b000003-0000-4000-8000-000000000003'::uuid, 'image/jpeg', 100000) $$,
  '22023', NULL,
  'media cannot be changed while the product sits in the review queue'
);

-- ─── Server-chosen paths, and idempotent init ──────────────────────────────

CREATE TEMP TABLE _init AS SELECT public.product_media_upload_init(
  '6b000001-0000-4000-8000-000000000001'::uuid, 'image/jpeg', 3000000,
  '../../etc/passwd; DROP TABLE products.jpg', 'tok-A') AS r;

SELECT ok(
  (SELECT (r ->> 'draft_path') LIKE '6a000001-0000-4000-8000-000000000001/6b000001-0000-4000-8000-000000000001/%' FROM _init),
  'the object key is server-chosen and inside the shop/product namespace'
);
SELECT ok(
  (SELECT (r ->> 'draft_path') NOT LIKE '%passwd%' AND (r ->> 'draft_path') NOT LIKE '%..%' FROM _init),
  'the uploaded filename never becomes part of the key'
);
SELECT ok(
  (SELECT original_filename NOT LIKE '%/%' AND original_filename NOT LIKE '%;%'
   FROM public.product_media WHERE client_token='tok-A'),
  'the filename is kept only as sanitised display metadata'
);

-- Retrying init with the same token must not leave a second orphan behind.
SELECT is(
  (SELECT (public.product_media_upload_init(
      '6b000001-0000-4000-8000-000000000001'::uuid, 'image/jpeg', 3000000, NULL, 'tok-A') ->> 'media_id')),
  (SELECT (r ->> 'media_id') FROM _init),
  'a retried upload_init returns the SAME media row'
);
SELECT is(
  (SELECT count(*)::int FROM public.product_media WHERE product_id='6b000001-0000-4000-8000-000000000001'::uuid),
  1,
  'a retried upload_init creates no second record'
);

-- ─── Finalize is where a client claim meets the storage catalogue ──────────

SELECT throws_ok(
  $$ SELECT public.product_media_finalize((SELECT id FROM public.product_media WHERE client_token='tok-A')) $$,
  'P0002', NULL,
  'finalize fails when the object was never actually uploaded'
);

SET LOCAL role postgres;
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'shop-product-media-draft', draft_path,
       jsonb_build_object('size', 3000000, 'mimetype', 'image/jpeg')
FROM public.product_media WHERE client_token='tok-A';
-- The client says it re-encoded to WebP. It uploaded a JPEG.
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'shop-product-media-draft', rendition_source_path,
       jsonb_build_object('size', 240000, 'mimetype', 'image/jpeg')
FROM public.product_media WHERE client_token='tok-A';
SET LOCAL role authenticated;

SELECT throws_ok(
  $$ SELECT public.product_media_finalize((SELECT id FROM public.product_media WHERE client_token='tok-A')) $$,
  '22023', NULL,
  'a client that lies about having re-encoded is caught by the storage catalogue'
);

SET LOCAL role postgres;
UPDATE storage.objects SET metadata = jsonb_build_object('size', 9000000, 'mimetype', 'image/webp')
WHERE bucket_id='shop-product-media-draft'
  AND name = (SELECT rendition_source_path FROM public.product_media WHERE client_token='tok-A');
SET LOCAL role authenticated;

SELECT throws_ok(
  $$ SELECT public.product_media_finalize((SELECT id FROM public.product_media WHERE client_token='tok-A')) $$,
  '22023', NULL,
  'an oversized rendition is refused on the real size, not the claimed one'
);

SET LOCAL role postgres;
UPDATE storage.objects SET metadata = jsonb_build_object('size', 240000, 'mimetype', 'image/webp')
WHERE bucket_id='shop-product-media-draft'
  AND name = (SELECT rendition_source_path FROM public.product_media WHERE client_token='tok-A');
SET LOCAL role authenticated;

SELECT ok(
  (public.product_media_finalize(
     (SELECT id FROM public.product_media WHERE client_token='tok-A'), 1200, 900) ->> 'verified')::boolean,
  'finalize succeeds once both objects really exist and match the contract'
);
SELECT is(
  (SELECT byte_size FROM public.product_media WHERE client_token='tok-A'),
  240000,
  'byte_size is read back from storage, never taken from the client'
);
SELECT ok(
  (public.product_media_finalize(
     (SELECT id FROM public.product_media WHERE client_token='tok-A')) ->> 'reused')::boolean,
  'a retried finalize is idempotent'
);

-- Another shop's manager cannot finalize this media. The id is captured here,
-- while A can still see the row: looked up as B it would be filtered by RLS
-- and the call would fail as "not found", which proves nothing about authz.
CREATE TEMP TABLE _mid AS SELECT id FROM public.product_media WHERE client_token='tok-A';
SET LOCAL request.jwt.claims TO '{"sub":"50030002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
SELECT throws_ok(
  $$ SELECT public.product_media_finalize((SELECT id FROM _mid)) $$,
  '42501', NULL,
  'a manager of another shop CANNOT finalize this media'
);
SET LOCAL request.jwt.claims TO '{"sub":"50030001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

-- ─── Publish, then revoke ──────────────────────────────────────────────────

INSERT INTO public.product_variants (product_id, shop_id, price_vnd)
VALUES ('6b000001-0000-4000-8000-000000000001'::uuid, '6a000001-0000-4000-8000-000000000001'::uuid, 500000);
SELECT is(
  public.product_submit_for_review('6b000001-0000-4000-8000-000000000001'::uuid)::text,
  'pending_review',
  'a product with a verified photo can be submitted'
);

SET LOCAL request.jwt.claims TO '{"sub":"50030005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
SELECT is(
  public.product_decide('6b000001-0000-4000-8000-000000000001'::uuid, 'approve')::text,
  'approved', 'admin approves');

SET LOCAL request.jwt.claims TO '{"sub":"50030001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
CREATE TEMP TABLE _pub AS
  SELECT public.product_publish_prepare('6b000001-0000-4000-8000-000000000001'::uuid) AS p;

SET LOCAL role postgres;
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'shop-product-media', c ->> 'target', jsonb_build_object('size', 240000, 'mimetype', 'image/webp')
FROM _pub, jsonb_array_elements(p -> 'copies') c;
SELECT is(
  public.product_publish_commit('6b000001-0000-4000-8000-000000000001'::uuid, (SELECT p -> 'copies' FROM _pub)),
  1, 'the worker commits one rendition pointer');
SET LOCAL role authenticated;

SELECT ok(
  (SELECT public_path IS NOT NULL FROM public.product_media WHERE client_token='tok-A'),
  'the product is now serving a public rendition'
);

-- The heart of D1: unpublishing must leave a durable promise, not just a NULL.
SELECT ok(NOT public.product_set_published('6b000001-0000-4000-8000-000000000001'::uuid, false),
  'owner unpublishes');
SELECT ok(
  (SELECT public_path IS NULL FROM public.product_media WHERE client_token='tok-A'),
  'database visibility is revoked in the same transaction'
);

SET LOCAL role postgres;
SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs
   WHERE reason='unpublish' AND bucket_id='shop-product-media' AND state='pending'),
  1,
  'and a durable deletion job exists for the object itself'
);

-- Re-revoking the same object must not pile up jobs.
SELECT is(
  (SELECT count(*)::int FROM (
     SELECT public.shop_media_enqueue_cleanup(
       'shop-product-media',
       (SELECT object_path FROM public.shop_media_cleanup_jobs WHERE reason='unpublish' LIMIT 1),
       NULL, NULL, NULL, 'unpublish') AS id) x
   WHERE id = (SELECT id FROM public.shop_media_cleanup_jobs WHERE reason='unpublish' LIMIT 1)),
  1,
  'enqueueing the same object again returns the SAME job'
);

-- ─── Claim / complete / backoff ────────────────────────────────────────────

CREATE TEMP TABLE _claim AS SELECT * FROM public.shop_media_cleanup_claim(10);

SELECT ok((SELECT count(*) FROM _claim) >= 1, 'the worker can claim due jobs');
SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs
   WHERE id IN (SELECT id FROM _claim) AND state='in_progress'),
  (SELECT count(*)::int FROM _claim),
  'claimed jobs are marked in_progress so a second worker cannot take them'
);
SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_claim(10)),
  0,
  'a second claim finds nothing — no job is handed out twice'
);

-- A Storage failure must never be recorded as success.
SELECT is(
  public.shop_media_cleanup_complete((SELECT id FROM _claim LIMIT 1), false,
    'HTTP 500 https://x.supabase.co/storage/v1/object/sign/a?token=SECRET')::text,
  'pending',
  'a failed delete goes back to pending, never to done'
);
SELECT is(
  (SELECT attempts FROM public.shop_media_cleanup_jobs WHERE id = (SELECT id FROM _claim LIMIT 1)),
  1,
  'the attempt is counted'
);
SELECT ok(
  (SELECT next_attempt_at > now() FROM public.shop_media_cleanup_jobs WHERE id = (SELECT id FROM _claim LIMIT 1)),
  'and the retry is pushed out rather than hammered'
);
SELECT ok(
  (SELECT last_error NOT LIKE '%token=%' AND char_length(last_error) <= 500
   FROM public.shop_media_cleanup_jobs WHERE id = (SELECT id FROM _claim LIMIT 1)),
  'the stored error carries no signed-URL query string'
);

-- Eight failures and it stops retrying and starts being visible.
DO $$
DECLARE _id UUID := (SELECT id FROM public.shop_media_cleanup_jobs WHERE reason='unpublish' LIMIT 1);
BEGIN
  FOR i IN 1..7 LOOP
    PERFORM public.shop_media_cleanup_complete(_id, false, 'still failing');
  END LOOP;
END $$;
SELECT is(
  (SELECT state::text FROM public.shop_media_cleanup_jobs WHERE reason='unpublish' LIMIT 1),
  'failed',
  'after the retry budget the job goes failed instead of disappearing'
);
SELECT ok(
  (SELECT failed >= 1 FROM public.shop_media_cleanup_health),
  'a failed job is visible in the ops view'
);

SELECT is(
  public.shop_media_cleanup_complete((SELECT id FROM public.shop_media_cleanup_jobs WHERE reason='unpublish' LIMIT 1), true)::text,
  'done',
  'a later success closes it — deleting an object that is already gone counts as success'
);
SELECT ok(
  (SELECT completed_at IS NOT NULL FROM public.shop_media_cleanup_jobs WHERE reason='unpublish' LIMIT 1),
  'completion is stamped'
);

-- ─── Reconciliation ────────────────────────────────────────────────────────

UPDATE public.shop_media_cleanup_jobs
SET state='in_progress', claimed_at = now() - INTERVAL '1 hour'
WHERE state='done';
SELECT is(
  (public.shop_media_reconcile() ->> 'unstuck')::int,
  1,
  'a job left in_progress by a dead worker is returned to pending'
);

-- An object nobody points at any more is swept up…
INSERT INTO storage.objects (bucket_id, name, created_at, metadata)
VALUES ('shop-product-media', '6a000001-0000-4000-8000-000000000001/orphan-v9.webp',
        now() - INTERVAL '2 hours', jsonb_build_object('size', 1000, 'mimetype', 'image/webp'));
SELECT ok(
  (public.shop_media_reconcile() ->> 'orphans_queued')::int >= 1,
  'an unreferenced public object is queued for deletion'
);
-- …but an object that IS in use is never touched.
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50030001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
CREATE TEMP TABLE _pub2 AS
  SELECT public.product_publish_prepare('6b000001-0000-4000-8000-000000000001'::uuid) AS p;
SET LOCAL role postgres;
INSERT INTO storage.objects (bucket_id, name, created_at, metadata)
SELECT 'shop-product-media', c ->> 'target', now() - INTERVAL '2 hours',
       jsonb_build_object('size', 240000, 'mimetype', 'image/webp')
FROM _pub2, jsonb_array_elements(p -> 'copies') c
ON CONFLICT DO NOTHING;
SELECT public.product_publish_commit('6b000001-0000-4000-8000-000000000001'::uuid, (SELECT p -> 'copies' FROM _pub2));
SELECT public.shop_media_reconcile();
SELECT is(
  (SELECT count(*)::int FROM public.shop_media_cleanup_jobs j
   JOIN public.product_media m ON m.public_path = j.object_path
   WHERE j.state <> 'done'),
  0,
  'reconciliation never queues an object that is still in use'
);

-- ─── Suspension and deletion ───────────────────────────────────────────────

-- Suspension is an admin act. Attempted as anyone else the column guard pins
-- state back and nothing happens — which is itself worth stating, because a
-- silent no-op here would have read as "suspension does not revoke media".
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50030005-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
UPDATE public.shops SET state='suspended' WHERE id='6a000001-0000-4000-8000-000000000001'::uuid;
SET LOCAL role postgres;
SELECT ok(
  (SELECT count(*) FROM public.shop_media_cleanup_jobs WHERE reason='suspend') >= 1,
  'suspending a shop queues its renditions for deletion too'
);
SELECT is(
  (SELECT count(*)::int FROM public.product_media
   WHERE product_id='6b000001-0000-4000-8000-000000000001'::uuid AND public_path IS NOT NULL),
  0,
  'and revokes their database visibility immediately'
);

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50030001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT ok(
  public.product_media_delete((SELECT id FROM public.product_media WHERE client_token='tok-A')),
  'owner deletes a photo'
);
SET LOCAL role postgres;
SELECT ok(
  (SELECT count(*) FROM public.shop_media_cleanup_jobs
   WHERE reason='delete' AND bucket_id='shop-product-media-draft') = 2,
  'both private objects — original and rendition source — are queued'
);
SET LOCAL role authenticated;
SELECT ok(
  public.product_media_delete('00000000-0000-4000-8000-0000000000ff'::uuid),
  'deleting media that is already gone is success, not an error to retry'
);

SELECT * FROM finish();
ROLLBACK;
