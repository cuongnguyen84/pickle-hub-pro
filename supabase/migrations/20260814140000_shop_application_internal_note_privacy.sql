-- ============================================================================
-- internal_note was readable by the applicant, one layer below its guard.
-- ----------------------------------------------------------------------------
-- The applicant-facing read goes through `my_shop_application` (§5 of
-- 20260811090000), which simply has no internal_note column — and every
-- production call site uses it. But the base table still carried
-- `GRANT SELECT` on EVERY column to authenticated, and the select_own policy
-- hands the applicant their own row, so one hand-written REST call —
-- `/rest/v1/shop_applications?select=*` with the seller's own JWT — returned
-- the moderator's note verbatim. Found by CP27 case 6c against staging;
-- pgTAP never saw it because every earlier assertion exercised the view or
-- the RPCs, not a bare table read.
--
-- Same shape as the cleanup-health fix (20260814130000): the revoke has to
-- live at the layer the request actually hits.
--
--  * authenticated keeps SELECT on every column EXCEPT internal_note. A
--    `select=*` on the base table now answers 42501 for sellers and admins
--    alike — the moderation screens move to the definer view below.
--  * Writes are untouched: the guard trigger already reverts every
--    non-privileged write to moderator columns, and the decide/submit RPCs
--    are SECURITY DEFINER.
--  * service_role is untouched.

REVOKE SELECT ON public.shop_applications FROM authenticated;
GRANT SELECT (
  id, applicant_user_id, status, seller_type, full_name, phone,
  shop_name, shop_intro, pickup_address, city,
  applicant_note, requested_fields,
  submitted_at, decided_at, decided_by, shop_id, created_at, updated_at
) ON public.shop_applications TO authenticated;

-- The moderator's read of the queue, internal_note included. A DEFINER view
-- (the default, NOT security_invoker) on purpose: the column grant above
-- would blind the moderation screens too, since admin is the same Postgres
-- role. The is_admin() predicate is then the entire boundary — the same
-- boundary the decide RPC already trusts, aal2 included.
CREATE OR REPLACE VIEW public.shop_applications_admin AS
  SELECT id, applicant_user_id, status, seller_type, full_name, phone,
         shop_name, shop_intro, pickup_address, city,
         applicant_note, internal_note, requested_fields,
         submitted_at, decided_at, decided_by, shop_id, created_at, updated_at
  FROM public.shop_applications
  WHERE public.is_admin();

COMMENT ON VIEW public.shop_applications_admin IS
  'Moderation queue read, internal_note included. Definer view gated by is_admin() (aal2); non-admins get zero rows, and the base table no longer grants internal_note to authenticated at all.';

REVOKE ALL ON public.shop_applications_admin FROM PUBLIC;
REVOKE ALL ON public.shop_applications_admin FROM anon;
GRANT SELECT ON public.shop_applications_admin TO authenticated, service_role;
