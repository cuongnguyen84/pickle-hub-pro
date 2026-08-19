-- ============================================================================
-- Shop Phase 3 — two things the buyer screens cannot do without.
--
-- 1. product_public_projection() learns `ordering_enabled` and
--    `shipping_fee_vnd`.
--
--    Both columns are added to `shops` by 20260818100000. Until now the only
--    surface that carried them was shop_cart_view(), so the product page had
--    no way to know a shop had paused selling: it rendered "Thêm vào giỏ",
--    the buyer pressed it, and the line went into the cart to be refused two
--    screens later. The browser test caught exactly that (round 2, TC06).
--
--    CREATE OR REPLACE, in a NEW file. 20260813090000 is already applied on
--    production and editing an applied migration is how the ledger drifts.
--    shop_public_product() calls this function, so it inherits both keys with
--    no change of its own.
--
--    Both keys are returned to the PUBLIC reader on purpose. Neither is a
--    secret: "this shop is not taking orders" and "delivery costs 30.000₫"
--    are the two facts a buyer needs BEFORE they fill in an address.
--
-- 2. shop_last_shipping_address() — checkout prefill, buyer-scoped.
--
--    This cannot be done from the client. RLS on shop_orders admits every
--    party to the order, so "the newest order I can read" is, for anybody who
--    also sells, their own CUSTOMER's order — and buyer_user_id is not
--    granted, so the client cannot filter it back out. A SECURITY DEFINER
--    function that reads auth.uid() itself is the only place that comparison
--    can happen.
--
-- Neither object is destructive; both are CREATE OR REPLACE.
-- ============================================================================

-- ─── 1. The projection ──────────────────────────────────────────────────────
-- Body copied verbatim from 20260813090000 with two keys added under `shop`,
-- so a diff between the two files shows only those two lines.

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
      -- D1. false hides the quantity box and the button; the same flag makes
      -- shop_order_create raise PT403 / ordering_disabled, so the screen and
      -- the server cannot disagree.
      'ordering_enabled', _shop.ordering_enabled,
      -- D3. 0 is FREE and renders as "Miễn phí" — never "0đ", never "—".
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

-- ─── 2. The last address this buyer used ────────────────────────────────────
-- Returns NULL — not an empty object — when the caller has never ordered, so
-- the screen has one test for "nothing to prefill".
--
-- Deliberately NOT scoped to a shop: an address is a property of the person,
-- not of who they last bought from. Cancelled orders count too; the parcel
-- was still going to that door.

CREATE OR REPLACE FUNCTION public.shop_last_shipping_address()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'recipient_name',   o.recipient_name,
           'recipient_phone',  o.recipient_phone,
           'shipping_address', o.shipping_address)
  FROM public.shop_orders o
  WHERE o.buyer_user_id = auth.uid()
  ORDER BY o.created_at DESC, o.id DESC
  LIMIT 1
$$;

COMMENT ON FUNCTION public.shop_last_shipping_address() IS
  'Địa chỉ giao của đơn gần nhất CỦA CHÍNH người gọi. NULL nếu chưa có đơn. '
  'Không nhận tham số: buyer_user_id không được GRANT nên client không tự lọc được.';

REVOKE ALL   ON FUNCTION public.shop_last_shipping_address() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_last_shipping_address() TO authenticated, service_role;

-- ─── 3. "Đơn của tôi" means MINE ────────────────────────────────────────────
-- shop_orders' SELECT policy admits every party: buyer, every member of the
-- shop, and admins. That is right for /shop/order/:code, and wrong for a LIST
-- called "Đơn của tôi" — a shop owner opening it would be handed their own
-- customers' names, phones and addresses under the heading "my orders".
--
-- The client cannot narrow it: buyer_user_id is not granted, so it is not
-- selectable and not filterable either. Same shape as my_shop_application in
-- Phase 1: a view that applies auth.uid() itself, with exactly the column
-- list the table grants and nothing more.
--
-- security_invoker is deliberately OFF (the default). The view owner reads
-- the table, so the WHERE below is the only thing deciding what comes back —
-- which is the point. With invoker ON, Postgres would check COLUMN privileges
-- as the caller, and `authenticated` holds no SELECT on buyer_user_id, so the
-- view's own WHERE would answer 42501 for everybody.
--
-- The consequence: neither the table's policy nor its column GRANTs apply
-- here, so THIS column list is the second, independent place the identity
-- invariant lives. cancelled_by is a uid and is out for the same reason it is
-- out of the table grant. supabase/tests/shop_orders.test.sql guards the list.

DROP VIEW IF EXISTS public.my_shop_orders;
CREATE VIEW public.my_shop_orders WITH (security_barrier = true) AS
SELECT
  o.id, o.code, o.shop_id, o.status, o.payment_method,
  o.recipient_name, o.recipient_phone, o.shipping_address, o.delivery_note,
  o.items_total_vnd, o.shipping_fee_vnd, o.total_vnd,
  o.confirm_due_at, o.tracking_code, o.cancel_reason,
  o.created_at, o.updated_at
FROM public.shop_orders o
WHERE o.buyer_user_id = auth.uid();

COMMENT ON VIEW public.my_shop_orders IS
  'Đơn của CHÍNH người đang đăng nhập. Dùng cho /shop/orders; trang chi tiết vẫn đọc shop_orders '
  'vì ở đó cả người bán cũng là một bên hợp lệ.';

REVOKE ALL   ON public.my_shop_orders FROM PUBLIC, anon;
GRANT SELECT ON public.my_shop_orders TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
