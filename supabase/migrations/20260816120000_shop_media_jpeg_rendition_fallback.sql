-- ============================================================================
-- JPEG rendition fallback (Wave-1 blocker, 2026-08-16)
-- ----------------------------------------------------------------------------
-- iOS Safari cannot encode WebP through canvas.toBlob, so sellers on iPhone
-- could not upload a single product photo. The client now retries its quality
-- ladder as JPEG when the WebP encoder is missing; this migration widens the
-- rendition MIME allowlist to match. Nothing else moves:
--
--   · the verify model is unchanged — finalize still reads the REAL mimetype
--     back from storage.objects, which only the Storage API writes;
--   · object keys keep their .webp suffix even when the bytes are JPEG
--     (rendition.webp, <media_id>-v<n>.webp, profile/.../live.webp). The path
--     lives in DB rows, clients build URLs only from those rows, browsers
--     render by Content-Type — and shop_media_reconcile derives the expected
--     public key with .webp hardcoded. Extension is a claim; the MIME in
--     storage.objects is the truth.
--
-- Three CREATE OR REPLACE, no grant changes (replace keeps the originals from
-- 20260811140000 / 20260811220000).
-- ============================================================================

-- ─── 1. Limits: the rendition MIME allowlist ────────────────────────────────
-- 'rendition_content_type' (singular) stays as the PREFERRED type so any
-- reader that predates the list keeps working; 'rendition_content_types' is
-- what the finalize functions now check membership against.

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
    'rendition_content_type', 'image/webp', -- preferred; canvas re-encode drops EXIF
    -- image/jpeg: what iOS Safari's canvas produces instead of WebP. The
    -- re-encode drops EXIF the same way; the format is not the privacy step.
    'rendition_content_types', jsonb_build_array('image/webp', 'image/jpeg'),
    'draft_bucket',           'shop-product-media-draft',
    'public_bucket',          'shop-product-media'
  )
$$;

-- ─── 2. product_media_finalize: equality check → membership check ───────────
-- Byte-identical to 20260811140000 apart from the MIME check and its message.

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

  -- The client claimed it re-encoded. This is where the claim is checked —
  -- against the MIME the Storage API recorded, never the object key's
  -- extension: extension is a claim; the MIME in storage.objects is the truth.
  IF NOT ((_lim -> 'rendition_content_types') ? coalesce(_rend_meta ->> 'mimetype', '')) THEN
    RAISE EXCEPTION 'ảnh đã xử lý phải là WebP hoặc JPEG (nhận được %)',
      coalesce(_rend_meta ->> 'mimetype', 'không rõ')
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

-- ─── 3. shop_profile_media_finalize: the same widening ──────────────────────
-- Byte-identical to 20260811220000 apart from the MIME check and its message.

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

  IF NOT ((_lim -> 'rendition_content_types') ? coalesce(_rend_meta ->> 'mimetype', '')) THEN
    RAISE EXCEPTION 'ảnh đã xử lý phải là WebP hoặc JPEG (nhận được %)',
      coalesce(_rend_meta ->> 'mimetype', 'không rõ')
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
