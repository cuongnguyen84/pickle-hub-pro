-- ============================================================================
-- product_discount_set — % giảm giờ TRỪ THẲNG vào giá bán.
-- ----------------------------------------------------------------------------
-- Bản 20260829180000 giữ nguyên giá bán và thổi giá gốc lên cho khớp % nhập
-- vào (compare_at = price / (1 - pct)). Người bán đọc ra "tăng tiền lên rồi
-- giảm xuống đúng bằng giá cũ" — không ai muốn thế. Từ nay giá gốc là NEO:
--
--   neo         = COALESCE(compare_at_price_vnd, price_vnd)
--   giá bán mới = floor(neo * (100 - pct) / 100), làm tròn xuống nghìn khi ≥ 100k
--   giá gốc mới = neo   (pct = 0 → giá bán về đúng neo, giá gốc NULL)
--
-- Vì vậy đặt 20% rồi 50% vẫn tính từ giá gốc chứ không giảm chồng giảm, và bỏ
-- giảm thì giá quay lại đúng chỗ cũ. Sản phẩm đang có giảm giá không đổi gì
-- cho tới khi người bán gõ số khác.
--
-- Làm tròn XUỐNG nghìn để giá đẹp; chỉ khi giá ≥ 100k, lúc đó 1000đ nhỏ hơn
-- 1% nên % hiển thị (floor, xem src/lib/shop/discount.ts) vẫn ra đúng số đã gõ.
--
-- Đây là lần đầu một RPC đổi price_vnd của sản phẩm ĐANG BÁN mà không qua
-- duyệt lại. Có chủ ý: giảm giá là việc của người bán, và shop_order_create
-- vẫn chặn đơn có expected_unit_price_vnd lệch nên giỏ hàng cũ không mua hớ.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.product_discount_set(
  _product_id UUID,
  _pct        INTEGER
)
RETURNS public.products
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
  PERFORM public.product_assert_writable(_row.shop_id);

  IF _row.status IN ('archived', 'suspended') THEN
    RAISE EXCEPTION 'sản phẩm đang ở trạng thái % nên chưa đặt giảm giá được', _row.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _pct IS NOT NULL AND (_pct < 0 OR _pct > 90) THEN
    RAISE EXCEPTION '%% giảm giá chỉ nhận 0–90' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);

  WITH anchor AS (
    SELECT id, COALESCE(compare_at_price_vnd, price_vnd) AS neo
      FROM public.product_variants
     WHERE product_id = _product_id AND retired_at IS NULL
  ), raw AS (
    SELECT id, neo,
           CASE WHEN COALESCE(_pct, 0) = 0 THEN neo
                ELSE FLOOR(neo * (100 - _pct) / 100.0)::INTEGER
           END AS p
      FROM anchor
  ), calc AS (
    SELECT id, neo,
           CASE WHEN p >= 100000 THEN (p / 1000) * 1000 ELSE p END AS new_price
      FROM raw
  )
  UPDATE public.product_variants v
     SET price_vnd            = c.new_price,
         compare_at_price_vnd = CASE WHEN c.new_price < c.neo THEN c.neo ELSE NULL END,
         updated_at           = now()
    FROM calc c
   WHERE v.id = c.id;

  UPDATE public.products
     SET version = version + 1, updated_at = now()
   WHERE id = _product_id
   RETURNING * INTO _row;
  PERFORM set_config('shop.privileged_write', 'off', true);

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.product_discount_set(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_discount_set(UUID, INTEGER) TO authenticated, service_role;
