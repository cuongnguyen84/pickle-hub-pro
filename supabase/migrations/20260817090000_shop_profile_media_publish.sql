-- ============================================================================
-- Shop — publish leg for logo and cover (round 5, "sửa nốt tải logo/banner").
-- ----------------------------------------------------------------------------
-- Everything up to machine verification already worked: upload_init chooses
-- the paths, finalize reads the real bytes back from storage.objects and sets
-- verified_at. What was missing is the leg that makes a verified image PUBLIC:
--
--   * shop_profile_media_publish_commit existed with ZERO callers — the state
--     machine was complete and the shelf stayed empty (the exact Wave-0
--     failure mode product publish had).
--   * there was no prepare, so the worker had nothing to hand a copies plan.
--   * shop_public_shop returned no image fields, so even a published logo had
--     nowhere to appear.
--
-- This migration mirrors the product pattern exactly: prepare runs under the
-- CALLER's JWT and authz is decided here in Postgres; the edge function copies
-- bytes with the service role; commit — service_role only — flips the pointer.
--
-- One deliberate difference from the old commit: the public key is now
-- DETERMINISTIC (`<shop_id>/profile/<purpose>/<media_id>/v<version>/live.webp`)
-- and commit refuses anything else. That closes the stale-plan race — prepare
-- for v1, seller re-uploads to v2, a delayed v1 commit must FAIL rather than
-- overwrite the live pointer — without adding a parameter. Same signature
-- (UUID, TEXT) on purpose: a second overload of one function name is the 42725
-- trap that broke the approval flow before.
--
-- The same deterministic expression is added to shop_media_referenced_objects
-- so an object mid-copy is never swept as an orphan. Prepare, commit and the
-- allowlist must stay LITERALLY identical — shop_media_reconcile.test.sql and
-- shop_profile_media_publish.test.sql both read the three.
-- ============================================================================

-- ─── 1. Prepare: the copies plan, under the caller's own JWT ────────────────

CREATE OR REPLACE FUNCTION public.shop_profile_media_publish_prepare(_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lim  JSONB := public.shop_media_limits();
  _shop public.shops%ROWTYPE;
  _plan JSONB;
BEGIN
  SELECT * INTO _shop FROM public.shops WHERE id = _shop_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shop not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (public.is_shop_manager(_shop_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- A shop that is not live has no public face to put a logo on. The revoke
  -- trigger already takes published media DOWN on suspension; refusing here
  -- keeps the other direction closed too.
  IF _shop.state <> 'active' THEN
    RAISE EXCEPTION 'shop đang ở trạng thái % nên chưa đưa ảnh lên trang công khai được', _shop.state
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'media_id', p.id,
           'source',   p.rendition_source_path,
           -- Immutable per version, satisfies the `<shop_id>/%` path scope,
           -- and recomputable — which is what lets commit refuse a stale plan.
           'target',   p.shop_id::text || '/profile/' || p.purpose::text || '/'
                       || p.id::text || '/v' || p.version::text || '/live.webp'
         ) ORDER BY p.purpose)
  INTO _plan
  FROM public.shop_profile_media p
  WHERE p.shop_id = _shop_id AND p.verified_at IS NOT NULL;

  IF _plan IS NULL THEN
    RAISE EXCEPTION 'chưa có ảnh nào được xác minh' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN jsonb_build_object(
    'shop_id',       _shop_id,
    'draft_bucket',  _lim ->> 'draft_bucket',
    'public_bucket', _lim ->> 'public_bucket',
    'copies',        _plan
  );
END $$;

REVOKE ALL ON FUNCTION public.shop_profile_media_publish_prepare(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_profile_media_publish_prepare(UUID) TO authenticated, service_role;

-- ─── 2. Commit: same signature, three new refusals ──────────────────────────
-- SAME (UUID, TEXT) signature — no new overload (42725), no dropped DEFAULT
-- games (42P13). service_role only, as before.

CREATE OR REPLACE FUNCTION public.shop_profile_media_publish_commit(
  _media_id    UUID,
  _public_path TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lim        JSONB := public.shop_media_limits();
  _row        public.shop_profile_media%ROWTYPE;
  _shop_state TEXT;
  _expected   TEXT;
BEGIN
  SELECT * INTO _row FROM public.shop_profile_media WHERE id = _media_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'media not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF _row.verified_at IS NULL THEN
    RAISE EXCEPTION 'ảnh chưa được xác minh' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _public_path IS NULL OR _public_path NOT LIKE (_row.shop_id::text || '/%') THEN
    RAISE EXCEPTION 'đường dẫn công khai không hợp lệ' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- The stale-plan race: prepare handed the worker v1's key, the seller
  -- re-uploaded and re-finalized to v2, and only THEN does the delayed v1
  -- commit arrive. The row's CURRENT purpose/version decides — literally the
  -- same expression as prepare — so yesterday's plan cannot overwrite today's
  -- pointer. A retry of the CURRENT plan recomputes to the same key and is
  -- idempotent.
  _expected := _row.shop_id::text || '/profile/' || _row.purpose::text || '/'
               || _row.id::text || '/v' || _row.version::text || '/live.webp';
  IF _public_path <> _expected THEN
    RAISE EXCEPTION 'đường dẫn công khai không khớp phiên bản hiện tại của ảnh'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- The prepare-then-suspend window: the plan was made while the shop was
  -- active; if it no longer is, committing would put a suspended shop's face
  -- back on the public bucket's pointer.
  SELECT state::text INTO _shop_state FROM public.shops WHERE id = _row.shop_id;
  IF _shop_state IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'shop không còn hoạt động — không đưa ảnh lên được'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- A key can come back into use: suspend queues it for deletion via
  -- shop_profile_media_revoke, then the shop is reactivated and republishes
  -- the SAME version — same deterministic key. Without this the cleanup
  -- worker would delete a live rendition minutes after a successful publish.
  -- Same transaction as the pointer update, mirroring product_publish_commit.
  DELETE FROM public.shop_media_cleanup_jobs
  WHERE bucket_id = (_lim ->> 'public_bucket')
    AND object_path = _public_path
    AND state <> 'done';

  UPDATE public.shop_profile_media
  SET public_path = _public_path, updated_at = now()
  WHERE id = _media_id;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.shop_profile_media_publish_commit(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_profile_media_publish_commit(UUID, TEXT) TO service_role;

-- ─── 3. The referenced set learns the pending profile targets ───────────────
-- Body copied from 20260814110000 with ONE new UNION ALL arm: the key a
-- verified logo/cover is ABOUT to be published to, so the window between the
-- worker's copy and its commit is covered by definition rather than by the
-- one-hour grace. The note in 20260814110000 that said profile media still
-- relied on the grace period is retired by this arm.

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

  -- Same again for profile media, against shop_profile_media_publish_prepare's
  -- target expression — the identical-expression rule applies here too.
  UNION ALL
  SELECT (l ->> 'public_bucket'),
         p.shop_id::text || '/profile/' || p.purpose::text || '/'
           || p.id::text || '/v' || p.version::text || '/live.webp'
  FROM public.shop_profile_media p, lim WHERE p.verified_at IS NOT NULL
$$;

COMMENT ON FUNCTION public.shop_media_referenced_objects() IS
  'Every (bucket, path) the system expects to exist: product media and shop profile media, draft originals, rendition sources, live public paths, and the deterministic keys verified product AND profile images are about to be published to. The orphan sweep is the complement of this set. See migrations 20260814110000 and 20260817090000.';

REVOKE ALL ON FUNCTION public.shop_media_referenced_objects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_media_referenced_objects() TO service_role;

-- ─── 4. The public shop reader gains its three image fields ─────────────────
-- Body copied verbatim from 20260813120000; the ONLY change is three new keys
-- inside `shop`. SECURITY DEFINER bypasses RLS, so the `public_path IS NOT
-- NULL` filter in each subselect IS the security boundary: verified-but-
-- unpublished media must never leak through here. The suspended-shop
-- anti-enumeration branch is byte-identical.

CREATE OR REPLACE FUNCTION public.shop_public_shop(_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s        public.shops%ROWTYPE;
  _redirect TEXT;
BEGIN
  SELECT * INTO _s FROM public.shops WHERE slug = _slug;

  IF FOUND AND _s.state = 'active' THEN
    RETURN jsonb_build_object(
      'found', true,
      'shop', jsonb_build_object(
        'slug', _s.slug,
        'name', _s.name,
        'intro', _s.intro,
        'region', _s.region,
        'verified', _s.verified_at IS NOT NULL,
        'verified_at', _s.verified_at,
        'shipping_note', _s.shipping_note,
        'return_note', _s.return_note,
        'primary_category_slug', _s.primary_category_slug,
        'logo_path', (
          SELECT m.public_path FROM public.shop_profile_media m
          WHERE m.shop_id = _s.id AND m.purpose = 'logo' AND m.public_path IS NOT NULL),
        'cover_path', (
          SELECT m.public_path FROM public.shop_profile_media m
          WHERE m.shop_id = _s.id AND m.purpose = 'cover' AND m.public_path IS NOT NULL),
        'cover_focal_y', (
          SELECT m.focal_y FROM public.shop_profile_media m
          WHERE m.shop_id = _s.id AND m.purpose = 'cover' AND m.public_path IS NOT NULL),
        'product_count', (
          SELECT count(*)::int FROM public.products p
          JOIN public.product_categories c ON c.slug = p.category_slug
          WHERE p.shop_id = _s.id AND p.status = 'approved' AND p.is_published
            AND c.is_active
            AND EXISTS (SELECT 1 FROM public.product_media m
                        WHERE m.product_id = p.id AND m.public_path IS NOT NULL))
      ),
      'contacts', public.shop_public_contacts(_s.id));
  END IF;

  -- Not a live shop — including "exists but is suspended". Fall through to the
  -- history so a renamed shop still resolves, and answer identically for a
  -- suspended shop and one that never existed: a different reply would confirm
  -- which shops are real.
  SELECT s.slug INTO _redirect
  FROM public.shop_slug_history h
  JOIN public.shops s ON s.id = h.shop_id
  WHERE h.slug = _slug AND s.state = 'active';

  RETURN jsonb_build_object('found', false, 'redirect_to', _redirect);
END $$;

REVOKE ALL   ON FUNCTION public.shop_public_shop(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_public_shop(TEXT) TO anon, authenticated, service_role;
