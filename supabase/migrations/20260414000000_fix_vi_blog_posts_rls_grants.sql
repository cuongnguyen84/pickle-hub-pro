-- Fix vi_blog_posts: missing GRANT + align policies to use is_admin() like rest of codebase
--
-- Root cause of "permission denied for table vi_blog_posts":
--   The table was created without GRANT to authenticated/anon roles.
--   PostgreSQL object-level permission is checked before RLS, so admin INSERT
--   was blocked at the GRANT layer, never reaching the RLS policies.
--
-- Secondary: policies used has_role(auth.uid(), 'admin') — replaced with is_admin()
--   for consistency with all other tables in the project.

-- ── 1. Grant table-level access ──────────────────────────────────────────────

-- anon: SELECT only (for public blog reader, no auth)
GRANT SELECT ON public.vi_blog_posts TO anon;

-- authenticated: full DML (RLS policies below restrict actual rows)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vi_blog_posts TO authenticated;

-- ── 2. Replace has_role policies with is_admin() ──────────────────────────────

-- Drop the policies created in the original migration that use has_role
DROP POLICY IF EXISTS "Admins can read all vi blog posts"   ON public.vi_blog_posts;
DROP POLICY IF EXISTS "Admins can insert vi blog posts"     ON public.vi_blog_posts;
DROP POLICY IF EXISTS "Admins can update vi blog posts"     ON public.vi_blog_posts;
DROP POLICY IF EXISTS "Admins can delete vi blog posts"     ON public.vi_blog_posts;

-- Re-create using is_admin() — same logic, consistent with rest of codebase
CREATE POLICY "Admins can read all vi blog posts"
  ON public.vi_blog_posts FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert vi blog posts"
  ON public.vi_blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update vi blog posts"
  ON public.vi_blog_posts FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete vi blog posts"
  ON public.vi_blog_posts FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- "Public can view published vi blog posts" policy is unchanged — already correct.
-- It uses USING (status = 'published') with no role restriction, so it covers
-- both anon and authenticated non-admin users reading published content.
