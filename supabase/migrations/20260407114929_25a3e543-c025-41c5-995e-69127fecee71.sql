
-- Create vi_blog_posts table
CREATE TABLE public.vi_blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  meta_title TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  excerpt TEXT,
  content_html TEXT NOT NULL,
  cover_image_url TEXT,
  author_name TEXT DEFAULT 'ThePickleHub',
  category TEXT,
  tags TEXT[],
  focus_keyword TEXT,
  faq_items JSONB,
  related_post_slugs TEXT[],
  alternate_en_slug TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vi_blog_slug ON public.vi_blog_posts(slug) WHERE status = 'published';
CREATE INDEX idx_vi_blog_status_published_at ON public.vi_blog_posts(status, published_at DESC);
CREATE INDEX idx_vi_blog_category ON public.vi_blog_posts(category) WHERE status = 'published';

-- RLS
ALTER TABLE public.vi_blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read published posts
CREATE POLICY "Public can view published vi blog posts"
  ON public.vi_blog_posts FOR SELECT
  USING (status = 'published');

-- Admins can read all posts (including drafts)
CREATE POLICY "Admins can read all vi blog posts"
  ON public.vi_blog_posts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert
CREATE POLICY "Admins can insert vi blog posts"
  ON public.vi_blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update
CREATE POLICY "Admins can update vi blog posts"
  ON public.vi_blog_posts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can delete
CREATE POLICY "Admins can delete vi blog posts"
  ON public.vi_blog_posts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_vi_blog_updated_at
  BEFORE UPDATE ON public.vi_blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
