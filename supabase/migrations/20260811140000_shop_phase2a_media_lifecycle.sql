-- ============================================================================
-- Shop marketplace — P2a.2: product media lifecycle
-- ----------------------------------------------------------------------------
-- P2a.1 recorded WHICH object was public. It could not take a public object
-- away, because SQL cannot delete storage bytes, and the header said so. This
-- migration closes that hole properly rather than deferring it to P2b.
--
-- CONSISTENCY MODEL — stated plainly, because "revoked" meaning two different
-- things is how an image outlives its removal:
--
--   database visibility  revoked SYNCHRONOUSLY, inside the same transaction as
--                        the unpublish / reject / archive / suspend. From the
--                        commit onward public_products and the media policies
--                        serve nothing, for everyone.
--   known-URL object     revoked ASYNCHRONOUSLY. The same transaction writes a
--                        durable cleanup job; a trusted worker holding the
--                        service role deletes the object and only then marks
--                        the job done.
--
--   operational default  worker every 5 minutes; target p95 deletion within
--   (CONFIGURATION,      10 minutes of revocation. Retry is exponential —
--    not a product SLA)  1m, 5m, 25m, 2h, 10h, then capped at 24h — for at
--                        most 8 attempts, after which the job goes `failed`
--                        and stays visible instead of disappearing.
--   storage API failure  the job is never marked done. attempts increments,
--                        last_error is kept, next_attempt_at moves out. A job
--                        left `in_progress` (worker died mid-flight) is
--                        returned to `pending` by the reconcile pass.
--   object already gone  success. Deletion is idempotent by definition.
--   observability        public.shop_media_cleanup_health — pending, due,
--                        stuck and failed counts plus the oldest failure.
--
-- Anything a client says is treated as a claim, never as a fact: sizes and
-- MIME types are read back from storage.objects, which only the Storage API
-- can write. A client that lies about having re-encoded its photo fails
-- finalize.
--
-- HEIC: NOT accepted. Browsers cannot decode it reliably, the repo has no
-- trusted conversion service, and adding one to satisfy a pilot of three
-- sellers is not a trade worth making. Rejected with a Vietnamese message that
-- tells the seller what to do instead, rather than pretending to support it.
-- ============================================================================

-- ─── 1. Media columns the lifecycle needs ───────────────────────────────────

ALTER TABLE public.product_media
  -- The client-processed, EXIF-free WebP that becomes the public rendition.
  -- Separate object from draft_path: the original never goes public.
  ADD COLUMN IF NOT EXISTS rendition_source_path TEXT,
  ADD COLUMN IF NOT EXISTS content_type          TEXT,
  ADD COLUMN IF NOT EXISTS byte_size             INTEGER,
  ADD COLUMN IF NOT EXISTS width                 INTEGER,
  ADD COLUMN IF NOT EXISTS height                INTEGER,
  -- Display metadata only. Sanitised, never part of any object key.
  ADD COLUMN IF NOT EXISTS original_filename     TEXT,
  -- Bumped on every replace. The public key embeds it, so a replaced image
  -- gets a NEW immutable URL and no CDN anywhere can serve the old bytes for
  -- the new product.
  ADD COLUMN IF NOT EXISTS version               INTEGER NOT NULL DEFAULT 1,
  -- Set by product_media_finalize once the objects were verified against
  -- storage.objects. Unverified media cannot be submitted or published.
  ADD COLUMN IF NOT EXISTS verified_at           TIMESTAMPTZ,
  -- Idempotency key for upload_init. A retried init returns the same row
  -- instead of leaving a second orphan behind.
  ADD COLUMN IF NOT EXISTS client_token          TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_media_client_token
  ON public.product_media (product_id, client_token)
  WHERE client_token IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_media_rendition_scope'
  ) THEN
    ALTER TABLE public.product_media
      ADD CONSTRAINT product_media_rendition_scope CHECK (
        rendition_source_path IS NULL
        OR rendition_source_path LIKE (shop_id::text || '/%')
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_media_filename_len'
  ) THEN
    ALTER TABLE public.product_media
      ADD CONSTRAINT product_media_filename_len CHECK (
        original_filename IS NULL OR char_length(original_filename) <= 120
      );
  END IF;
  -- Only a verified media row may ever carry a rendition.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_media_public_requires_verified'
  ) THEN
    ALTER TABLE public.product_media
      ADD CONSTRAINT product_media_public_requires_verified CHECK (
        public_path IS NULL OR verified_at IS NOT NULL
      );
  END IF;
END $$;

-- ─── 2. Limits, in one place ────────────────────────────────────────────────
-- A function rather than scattered literals: the seller form, the RPCs and the
-- tests all read the same numbers, so they cannot drift apart.

CREATE OR REPLACE FUNCTION public.shop_media_limits()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'max_per_product',        8,
    'max_input_bytes',        8388608,      -- 8 MB: a phone photo is 3-5 MB
    'max_rendition_bytes',    1048576,      -- 1 MB after re-encode
    'max_dimension',          2048,
    'input_content_types',    jsonb_build_array('image/jpeg', 'image/png', 'image/webp'),
    'rendition_content_type', 'image/webp', -- canvas re-encode drops EXIF
    'draft_bucket',           'shop-product-media-draft',
    'public_bucket',          'shop-product-media'
  )
$$;

GRANT EXECUTE ON FUNCTION public.shop_media_limits() TO anon, authenticated, service_role;

-- ─── 3. The cleanup outbox ──────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_media_cleanup_state') THEN
    CREATE TYPE public.shop_media_cleanup_state AS ENUM (
      'pending', 'in_progress', 'done', 'failed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.shop_media_cleanup_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id       TEXT NOT NULL,
  object_path     TEXT NOT NULL,
  shop_id         UUID,
  product_id      UUID,
  media_id        UUID,
  reason          TEXT NOT NULL,
  state           public.shop_media_cleanup_state NOT NULL DEFAULT 'pending',
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at      TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  CONSTRAINT shop_media_cleanup_reason_check CHECK (
    reason IN ('unpublish', 'reject', 'archive', 'suspend', 'replace', 'delete', 'orphan')
  ),
  -- last_error is operator-facing text. It must never carry a signed URL: the
  -- worker truncates and strips, and this makes a long paste impossible.
  CONSTRAINT shop_media_cleanup_error_len CHECK (
    last_error IS NULL OR char_length(last_error) <= 500
  )
);

-- Idempotent enqueue: the same object cannot be queued twice while a job for
-- it is still outstanding. Re-revoking something already queued is a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_shop_media_cleanup_open
  ON public.shop_media_cleanup_jobs (bucket_id, object_path)
  WHERE state <> 'done';

CREATE INDEX IF NOT EXISTS idx_shop_media_cleanup_due
  ON public.shop_media_cleanup_jobs (next_attempt_at)
  WHERE state = 'pending';

COMMENT ON TABLE public.shop_media_cleanup_jobs IS
  'Durable outbox. A row here is a promise that a storage object will be deleted. Written in the same transaction as the revocation it belongs to.';

ALTER TABLE public.shop_media_cleanup_jobs ENABLE ROW LEVEL SECURITY;

-- Admins may look. Nobody with a user JWT may write: the worker holds the
-- service role, which bypasses RLS.
DROP POLICY IF EXISTS "shop_media_cleanup_admin_read" ON public.shop_media_cleanup_jobs;
CREATE POLICY "shop_media_cleanup_admin_read" ON public.shop_media_cleanup_jobs
  FOR SELECT TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.shop_media_cleanup_jobs TO authenticated;

-- Ops view. Deliberately counts rather than dumping paths.
CREATE OR REPLACE VIEW public.shop_media_cleanup_health
WITH (security_invoker = true)
AS
  SELECT
    count(*) FILTER (WHERE state = 'pending')                            AS pending,
    count(*) FILTER (WHERE state = 'pending' AND next_attempt_at <= now()) AS due_now,
    count(*) FILTER (WHERE state = 'in_progress' AND claimed_at < now() - INTERVAL '15 minutes') AS stuck,
    count(*) FILTER (WHERE state = 'failed')                             AS failed,
    max(attempts) FILTER (WHERE state IN ('pending', 'failed'))          AS worst_attempts,
    min(created_at) FILTER (WHERE state = 'failed')                      AS oldest_failure_at
  FROM public.shop_media_cleanup_jobs;

GRANT SELECT ON public.shop_media_cleanup_health TO authenticated;

-- ─── 4. Enqueue helper ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.shop_media_enqueue_cleanup(
  _bucket_id   TEXT,
  _object_path TEXT,
  _shop_id     UUID,
  _product_id  UUID,
  _media_id    UUID,
  _reason      TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  IF _object_path IS NULL OR btrim(_object_path) = '' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.shop_media_cleanup_jobs
    (bucket_id, object_path, shop_id, product_id, media_id, reason)
  VALUES
    (_bucket_id, _object_path, _shop_id, _product_id, _media_id, _reason)
  -- Already queued for this object: keep the existing job, reset its backoff
  -- so a fresh revocation is not delayed behind an old failure.
  ON CONFLICT (bucket_id, object_path) WHERE state <> 'done'
  DO UPDATE SET next_attempt_at = LEAST(public.shop_media_cleanup_jobs.next_attempt_at, now()),
                state = CASE WHEN public.shop_media_cleanup_jobs.state = 'failed'
                             THEN 'pending' ELSE public.shop_media_cleanup_jobs.state END,
                updated_at = now()
  RETURNING id INTO _id;

  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.shop_media_enqueue_cleanup(TEXT, TEXT, UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_media_enqueue_cleanup(TEXT, TEXT, UUID, UUID, UUID, TEXT) TO service_role;

-- Revoke every rendition a product currently has, in one place, so unpublish,
-- reject, archive and suspend cannot drift apart.
CREATE OR REPLACE FUNCTION public.shop_media_revoke_product_renditions(
  _product_id UUID,
  _reason     TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row   RECORD;
  _count INTEGER := 0;
BEGIN
  FOR _row IN
    SELECT id, shop_id, public_path
    FROM public.product_media
    WHERE product_id = _product_id AND public_path IS NOT NULL
  LOOP
    PERFORM public.shop_media_enqueue_cleanup(
      (public.shop_media_limits() ->> 'public_bucket'),
      _row.public_path, _row.shop_id, _product_id, _row.id, _reason
    );
    _count := _count + 1;
  END LOOP;

  -- Database visibility goes now, in this transaction. The object goes when
  -- the worker confirms it.
  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.product_media
  SET state = 'draft', public_path = NULL
  WHERE product_id = _product_id AND public_path IS NOT NULL;
  PERFORM set_config('shop.privileged_write', 'off', true);

  RETURN _count;
END $$;

REVOKE ALL ON FUNCTION public.shop_media_revoke_product_renditions(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_media_revoke_product_renditions(UUID, TEXT) TO service_role;

-- ─── 5. Upload: init / finalize ─────────────────────────────────────────────
-- The client chooses none of: bucket, shop, product, path, state, rendition.
-- It sends what it wants to upload; the server decides where it may go.

CREATE OR REPLACE FUNCTION public.product_media_upload_init(
  _product_id        UUID,
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
  _prod     public.products%ROWTYPE;
  _existing public.product_media%ROWTYPE;
  _count    INTEGER;
  _id       UUID := gen_random_uuid();
  _base     TEXT;
  _clean    TEXT;
BEGIN
  SELECT * INTO _prod FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- Closed pilot is a server-side gate, not a hidden button.
  IF NOT public.shop_pilot_has_access() THEN
    RAISE EXCEPTION 'shop pilot access required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.is_shop_manager(_prod.shop_id) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _prod.status NOT IN ('draft', 'needs_changes', 'rejected') THEN
    RAISE EXCEPTION 'product is % — media can only be changed while it is editable', _prod.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF NOT (_lim -> 'input_content_types' ? _content_type) THEN
    -- HEIC lands here, deliberately.
    RAISE EXCEPTION 'định dạng ảnh % không được hỗ trợ — dùng JPG, PNG hoặc WebP (ảnh iPhone HEIC: bật Cài đặt > Camera > Định dạng > Tương thích nhất)', _content_type
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _byte_size IS NULL OR _byte_size <= 0
     OR _byte_size > (_lim ->> 'max_input_bytes')::int THEN
    RAISE EXCEPTION 'ảnh vượt quá % MB', round((_lim ->> 'max_input_bytes')::numeric / 1048576, 0)
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Idempotent retry: same token, same row, same paths.
  IF _client_token IS NOT NULL THEN
    SELECT * INTO _existing FROM public.product_media
    WHERE product_id = _product_id AND client_token = _client_token;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'media_id',      _existing.id,
        'draft_path',    _existing.draft_path,
        'rendition_path', _existing.rendition_source_path,
        'version',       _existing.version,
        'reused',        true
      );
    END IF;
  END IF;

  SELECT count(*) INTO _count FROM public.product_media WHERE product_id = _product_id;
  IF _count >= (_lim ->> 'max_per_product')::int THEN
    RAISE EXCEPTION 'mỗi sản phẩm tối đa % ảnh', (_lim ->> 'max_per_product')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Unguessable, and derived from nothing the user supplied. The uploaded
  -- filename is display metadata; it never becomes authority.
  _base  := _prod.shop_id::text || '/' || _product_id::text || '/' || _id::text;
  _clean := NULLIF(btrim(regexp_replace(coalesce(_original_filename, ''), '[^\w\s.\-]', '', 'g')), '');

  PERFORM set_config('shop.privileged_write', 'on', true);
  INSERT INTO public.product_media
    (id, product_id, shop_id, draft_path, rendition_source_path, content_type,
     original_filename, client_token, position, state)
  VALUES
    (_id, _product_id, _prod.shop_id, _base || '/original', _base || '/rendition.webp',
     _content_type, left(_clean, 120), _client_token, _count, 'draft');
  PERFORM set_config('shop.privileged_write', 'off', true);

  RETURN jsonb_build_object(
    'media_id',       _id,
    'draft_path',     _base || '/original',
    'rendition_path', _base || '/rendition.webp',
    'version',        1,
    'reused',         false
  );
END $$;

-- Authoritative verification. Everything checked here is read from
-- storage.objects, which only the Storage API writes — so a client cannot
-- assert its way past any of it.
CREATE OR REPLACE FUNCTION public.product_media_finalize(
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
  _media     public.product_media%ROWTYPE;
  _orig_meta JSONB;
  _rend_meta JSONB;
  _rend_size BIGINT;
BEGIN
  SELECT * INTO _media FROM public.product_media WHERE id = _media_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'media not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_shop_manager(_media.shop_id) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Already verified: return the same answer instead of doing it twice.
  IF _media.verified_at IS NOT NULL THEN
    RETURN jsonb_build_object('media_id', _media.id, 'verified', true, 'reused', true);
  END IF;

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

  -- The client claimed it re-encoded. This is where the claim is checked.
  IF coalesce(_rend_meta ->> 'mimetype', '') <> (_lim ->> 'rendition_content_type') THEN
    RAISE EXCEPTION 'ảnh đã xử lý phải là % (nhận được %)',
      (_lim ->> 'rendition_content_type'), coalesce(_rend_meta ->> 'mimetype', 'không rõ')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  _rend_size := coalesce((_rend_meta ->> 'size')::bigint, 0);
  IF _rend_size <= 0 OR _rend_size > (_lim ->> 'max_rendition_bytes')::bigint THEN
    RAISE EXCEPTION 'ảnh đã xử lý vượt quá % KB', (_lim ->> 'max_rendition_bytes')::int / 1024
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF coalesce((_orig_meta ->> 'size')::bigint, 0) > (_lim ->> 'max_input_bytes')::bigint THEN
    RAISE EXCEPTION 'ảnh gốc vượt quá giới hạn' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _width IS NOT NULL AND (_width > (_lim ->> 'max_dimension')::int
                             OR _height > (_lim ->> 'max_dimension')::int) THEN
    RAISE EXCEPTION 'ảnh vượt quá % px' , (_lim ->> 'max_dimension')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.product_media
  SET verified_at = now(),
      byte_size   = _rend_size::int,
      width       = _width,
      height      = _height,
      updated_at  = now()
  WHERE id = _media_id AND verified_at IS NULL;
  PERFORM set_config('shop.privileged_write', 'off', true);

  RETURN jsonb_build_object('media_id', _media_id, 'verified', true, 'reused', false);
END $$;

-- Delete: the row goes now, both objects are queued.
CREATE OR REPLACE FUNCTION public.product_media_delete(_media_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lim   JSONB := public.shop_media_limits();
  _media public.product_media%ROWTYPE;
BEGIN
  SELECT * INTO _media FROM public.product_media WHERE id = _media_id FOR UPDATE;
  IF NOT FOUND THEN
    -- Deleting something already gone is success, not an error to retry.
    RETURN true;
  END IF;
  IF NOT (public.is_shop_manager(_media.shop_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public.shop_media_enqueue_cleanup(
    (_lim ->> 'draft_bucket'), _media.draft_path, _media.shop_id, _media.product_id, _media.id, 'delete');
  PERFORM public.shop_media_enqueue_cleanup(
    (_lim ->> 'draft_bucket'), _media.rendition_source_path, _media.shop_id, _media.product_id, _media.id, 'delete');
  IF _media.public_path IS NOT NULL THEN
    PERFORM public.shop_media_enqueue_cleanup(
      (_lim ->> 'public_bucket'), _media.public_path, _media.shop_id, _media.product_id, _media.id, 'delete');
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  DELETE FROM public.product_media WHERE id = _media_id;
  PERFORM set_config('shop.privileged_write', 'off', true);

  RETURN true;
END $$;

-- ─── 6. Publish: copy first, flip second, delete third ──────────────────────
-- The order matters. Flipping the pointer before the bytes exist gives the PDP
-- a 404; deleting the old object before the pointer moves gives it a hole.

CREATE OR REPLACE FUNCTION public.product_publish_prepare(_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lim  JSONB := public.shop_media_limits();
  _prod public.products%ROWTYPE;
  _plan JSONB;
BEGIN
  SELECT * INTO _prod FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (public.is_shop_manager(_prod.shop_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _prod.status <> 'approved' THEN
    RAISE EXCEPTION 'product is % — only an approved product may be published', _prod.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'media_id', m.id,
           'source',   m.rendition_source_path,
           -- Immutable and versioned: a replaced image never reuses a key, so
           -- no CDN can answer the new URL with the old bytes.
           'target',   m.shop_id::text || '/' || m.product_id::text || '/'
                       || m.id::text || '-v' || m.version::text || '.webp'
         ) ORDER BY m.position)
  INTO _plan
  FROM public.product_media m
  WHERE m.product_id = _product_id AND m.verified_at IS NOT NULL;

  IF _plan IS NULL THEN
    RAISE EXCEPTION 'chưa có ảnh nào được xác minh' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN jsonb_build_object(
    'product_id',    _product_id,
    'draft_bucket',  _lim ->> 'draft_bucket',
    'public_bucket', _lim ->> 'public_bucket',
    'copies',        _plan
  );
END $$;

-- Called by the trusted worker AFTER every copy landed. service_role only:
-- a client reaching this could publish bytes nobody verified.
CREATE OR REPLACE FUNCTION public.product_publish_commit(
  _product_id UUID,
  _copied     JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lim   JSONB := public.shop_media_limits();
  _item  JSONB;
  _old   TEXT;
  _n     INTEGER := 0;
  _shop  UUID;
BEGIN
  SELECT shop_id INTO _shop FROM public.products WHERE id = _product_id FOR UPDATE;
  IF _shop IS NULL THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);

  FOR _item IN SELECT * FROM jsonb_array_elements(_copied) LOOP
    SELECT public_path INTO _old FROM public.product_media
    WHERE id = (_item ->> 'media_id')::uuid FOR UPDATE;

    -- A key can come back into use: unpublish queues it for deletion, then the
    -- seller republishes before the worker got there. Without this the worker
    -- would happily delete a live rendition, and the PDP would 404 minutes
    -- after a successful publish. Found by the reconciliation test, not by
    -- reading the code.
    DELETE FROM public.shop_media_cleanup_jobs
    WHERE bucket_id = (_lim ->> 'public_bucket')
      AND object_path = (_item ->> 'target')
      AND state <> 'done';

    UPDATE public.product_media
    SET state = 'approved',
        public_path = _item ->> 'target',
        updated_at = now()
    WHERE id = (_item ->> 'media_id')::uuid
      AND verified_at IS NOT NULL;

    -- The superseded object is queued only once the pointer has moved.
    IF _old IS NOT NULL AND _old <> (_item ->> 'target') THEN
      PERFORM public.shop_media_enqueue_cleanup(
        (_lim ->> 'public_bucket'), _old, _shop, _product_id,
        (_item ->> 'media_id')::uuid, 'replace');
    END IF;

    _n := _n + 1;
  END LOOP;

  UPDATE public.products SET is_published = true WHERE id = _product_id;

  PERFORM set_config('shop.privileged_write', 'off', true);
  RETURN _n;
END $$;

REVOKE ALL ON FUNCTION public.product_publish_commit(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_publish_commit(UUID, JSONB) TO service_role;

-- ─── 7. Revocation wired into every transition ──────────────────────────────
-- product_set_published(false) now revokes AND queues. Publishing is no longer
-- done here: it needs bytes copied first, so it goes through the worker.

CREATE OR REPLACE FUNCTION public.product_set_published(_product_id UUID, _published BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.products%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (public.is_shop_manager(_row.shop_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _published AND _row.status <> 'approved' THEN
    RAISE EXCEPTION 'product is % — only an approved product may be published', _row.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _published THEN
    -- Publishing needs the rendition copied into the public bucket first, and
    -- SQL cannot copy bytes. product_publish_prepare + the shop-media-lifecycle
    -- function do it, then product_publish_commit flips the pointer.
    RAISE EXCEPTION 'dùng shop-media-lifecycle để đăng bán — SQL không sao chép được ảnh'
      USING ERRCODE = 'feature_not_supported';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products SET is_published = false WHERE id = _product_id;
  PERFORM set_config('shop.privileged_write', 'off', true);

  PERFORM public.shop_media_revoke_product_renditions(_product_id, 'unpublish');
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.product_archive(_product_id UUID)
RETURNS public.product_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.products%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (public.is_shop_manager(_row.shop_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products SET status = 'archived', is_published = false
  WHERE id = _product_id AND status <> 'archived';
  PERFORM set_config('shop.privileged_write', 'off', true);

  PERFORM public.shop_media_revoke_product_renditions(_product_id, 'archive');
  RETURN 'archived';
END $$;

CREATE OR REPLACE FUNCTION public.product_decide(
  _product_id       UUID,
  _decision         TEXT,
  _applicant_note   TEXT DEFAULT NULL,
  _internal_note    TEXT DEFAULT NULL,
  _requested_fields TEXT[] DEFAULT '{}'
)
RETURNS public.product_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row  public.products%ROWTYPE;
  _next public.product_status;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _decision NOT IN ('approve', 'reject', 'request_changes') THEN
    RAISE EXCEPTION 'unknown decision %', _decision USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _decision <> 'approve' AND coalesce(btrim(_applicant_note), '') = '' THEN
    RAISE EXCEPTION 'reject and request_changes require a note for the seller'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO _row FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF _row.status <> 'pending_review' THEN
    RAISE EXCEPTION 'product is % — only pending_review may be decided', _row.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  _next := CASE _decision
             WHEN 'approve' THEN 'approved'
             WHEN 'reject'  THEN 'rejected'
             ELSE 'needs_changes'
           END::public.product_status;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products
  SET status = _next, decided_at = now(), decided_by = auth.uid(),
      applicant_note = _applicant_note, internal_note = _internal_note,
      requested_fields = CASE WHEN _decision = 'request_changes' THEN _requested_fields ELSE '{}' END
  WHERE id = _product_id AND status = 'pending_review';
  IF _decision <> 'approve' THEN
    UPDATE public.products SET is_published = false WHERE id = _product_id;
  END IF;
  PERFORM set_config('shop.privileged_write', 'off', true);

  IF _decision <> 'approve' THEN
    PERFORM public.shop_media_revoke_product_renditions(_product_id, 'reject');
  END IF;

  PERFORM public.log_audit_event(
    ('shop_product_' || _decision)::text,
    'admin'::text,
    'shop_product'::text,
    _product_id::text,
    (CASE WHEN _decision = 'reject' THEN 'warning' ELSE 'info' END)::text,
    jsonb_build_object('shop_id', _row.shop_id, 'requested_fields', _requested_fields),
    'user'::text
  );

  RETURN _next;
END $$;

-- Suspending a shop must take its catalog's renditions with it. The public
-- projection already hides them; this queues the objects too.
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
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS shops_revoke_media_on_state_change_trg ON public.shops;
CREATE TRIGGER shops_revoke_media_on_state_change_trg
  AFTER UPDATE OF state ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.shops_revoke_media_on_state_change();

-- ─── 8. Worker interface ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.shop_media_cleanup_claim(_limit INTEGER DEFAULT 25)
RETURNS SETOF public.shop_media_cleanup_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.shop_media_cleanup_jobs j
  SET state = 'in_progress', claimed_at = now(), updated_at = now()
  WHERE j.id IN (
    SELECT id FROM public.shop_media_cleanup_jobs
    WHERE state = 'pending' AND next_attempt_at <= now()
    ORDER BY next_attempt_at
    LIMIT GREATEST(_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.*;
$$;

REVOKE ALL ON FUNCTION public.shop_media_cleanup_claim(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_media_cleanup_claim(INTEGER) TO service_role;

-- Backoff lives here, not in the worker: a redeployed worker with a different
-- opinion about retries cannot change the policy.
CREATE OR REPLACE FUNCTION public.shop_media_cleanup_complete(
  _job_id UUID,
  _ok     BOOLEAN,
  _error  TEXT DEFAULT NULL
)
RETURNS public.shop_media_cleanup_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job   public.shop_media_cleanup_jobs%ROWTYPE;
  _next  public.shop_media_cleanup_state;
  _delay INTERVAL;
BEGIN
  SELECT * INTO _job FROM public.shop_media_cleanup_jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF _ok THEN
    UPDATE public.shop_media_cleanup_jobs
    SET state = 'done', completed_at = now(), updated_at = now(), last_error = NULL
    WHERE id = _job_id;
    RETURN 'done';
  END IF;

  -- 1m, 5m, 25m, 2h, 10h, then capped. 8 attempts, then it stops retrying and
  -- starts being visible instead.
  _delay := CASE LEAST(_job.attempts, 5)
              WHEN 0 THEN INTERVAL '1 minute'
              WHEN 1 THEN INTERVAL '5 minutes'
              WHEN 2 THEN INTERVAL '25 minutes'
              WHEN 3 THEN INTERVAL '2 hours'
              WHEN 4 THEN INTERVAL '10 hours'
              ELSE INTERVAL '24 hours'
            END;
  _next := CASE WHEN _job.attempts + 1 >= 8 THEN 'failed' ELSE 'pending' END::public.shop_media_cleanup_state;

  UPDATE public.shop_media_cleanup_jobs
  SET state = _next,
      attempts = _job.attempts + 1,
      next_attempt_at = now() + _delay,
      claimed_at = NULL,
      -- Truncated hard: an error string is not a place to leak a signed URL.
      last_error = left(regexp_replace(coalesce(_error, 'unknown'), '\?[^ ]*', '', 'g'), 500),
      updated_at = now()
  WHERE id = _job_id;

  RETURN _next;
END $$;

REVOKE ALL ON FUNCTION public.shop_media_cleanup_complete(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_media_cleanup_complete(UUID, BOOLEAN, TEXT) TO service_role;

-- ─── 9. Reconciliation ──────────────────────────────────────────────────────
-- Two failure modes a queue alone cannot fix: a worker that died holding a
-- job, and an object nobody ever queued because the process crashed between
-- the copy and the commit.

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

  -- A public object no live media row points at. Grace period so a copy that
  -- is mid-flight toward its commit is never swept away underneath itself.
  FOR _row IN
    SELECT o.name
    FROM storage.objects o
    WHERE o.bucket_id = (_lim ->> 'public_bucket')
      AND o.created_at < now() - INTERVAL '1 hour'
      AND NOT EXISTS (
        SELECT 1 FROM public.product_media m WHERE m.public_path = o.name
      )
  LOOP
    PERFORM public.shop_media_enqueue_cleanup(
      (_lim ->> 'public_bucket'), _row.name, NULL, NULL, NULL, 'orphan');
    _orphans := _orphans + 1;
  END LOOP;

  -- Same for the private side: an upload_init whose upload never finished.
  FOR _row IN
    SELECT o.name
    FROM storage.objects o
    WHERE o.bucket_id = (_lim ->> 'draft_bucket')
      AND o.created_at < now() - INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.product_media m
        WHERE m.draft_path = o.name OR m.rendition_source_path = o.name
      )
  LOOP
    PERFORM public.shop_media_enqueue_cleanup(
      (_lim ->> 'draft_bucket'), _row.name, NULL, NULL, NULL, 'orphan');
    _orphans := _orphans + 1;
  END LOOP;

  RETURN jsonb_build_object('unstuck', _unstuck, 'orphans_queued', _orphans);
END $$;

REVOKE ALL ON FUNCTION public.shop_media_reconcile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_media_reconcile() TO service_role;

-- ─── 10. Grants for the new client-facing RPCs ──────────────────────────────

REVOKE ALL ON FUNCTION public.product_media_upload_init(UUID, TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_media_finalize(UUID, INTEGER, INTEGER)            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_media_delete(UUID)                                FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_publish_prepare(UUID)                             FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.product_media_upload_init(UUID, TEXT, INTEGER, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_media_finalize(UUID, INTEGER, INTEGER)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_media_delete(UUID)                                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_publish_prepare(UUID)                             TO authenticated, service_role;

-- ─── 11. Submission gate: unverified media cannot reach the queue ───────────

CREATE OR REPLACE FUNCTION public.product_submit_for_review(_product_id UUID)
RETURNS public.product_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row      public.products%ROWTYPE;
  _variants INTEGER;
  _media    INTEGER;
BEGIN
  SELECT * INTO _row FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_shop_manager(_row.shop_id) THEN
    RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _row.status NOT IN ('draft', 'needs_changes') THEN
    RAISE EXCEPTION 'product is % — only draft or needs_changes may be submitted', _row.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _row.category_slug IS NULL THEN
    RAISE EXCEPTION 'category is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT count(*) INTO _variants FROM public.product_variants WHERE product_id = _product_id;
  IF _variants < 1 THEN
    RAISE EXCEPTION 'at least one variant with a price is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Verified, not merely present: a row whose upload never landed would send
  -- an empty product to a moderator.
  SELECT count(*) INTO _media FROM public.product_media
  WHERE product_id = _product_id AND verified_at IS NOT NULL;
  IF _media < 1 THEN
    RAISE EXCEPTION 'at least one verified photo is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products
  SET status = 'pending_review', submitted_at = now(), requested_fields = '{}'
  WHERE id = _product_id AND status = _row.status;
  PERFORM set_config('shop.privileged_write', 'off', true);

  RETURN 'pending_review';
END $$;
