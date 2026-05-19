-- Migration: blog_post_views table + RPCs
-- Apply via Supabase Dashboard SQL Editor (NOT supabase db push)

CREATE TYPE blog_lang AS ENUM ('en', 'vi');

CREATE TABLE blog_post_views (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lang             blog_lang   NOT NULL,
  slug             TEXT        NOT NULL,
  viewer_user_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  session_hash     TEXT,
  country_code     TEXT,
  referrer_source  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for RPC performance
CREATE INDEX blog_post_views_lang_slug_idx ON blog_post_views (lang, slug);
CREATE INDEX blog_post_views_created_at_idx ON blog_post_views (created_at);
CREATE INDEX blog_post_views_session_hash_idx ON blog_post_views (session_hash);

-- RLS
ALTER TABLE blog_post_views ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can insert views
CREATE POLICY "blog_post_views_insert"
  ON blog_post_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can select (via user_roles table)
CREATE POLICY "blog_post_views_admin_select"
  ON blog_post_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- RPC: single post view count
CREATE OR REPLACE FUNCTION get_blog_post_view_count(p_lang blog_lang, p_slug TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM blog_post_views
  WHERE lang = p_lang
    AND slug = p_slug;
$$;

-- RPC: batch view counts for multiple posts
-- p_pairs: [{"lang": "en", "slug": "some-slug"}, ...]
CREATE OR REPLACE FUNCTION get_blog_post_view_counts_batch(p_pairs JSONB)
RETURNS TABLE (lang blog_lang, slug TEXT, view_count INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  pair JSONB;
BEGIN
  FOR pair IN SELECT * FROM jsonb_array_elements(p_pairs)
  LOOP
    lang  := (pair->>'lang')::blog_lang;
    slug  := pair->>'slug';
    SELECT COUNT(*)::INTEGER INTO view_count
    FROM blog_post_views bpv
    WHERE bpv.lang = (pair->>'lang')::blog_lang
      AND bpv.slug = pair->>'slug';
    RETURN NEXT;
  END LOOP;
END;
$$;

-- RPC: top blog posts by views in last N days
CREATE OR REPLACE FUNCTION get_top_blog_posts(p_days INTEGER DEFAULT 30, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  lang           blog_lang,
  slug           TEXT,
  total_views    BIGINT,
  unique_viewers BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    lang,
    slug,
    COUNT(*)                          AS total_views,
    COUNT(DISTINCT session_hash)      AS unique_viewers
  FROM blog_post_views
  WHERE created_at >= now() - (p_days || ' days')::INTERVAL
  GROUP BY lang, slug
  ORDER BY total_views DESC
  LIMIT p_limit;
$$;

-- Grant execute to anon + authenticated for the public-facing RPCs
GRANT EXECUTE ON FUNCTION get_blog_post_view_count(blog_lang, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_blog_post_view_counts_batch(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_blog_posts(INTEGER, INTEGER) TO authenticated;

-- Grant table-level INSERT to anon + authenticated.
-- RLS policy "blog_post_views_insert" gates which rows pass, but Postgres
-- requires table-level GRANT first — without this, anon clients hit
-- error 42501 "permission denied for table" before any RLS check runs.
-- (Discovered 2026-04-25 when curl with anon key returned 42501; SQL
-- editor super-user worked because it bypasses both GRANT and RLS.)
GRANT INSERT ON public.blog_post_views TO anon, authenticated;

-- Force PostgREST to reload schema cache so the new table + enum + RPCs
-- are recognized immediately. Without this, REST clients can hit cached
-- "relation does not exist" or stale type metadata for several minutes.
NOTIFY pgrst, 'reload schema';
