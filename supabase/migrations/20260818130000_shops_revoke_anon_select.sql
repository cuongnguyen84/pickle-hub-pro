-- ============================================================================
-- `shops` was the one catalog table the Wave-0 column-scope sweep missed.
-- ----------------------------------------------------------------------------
-- Probed on production with nothing but the publishable anon key:
--
--   GET /rest/v1/shops?select=slug,owner_user_id,city
--   → [{"slug":"thepicklehub","owner_user_id":"5235268c-…","city":"Hà Nội"}]
--
-- One uid is enough: `profiles` lets every signed-in user read a full row, so
-- an anonymous scrape of the catalog hands out a join key to the real identity
-- behind each storefront. Same invariant as 20260818120000 §5 — the leak just
-- wore a fourth column name.
--
-- 20260815090000 revoked anon from products / product_variants / product_media
-- and explained why. `shops` was not in that list; this is the omission, not a
-- new policy.
--
-- The cut is one line because the public surface never needed the grant:
--   * every buyer-facing read goes through shop_public_search /
--     shop_public_shop / shop_public_product / product_public_projection, all
--     SECURITY DEFINER with an explicit column allowlist (20260813090000:487
--     documents owner_user_id's absence as "an allowlist, not a redaction").
--   * public_products has been DEFINER since 20260815090000, so its join to
--     `shops` no longer depends on the caller's grant.
--   * `src` never issues supabase.from("shops") — shop-client.ts:5 says so and
--     the table is absent from the generated types. The only direct readers are
--     service_role (delete-account, the QA scripts), which bypasses RLS.
--
-- A probe now answers 42501 instead of a full-width row.
--
-- `authenticated` deliberately keeps its grant: sellers and admins read the
-- base table under shops_select_member / shops_select_public_active, and the
-- storefront already publishes the owner's display name anyway. The boundary
-- that moved is the anonymous one.

REVOKE SELECT ON public.shops FROM anon;

COMMENT ON COLUMN public.shops.owner_user_id IS
  'Never leaves the server. anon has no SELECT on this table (20260818130000); every public projection is a DEFINER allowlist that omits this column.';
