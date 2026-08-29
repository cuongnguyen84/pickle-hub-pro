-- ============================================================================
-- product_discount_set — set a % discount on a LIVE product from the seller
-- list, without unpublishing it.
-- ----------------------------------------------------------------------------
-- product_update / product_variants_reconcile refuse anything that is not
-- editable (draft / needs_changes), which is right for title, specs and the
-- selling price — those go through review. A compare-at price is display
-- only: it never changes what the buyer pays (shop_order_create reads
-- price_vnd), so the seller may set or clear it while the product is on the
-- shelf. Every non-retired variant gets compare_at = ceil(price / (1 - pct)),
-- which always satisfies product_variants_compare_range; pct 0 / NULL clears.
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
    RAISE EXCEPTION '% giảm giá chỉ nhận 0–90' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.product_variants
     SET compare_at_price_vnd = CASE
           WHEN _pct IS NULL OR _pct = 0 THEN NULL
           ELSE CEIL(price_vnd * 100.0 / (100 - _pct))::INTEGER
         END,
         updated_at = now()
   WHERE product_id = _product_id AND retired_at IS NULL;
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
