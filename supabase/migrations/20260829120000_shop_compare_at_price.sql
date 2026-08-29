-- ============================================================================
-- Shop — giá gốc (compare_at_price_vnd) đi xuyên suốt RPC.
-- ----------------------------------------------------------------------------
-- Cột product_variants.compare_at_price_vnd và constraint
-- product_variants_compare_range đã có từ 20260811120000; chưa RPC nào ghi hay
-- đọc nó. File này:
--   1. thêm public.product_compare_at_vnd(jsonb) — bản "tuỳ chọn" của
--      product_price_vnd: NULL / JSON null / khoá vắng → NULL, còn lại parse
--      đúng cùng luật;
--   2. CREATE OR REPLACE năm RPC, chép nguyên văn bản mới nhất và chỉ thêm
--      xử lý compare_at_price_vnd: product_create, product_update,
--      product_variants_reconcile, product_public_projection, shop_public_search.
-- Chữ ký hàm, REVOKE/GRANT và mọi hành vi khác giữ nguyên.
-- ============================================================================

-- ─── 1. Parser cho trường tuỳ chọn ───────────────────────────────────────────
-- Không gọi thẳng product_price_vnd cho trường này: hàm đó RAISE khi NULL.
-- `jsonb -> 'key'` trả SQL NULL khi khoá vắng và JSON null khi client gửi null;
-- cả hai đều nghĩa là "không có giá gốc".

CREATE OR REPLACE FUNCTION public.product_compare_at_vnd(_value JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _text TEXT;
BEGIN
  IF _value IS NULL OR jsonb_typeof(_value) = 'null' THEN
    RETURN NULL;
  END IF;

  _text := CASE WHEN jsonb_typeof(_value) = 'string' THEN btrim(_value #>> '{}') ELSE _value::text END;

  IF _text = '' THEN
    RETURN NULL;
  END IF;

  IF _text !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'giá gốc phải là số nguyên tiền đồng, không dấu chấm hay dấu phẩy'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _text::numeric > 2000000000 THEN
    RAISE EXCEPTION 'giá gốc vượt mức cho phép' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN _text::integer;
END $$;

REVOKE ALL ON FUNCTION public.product_compare_at_vnd(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_compare_at_vnd(JSONB) TO authenticated, service_role;

-- ─── 2. product_create — chép từ 20260811210000, thêm compare_at ─────────────

CREATE OR REPLACE FUNCTION public.product_create(
  _shop_id      UUID,
  _client_token TEXT,
  _payload      JSONB DEFAULT '{}'::jsonb
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row     public.products%ROWTYPE;
  _title   TEXT;
  _price   INTEGER;
  _stock   INTEGER;
  _variant UUID;
  _compare INTEGER;
BEGIN
  PERFORM public.product_assert_writable(_shop_id);

  IF coalesce(btrim(_client_token), '') = '' THEN
    RAISE EXCEPTION 'thiếu mã chống trùng của lần tạo này' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO _row FROM public.products
  WHERE shop_id = _shop_id AND client_token = btrim(_client_token);
  IF FOUND THEN
    RETURN _row;
  END IF;

  _title := btrim(coalesce(_payload ->> 'title', ''));
  IF char_length(_title) < 3 OR char_length(_title) > 140 THEN
    RAISE EXCEPTION 'tên sản phẩm cần từ 3 đến 140 ký tự' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  _price := public.product_price_vnd(_payload -> 'price_vnd');
  _stock := public.product_stock(coalesce(_payload -> 'stock_on_hand', _payload -> 'stock'));
  _compare := public.product_compare_at_vnd(_payload -> 'compare_at_price_vnd');

  INSERT INTO public.products (shop_id, slug, title, description, category_slug, condition, client_token)
  VALUES (
    _shop_id,
    public.product_slug_from_title(_title),
    _title,
    NULLIF(btrim(coalesce(_payload ->> 'description', '')), ''),
    NULLIF(_payload ->> 'category_slug', ''),
    coalesce(NULLIF(_payload ->> 'condition', ''), 'new')::public.product_condition,
    btrim(_client_token)
  )
  RETURNING * INTO _row;

  INSERT INTO public.product_variants (product_id, shop_id, price_vnd, compare_at_price_vnd, stock_on_hand, position)
  VALUES (_row.id, _shop_id, _price, _compare, _stock, 0)
  RETURNING id INTO _variant;

  IF _stock IS NOT NULL THEN
    INSERT INTO public.inventory_movements
      (shop_id, variant_id, product_id, delta, on_hand_before, on_hand_after, reason, actor_user_id)
    VALUES (_shop_id, _variant, _row.id, _stock, 0, _stock, 'opening', auth.uid());
  END IF;

  RETURN _row;
END $$;

-- ─── 3. product_update — chép từ 20260823090000, thêm compare_at ─────────────
-- Ngữ nghĩa ở nhánh UPDATE: khoá vắng → giữ nguyên; gửi null → xoá giá gốc.

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
    INSERT INTO public.product_variants (product_id, shop_id, price_vnd, compare_at_price_vnd, stock_on_hand, position)
    VALUES (_product_id, _row.shop_id,
            public.product_price_vnd(_variant -> 'price_vnd'),
            public.product_compare_at_vnd(_variant -> 'compare_at_price_vnd'),
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
      compare_at_price_vnd = CASE WHEN _variant ? 'compare_at_price_vnd'
                       THEN public.product_compare_at_vnd(_variant -> 'compare_at_price_vnd') ELSE compare_at_price_vnd END,
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

-- ─── 4. product_variants_reconcile — chép từ 20260811210000, thêm compare_at ─
-- Reconcile là thay-cả-dòng (bulk import): khoá vắng → NULL, KHÔNG giữ giá cũ.

CREATE OR REPLACE FUNCTION public.product_variants_reconcile(
  _product_id       UUID,
  _expected_version INTEGER,
  _option_groups    JSONB,
  _rows             JSONB,
  _client_token     TEXT DEFAULT NULL,
  -- Multi -> single needs a decision the server cannot make: which of the
  -- existing variants becomes the one price the product now has.
  _keep_variant_id  UUID DEFAULT NULL
)
RETURNS SETOF public.product_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _product     public.products%ROWTYPE;
  _row         JSONB;
  _key         TEXT;
  _seen        TEXT[] := '{}';
  _expected    INTEGER;
  _price       INTEGER;
  _stock       INTEGER;
  _compare     INTEGER;
  _sku         TEXT;
  _existing    public.product_variants%ROWTYPE;
  _new         public.product_variants%ROWTYPE;
  _multi       BOOLEAN;
BEGIN
  SELECT * INTO _product FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.product_assert_writable(_product.shop_id);

  IF NOT public.product_status_is_editable(_product.status) THEN
    RAISE EXCEPTION 'sản phẩm đang ở trạng thái % nên chưa sửa được', _product.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Replay: the same token against the same product is the same save.
  IF _client_token IS NOT NULL AND btrim(_client_token) <> ''
     AND _product.variants_token = btrim(_client_token) THEN
    RETURN QUERY SELECT * FROM public.product_variants
      WHERE product_id = _product_id AND retired_at IS NULL
      ORDER BY position, created_at;
    RETURN;
  END IF;

  IF _product.version <> _expected_version THEN
    RAISE EXCEPTION 'sản phẩm đã được cập nhật ở nơi khác (phiên bản % ≠ %)',
      _product.version, _expected_version USING ERRCODE = 'PT409';
  END IF;

  IF NOT public.product_option_groups_valid(_option_groups) THEN
    RAISE EXCEPTION 'bộ tuỳ chọn không hợp lệ — tối đa 3 nhóm, 100 phiên bản, tên và giá trị tối đa 40 ký tự, không trùng nhau'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  _multi := jsonb_array_length(_option_groups) > 0;

  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN
    RAISE EXCEPTION 'thiếu danh sách phiên bản' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Multi -> single collapses to one variant, and the seller has to say which
  -- one keeps selling. Picking silently would throw away a SKU somebody prints
  -- on shipping labels.
  IF NOT _multi AND jsonb_array_length(_rows) > 1 THEN
    RAISE EXCEPTION 'tắt nhiều phiên bản thì chỉ giữ lại một phiên bản' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT _multi AND EXISTS (
    SELECT 1 FROM public.product_variants
    WHERE product_id = _product_id AND retired_at IS NULL AND option_key IS NOT NULL
  ) AND _keep_variant_id IS NULL THEN
    RAISE EXCEPTION 'chọn phiên bản được giữ lại trước khi tắt nhiều phiên bản'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- The option structure moves first, so the variant guard validates against
  -- the NEW groups rather than the old ones.
  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.products
  SET option_groups = _option_groups,
      variants_token = NULLIF(btrim(coalesce(_client_token, '')), '')
  WHERE id = _product_id AND version = _expected_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sản phẩm đã được cập nhật ở nơi khác' USING ERRCODE = 'PT409';
  END IF;
  PERFORM set_config('shop.privileged_write', 'off', true);

  -- Retire first, so a combination being replaced frees its unique key before
  -- the replacement claims it.
  UPDATE public.product_variants
  SET retired_at = now(), updated_at = now()
  WHERE product_id = _product_id
    AND retired_at IS NULL
    AND (
      -- Going single: everything except the survivor.
      (NOT _multi AND id IS DISTINCT FROM coalesce(_keep_variant_id, id) AND option_key IS NOT NULL)
      -- Going multi from single: the old default has no combination and cannot
      -- stay. Retired, never deleted — it keeps its id, its SKU and its
      -- movements, so nothing the seller entered is destroyed by the switch.
      -- The new rows arrive already seeded from its price by the editor.
      OR (_multi AND option_key IS NULL)
    );

  -- Going single, the survivor stops being a combination and becomes THE
  -- variant. Converting it in place is what makes "keep this one" mean what it
  -- says: the id, the SKU, the stock and the ledger all stay with it. Skipping
  -- this step leaves it holding an option_key, the loop below fails to match
  -- it, and the insert that follows collides with the survivor's own SKU —
  -- which is exactly how the pgTAP found this.
  IF NOT _multi AND _keep_variant_id IS NOT NULL THEN
    UPDATE public.product_variants
    SET option_values = NULL, option_key = NULL, updated_at = now()
    WHERE id = _keep_variant_id AND product_id = _product_id AND retired_at IS NULL;
  END IF;

  FOR _row IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    _price := public.product_price_vnd(_row -> 'price_vnd');
    _stock := public.product_stock(_row -> 'stock_on_hand');
    -- Full-row replace: khoá vắng nghĩa là không có giá gốc, không phải "giữ nguyên".
    _compare := public.product_compare_at_vnd(_row -> 'compare_at_price_vnd');
    _sku   := NULLIF(btrim(coalesce(_row ->> 'sku', '')), '');
    _key   := CASE WHEN _multi THEN public.product_option_key(_row -> 'option_values') ELSE NULL END;

    IF _multi AND _key IS NULL THEN
      RAISE EXCEPTION 'một dòng phiên bản thiếu tuỳ chọn' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Duplicate inside the SUBMITTED set, caught before the index sees it so
    -- the message can name the combination rather than the constraint.
    IF _multi AND coalesce(_key, '') = ANY (_seen) THEN
      RAISE EXCEPTION 'hai dòng cùng một tổ hợp tuỳ chọn: %', _key USING ERRCODE = 'unique_violation';
    END IF;
    _seen := _seen || coalesce(_key, '');

    -- Identity, not position: an existing variant with this key keeps its id,
    -- its history and its stock. This is what makes reordering the option
    -- groups a display change.
    SELECT * INTO _existing FROM public.product_variants
    WHERE product_id = _product_id
      AND retired_at IS NULL
      AND option_key IS NOT DISTINCT FROM _key
    LIMIT 1;

    IF FOUND THEN
      PERFORM set_config('shop.privileged_write', 'on', true);
      UPDATE public.product_variants
      SET price_vnd     = _price,
          compare_at_price_vnd = _compare,
          sku           = _sku,
          option_values = CASE WHEN _multi THEN _row -> 'option_values' ELSE NULL END,
          position      = coalesce((_row ->> 'position')::int, position),
          updated_at    = now()
      WHERE id = _existing.id;
      PERFORM set_config('shop.privileged_write', 'off', true);

      -- Stock still moves only through the ledger, even here. A matrix save
      -- that quietly rewrote the counter would be the PATCH this design
      -- removed, wearing a different name.
      PERFORM public.product_variant_set_stock(_existing.id, _stock, 'Sửa trong bảng phiên bản');
      CONTINUE;
    END IF;

    INSERT INTO public.product_variants
      (product_id, shop_id, price_vnd, compare_at_price_vnd, sku, stock_on_hand, option_values, position)
    VALUES (_product_id, _product.shop_id, _price, _compare, _sku, _stock,
            CASE WHEN _multi THEN _row -> 'option_values' ELSE NULL END,
            coalesce((_row ->> 'position')::int, 0))
    RETURNING * INTO _new;

    IF _stock IS NOT NULL THEN
      INSERT INTO public.inventory_movements
        (shop_id, variant_id, product_id, delta, on_hand_before, on_hand_after, reason, actor_user_id)
      VALUES (_product.shop_id, _new.id, _product_id, _stock, 0, _stock, 'opening', auth.uid());
    END IF;
  END LOOP;

  RETURN QUERY SELECT * FROM public.product_variants
    WHERE product_id = _product_id AND retired_at IS NULL
    ORDER BY position, created_at;
END $$;

-- ─── 5. product_public_projection — chép từ 20260823090000, thêm compare_at ──

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
               'compare_at_price_vnd', v.compare_at_price_vnd,
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

-- ─── 6. shop_public_search — chép từ 20260813090000, thêm 2 khoá card ────────
-- discount_pct_max: % giảm lớn nhất trong các phiên bản còn bán có giá gốc
--   (floor(100 - price*100/compare)); không có giá gốc → NULL; giảm < 1%
--   (floor = 0) → NULL luôn, cùng luật với discountPct() client — không "-0%".
-- compare_at_min: giá gốc của phiên bản có price_vnd = price_min. Tie-break:
--   nhiều phiên bản cùng price_min → lấy min(compare_at_price_vnd) (thấp nhất,
--   tức % giảm khiêm tốn nhất — card không được hứa nhiều hơn PDP).

CREATE OR REPLACE FUNCTION public.shop_public_search(
  _q             TEXT    DEFAULT NULL,
  _category_slug TEXT    DEFAULT NULL,
  _shop_slug     TEXT    DEFAULT NULL,
  _condition     TEXT    DEFAULT NULL,
  _in_stock_only BOOLEAN DEFAULT false,
  _sort          TEXT    DEFAULT 'recent',
  _cursor_at     TIMESTAMPTZ DEFAULT NULL,
  _cursor_id     UUID    DEFAULT NULL,
  _limit         INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n     INTEGER := least(greatest(coalesce(_limit, 24), 1), 48);
  _tsq   tsquery;
  _rows  JSONB;
  _total INTEGER;
  _more  BOOLEAN;
BEGIN
  IF _sort NOT IN ('recent', 'price_asc', 'price_desc') THEN
    RAISE EXCEPTION 'unknown sort %', _sort USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _condition IS NOT NULL AND _condition NOT IN ('new', 'used') THEN
    RAISE EXCEPTION 'unknown condition %', _condition USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- websearch_to_tsquery never raises on user input; plainto_ would choke on
  -- an unbalanced quote and turn a typo into a 500.
  IF coalesce(btrim(_q), '') <> '' THEN
    _tsq := websearch_to_tsquery('simple', public.unaccent_immutable(btrim(_q)));
  END IF;

  -- Two passes, on purpose.
  --
  -- The first version computed price_min/price_max/availability/cover for
  -- EVERY matching row and then counted them, because `total` was a count over
  -- the same CTE the page came from. On 10k products that was 122,819 buffers
  -- and 57.9 ms for a 24-row first page — the N+1 this design exists to avoid,
  -- moved into the count where it was harder to see.
  --
  -- So: narrow first (ids and the sort key, every filter an EXISTS the indexes
  -- can serve), count that, then pay for the expensive per-row fields on the
  -- ≤25 rows actually being returned.
  WITH visible AS (
    SELECT p.id, p.created_at
    FROM public.products p
    JOIN public.shops s              ON s.id = p.shop_id
    JOIN public.product_categories c ON c.slug = p.category_slug
    WHERE p.status = 'approved'
      AND p.is_published
      AND s.state = 'active'
      AND c.is_active
      AND EXISTS (SELECT 1 FROM public.product_media m
                  WHERE m.product_id = p.id AND m.public_path IS NOT NULL)
      AND EXISTS (SELECT 1 FROM public.product_variants v
                  WHERE v.product_id = p.id AND v.retired_at IS NULL)
      AND (_tsq IS NULL OR p.search_doc @@ _tsq)
      AND (_category_slug IS NULL OR p.category_slug = _category_slug)
      AND (_shop_slug IS NULL OR s.slug = _shop_slug)
      AND (_condition IS NULL OR p.condition::text = _condition)
      -- "In stock" as an EXISTS rather than a label: a buyer filtering for it
      -- means "something here is buyable", and asking that question does not
      -- require computing the label for rows nobody will see.
      AND (NOT _in_stock_only OR EXISTS (
            SELECT 1 FROM public.product_variants v
            WHERE v.product_id = p.id AND v.retired_at IS NULL AND v.stock_on_hand > 0))
  ),
  page AS (
    SELECT v.id, v.created_at
    FROM visible v
    WHERE _cursor_at IS NULL
       OR (v.created_at, v.id) < (_cursor_at, _cursor_id)
    ORDER BY v.created_at DESC, v.id DESC
    LIMIT _n + 1
  ),
  kept AS (
    SELECT * FROM page ORDER BY created_at DESC, id DESC LIMIT _n
  )
  SELECT
    coalesce(jsonb_agg(card ORDER BY (card ->> 'created_at') DESC, (card ->> 'id') DESC), '[]'::jsonb),
    (SELECT count(*)::int FROM visible),
    (SELECT count(*) FROM page) > _n
  INTO _rows, _total, _more
  FROM (
    SELECT jsonb_build_object(
             'id', p.id, 'slug', p.slug, 'title', p.title,
             'condition', p.condition, 'created_at', k.created_at,
             'category', jsonb_build_object('slug', c.slug, 'name', c.name_vi),
             'shop', jsonb_build_object('slug', s.slug, 'name', s.name,
                                        'verified', s.verified_at IS NOT NULL),
             'price_min', (SELECT min(v.price_vnd) FROM public.product_variants v
                           WHERE v.product_id = p.id AND v.retired_at IS NULL),
             'price_max', (SELECT max(v.price_vnd) FROM public.product_variants v
                           WHERE v.product_id = p.id AND v.retired_at IS NULL),
             'discount_pct_max', NULLIF((SELECT max(floor(100 - v.price_vnd * 100.0 / v.compare_at_price_vnd))::int
                                         FROM public.product_variants v
                                         WHERE v.product_id = p.id AND v.retired_at IS NULL
                                           AND v.compare_at_price_vnd IS NOT NULL), 0),
             -- Tie-break: min(compare_at) among the variants sharing price_min.
             'compare_at_min', (SELECT min(v.compare_at_price_vnd) FROM public.product_variants v
                                WHERE v.product_id = p.id AND v.retired_at IS NULL
                                  AND v.price_vnd = (SELECT min(v2.price_vnd) FROM public.product_variants v2
                                                     WHERE v2.product_id = p.id AND v2.retired_at IS NULL)),
             'availability', (
               SELECT CASE
                        WHEN bool_or(v.stock_on_hand > 0) THEN 'in_stock'
                        WHEN bool_or(v.stock_on_hand IS NULL) THEN 'unknown'
                        ELSE 'out_of_stock'
                      END
               FROM public.product_variants v
               WHERE v.product_id = p.id AND v.retired_at IS NULL),
             'cover', (SELECT jsonb_build_object('public_path', m.public_path,
                                                 'alt_text', m.alt_text,
                                                 'width', m.width, 'height', m.height)
                       FROM public.product_media m
                       WHERE m.product_id = p.id AND m.public_path IS NOT NULL
                       ORDER BY m.position, m.created_at LIMIT 1)
           ) AS card
    FROM kept k
    JOIN public.products p           ON p.id = k.id
    JOIN public.shops s              ON s.id = p.shop_id
    JOIN public.product_categories c ON c.slug = p.category_slug
  ) cards;

  RETURN jsonb_build_object(
    'rows',     _rows,
    'total',    _total,
    'has_more', _more
  );
END $$;

