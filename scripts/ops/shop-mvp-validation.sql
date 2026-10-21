-- Shop MVP validation — read-only queries for Supabase SQL Editor.
-- Replace the two timestamps before every cohort. Keep team/test user IDs in a
-- private scratch table or add them to excluded_buyers below; never commit PII.

WITH params AS (
  SELECT
    timestamptz '2026-08-28 00:00:00+07' AS cohort_start,
    timestamptz '2026-09-11 23:59:59+07' AS cohort_end
),
excluded_buyers(user_id) AS (
  SELECT NULL::uuid WHERE false
),
cohort_orders AS (
  SELECT o.*
  FROM public.shop_orders o, params p
  WHERE o.created_at >= p.cohort_start
    AND o.created_at <= p.cohort_end
    AND o.buyer_user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM excluded_buyers x WHERE x.user_id = o.buyer_user_id
    )
)
SELECT
  count(*) AS orders_created,
  count(DISTINCT buyer_user_id) AS unique_buyers_created,
  count(*) FILTER (WHERE status = 'delivered') AS delivered_orders,
  count(DISTINCT buyer_user_id) FILTER (WHERE status = 'delivered') AS delivered_buyers,
  count(*) FILTER (WHERE payment_confirmed_at IS NOT NULL) AS transfer_confirmed_orders,
  count(*) FILTER (WHERE status = 'cancelled') AS cancelled_orders,
  count(*) FILTER (
    WHERE status = 'cancelled' AND cancelled_by IS DISTINCT FROM buyer_user_id
  ) AS seller_or_admin_cancelled_orders,
  coalesce(sum(total_vnd) FILTER (WHERE status <> 'cancelled'), 0) AS non_cancelled_gmv_vnd
FROM cohort_orders;

-- Status and payment breakdown. Codes/recipient PII are intentionally omitted.
WITH params AS (
  SELECT
    timestamptz '2026-08-28 00:00:00+07' AS cohort_start,
    timestamptz '2026-09-11 23:59:59+07' AS cohort_end
)
SELECT
  status,
  payment_method,
  count(*) AS orders,
  count(DISTINCT buyer_user_id) AS unique_buyers,
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY extract(epoch FROM (updated_at - created_at)) / 3600
  ) AS median_hours_to_current_state
FROM public.shop_orders o, params p
WHERE o.created_at BETWEEN p.cohort_start AND p.cohort_end
GROUP BY status, payment_method
ORDER BY status, payment_method;

-- Seller/data readiness. Every returned row is a release blocker to fix.
SELECT
  s.slug,
  s.state,
  s.region IS NULL OR btrim(s.region) = '' AS missing_region,
  s.return_note IS NULL OR char_length(btrim(s.return_note)) < 20 AS weak_return_note,
  s.shipping_note IS NULL OR btrim(s.shipping_note) = '' AS missing_shipping_note,
  s.shipping_fee_vnd IS NULL AS missing_shipping_fee,
  count(DISTINCT p.id) FILTER (
    WHERE p.status = 'approved' AND p.is_published
  ) AS published_products,
  count(DISTINCT v.id) FILTER (
    WHERE p.status = 'approved' AND p.is_published AND coalesce(v.stock, 0) > 0
  ) AS variants_in_stock
FROM public.shops s
LEFT JOIN public.products p ON p.shop_id = s.id
LEFT JOIN public.product_variants v ON v.product_id = p.id
WHERE s.state = 'active'
GROUP BY s.id, s.slug, s.state, s.region, s.return_note,
         s.shipping_note, s.shipping_fee_vnd
HAVING s.region IS NULL
    OR btrim(coalesce(s.region, '')) = ''
    OR s.return_note IS NULL
    OR char_length(btrim(coalesce(s.return_note, ''))) < 20
    OR s.shipping_note IS NULL
    OR btrim(coalesce(s.shipping_note, '')) = ''
    OR s.shipping_fee_vnd IS NULL
    OR count(DISTINCT p.id) FILTER (
         WHERE p.status = 'approved' AND p.is_published
       ) = 0
    OR count(DISTINCT v.id) FILTER (
         WHERE p.status = 'approved' AND p.is_published AND coalesce(v.stock, 0) > 0
       ) = 0
ORDER BY s.slug;
