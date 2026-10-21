-- ============================================================================
-- Anonymous REST could read every column of the catalog tables.
-- ----------------------------------------------------------------------------
-- Wave 0, with nothing but the anon key:
--
--   GET /rest/v1/product_variants?select=sku,stock_on_hand
--   → real stock counts, retired variants included.
--
-- RLS limits ROWS, never columns. `public_products` was built as the one
-- column-scoped definition of "publicly visible" — but it was security_invoker,
-- which forced the base tables to carry `TO public` SELECT policies for the
-- view to work at all, and those policies handed anon the WHOLE row over REST:
-- stock_on_hand, products.internal_note (promised to stay internal by the
-- admin UI), decided_by, product_media.draft_path. The admin screen's claim
-- "Số tồn kho thật không đi vào phép chiếu này" was true of the view and false
-- of the API next to it. Same lesson as the cleanup-health view and
-- shop_applications.internal_note: the guard must live at the layer the
-- request hits.
--
-- The cut:
--   * public_products becomes a DEFINER view — its WHERE and its column list
--     are the boundary, exactly like shop_applications_admin. Nothing else
--     about its definition changes, so every server-side reader (reconcile,
--     grants, the canonical projection) sees the same rows.
--   * The three `TO public` base-table policies are dropped. Buyer traffic
--     never used them: every public surface reads through the
--     shop_public_* SECURITY DEFINER RPCs or the view.
--   * anon loses its (platform-default) SELECT grant on the base tables
--     outright, so a probe answers 42501 instead of a silently-empty [] —
--     and instead of a full-width row.
--   * authenticated keeps its grants: sellers and admins read the base tables
--     under the member/admin policies. A signed-in buyer who tries the same
--     probe hits those policies and gets zero rows — column NAMES are
--     visible, values are not, which is the boundary the repo already
--     documents in BUYER_FORBIDDEN_VALUES.

ALTER VIEW public.public_products SET (security_invoker = false);
COMMENT ON VIEW public.public_products IS
  'The only definition of publicly visible. DEFINER on purpose: the WHERE and the column list are the boundary; the base tables carry no public policy at all (20260815090000).';

DROP POLICY IF EXISTS "products_select_public"         ON public.products;
DROP POLICY IF EXISTS "product_variants_select_public" ON public.product_variants;
DROP POLICY IF EXISTS "product_media_select_public"    ON public.product_media;

REVOKE SELECT ON public.products         FROM anon;
REVOKE SELECT ON public.product_variants FROM anon;
REVOKE SELECT ON public.product_media    FROM anon;

-- The view stays readable by everyone — that is its job.
GRANT SELECT ON public.public_products TO anon, authenticated, service_role;
