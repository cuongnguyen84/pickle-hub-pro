-- ============================================================================
-- Shop — thông số kỹ thuật của sản phẩm, và một mô tả dài hơn ba chữ.
--
-- Hai lỗ hổng cùng một gốc: trang sản phẩm không có chỗ nào để đặt sự thật
-- người mua cần. Sản phẩm 2.500.000₫ trên production có mô tả đúng ba chữ
-- ("Hàng mới về") và không một ô thông số nào, trong khi người mua vợt so
-- sánh trọng lượng, độ dày lõi, chất liệu mặt, hình dáng, cán và chu vi cán.
--
--   1. products.specs JSONB — bản đồ khoá → chuỗi. KHÔNG có từ điển thông số
--      trong SQL: danh sách ô nào thuộc ngành hàng nào sống ở
--      src/lib/shop/productSpecs.ts, một nơi duy nhất, và thêm một ô mới ở
--      đó không cần migration. Postgres chỉ giữ HÌNH DẠNG — object, khoá
--      snake_case, đủ ngắn, giá trị là chuỗi — vì đó là phần một client hỏng
--      hoặc một kẻ gọi RPC thẳng có thể phá.
--
--   2. product_submit_preflight() thêm `description_too_short`. Bản 20260811230000
--      cố ý KHÔNG đặt độ dài tối thiểu ("một con số không ai yêu cầu"). Nay PO
--      yêu cầu: mô tả ba chữ mỏng cho cả người mua lẫn Google. 40 ký tự là một
--      câu — và giờ đã có ô thông số riêng nên mô tả không phải gánh phần
--      thông số nữa.
--
-- product_create KHÔNG nhận specs, có chủ ý: màn thêm sản phẩm ẩn phần thông
-- số và nói "lưu nháp trước", đúng như nó đang làm với ảnh. Một payload create
-- mang specs là một hàm nữa phải chép lại để đổi đúng một dòng.
-- ============================================================================

-- ─── 1. Hình dạng hợp lệ ────────────────────────────────────────────────────
-- IMMUTABLE để dùng được trong CHECK. Trả false thay vì raise: CHECK cần một
-- boolean, còn câu tiếng Việt cho người bán nằm ở product_update.

CREATE OR REPLACE FUNCTION public.product_specs_valid(_specs JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _specs IS NULL
      OR (
        jsonb_typeof(_specs) = 'object'
        AND (SELECT count(*) FROM jsonb_object_keys(_specs)) <= 24
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_each(_specs) AS e(key, value)
          WHERE key !~ '^[a-z0-9_]{1,40}$'
             OR jsonb_typeof(value) <> 'string'
             OR btrim(value #>> '{}') = ''
             OR char_length(value #>> '{}') > 120
        )
      );
$$;

REVOKE ALL   ON FUNCTION public.product_specs_valid(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_specs_valid(JSONB) TO anon, authenticated, service_role;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS specs JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_specs_shape;
ALTER TABLE public.products
  ADD CONSTRAINT products_specs_shape CHECK (public.product_specs_valid(specs));

COMMENT ON COLUMN public.products.specs IS
  'Thông số kỹ thuật, khoá → chuỗi. Từ điển khoá theo ngành hàng nằm ở src/lib/shop/productSpecs.ts, không nằm trong SQL. Migration 20260823090000.';

-- ─── 2. product_update học `specs` ──────────────────────────────────────────
-- Chép nguyên văn từ 20260811210000, thêm đúng phần specs. Nửa `_variant` vẫn
-- y nguyên — biểu mẫu không gửi nó, nhưng RPC vẫn là API hợp lệ của máy chủ.

CREATE OR REPLACE FUNCTION public.product_update(
  _product_id       UUID,
  _expected_version INTEGER,
  _patch            JSONB DEFAULT '{}'::jsonb,
  _variant          JSONB DEFAULT NULL
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row     public.products%ROWTYPE;
  _count   INTEGER;
  _default UUID;
  _title   TEXT;
  _specs   JSONB;
BEGIN
  SELECT * INTO _row FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.product_assert_writable(_row.shop_id);

  IF NOT public.product_status_is_editable(_row.status) THEN
    RAISE EXCEPTION 'sản phẩm đang ở trạng thái % nên chưa sửa được', _row.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF _row.version <> _expected_version THEN
    RAISE EXCEPTION 'sản phẩm đã được cập nhật ở nơi khác (phiên bản % ≠ %)', _row.version, _expected_version
      USING ERRCODE = 'PT409';
  END IF;

  IF _patch ? 'title' THEN
    _title := btrim(coalesce(_patch ->> 'title', ''));
    IF char_length(_title) < 3 OR char_length(_title) > 140 THEN
      RAISE EXCEPTION 'tên sản phẩm cần từ 3 đến 140 ký tự' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

  -- Ô trống bị bỏ ở đây chứ không lưu thành chuỗi rỗng: một thông số trống là
  -- một thông số KHÔNG CÓ, và trang sản phẩm không được hiện một dòng "Trọng
  -- lượng: " không có số.
  IF _patch ? 'specs' THEN
    IF jsonb_typeof(_patch -> 'specs') <> 'object' THEN
      RAISE EXCEPTION 'thông số kỹ thuật phải là một đối tượng' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    SELECT coalesce(jsonb_object_agg(e.key, to_jsonb(btrim(e.value #>> '{}'))), '{}'::jsonb)
    INTO _specs
    FROM jsonb_each(_patch -> 'specs') AS e(key, value)
    WHERE jsonb_typeof(e.value) = 'string' AND btrim(e.value #>> '{}') <> '';

    IF NOT public.product_specs_valid(_specs) THEN
      RAISE EXCEPTION 'thông số kỹ thuật không hợp lệ — tối đa 24 ô, mỗi ô tối đa 120 ký tự'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

  UPDATE public.products
  SET title         = coalesce(_title, title),
      description   = CASE WHEN _patch ? 'description'
                           THEN NULLIF(btrim(_patch ->> 'description'), '') ELSE description END,
      category_slug = CASE WHEN _patch ? 'category_slug'
                           THEN NULLIF(_patch ->> 'category_slug', '') ELSE category_slug END,
      condition     = CASE WHEN _patch ? 'condition'
                           THEN (_patch ->> 'condition')::public.product_condition ELSE condition END,
      specs         = CASE WHEN _patch ? 'specs' THEN _specs ELSE specs END
  WHERE id = _product_id AND version = _expected_version
  RETURNING * INTO _row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sản phẩm đã được cập nhật ở nơi khác' USING ERRCODE = 'PT409';
  END IF;

  IF _variant IS NULL THEN
    RETURN _row;
  END IF;

  SELECT count(*)::int INTO _count FROM public.product_variants
  WHERE product_id = _product_id AND retired_at IS NULL;

  IF _count > 1 OR jsonb_array_length(_row.option_groups) > 0 THEN
    RAISE EXCEPTION 'sản phẩm này có nhiều phiên bản — sửa giá và tồn kho ở bảng phiên bản'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF _count = 0 THEN
    INSERT INTO public.product_variants (product_id, shop_id, price_vnd, stock_on_hand, position)
    VALUES (_product_id, _row.shop_id,
            public.product_price_vnd(_variant -> 'price_vnd'),
            public.product_stock(_variant -> 'stock_on_hand'), 0)
    RETURNING id INTO _default;

    IF (_variant -> 'stock_on_hand') IS NOT NULL
       AND public.product_stock(_variant -> 'stock_on_hand') IS NOT NULL THEN
      INSERT INTO public.inventory_movements
        (shop_id, variant_id, product_id, delta, on_hand_before, on_hand_after, reason, actor_user_id)
      VALUES (_row.shop_id, _default, _product_id,
              public.product_stock(_variant -> 'stock_on_hand'), 0,
              public.product_stock(_variant -> 'stock_on_hand'), 'opening', auth.uid());
    END IF;
    RETURN _row;
  END IF;

  SELECT id INTO _default FROM public.product_variants
  WHERE product_id = _product_id AND retired_at IS NULL
  ORDER BY position, created_at LIMIT 1;

  UPDATE public.product_variants
  SET price_vnd = CASE WHEN _variant ? 'price_vnd'
                       THEN public.product_price_vnd(_variant -> 'price_vnd') ELSE price_vnd END,
      sku       = CASE WHEN _variant ? 'sku'
                       THEN NULLIF(btrim(_variant ->> 'sku'), '') ELSE sku END,
      updated_at = now()
  WHERE id = _default;

  IF _variant ? 'stock_on_hand' THEN
    PERFORM public.product_variant_set_stock(
      _default, public.product_stock(_variant -> 'stock_on_hand'), 'Sửa trong màn hình sản phẩm');
  END IF;

  RETURN _row;
END $$;

-- ─── 3. Projection mang specs ra cho người mua ──────────────────────────────
-- Chép nguyên văn từ 20260818120000, thêm đúng một khoá `specs`.

CREATE OR REPLACE FUNCTION public.product_public_projection(
  _product_id UUID,
  _as_seller  BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p    public.products%ROWTYPE;
  _shop public.shops%ROWTYPE;
  _out  JSONB;
BEGIN
  SELECT * INTO _p FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT * INTO _shop FROM public.shops WHERE id = _p.shop_id;

  IF _as_seller THEN
    IF NOT (public.is_shop_member(_p.shop_id) OR public.is_admin()) THEN
      RAISE EXCEPTION 'not a member of this shop' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NOT (_p.status = 'approved' AND _p.is_published AND _shop.state = 'active') THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT jsonb_build_object(
    'id',            _p.id,
    'slug',          _p.slug,
    'title',         _p.title,
    'description',   _p.description,
    'condition',     _p.condition,
    -- Công khai có chủ ý: trọng lượng một cây vợt không phải bí mật, nó là
    -- lý do người mua chọn cây này thay vì cây kia.
    'specs',         coalesce(_p.specs, '{}'::jsonb),
    'category', (
      SELECT jsonb_build_object('slug', c.slug, 'name', c.name_vi)
      FROM public.product_categories c WHERE c.slug = _p.category_slug
    ),
    'shop', jsonb_build_object(
      'slug',   _shop.slug,
      'name',   _shop.name,
      'region', _shop.region,
      'verified', _shop.verified_at IS NOT NULL,
      'shipping_note', _shop.shipping_note,
      'return_note',   _shop.return_note,
      'ordering_enabled', _shop.ordering_enabled,
      'shipping_fee_vnd', _shop.shipping_fee_vnd
    ),
    'option_groups', _p.option_groups,
    'variants', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id',            v.id,
               'option_values', v.option_values,
               'option_key',    v.option_key,
               'sku',           v.sku,
               'price_vnd',     v.price_vnd,
               'availability',  CASE
                                  WHEN v.stock_on_hand IS NULL THEN 'unknown'
                                  WHEN v.stock_on_hand <= 0    THEN 'out_of_stock'
                                  ELSE 'in_stock'
                                END,
               'stock_on_hand', CASE WHEN _as_seller THEN to_jsonb(v.stock_on_hand) ELSE 'null'::jsonb END,
               'media_id',      v.media_id
             ) ORDER BY v.position, v.created_at)
      FROM public.product_variants v
      WHERE v.product_id = _p.id AND v.retired_at IS NULL
    ), '[]'::jsonb),
    'media', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id',       m.id,
               'alt_text', m.alt_text,
               'position', m.position,
               'path',     CASE WHEN _as_seller
                                THEN to_jsonb(m.rendition_source_path)
                                ELSE 'null'::jsonb END,
               'public_path', m.public_path,
               'width',    m.width,
               'height',   m.height
             ) ORDER BY m.position, m.created_at)
      FROM public.product_media m
      WHERE m.product_id = _p.id
        AND m.verified_at IS NOT NULL
        AND (_as_seller OR m.public_path IS NOT NULL)
    ), '[]'::jsonb),
    'primary_media_id', (
      SELECT m.id FROM public.product_media m
      WHERE m.product_id = _p.id
        AND m.verified_at IS NOT NULL
        AND (_as_seller OR m.public_path IS NOT NULL)
      ORDER BY m.position, m.created_at LIMIT 1
    ),
    'in_stock',                _p.in_stock,
    'availability_updated_at', _p.availability_updated_at,
    'status',       CASE WHEN _as_seller THEN to_jsonb(_p.status) ELSE 'null'::jsonb END,
    'is_published', _p.is_published,
    'shop_state',   CASE WHEN _as_seller THEN to_jsonb(_shop.state) ELSE 'null'::jsonb END,
    'applicant_note', CASE WHEN _as_seller THEN to_jsonb(_p.applicant_note) ELSE 'null'::jsonb END,
    'version',      CASE WHEN _as_seller THEN to_jsonb(_p.version) ELSE 'null'::jsonb END,
    'is_preview',   _as_seller
  ) INTO _out;

  RETURN _out;
END $$;

REVOKE ALL   ON FUNCTION public.product_public_projection(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_public_projection(UUID, BOOLEAN) TO anon, authenticated, service_role;

-- ─── 4. Preflight: mô tả phải là một câu, không phải ba chữ ─────────────────
-- Chép nguyên văn từ 20260811230000, đổi đúng khối description.

CREATE OR REPLACE FUNCTION public.product_submit_preflight(_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p        public.products%ROWTYPE;
  _shop     public.shops%ROWTYPE;
  _problems JSONB := '[]'::jsonb;
  _v        RECORD;
  _n        INTEGER;
BEGIN
  SELECT * INTO _p FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (public.is_shop_member(_p.shop_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'not a member of this shop' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO _shop FROM public.shops WHERE id = _p.shop_id;

  IF _shop.state <> 'active' THEN
    _problems := _problems || jsonb_build_object(
      'code', 'shop_not_active', 'section', 'basics', 'field', null,
      'detail', jsonb_build_object('state', _shop.state));
  END IF;

  IF _p.status NOT IN ('draft', 'needs_changes') THEN
    _problems := _problems || jsonb_build_object(
      'code', 'wrong_status', 'section', 'basics', 'field', null,
      'detail', jsonb_build_object('status', _p.status));
  END IF;

  IF char_length(btrim(coalesce(_p.title, ''))) < 3 THEN
    _problems := _problems || jsonb_build_object(
      'code', 'title_missing', 'section', 'basics', 'field', 'title');
  END IF;

  IF _p.category_slug IS NULL THEN
    _problems := _problems || jsonb_build_object(
      'code', 'category_missing', 'section', 'category', 'field', 'category_slug');
  END IF;

  -- 20260811230000 cố ý không đặt ngưỡng ("một con số không ai yêu cầu"). Số
  -- đó nay đã có người yêu cầu: một sản phẩm 2.500.000₫ trên production mô tả
  -- đúng ba chữ. 40 ký tự là một câu, và phần thông số kỹ thuật giờ có ô
  -- riêng nên mô tả không còn phải gánh nó.
  IF coalesce(btrim(_p.description), '') = '' THEN
    _problems := _problems || jsonb_build_object(
      'code', 'description_missing', 'section', 'description', 'field', 'description');
  ELSIF char_length(btrim(_p.description)) < 40 THEN
    _problems := _problems || jsonb_build_object(
      'code', 'description_too_short', 'section', 'description', 'field', 'description',
      'detail', jsonb_build_object('length', char_length(btrim(_p.description)), 'min', 40));
  END IF;

  IF NOT public.product_option_groups_valid(_p.option_groups) THEN
    _problems := _problems || jsonb_build_object(
      'code', 'option_graph_invalid', 'section', 'variants', 'field', null);
  END IF;

  SELECT count(*) INTO _n FROM public.product_variants
  WHERE product_id = _product_id AND retired_at IS NULL;
  IF _n < 1 THEN
    _problems := _problems || jsonb_build_object(
      'code', 'no_variant', 'section', 'variants', 'field', null);
  END IF;

  IF jsonb_array_length(_p.option_groups) = 0 THEN
    SELECT count(*) INTO _n FROM public.product_variants
    WHERE product_id = _product_id AND retired_at IS NULL AND option_key IS NULL;
    IF _n <> 1 THEN
      _problems := _problems || jsonb_build_object(
        'code', 'default_variant_broken', 'section', 'variants', 'field', null,
        'detail', jsonb_build_object('count', _n));
    END IF;
  ELSE
    SELECT count(*) INTO _n FROM public.product_variants
    WHERE product_id = _product_id AND retired_at IS NULL AND option_key IS NULL;
    IF _n > 0 THEN
      _problems := _problems || jsonb_build_object(
        'code', 'orphan_default_variant', 'section', 'variants', 'field', null);
    END IF;
  END IF;

  FOR _v IN
    SELECT * FROM public.product_variants
    WHERE product_id = _product_id AND retired_at IS NULL ORDER BY position
  LOOP
    IF _v.price_vnd IS NULL OR _v.price_vnd <= 0 THEN
      _problems := _problems || jsonb_build_object(
        'code', 'price_missing', 'section', 'price', 'field', 'price_vnd',
        'variant_id', _v.id);
    END IF;
    IF _v.stock_on_hand IS NOT NULL AND _v.stock_on_hand < 0 THEN
      _problems := _problems || jsonb_build_object(
        'code', 'stock_negative', 'section', 'stock', 'field', 'stock_on_hand',
        'variant_id', _v.id);
    END IF;
    IF _v.sku IS NOT NULL AND btrim(_v.sku) <> '' AND EXISTS (
      SELECT 1 FROM public.product_variants o
      WHERE o.shop_id = _v.shop_id AND o.id <> _v.id
        AND o.retired_at IS NULL AND o.archived = false
        AND upper(btrim(o.sku)) = upper(btrim(_v.sku))
    ) THEN
      _problems := _problems || jsonb_build_object(
        'code', 'sku_duplicate', 'section', 'sku', 'field', 'sku', 'variant_id', _v.id);
    END IF;
    IF _v.media_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.product_media m
      WHERE m.id = _v.media_id AND m.product_id = _product_id AND m.verified_at IS NOT NULL
    ) THEN
      _problems := _problems || jsonb_build_object(
        'code', 'variant_media_invalid', 'section', 'variant_media', 'field', null,
        'variant_id', _v.id);
    END IF;
  END LOOP;

  SELECT count(*) INTO _n FROM public.product_media
  WHERE product_id = _product_id AND verified_at IS NOT NULL;
  IF _n < 1 THEN
    _problems := _problems || jsonb_build_object(
      'code', 'no_media', 'section', 'media', 'field', null);
  END IF;

  SELECT count(*) INTO _n FROM public.product_media
  WHERE product_id = _product_id AND verified_at IS NULL;
  IF _n > 0 THEN
    _problems := _problems || jsonb_build_object(
      'code', 'media_unverified', 'section', 'media', 'field', null,
      'detail', jsonb_build_object('count', _n));
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.product_media
    WHERE product_id = _product_id AND shop_id <> _p.shop_id
  ) THEN
    _problems := _problems || jsonb_build_object(
      'code', 'media_wrong_shop', 'section', 'media', 'field', null);
  END IF;

  RETURN _problems;
END $$;
