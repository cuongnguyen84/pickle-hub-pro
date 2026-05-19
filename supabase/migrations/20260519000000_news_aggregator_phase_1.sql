-- ============================================================================
-- News Aggregator Phase 1 — Foundation
-- ----------------------------------------------------------------------------
-- Background
-- ----------
-- ThePickleHub aggregates pickleball news from 5 English-language sources:
--   PPA Tour, PPA Tour Asia, The Kitchen Pickleball, The Dink Pickleball,
--   APP Pickleball News.
--
-- Bilingual strategy:
--   - Track EN: ingest verbatim from source RSS (Track EN audience).
--   - Track VI: AI-rewritten EN→VI summary via Claude Haiku in a follow-up
--     edge function (Track VI audience). Each VI row references the original
--     EN row via parent_news_id so hreflang can be wired up.
--
-- This migration prepares the schema for:
--   - Phase 2: external RSS fetcher (Cloudflare Worker) → calls news-ingest
--   - Phase 3: news-translate edge function (AI rewrite EN → VI)
--   - Phase 4: /news/:slug + /vi/news/:slug SEO pages
--
-- Changes in this migration
-- -------------------------
-- 1. ALTER news_items: add image_url, language, slug, category, importance,
--    ai_translated, parent_news_id, source_id, content_html.
--    Backfill language='en' for existing rows (assume current data is EN).
--
-- 2. CREATE news_sources lookup table — single source of truth for the 5
--    sources. Replaces the free-text `news_items.source` field for joins.
--    Legacy text column kept during transition; will be dropped in Phase 2
--    once the fetcher fills source_id consistently.
--
-- 3. DEDUP existing news_items rows by (source_url, language) BEFORE adding
--    the UNIQUE index. The legacy `pro-tour-scraper` worker wrote duplicates
--    (no news-check call) and the index can't be created on dup data.
--
-- 4. INDEX news_items for the common access patterns:
--    - public list page: (status, language, published_at DESC)
--    - source filter:    (source_id, status, published_at DESC)
--    - slug lookup:      (language, slug) UNIQUE
--    - source_url dedup: (source_url, language) UNIQUE
--
-- 5. SEED 5 sources:
--    - 4 active RSS feeds (verified via curl 2026-05-19)
--    - 1 deferred (APP — Webflow site, needs HTML scraper in Phase 2)
--
-- 6. RLS for news_sources: public can read active rows (frontend filter
--    pills, source attribution links). Write is service_role only.
--
-- 7. Trigger to maintain updated_at on news_items and news_sources.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ALTER news_items
-- ----------------------------------------------------------------------------

ALTER TABLE public.news_items
  ADD COLUMN IF NOT EXISTS image_url       TEXT,
  ADD COLUMN IF NOT EXISTS language        TEXT NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'vi')),
  ADD COLUMN IF NOT EXISTS slug            TEXT,
  ADD COLUMN IF NOT EXISTS category        TEXT,
  ADD COLUMN IF NOT EXISTS importance      INT NOT NULL DEFAULT 3
    CHECK (importance BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS ai_translated   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_news_id  UUID
    REFERENCES public.news_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_id       TEXT,
  ADD COLUMN IF NOT EXISTS content_html    TEXT,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.news_items.image_url      IS 'Public URL of the article hero image. Self-hosted (Supabase Storage / R2), NOT hotlinked from source.';
COMMENT ON COLUMN public.news_items.language       IS 'Content language: en (original) | vi (AI-translated).';
COMMENT ON COLUMN public.news_items.slug           IS 'URL slug for /news/:slug (or /vi/news/:slug). Unique per language.';
COMMENT ON COLUMN public.news_items.category       IS 'Free-text tag: tournament | player | equipment | business | community. Not enum to allow flexibility.';
COMMENT ON COLUMN public.news_items.importance     IS '1 (low) - 5 (breaking). Drives push notifications and front-page placement.';
COMMENT ON COLUMN public.news_items.ai_translated  IS 'true if AI-rewritten from another news_items row. Show "AI-translated" badge in UI for transparency.';
COMMENT ON COLUMN public.news_items.parent_news_id IS 'For VI rows: points at the EN source row. Used for hreflang in SEO pages.';
COMMENT ON COLUMN public.news_items.source_id      IS 'FK to news_sources.id. Legacy text column `source` kept during Phase 1 transition.';
COMMENT ON COLUMN public.news_items.content_html   IS 'Optional long-form body. Most rows store only summary; this is for future long-form / opinion pieces.';

-- ----------------------------------------------------------------------------
-- 2. CREATE news_sources
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.news_sources (
  id              TEXT PRIMARY KEY,                     -- e.g. 'ppa-tour'
  name            TEXT NOT NULL,                        -- e.g. 'PPA Tour'
  base_url        TEXT NOT NULL,                        -- site root, used for logos / "Read at" links
  feed_url        TEXT,                                 -- RSS / Atom URL; NULL for HTML scrape sources
  feed_type       TEXT NOT NULL DEFAULT 'rss'
    CHECK (feed_type IN ('rss', 'atom', 'html_scrape', 'manual')),
  language        TEXT NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'vi')),
  trust_tier      INT NOT NULL DEFAULT 1
    CHECK (trust_tier BETWEEN 1 AND 3),                 -- 1 = highest trust → auto-publish
  auto_publish    BOOLEAN NOT NULL DEFAULT true,
  active          BOOLEAN NOT NULL DEFAULT true,
  logo_url        TEXT,                                 -- source logo for UI attribution
  last_fetched_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,                          -- updated only on successful fetch
  last_error      TEXT,                                 -- last failure reason (debug aid)
  notes           TEXT,                                 -- free-text — quirks, edge cases
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.news_sources              IS 'Whitelist of pickleball news sources the aggregator pulls from. Frontend filter pills + admin pause switch.';
COMMENT ON COLUMN public.news_sources.id           IS 'Stable slug used as FK from news_items.source_id and in URLs. Never change after seed.';
COMMENT ON COLUMN public.news_sources.feed_type    IS 'rss | atom | html_scrape (needs custom parser) | manual (admin paste only).';
COMMENT ON COLUMN public.news_sources.trust_tier   IS '1 = auto-publish (all 5 current sources). 2 = queue for admin review. 3 = manual approval required.';
COMMENT ON COLUMN public.news_sources.auto_publish IS 'If false, items from this source land as status=draft regardless of trust_tier. Kill switch.';
COMMENT ON COLUMN public.news_sources.active       IS 'If false, fetcher skips this source. Set to false to pause without deleting history.';

-- Now that news_sources exists, add the FK constraint on news_items.source_id.
-- We do this in a separate step so the news_sources rows are inserted before
-- any existing news_items rows are migrated (existing rows have source_id NULL
-- until manually backfilled in Phase 2).
ALTER TABLE public.news_items
  ADD CONSTRAINT news_items_source_id_fkey
    FOREIGN KEY (source_id) REFERENCES public.news_sources(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 3. DEDUP existing data before adding UNIQUE indexes
-- ----------------------------------------------------------------------------
-- The legacy external scraper (Cloudflare Worker `pro-tour-scraper`) wrote
-- duplicate rows because it didn't call news-check before news-ingest. The
-- UNIQUE (source_url, language) index below would fail with 23505 unless we
-- clean up existing dups first.
--
-- Policy: same (source_url, language) tuple = duplicate. Keep the OLDEST row
-- (smallest created_at; if tied, smallest id) — that's the row most likely to
-- have been picked up by downstream caches, search indexers, or social shares.
DELETE FROM public.news_items a
USING public.news_items b
WHERE a.source_url = b.source_url
  AND a.language   = b.language
  AND (
    a.created_at >  b.created_at
    OR (a.created_at = b.created_at AND a.id > b.id)
  );

-- ----------------------------------------------------------------------------
-- 4. INDEXES
-- ----------------------------------------------------------------------------

-- Public list page: filter by language + status, order by published_at desc.
-- Existing index `idx_news_items_status_published_at` is on (status, published_at)
-- but doesn't include language, so it's no longer covering. Replace it.
DROP INDEX IF EXISTS public.idx_news_items_status_published_at;

CREATE INDEX IF NOT EXISTS idx_news_items_lang_status_published
  ON public.news_items(language, status, published_at DESC);

-- Source filter on the news page.
CREATE INDEX IF NOT EXISTS idx_news_items_source_published
  ON public.news_items(source_id, status, published_at DESC)
  WHERE source_id IS NOT NULL;

-- Slug lookup for /news/:slug and /vi/news/:slug.
-- UNIQUE per (language, slug) so EN and VI can share base slugs if needed.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_news_items_lang_slug
  ON public.news_items(language, slug)
  WHERE slug IS NOT NULL;

-- Dedup: same source URL should never be ingested twice for the same language.
-- (A VI translation of an EN article has the same source_url but different
-- language, so this is composite, not single-column.)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_news_items_source_url_lang
  ON public.news_items(source_url, language);

-- parent_news_id lookup: when rendering EN page, find the matching VI row
-- for hreflang. Reverse direction too (VI → EN already covered by PK).
CREATE INDEX IF NOT EXISTS idx_news_items_parent
  ON public.news_items(parent_news_id)
  WHERE parent_news_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. SEED news_sources
-- ----------------------------------------------------------------------------
-- All 5 sources verified via curl on 2026-05-19. APP returns 404 on every
-- guessed feed URL (Webflow site) so it's seeded with active=false and
-- feed_type='html_scrape' — Phase 2 will add a dedicated HTML scraper.

INSERT INTO public.news_sources (
  id, name, base_url, feed_url, feed_type, language,
  trust_tier, auto_publish, active, notes
) VALUES
  (
    'ppa-tour',
    'PPA Tour',
    'https://ppatour.com',
    'https://ppatour.com/feed/',
    'rss',
    'en',
    1, true, true,
    'WordPress RSS 2.0. Highest authority for US pro tour coverage.'
  ),
  (
    'ppa-asia',
    'PPA Tour Asia',
    'https://www.ppatour-asia.com',
    'https://www.ppatour-asia.com/feed/',
    'rss',
    'en',
    1, true, true,
    'WordPress RSS 2.0. Strategic — Newsport partnership. Highest priority for Vietnam audience.'
  ),
  (
    'dink',
    'The Dink Pickleball',
    'https://www.thedinkpickleball.com',
    'https://www.thedinkpickleball.com/feed',
    'rss',
    'en',
    1, true, true,
    'RSS 2.0 with media:content namespace — images present in feed.'
  ),
  (
    'kitchen',
    'The Kitchen Pickleball',
    'https://thekitchenpickle.com',
    'https://thekitchenpickle.com/blogs/news.atom',
    'atom',
    'en',
    1, true, true,
    'Shopify Atom feed. Long-form articles, lower volume than The Dink.'
  ),
  (
    'app',
    'APP Pickleball News',
    'https://www.theapp.global',
    NULL,
    'html_scrape',
    'en',
    1, true, false,
    'DEFERRED to Phase 2: Webflow site, no RSS feed. Needs HTML scraper. Activate after scraper ships.'
  )
ON CONFLICT (id) DO UPDATE SET
  name      = EXCLUDED.name,
  base_url  = EXCLUDED.base_url,
  feed_url  = EXCLUDED.feed_url,
  feed_type = EXCLUDED.feed_type,
  notes     = EXCLUDED.notes,
  updated_at = now();

-- ----------------------------------------------------------------------------
-- 6. RLS for news_sources
-- ----------------------------------------------------------------------------

ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;

-- Public can read active sources (frontend filter pills, attribution).
CREATE POLICY "Active news sources are publicly readable"
  ON public.news_sources
  FOR SELECT
  USING (active = true);

-- Admin (service_role) bypasses RLS, so no INSERT/UPDATE/DELETE policies are
-- needed. Phase 5 will add an admin UI that runs through service_role.

-- ----------------------------------------------------------------------------
-- 7. updated_at trigger for news_sources and news_items
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_news_sources_updated_at ON public.news_sources;
CREATE TRIGGER set_news_sources_updated_at
  BEFORE UPDATE ON public.news_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_news_items_updated_at ON public.news_items;
CREATE TRIGGER set_news_items_updated_at
  BEFORE UPDATE ON public.news_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Post-migration TODO (manual, NOT in this file)
-- ----------------------------------------------------------------------------
-- 1. Run `supabase gen types typescript --project-id ajvlcamxemgbxduhiqrl
--    > src/integrations/supabase/types.ts` to refresh TS types.
-- 2. Verify in Supabase Studio: news_sources has 5 rows, 4 active + 1 deferred.
-- 3. Hook Phase 2 fetcher to write into source_id (not the legacy `source`
--    text column). Backfill existing rows manually in Phase 2.
-- ============================================================================
