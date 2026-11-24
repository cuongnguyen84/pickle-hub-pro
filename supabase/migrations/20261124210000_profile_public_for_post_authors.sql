-- =====================================================================
-- profile_has_approved_post: is this user a published community
-- author?
--
-- Cuong decision, 2026-11-24: an author with at least one approved
-- social_post gets a publicly viewable profile page
-- (/nguoi-choi/:username) even when they never opted in via
-- profiles.is_public_profile. Users with no approved post keep the
-- existing opt-in gate.
--
-- SECURITY DEFINER on purpose: social_posts has no anonymous SELECT
-- policy, so the profile gate cannot count approved posts with the
-- caller's own privileges. The function exposes exactly one boolean
-- and nothing else - no post content, no counts. Callers:
-- usePlayerProfile (SPA gate) and functions/_lib/render/profile.ts
-- (bot gate), so humans and crawlers apply the same rule.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.profile_has_approved_post(p_author_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.social_posts
    WHERE author_id = p_author_id
      AND kind = 'post'
      AND status = 'approved'
  );
$$;

GRANT EXECUTE ON FUNCTION public.profile_has_approved_post(uuid) TO anon, authenticated;
