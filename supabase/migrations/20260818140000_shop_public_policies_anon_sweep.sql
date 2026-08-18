-- ============================================================================
-- Two more tables anon could read, found by the fallout of 20260818130000.
-- ----------------------------------------------------------------------------
-- Revoking anon's SELECT on `shops` broke five pgTAP files with
-- "permission denied for table shops" raised from queries that never named
-- `shops`. The cause is worth writing down, because it is the reason this
-- follow-up exists rather than a one-line test fix:
--
--   RLS policy expressions are evaluated AS THE QUERYING ROLE.
--
-- So a `TO public` policy shaped like
--
--   USING (is_public AND state = 'approved'
--          AND EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id
--                        AND s.state = 'active'))
--
-- silently required anon to hold SELECT on `shops`. Exactly two tables in the
-- schema have that shape, and anon held a grant on both:
--
--   shop_contact_channels  →  shop_contact_select_public
--   shop_profile_media     →  shop_profile_media_select_public
--
-- Which means that for as long as anon held SELECT on `shops`, an anonymous
-- REST call could read both tables WHOLE for any active shop. Verified locally
-- against the pre-20260818130000 grant state, not inferred:
--
--   SET ROLE anon; SELECT value_raw, value_normalized FROM shop_contact_channels;
--   → 0912345678 | +84912345678
--
-- The row is wider than the door next to it. shop_public_contacts returns an
-- allowlist of four keys (id, type, href, label). The table also carries
-- `internal_note` and `review_note` — moderator-only text, the exact class of
-- field 20260814140000 was written to keep off shop_applications — plus
-- `approved_by`, another admin uid. shop_profile_media carries `draft_path`,
-- the private original, which 20260815090000 named explicitly as a leak when
-- it found the same column on product_media.
--
-- Same hole as `shops`, two tables further along; the 20260815090000 sweep
-- missed all three.
--
-- The cut is the same one, for the same reason: nothing public needs the
-- grant.
--   * contacts reach a buyer through shop_public_contacts /
--     shop_public_contacts_for_product, SECURITY DEFINER, which return an
--     allowlist of already-approved, already-public channels.
--   * logo and cover reach a buyer inside shop_public_shop's JSON.
--   * the only client code that reads either table directly is
--     useShopContacts (SellerShopSettings) and useShopProfileMedia
--     (MediaEditor, AdminShopApplicationReview) — all seller or admin, all
--     `authenticated`, all covered by the member/admin policies.
--
-- The `TO public` policies are deliberately NOT dropped. They still do real
-- work for `authenticated`, which keeps its grant on both tables and on
-- `shops`, so the EXISTS above still evaluates. Dropping them would take the
-- signed-in non-member path with it for no gain.

REVOKE SELECT ON public.shop_contact_channels FROM anon;
REVOKE SELECT ON public.shop_profile_media    FROM anon;

COMMENT ON TABLE public.shop_contact_channels IS
  'Seller contact channels in raw stored form. anon has no SELECT (20260818140000); the public door is shop_public_contacts, which returns approved+public channels only.';
COMMENT ON TABLE public.shop_profile_media IS
  'Shop logo/cover rows including draft paths. anon has no SELECT (20260818140000); public renditions travel inside shop_public_shop.';
