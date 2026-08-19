-- ============================================================================
-- B13 — the orphan sweep only knew half the media it is responsible for
-- ----------------------------------------------------------------------------
-- shop_media_reconcile() decides which storage objects nobody points at any
-- more and queues them for deletion. It asked exactly one table:
-- product_media. shop_profile_media — a shop's logo and cover — arrived two
-- migrations later (20260811220000), in the SAME two buckets, and nothing went
-- back to teach the sweep it existed.
--
-- So by that function's definition a live logo is an orphan:
--
--   · draft bucket, after 24h — the original and the rendition source of every
--     logo and cover uploaded through the seller settings screen. This is the
--     reachable one: profile media is uploaded to the draft bucket today.
--   · public bucket, after 1h — a published logo. Latent for now only because
--     shop_profile_media_publish_commit() has no production caller yet; the
--     RPC exists and the day something calls it, this fires.
--
-- It has never happened because the reconcile cron has never been deployed
-- anywhere. The first environment to run it would start deleting sellers'
-- images.
--
-- ── The fix is not an exclusion ────────────────────────────────────────────
--
-- Adding "…and it is not a logo" to the sweep would fix today's symptom and
-- leave the shape of the bug: two media domains, one sweep that knows about
-- one of them, and a third domain a year from now that nobody remembers to
-- add. What is missing is a DEFINITION, so this migration writes one:
--
--   shop_media_referenced_objects() — every (bucket, path) the system expects
--   to exist, from both domains, across every column that can hold a key.
--
-- The sweep becomes "an object in one of our buckets that is not in that set".
-- A future media domain is one UNION away from being swept correctly, and if
-- it is forgotten the failure is at least in one obvious place.
--
-- ── One race the grace period alone did not cover ──────────────────────────
--
-- A product rendition is copied to its public key by the worker and only THEN
-- committed. Between those two, the object exists and no row points at it. The
-- old code relied on the one-hour grace; that is a wager on how long a copy
-- takes, and it is the kind of wager that pays out until a bad day.
--
-- The public key is deterministic — shop/product/media-v<version>.webp, built
-- by product_publish_prepare — so the referenced set can contain the key a
-- verified image is ABOUT to be published to, and the window closes properly
-- rather than probably. Profile media has no equivalent: its commit accepts
-- the path from the worker, so there it is still the grace period doing the
-- work. Noted rather than papered over.
--
-- ── What this migration deliberately does NOT change ──────────────────────
--
--   · No new grant. reconcile stays service_role only; the new helper is
--     service_role only. Nothing becomes reachable with a user JWT.
--   · No change to bucket names, path shapes, or the ownership checks in
--     upload_init / finalize / commit.
--   · No pagination. The sweep still walks a bucket. At pilot size that is
--     correct and the honest note lives in the proposal, not in a redesign
--     nobody asked for.
-- ============================================================================

-- ─── 1. What "referenced" means, in one place ───────────────────────────────

CREATE OR REPLACE FUNCTION public.shop_media_referenced_objects()
RETURNS TABLE (bucket_id TEXT, object_path TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lim AS (SELECT public.shop_media_limits() AS l)

  -- ── Draft bucket: the seller's originals and the rendition sources ───────
  -- Both are written by upload_init BEFORE the object exists, which is what
  -- makes an upload in flight safe: the row is already there to point at it.

  SELECT (l ->> 'draft_bucket'), m.draft_path
  FROM public.product_media m, lim WHERE m.draft_path IS NOT NULL
  UNION ALL
  SELECT (l ->> 'draft_bucket'), m.rendition_source_path
  FROM public.product_media m, lim WHERE m.rendition_source_path IS NOT NULL
  UNION ALL
  SELECT (l ->> 'draft_bucket'), p.draft_path
  FROM public.shop_profile_media p, lim WHERE p.draft_path IS NOT NULL
  UNION ALL
  SELECT (l ->> 'draft_bucket'), p.rendition_source_path
  FROM public.shop_profile_media p, lim WHERE p.rendition_source_path IS NOT NULL

  -- ── Public bucket: what is live ─────────────────────────────────────────
  UNION ALL
  SELECT (l ->> 'public_bucket'), m.public_path
  FROM public.product_media m, lim WHERE m.public_path IS NOT NULL
  UNION ALL
  SELECT (l ->> 'public_bucket'), p.public_path
  FROM public.shop_profile_media p, lim WHERE p.public_path IS NOT NULL

  -- ── Public bucket: what is on its way there ─────────────────────────────
  -- The same expression product_publish_prepare hands the worker. Kept
  -- literally identical on purpose: if one changes and the other does not,
  -- the sweep starts deleting freshly copied renditions, so the two belong in
  -- a test that reads both. See shop_media_reconcile.test.sql.
  --
  -- A verified row keeps its target reserved even between publishes. That is
  -- intended: the next publish overwrites the same key, and a version bump
  -- leaves the OLD key unreferenced, so nothing accumulates.
  UNION ALL
  SELECT (l ->> 'public_bucket'),
         m.shop_id::text || '/' || m.product_id::text || '/'
           || m.id::text || '-v' || m.version::text || '.webp'
  FROM public.product_media m, lim WHERE m.verified_at IS NOT NULL
$$;

COMMENT ON FUNCTION public.shop_media_referenced_objects() IS
  'Every (bucket, path) the system expects to exist: product media and shop profile media, draft originals, rendition sources, live public paths, and the deterministic key a verified product image is about to be published to. The orphan sweep is the complement of this set. See migration 20260814110000.';

REVOKE ALL ON FUNCTION public.shop_media_referenced_objects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_media_referenced_objects() TO service_role;

-- ─── 2. The sweep, rebuilt on that definition ───────────────────────────────

CREATE OR REPLACE FUNCTION public.shop_media_reconcile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lim      JSONB := public.shop_media_limits();
  _unstuck  INTEGER;
  _orphans  INTEGER := 0;
  _row      RECORD;
BEGIN
  UPDATE public.shop_media_cleanup_jobs
  SET state = 'pending', claimed_at = NULL, next_attempt_at = now(), updated_at = now()
  WHERE state = 'in_progress' AND claimed_at < now() - INTERVAL '15 minutes';
  GET DIAGNOSTICS _unstuck = ROW_COUNT;

  -- One loop for both buckets. They differ only in how long an unreferenced
  -- object is given the benefit of the doubt: a public object is created by a
  -- copy that commits seconds later, a draft object waits for a human to
  -- finish an upload.
  --
  -- Objects that already have an open job are skipped rather than re-enqueued.
  -- shop_media_enqueue_cleanup would collapse the duplicate anyway (unique
  -- index on (bucket_id, object_path) WHERE state <> 'done'), but then
  -- `orphans_queued` would count work that did not happen, and a number that
  -- overstates itself is worse than no number in an ops signal.
  FOR _row IN
    SELECT o.bucket_id, o.name
    FROM storage.objects o
    WHERE (
            (o.bucket_id = (_lim ->> 'public_bucket') AND o.created_at < now() - INTERVAL '1 hour')
         OR (o.bucket_id = (_lim ->> 'draft_bucket')  AND o.created_at < now() - INTERVAL '24 hours')
          )
      AND NOT EXISTS (
        SELECT 1 FROM public.shop_media_referenced_objects() r
        WHERE r.bucket_id = o.bucket_id AND r.object_path = o.name
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.shop_media_cleanup_jobs j
        WHERE j.bucket_id = o.bucket_id AND j.object_path = o.name AND j.state <> 'done'
      )
  LOOP
    PERFORM public.shop_media_enqueue_cleanup(
      _row.bucket_id, _row.name, NULL, NULL, NULL, 'orphan');
    _orphans := _orphans + 1;
  END LOOP;

  -- Counts only. A path in an ops response is a private key in a log line.
  RETURN jsonb_build_object('unstuck', _unstuck, 'orphans_queued', _orphans);
END $$;

REVOKE ALL ON FUNCTION public.shop_media_reconcile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_media_reconcile() TO service_role;
