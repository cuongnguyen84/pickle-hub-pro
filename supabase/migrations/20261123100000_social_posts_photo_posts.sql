-- UGC photo posts - narrowed photo-first slice of MXH-UGC plan PR-0b (23/11/2026).
-- Creates: public.social_posts (+ status triggers + RLS), storage bucket
-- 'post-images', and widens content_reports.content_type with 'post' so the
-- existing ReportDialog flow can report user posts.
-- Runbook: apply to production BEFORE merging the feature PR, then insert the
-- ledger row (separate block at the bottom of the handoff message).

-- ===========================================================================
-- 1. social_posts
-- kind: 'post' (photo post, v1) | 'checkin' (reserved for the check-in PR).
-- A 'post' MUST carry an image in v1 (photo-first scope set by Cuong 23/11).
-- ===========================================================================
CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'post' CHECK (kind IN ('post', 'checkin')),
  body text CHECK (body IS NULL OR char_length(body) <= 2000),
  image_url text,
  topic text CHECK (topic IS NULL OR topic IN ('tim-ban-danh', 'hoi-ky-thuat', 'khoe-vot', 'ket-qua', 'open-play')),
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
  auto_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_posts_post_requires_image CHECK (kind <> 'post' OR image_url IS NOT NULL)
);

CREATE INDEX idx_social_posts_status_created ON public.social_posts (status, created_at DESC);
CREATE INDEX idx_social_posts_author_created ON public.social_posts (author_id, created_at DESC);
CREATE INDEX idx_social_posts_venue_created ON public.social_posts (venue_id, created_at DESC) WHERE venue_id IS NOT NULL;

CREATE TRIGGER social_posts_set_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================================================
-- 2. Initial status: an author with fewer than 3 approved posts starts at
-- 'pending' (pre-moderation); from 3 approved posts on, new posts are
-- 'approved' immediately (trust graduation from the UGC plan, threshold 3).
-- Runs as invoker on purpose: the author's own-rows SELECT policy makes the
-- count of their approved posts visible to the count query.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.social_posts_set_initial_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM public.social_posts
       WHERE author_id = NEW.author_id AND status = 'approved') >= 3 THEN
    NEW.status := 'approved';
  ELSE
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER social_posts_initial_status
  BEFORE INSERT ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.social_posts_set_initial_status();

-- ===========================================================================
-- 3. Status guard: only admins (public.is_admin()) or the service role may
-- change a post's status. Authors can edit their own body/image/topic but
-- cannot self-approve; moderation transitions stay admin-only.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.social_posts_guard_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND auth.role() <> 'service_role'
     AND NOT public.is_admin() THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER social_posts_guard_status
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.social_posts_guard_status_change();

-- ===========================================================================
-- 4. RLS. Guests (anon) get NO policy at all: they cannot read UGC.
-- Authenticated users read approved posts; authors read their own posts in
-- any status; admins read everything (the moderation queue).
-- ===========================================================================
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_posts_select_approved" ON public.social_posts;
CREATE POLICY "social_posts_select_approved"
  ON public.social_posts FOR SELECT TO authenticated
  USING (status = 'approved');

DROP POLICY IF EXISTS "social_posts_select_own" ON public.social_posts;
CREATE POLICY "social_posts_select_own"
  ON public.social_posts FOR SELECT TO authenticated
  USING (author_id = auth.uid());

DROP POLICY IF EXISTS "social_posts_select_admin" ON public.social_posts;
CREATE POLICY "social_posts_select_admin"
  ON public.social_posts FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "social_posts_insert_own" ON public.social_posts;
CREATE POLICY "social_posts_insert_own"
  ON public.social_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "social_posts_update_own" ON public.social_posts;
CREATE POLICY "social_posts_update_own"
  ON public.social_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "social_posts_update_admin" ON public.social_posts;
CREATE POLICY "social_posts_update_admin"
  ON public.social_posts FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- No DELETE policy on purpose: removal is a status change to 'hidden'
-- (author) or 'rejected'/'hidden' (admin), never a hard delete.

-- ===========================================================================
-- 5. Bucket 'post-images': public read (post photos are public content),
-- writes ONLY through the create-post edge function running as service role
-- (no INSERT/UPDATE/DELETE policies for authenticated users at all).
-- ===========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images',
  true,
  10485760,  -- 10MB: phone originals reach the edge function, stored file is resized
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "post_images_public_read" ON storage.objects;
CREATE POLICY "post_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-images');

-- ===========================================================================
-- 6. content_reports: allow reporting user posts (ReportDialog reuses this
-- table). The CHECK was created inline in 20260305141227 and never altered,
-- so the auto-generated constraint name below is the live one.
-- ===========================================================================
ALTER TABLE public.content_reports
  DROP CONSTRAINT IF EXISTS content_reports_content_type_check;
ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_content_type_check
  CHECK (content_type IN ('livestream', 'tournament', 'profile', 'forum_post', 'post'));
