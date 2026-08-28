-- Seller bulk product deletion.
-- Sold products are immutable catalog history: deleting them would cascade
-- shop_order_items despite their snapshots. Unsold products can be removed,
-- with every media object queued through the existing lifecycle first.

CREATE OR REPLACE FUNCTION public.products_delete(_product_ids UUID[])
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ids UUID[];
  _product RECORD;
  _media RECORD;
BEGIN
  _ids := ARRAY(
    SELECT DISTINCT id
    FROM unnest(coalesce(_product_ids, '{}'::UUID[])) AS id
    WHERE id IS NOT NULL
  );

  IF cardinality(_ids) = 0 OR cardinality(_ids) > 50 THEN
    RAISE EXCEPTION 'choose between 1 and 50 products'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF (SELECT count(*) FROM public.products WHERE id = ANY(_ids)) <> cardinality(_ids) THEN
    RAISE EXCEPTION 'one or more products no longer exist' USING ERRCODE = 'no_data_found';
  END IF;

  FOR _product IN
    SELECT id, shop_id FROM public.products WHERE id = ANY(_ids) FOR UPDATE
  LOOP
    IF NOT (public.is_shop_manager(_product.shop_id) OR public.is_admin()) THEN
      RAISE EXCEPTION 'not a manager of this shop' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.shop_order_items WHERE product_id = ANY(_ids)) THEN
    RAISE EXCEPTION 'product_has_orders' USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  FOR _media IN
    SELECT id FROM public.product_media WHERE product_id = ANY(_ids) ORDER BY product_id, position
  LOOP
    PERFORM public.product_media_delete(_media.id);
  END LOOP;

  DELETE FROM public.products WHERE id = ANY(_ids);
  RETURN _ids;
END $$;

REVOKE ALL ON FUNCTION public.products_delete(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.products_delete(UUID[]) TO authenticated, service_role;

