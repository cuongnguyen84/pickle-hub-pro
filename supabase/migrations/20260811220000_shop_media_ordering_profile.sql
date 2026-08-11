-- ============================================================================
-- Shop marketplace — P2a step 6: media ordering, variant media, shop profile media
-- ----------------------------------------------------------------------------
-- P2a.2 built the whole product-media lifecycle: private original, verified
-- WebP rendition, immutable versioned public key, cleanup outbox, worker
-- contract. It did not build the three things a seller actually does with a
-- set of photos once they exist.
--
--   1. Put them in an order, and say which one is the main one.
--   2. Point a variant at the photo that shows that variant.
--   3. Give the shop a logo and a cover.
--
-- None of the P2a.2 invariants move. Every path here is still server-chosen,
-- every public object is still written only by the trusted worker, and every
-- object still lives under `<shop_id>/…` in the buckets that already exist.
--
-- ── Primary image: derived, not stored ──────────────────────────────────────
-- The main image is the one at position 0. There is no is_primary column, and
-- that is the decision, not an omission:
--   * two sources of truth (a position AND a flag) can disagree, and the day
--     they do the seller sees one image in the editor and another on the card;
--   * "set as main" becomes "move to position 0", which is the reorder RPC
--     that already has to exist;
--   * deleting the main image needs no special case at all — the next one is
--     at position 0 by definition, so the fallback is deterministic and there
--     is no window where a product points at a photo that is gone.
--
-- ── Variant media: a composite FK, not an id in JSON ────────────────────────
-- product_variants.media_id references (id, product_id) on product_media, so
-- Postgres — not a trigger, and not the client — guarantees a variant can only
-- point at a photo of its OWN product. ON DELETE SET NULL is what makes
-- deleting a photo safe: the mapping clears in the same transaction and the
-- variant falls back to the product's main image.
--
-- ── Shop logo and cover ─────────────────────────────────────────────────────
-- A new table with the same shape and the same lifecycle as product_media,
-- NOT a fake product. It reuses the existing buckets under a
-- `<shop_id>/profile/<purpose>/<id>/…` prefix, because the draft bucket's
-- policies already scope on `<shop_id>` as the first path segment — so logo
-- and cover inherit exactly the isolation product media has, with no second
-- bucket and no second set of policies to keep in step. The bucket is named
-- for products and now holds shop media too; renaming a bucket means moving
-- every object, so the name stays and this comment carries the truth.
--
-- Everything is idempotent: a replay is safe.
-- ============================================================================

-- ─── 1. Ordering ────────────────────────────────────────────────────────────

-- Needed so product_variants can carry the composite FK below.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_media_id_product_unique') THEN
    ALTER TABLE public.product_media
      ADD CONSTRAINT product_media_id_product_unique UNIQUE (id, product_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.product_media_reorder(
  _product_id       UUID,
  _expected_version INTEGER,
  _media_ids        UUID[]
)
RETURNS SETOF public.product_media
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prod  public.products%ROWTYPE;
  _have  INTEGER;
  _want  INTEGER;
BEGIN
  SELECT * INTO _prod FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.product_assert_writable(_prod.shop_id);

  IF NOT public.product_status_is_editable(_prod.status) THEN
    RAISE EXCEPTION 'sản phẩm đang ở trạng thái % nên chưa sắp xếp lại ảnh được', _prod.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _prod.version <> _expected_version THEN
    RAISE EXCEPTION 'sản phẩm đã được cập nhật ở nơi khác (phiên bản % ≠ %)',
      _prod.version, _expected_version USING ERRCODE = 'PT409';
  END IF;

  -- The submitted list must be exactly this product's media, no more and no
  -- less. A partial list would silently leave photos at stale positions, and a
  -- list carrying somebody else's media id would be a cross-product write.
  SELECT count(*) INTO _have FROM public.product_media WHERE product_id = _product_id;
  SELECT count(*) INTO _want FROM (SELECT DISTINCT unnest(_media_ids)) AS t;
  IF _want <> _have OR _want <> coalesce(array_length(_media_ids, 1), 0) THEN
    RAISE EXCEPTION 'danh sách ảnh không khớp — gửi đủ và không trùng % ảnh của sản phẩm', _have
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(_media_ids) AS m(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.product_media pm WHERE pm.id = m.id AND pm.product_id = _product_id
    )
  ) THEN
    RAISE EXCEPTION 'danh sách ảnh chứa ảnh không thuộc sản phẩm này'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Idempotent by construction: the same array always produces the same
  -- positions, so a retry is a no-op rather than a second shuffle.
  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.product_media pm
  SET position = t.ord - 1, updated_at = now()
  FROM unnest(_media_ids) WITH ORDINALITY AS t(id, ord)
  WHERE pm.id = t.id AND pm.product_id = _product_id;

  -- Touch the product so the version moves and any other open tab loses its
  -- race on the next write instead of overwriting this order.
  UPDATE public.products SET updated_at = now() WHERE id = _product_id;
  PERFORM set_config('shop.privileged_write', 'off', true);

  RETURN QUERY SELECT * FROM public.product_media
    WHERE product_id = _product_id ORDER BY position, created_at;
END $$;

-- ─── 2. Variant media ───────────────────────────────────────────────────────

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS media_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_media_same_product') THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_media_same_product
      FOREIGN KEY (media_id, product_id)
      REFERENCES public.product_media(id, product_id)
      -- The column list is load-bearing. A bare ON DELETE SET NULL on a
      -- COMPOSITE key nulls every column in it, including product_id — which
      -- is NOT NULL, so deleting any photo a variant used failed outright.
      -- Naming media_id nulls only the pointer and leaves the variant on its
      -- own product. Found by the pgTAP, not by reading the constraint.
      ON DELETE SET NULL (media_id);
  END IF;
END $$;

COMMENT ON COLUMN public.product_variants.media_id IS
  'Photo that shows THIS variant. Composite FK to (product_media.id, product_id), so a variant cannot point at another product''s photo. NULL = fall back to the product main image (position 0).';

CREATE OR REPLACE FUNCTION public.product_variant_set_media(
  _variant_id UUID,
  _media_id   UUID
)
RETURNS public.product_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.product_variants%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.product_variants WHERE id = _variant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'variant not found' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.product_assert_writable(_row.shop_id);

  -- Checked here for the message; the composite FK is what makes it true.
  IF _media_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_media
    WHERE id = _media_id AND product_id = _row.product_id
  ) THEN
    RAISE EXCEPTION 'ảnh không thuộc sản phẩm này' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.product_variants
  SET media_id = _media_id, updated_at = now()
  WHERE id = _variant_id
  RETURNING * INTO _row;

  RETURN _row;
END $$;

-- ─── 3. Shop profile media ──────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_media_purpose') THEN
    CREATE TYPE public.shop_media_purpose AS ENUM ('logo', 'cover');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.shop_profile_media (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  purpose               public.shop_media_purpose NOT NULL,
  -- Same three-object shape as product_media: the original never goes public,
  -- the rendition is what the worker copies, public_path is set only by the
  -- worker's commit.
  draft_path            TEXT NOT NULL,
  rendition_source_path TEXT NOT NULL,
  public_path           TEXT,
  content_type          TEXT,
  byte_size             INTEGER,
  width                 INTEGER,
  height                INTEGER,
  original_filename     TEXT,
  /* Cover framing. A number, not a cropped file: the original is never
     destroyed by a preview decision, and a seller who re-frames later has not
     already thrown the top of the photo away. */
  focal_y               NUMERIC(4, 3) NOT NULL DEFAULT 0.5,
  version               INTEGER NOT NULL DEFAULT 1,
  verified_at           TIMESTAMPTZ,
  client_token          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_profile_media_draft_scope CHECK (draft_path LIKE (shop_id::text || '/%')),
  CONSTRAINT shop_profile_media_rendition_scope CHECK (rendition_source_path LIKE (shop_id::text || '/%')),
  CONSTRAINT shop_profile_media_public_scope CHECK (
    public_path IS NULL OR public_path LIKE (shop_id::text || '/%')
  ),
  CONSTRAINT shop_profile_media_public_requires_verified CHECK (
    public_path IS NULL OR verified_at IS NOT NULL
  ),
  CONSTRAINT shop_profile_media_filename_len CHECK (
    original_filename IS NULL OR char_length(original_filename) <= 120
  ),
  CONSTRAINT shop_profile_media_focal_range CHECK (focal_y BETWEEN 0 AND 1)
);

-- One logo and one cover per shop. Replacing is an UPDATE of this row with a
-- bumped version and a new key, so the old object is queued for cleanup rather
-- than left addressable.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_shop_profile_media_purpose
  ON public.shop_profile_media (shop_id, purpose);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_shop_profile_media_token
  ON public.shop_profile_media (shop_id, purpose, client_token)
  WHERE client_token IS NOT NULL;

COMMENT ON TABLE public.shop_profile_media IS
  'Shop logo and cover. Same lifecycle as product_media and the same buckets, under <shop_id>/profile/<purpose>/. Public only when verified AND the shop is active.';

ALTER TABLE public.shop_profile_media ENABLE ROW LEVEL SECURITY;

-- Public: only a published asset of an ACTIVE shop, and only the public path.
DROP POLICY IF EXISTS "shop_profile_media_select_public" ON public.shop_profile_media;
CREATE POLICY "shop_profile_media_select_public" ON public.shop_profile_media
  FOR SELECT
  USING (
    public_path IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.state = 'active')
  );

DROP POLICY IF EXISTS "shop_profile_media_select_member" ON public.shop_profile_media;
CREATE POLICY "shop_profile_media_select_member" ON public.shop_profile_media
  FOR SELECT TO authenticated
  USING (public.is_shop_member(shop_id) OR public.is_admin());

-- No INSERT/UPDATE/DELETE policy for anyone: rows move only through the
-- SECURITY DEFINER RPCs below, which is what keeps paths server-chosen.
GRANT SELECT ON public.shop_profile_media TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_profile_media TO service_role;

-- ─── 4. Profile media lifecycle ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.shop_profile_media_upload_init(
  _shop_id           UUID,
  _purpose           TEXT,
  _content_type      TEXT,
  _byte_size         INTEGER,
  _original_filename TEXT DEFAULT NULL,
  _client_token      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lim      JSONB := public.shop_media_limits();
  _existing public.shop_profile_media%ROWTYPE;
  _id       UUID := gen_random_uuid();
  _base     TEXT;
  _clean    TEXT;
  _next     INTEGER := 1;
BEGIN
  PERFORM public.product_assert_writable(_shop_id);

  IF _purpose NOT IN ('logo', 'cover') THEN
    RAISE EXCEPTION 'loại ảnh không hợp lệ' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT (_lim -> 'input_content_types' ? _content_type) THEN
    RAISE EXCEPTION 'định dạng ảnh % không được hỗ trợ — dùng JPG, PNG hoặc WebP', _content_type
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _byte_size IS NULL OR _byte_size <= 0
     OR _byte_size > (_lim ->> 'max_input_bytes')::int THEN
    RAISE EXCEPTION 'ảnh vượt quá % MB', round((_lim ->> 'max_input_bytes')::numeric / 1048576, 0)
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO _existing FROM public.shop_profile_media
  WHERE shop_id = _shop_id AND purpose = _purpose::public.shop_media_purpose
  FOR UPDATE;

  -- Idempotent retry: same token, same row, same paths.
  IF FOUND AND _client_token IS NOT NULL AND _existing.client_token = _client_token THEN
    RETURN jsonb_build_object(
      'media_id', _existing.id, 'draft_path', _existing.draft_path,
      'rendition_path', _existing.rendition_source_path,
      'version', _existing.version, 'reused', true);
  END IF;

  IF FOUND THEN
    -- Replacing. The old objects are queued BEFORE the row forgets their
    -- paths, or nothing would ever be able to name them again.
    PERFORM public.shop_media_enqueue_cleanup(
      (_lim ->> 'draft_bucket'), _existing.draft_path, _shop_id, NULL, _existing.id, 'replace');
    PERFORM public.shop_media_enqueue_cleanup(
      (_lim ->> 'draft_bucket'), _existing.rendition_source_path, _shop_id, NULL, _existing.id, 'replace');
    IF _existing.public_path IS NOT NULL THEN
      PERFORM public.shop_media_enqueue_cleanup(
        (_lim ->> 'public_bucket'), _existing.public_path, _shop_id, NULL, _existing.id, 'replace');
    END IF;
    _next := _existing.version + 1;
    _id   := _existing.id;
  END IF;

  -- Server-chosen, unguessable, and versioned: a replaced asset gets a NEW
  -- immutable key, so no CDN anywhere can serve the old bytes for the new one.
  _base  := _shop_id::text || '/profile/' || _purpose || '/' || _id::text || '/v' || _next::text;
  _clean := NULLIF(btrim(regexp_replace(coalesce(_original_filename, ''), '[^\w\s.\-]', '', 'g')), '');

  IF FOUND THEN
    UPDATE public.shop_profile_media
    SET draft_path = _base || '/original',
        rendition_source_path = _base || '/rendition.webp',
        public_path = NULL, verified_at = NULL, byte_size = NULL,
        width = NULL, height = NULL,
        content_type = _content_type, original_filename = left(_clean, 120),
        client_token = _client_token, version = _next, updated_at = now()
    WHERE id = _id;
  ELSE
    INSERT INTO public.shop_profile_media
      (id, shop_id, purpose, draft_path, rendition_source_path, content_type,
       original_filename, client_token, version)
    VALUES
      (_id, _shop_id, _purpose::public.shop_media_purpose, _base || '/original',
       _base || '/rendition.webp', _content_type, left(_clean, 120), _client_token, _next);
  END IF;

  RETURN jsonb_build_object(
    'media_id', _id, 'draft_path', _base || '/original',
    'rendition_path', _base || '/rendition.webp', 'version', _next, 'reused', false);
END $$;

CREATE OR REPLACE FUNCTION public.shop_profile_media_finalize(
  _media_id UUID,
  _width    INTEGER DEFAULT NULL,
  _height   INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lim       JSONB := public.shop_media_limits();
  _media     public.shop_profile_media%ROWTYPE;
  _orig_meta JSONB;
  _rend_meta JSONB;
  _rend_size BIGINT;
BEGIN
  SELECT * INTO _media FROM public.shop_profile_media WHERE id = _media_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'media not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_shop_manager(_media.shop_id) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF _media.verified_at IS NOT NULL THEN
    RETURN jsonb_build_object('media_id', _media.id, 'verified', true, 'reused', true);
  END IF;

  -- Read back from storage.objects, which only the Storage API writes. A
  -- client that lies about having re-encoded fails here, exactly as it does
  -- for product media.
  SELECT metadata INTO _orig_meta FROM storage.objects
  WHERE bucket_id = (_lim ->> 'draft_bucket') AND name = _media.draft_path;
  IF _orig_meta IS NULL THEN
    RAISE EXCEPTION 'chưa thấy ảnh gốc trên máy chủ — tải lại ảnh' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT metadata INTO _rend_meta FROM storage.objects
  WHERE bucket_id = (_lim ->> 'draft_bucket') AND name = _media.rendition_source_path;
  IF _rend_meta IS NULL THEN
    RAISE EXCEPTION 'chưa thấy ảnh đã xử lý trên máy chủ — tải lại ảnh' USING ERRCODE = 'no_data_found';
  END IF;

  IF coalesce(_rend_meta ->> 'mimetype', '') <> (_lim ->> 'rendition_content_type') THEN
    RAISE EXCEPTION 'ảnh đã xử lý phải là %', (_lim ->> 'rendition_content_type')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  _rend_size := coalesce((_rend_meta ->> 'size')::bigint, 0);
  IF _rend_size <= 0 OR _rend_size > (_lim ->> 'max_rendition_bytes')::bigint THEN
    RAISE EXCEPTION 'ảnh đã xử lý vượt quá % KB', (_lim ->> 'max_rendition_bytes')::int / 1024
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _width IS NOT NULL AND (_width > (_lim ->> 'max_dimension')::int
                             OR _height > (_lim ->> 'max_dimension')::int) THEN
    RAISE EXCEPTION 'ảnh vượt quá % px', (_lim ->> 'max_dimension')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.shop_profile_media
  SET verified_at = now(), byte_size = _rend_size::int,
      width = _width, height = _height, updated_at = now()
  WHERE id = _media_id AND verified_at IS NULL;

  RETURN jsonb_build_object('media_id', _media_id, 'verified', true, 'reused', false);
END $$;

/* Framing only. Deliberately separate from the upload: re-framing a cover must
   not re-upload it, and must not invalidate the public key. */
CREATE OR REPLACE FUNCTION public.shop_profile_media_set_focal(
  _media_id UUID,
  _focal_y  NUMERIC
)
RETURNS public.shop_profile_media
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.shop_profile_media%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.shop_profile_media WHERE id = _media_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'media not found' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.product_assert_writable(_row.shop_id);
  IF _focal_y IS NULL OR _focal_y < 0 OR _focal_y > 1 THEN
    RAISE EXCEPTION 'vị trí khung ảnh không hợp lệ' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.shop_profile_media
  SET focal_y = _focal_y, updated_at = now()
  WHERE id = _media_id
  RETURNING * INTO _row;
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.shop_profile_media_delete(_media_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lim JSONB := public.shop_media_limits();
  _row public.shop_profile_media%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.shop_profile_media WHERE id = _media_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN true;   -- already gone
  END IF;
  PERFORM public.product_assert_writable(_row.shop_id);

  -- Queue before the row goes: after the DELETE nothing knows these paths.
  PERFORM public.shop_media_enqueue_cleanup(
    (_lim ->> 'draft_bucket'), _row.draft_path, _row.shop_id, NULL, _row.id, 'delete');
  PERFORM public.shop_media_enqueue_cleanup(
    (_lim ->> 'draft_bucket'), _row.rendition_source_path, _row.shop_id, NULL, _row.id, 'delete');
  IF _row.public_path IS NOT NULL THEN
    PERFORM public.shop_media_enqueue_cleanup(
      (_lim ->> 'public_bucket'), _row.public_path, _row.shop_id, NULL, _row.id, 'delete');
  END IF;

  DELETE FROM public.shop_profile_media WHERE id = _media_id;
  RETURN true;
END $$;

/* The worker's commit, mirroring product_publish_commit: the ONLY place a
   public_path is ever set, and only for an object the worker has already
   copied. service_role only — a user JWT cannot reach it. */
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
  _row public.shop_profile_media%ROWTYPE;
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

  UPDATE public.shop_profile_media
  SET public_path = _public_path, updated_at = now()
  WHERE id = _media_id;
  RETURN true;
END $$;

-- A shop leaving `active` takes its logo and cover off the public surface in
-- the same transaction, and queues the objects — the same rule product media
-- already follows.
CREATE OR REPLACE FUNCTION public.shop_profile_media_revoke(_shop_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lim JSONB := public.shop_media_limits();
  _row public.shop_profile_media%ROWTYPE;
  _n   INTEGER := 0;
BEGIN
  FOR _row IN
    SELECT * FROM public.shop_profile_media WHERE shop_id = _shop_id AND public_path IS NOT NULL
  LOOP
    PERFORM public.shop_media_enqueue_cleanup(
      (_lim ->> 'public_bucket'), _row.public_path, _shop_id, NULL, _row.id, 'unpublish');
    UPDATE public.shop_profile_media SET public_path = NULL, updated_at = now() WHERE id = _row.id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;

-- A shop leaving `active` already takes its product renditions down. Profile
-- media has to go with them, in the same transaction — a suspended shop whose
-- logo is still served is still a shop with a public face.
CREATE OR REPLACE FUNCTION public.shops_revoke_media_on_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p RECORD;
BEGIN
  IF NEW.state = 'active' OR NEW.state = OLD.state THEN
    RETURN NEW;
  END IF;
  FOR _p IN SELECT DISTINCT product_id FROM public.product_media
            WHERE shop_id = NEW.id AND public_path IS NOT NULL
  LOOP
    PERFORM public.shop_media_revoke_product_renditions(_p.product_id, 'suspend');
  END LOOP;
  PERFORM public.shop_profile_media_revoke(NEW.id);
  RETURN NEW;
END $$;

-- ─── 5. Grants ──────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.product_media_reorder(UUID, INTEGER, UUID[])                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_variant_set_media(UUID, UUID)                           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_profile_media_upload_init(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_profile_media_finalize(UUID, INTEGER, INTEGER)             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_profile_media_set_focal(UUID, NUMERIC)                     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_profile_media_delete(UUID)                                 FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_profile_media_publish_commit(UUID, TEXT)                   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_profile_media_revoke(UUID)                                 FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.product_media_reorder(UUID, INTEGER, UUID[])                    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_variant_set_media(UUID, UUID)                           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shop_profile_media_upload_init(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shop_profile_media_finalize(UUID, INTEGER, INTEGER)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shop_profile_media_set_focal(UUID, NUMERIC)                     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shop_profile_media_delete(UUID)                                 TO authenticated, service_role;
-- The worker's, and nobody else's.
GRANT EXECUTE ON FUNCTION public.shop_profile_media_publish_commit(UUID, TEXT)                   TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_profile_media_revoke(UUID)                                 TO service_role;
