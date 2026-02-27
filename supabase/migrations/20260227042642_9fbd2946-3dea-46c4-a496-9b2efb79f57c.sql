
-- Add name_en column to forum_categories for bilingual support
ALTER TABLE public.forum_categories ADD COLUMN IF NOT EXISTS name_en text;

-- Add is_hidden column to forum_posts for moderation
ALTER TABLE public.forum_posts ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- Update RLS policy on forum_categories to allow moderators to manage
DROP POLICY IF EXISTS "Admins can manage categories" ON public.forum_categories;
CREATE POLICY "Admins and moderators can manage categories"
ON public.forum_categories
FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

-- Update forum_posts policies for moderator access
DROP POLICY IF EXISTS "Owners can update own posts" ON public.forum_posts;
CREATE POLICY "Owners or admins or moderators can update posts"
ON public.forum_posts
FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Owners or admins can delete posts" ON public.forum_posts;
CREATE POLICY "Owners or admins or moderators can delete posts"
ON public.forum_posts
FOR DELETE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

-- Update the SELECT policy to hide hidden posts from regular users
DROP POLICY IF EXISTS "Anyone can view posts" ON public.forum_posts;
CREATE POLICY "Anyone can view non-hidden posts"
ON public.forum_posts
FOR SELECT
USING (is_hidden = false OR auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));
