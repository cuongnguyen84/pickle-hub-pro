-- =====================================================================
-- social_posts: anonymous visitors may read APPROVED posts.
--
-- Cuong decision, 2026-11-24 19:18: open published community posts
-- to signed-out visitors on both surfaces that show them (the /feed
-- overlay and the profile-page community posts section). Scope is
-- deliberately narrow: status = 'approved' AND kind = 'post' only.
-- pending / rejected / hidden stay invisible to anon - they remain
-- covered by the authenticated-only policies from
-- 20261123100000_social_posts_photo_posts (select_approved /
-- select_own / select_admin). UGC SEO posture is unchanged (the
-- surfaces stay noindex as before); this only widens who can READ
-- already-moderated content.
--
-- The GRANT is included explicitly: the table's original migration
-- created policies without grants, and the missing UPDATE grant for
-- authenticated is what broke the admin Approve button until
-- 20261124190000 fixed it. SELECT for anon is granted here so the
-- policy never depends on schema default privileges.
-- =====================================================================

GRANT SELECT ON public.social_posts TO anon;

DROP POLICY IF EXISTS "social_posts_select_approved_anon" ON public.social_posts;
CREATE POLICY "social_posts_select_approved_anon"
  ON public.social_posts FOR SELECT TO anon
  USING (status = 'approved' AND kind = 'post');
