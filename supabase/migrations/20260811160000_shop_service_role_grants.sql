-- ============================================================================
-- Shop tables — service_role table grants
-- ----------------------------------------------------------------------------
-- service_role bypasses RLS. It does not bypass GRANT, and this repo has been
-- caught by that distinction more than once (two missing-grants sweeps, one of
-- which had push_tokens silently broken for four months).
--
-- Phase 1 and P2a.1 granted anon and authenticated and stopped there, so every
-- shop table was unreadable to the service role. Nothing noticed because the
-- transitions are SECURITY DEFINER and run as the owner — the hole only opens
-- the first time a backfill, a worker or an integration test touches a table
-- directly, which is exactly what the P2a.2 storage tests do.
--
-- Granting the service role is not a widening of who can reach this data: a
-- service_role key is already full trust. It is making the existing trust
-- work.
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops                   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_members            TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_pilot_members      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_applications       TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_application_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products                TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_media           TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_media_cleanup_jobs TO service_role;

GRANT SELECT ON public.public_products            TO service_role;
GRANT SELECT ON public.shop_media_cleanup_health  TO service_role;
