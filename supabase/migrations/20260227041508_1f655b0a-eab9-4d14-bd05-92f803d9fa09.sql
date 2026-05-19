
-- Forum like target type enum
CREATE TYPE public.forum_like_target AS ENUM ('post', 'comment');

-- Forum categories
CREATE TABLE public.forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories" ON public.forum_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.forum_categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Forum posts
CREATE TABLE public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.forum_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  image_urls text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  is_pinned boolean NOT NULL DEFAULT false,
  is_qa boolean NOT NULL DEFAULT false,
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view posts" ON public.forum_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON public.forum_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update own posts" ON public.forum_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Owners or admins can delete posts" ON public.forum_posts FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- Forum comments
CREATE TABLE public.forum_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_best_answer boolean NOT NULL DEFAULT false,
  like_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments" ON public.forum_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON public.forum_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update own comments" ON public.forum_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners or admins can delete comments" ON public.forum_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- Forum likes
CREATE TABLE public.forum_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.forum_like_target NOT NULL,
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);
ALTER TABLE public.forum_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes" ON public.forum_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like" ON public.forum_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike own" ON public.forum_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Triggers for like_count increment/decrement
CREATE OR REPLACE FUNCTION public.forum_like_count_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.target_type = 'post' THEN
      UPDATE forum_posts SET like_count = like_count + 1 WHERE id = NEW.target_id;
    ELSIF NEW.target_type = 'comment' THEN
      UPDATE forum_comments SET like_count = like_count + 1 WHERE id = NEW.target_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.target_type = 'post' THEN
      UPDATE forum_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.target_id;
    ELSIF OLD.target_type = 'comment' THEN
      UPDATE forum_comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.target_id;
    END IF;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER forum_like_insert_trigger AFTER INSERT ON public.forum_likes FOR EACH ROW EXECUTE FUNCTION public.forum_like_count_trigger();
CREATE TRIGGER forum_like_delete_trigger AFTER DELETE ON public.forum_likes FOR EACH ROW EXECUTE FUNCTION public.forum_like_count_trigger();

-- Trigger for comment_count
CREATE OR REPLACE FUNCTION public.forum_comment_count_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER forum_comment_insert_trigger AFTER INSERT ON public.forum_comments FOR EACH ROW EXECUTE FUNCTION public.forum_comment_count_trigger();
CREATE TRIGGER forum_comment_delete_trigger AFTER DELETE ON public.forum_comments FOR EACH ROW EXECUTE FUNCTION public.forum_comment_count_trigger();

-- Updated_at trigger for posts
CREATE TRIGGER forum_posts_updated_at BEFORE UPDATE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for forum images
INSERT INTO storage.buckets (id, name, public) VALUES ('forum-images', 'forum-images', true);

CREATE POLICY "Anyone can view forum images" ON storage.objects FOR SELECT USING (bucket_id = 'forum-images');
CREATE POLICY "Authenticated users can upload forum images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'forum-images');
CREATE POLICY "Users can delete own forum images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_comments;

-- Indexes
CREATE INDEX idx_forum_posts_category ON public.forum_posts(category_id);
CREATE INDEX idx_forum_posts_user ON public.forum_posts(user_id);
CREATE INDEX idx_forum_posts_created ON public.forum_posts(created_at DESC);
CREATE INDEX idx_forum_posts_pinned ON public.forum_posts(is_pinned DESC, created_at DESC);
CREATE INDEX idx_forum_comments_post ON public.forum_comments(post_id);
CREATE INDEX idx_forum_likes_target ON public.forum_likes(target_type, target_id);

-- Seed default categories
INSERT INTO public.forum_categories (name, slug, description, display_order) VALUES
  ('Kỹ thuật', 'ky-thuat', 'Thảo luận về kỹ thuật chơi Pickleball', 1),
  ('Tìm bạn chơi', 'tim-ban-choi', 'Tìm người chơi cùng tại khu vực của bạn', 2),
  ('Mua bán gear', 'mua-ban-gear', 'Mua bán, trao đổi vợt và phụ kiện Pickleball', 3),
  ('Hỏi đáp', 'hoi-dap', 'Đặt câu hỏi và nhận câu trả lời từ cộng đồng', 4),
  ('Tổng hợp', 'tong-hop', 'Thảo luận chung về Pickleball', 5);

-- Helper function to check if user owns a post
CREATE OR REPLACE FUNCTION public.is_forum_post_owner(_post_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.forum_posts WHERE id = _post_id AND user_id = _user_id
  )
$$;
