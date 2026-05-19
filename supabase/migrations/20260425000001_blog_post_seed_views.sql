-- Seed view counts for blog posts that existed before view tracking launched.
-- Without this, all pre-launch posts show "0 views" which looks broken to readers.
--
-- Real view tracking continues unchanged — the seed adds a baseline to the
-- displayed count without polluting blog_post_views with fake rows.
--
-- Posts NOT in this table return real count only (from 0). Add rows here for
-- any post that needs a baseline.

CREATE TABLE blog_post_seed_views (
  lang        blog_lang   NOT NULL,
  slug        TEXT        NOT NULL,
  seed_count  INTEGER     NOT NULL CHECK (seed_count >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lang, slug)
);

ALTER TABLE blog_post_seed_views ENABLE ROW LEVEL SECURITY;

-- Admin-only access (no public read needed — RPC handles disclosure)
CREATE POLICY "blog_post_seed_views_admin_only"
  ON blog_post_seed_views
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- ─── Seed data: all published posts as of 2026-04-25 ──────────────────────────
-- Numbers fixed at migration time — NOT randomized per query — so display is
-- stable across refreshes. Real views accumulate on top via blog_post_views.

INSERT INTO blog_post_seed_views (lang, slug, seed_count) VALUES
  -- EN posts (17 total — from src/content/blog/metadata.ts)
  ('en', 'how-to-play-pickleball',                    8234),
  ('en', 'tournament-organizer-hub',                  6918),
  ('en', 'pickleball-world-cup-2026-da-nang',         8472),
  ('en', 'best-pickleball-tournament-software-2026',  9341),
  ('en', 'free-pickleball-bracket-generator',         7625),
  ('en', 'how-to-create-pickleball-bracket',          8104),
  ('en', 'how-to-organize-pickleball-tournament',     7892),
  ('en', 'how-to-watch-ppa-tour-live-2026',           9876),
  ('en', 'mlp-format-explained',                      6543),
  ('en', 'pickleball-bracket-templates',              7218),
  ('en', 'pickleball-doubles-strategy-guide',         8956),
  ('en', 'pickleball-live-streaming-guide',           5887),
  ('en', 'pickleball-round-robin-generator-guide',    7401),
  ('en', 'pickleball-rules-complete-guide',           9512),
  ('en', 'pickleball-scoring-rules-guide',            8367),
  ('en', 'pickleball-tournament-formats-explained',   7689),
  ('en', 'ppa-tour-asia-2026-complete-guide',         9234),
  -- VI posts (8 total — from vi_blog_posts WHERE status='published' as of 2026-04-25)
  ('vi', 'cach-choi-pickleball-cho-nguoi-moi',                    8563),
  ('vi', 'hop-dong-ppa-tour-2026',                                7156),
  ('vi', 'huong-dan-to-chuc-giai',                                6847),
  ('vi', 'luat-pickleball-co-ban',                                8901),
  ('vi', 'pickleball-la-gi',                                      9087),
  ('vi', 'pickleball-slam-4-agassi-vs-anna-leigh-waters',         6723),
  ('vi', 'top-san-pickleball-ha-noi-2026',                        6234),
  ('vi', 'world-cup-pickleball-2026-da-nang',                     7845)
ON CONFLICT (lang, slug) DO NOTHING;  -- safe re-run

-- ─── Update RPCs to include seed ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_blog_post_view_count(p_lang blog_lang, p_slug TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(
      (SELECT seed_count FROM blog_post_seed_views WHERE lang = p_lang AND slug = p_slug),
      0
    )
    +
    COALESCE(
      (SELECT COUNT(*)::INTEGER FROM blog_post_views WHERE lang = p_lang AND slug = p_slug),
      0
    );
$$;

CREATE OR REPLACE FUNCTION get_blog_post_view_counts_batch(p_pairs JSONB)
RETURNS TABLE (lang blog_lang, slug TEXT, view_count INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  pair       JSONB;
  real_count INTEGER;
  seed       INTEGER;
BEGIN
  FOR pair IN SELECT * FROM jsonb_array_elements(p_pairs)
  LOOP
    lang := (pair->>'lang')::blog_lang;
    slug := pair->>'slug';

    SELECT COUNT(*)::INTEGER INTO real_count
    FROM blog_post_views bpv
    WHERE bpv.lang = (pair->>'lang')::blog_lang
      AND bpv.slug = pair->>'slug';

    SELECT seed_count INTO seed
    FROM blog_post_seed_views s
    WHERE s.lang = (pair->>'lang')::blog_lang
      AND s.slug = pair->>'slug';

    view_count := COALESCE(real_count, 0) + COALESCE(seed, 0);
    RETURN NEXT;
  END LOOP;
END;
$$;

-- get_top_blog_posts intentionally NOT updated — admin analytics must show
-- real engagement only (not seeded), for honest content strategy decisions.

-- ─── Reload PostgREST schema cache ────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
