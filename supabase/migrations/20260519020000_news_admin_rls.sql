-- ============================================================================
-- News Aggregator Phase 5 — Admin RLS policies
-- ----------------------------------------------------------------------------
-- Phase 1 left news_items and news_sources writable only by service_role
-- (no INSERT/UPDATE/DELETE policies). Phase 5 adds an /admin/news UI that
-- mutates these tables from the browser via the supabase-js client, which
-- runs as the authenticated user — so we need explicit admin policies.
--
-- Convention matches the rest of the admin UI: gate writes behind the
-- existing public.is_admin() helper, which checks user_roles.role='admin'
-- for the current auth.uid().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- news_items — admin can read all (incl. drafts) + update status etc.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can read all news"     ON public.news_items;
DROP POLICY IF EXISTS "Admins can update news_items" ON public.news_items;

CREATE POLICY "Admins can read all news"
  ON public.news_items
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update news_items"
  ON public.news_items
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- news_sources — admin can read all (incl. inactive) + update flags.
-- Existing public policy already covers SELECT for active rows; we layer
-- an admin SELECT policy that covers ALL rows (PostgreSQL OR-combines
-- policies on the same operation), and an UPDATE policy for the toggle
-- switches in the admin UI (active, auto_publish).
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can read all news_sources"  ON public.news_sources;
DROP POLICY IF EXISTS "Admins can update news_sources"    ON public.news_sources;

CREATE POLICY "Admins can read all news_sources"
  ON public.news_sources
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update news_sources"
  ON public.news_sources
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
