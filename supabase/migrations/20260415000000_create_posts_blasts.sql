-- Audit log for email blasts sent per post.
-- UNIQUE(post_id, post_language) prevents double-blast if the webhook fires twice.
CREATE TABLE IF NOT EXISTS public.posts_blasts (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id                uuid        NOT NULL,
  post_slug              text        NOT NULL,
  post_language          text        NOT NULL CHECK (post_language IN ('vi', 'en')),
  mailchimp_campaign_id  text        NOT NULL,
  mailchimp_campaign_url text,
  scheduled_for          timestamptz NOT NULL,
  created_at             timestamptz DEFAULT now(),
  UNIQUE (post_id, post_language)
);

ALTER TABLE public.posts_blasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read blasts"
  ON public.posts_blasts FOR SELECT
  USING (public.is_admin());

-- skip_email_blast: set to true before publishing to suppress auto-campaign
ALTER TABLE public.vi_blog_posts
  ADD COLUMN IF NOT EXISTS skip_email_blast boolean DEFAULT false;
