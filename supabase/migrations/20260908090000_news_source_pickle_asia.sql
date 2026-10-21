-- Pickle Asia is a client-rendered SPA and does not expose a working RSS/Atom
-- feed. Its frontend reads published posts from a public JSON API, so the
-- Worker uses a host-and-path allowlisted adapter. The endpoint intentionally
-- lives in Worker code instead of this row: DB data cannot redirect the
-- secret-bearing request, and migrations stay environment-neutral.
--
-- Deployment order matters: set PICKLE_ASIA_API_KEY and deploy news-fetcher
-- before this migration activates the source. auto_publish=false keeps every
-- new origin in the protected editorial review queue.

ALTER TABLE public.news_sources
  DROP CONSTRAINT IF EXISTS news_sources_feed_type_check;

ALTER TABLE public.news_sources
  ADD CONSTRAINT news_sources_feed_type_check
  CHECK (feed_type IN ('rss', 'atom', 'html_scrape', 'json_api', 'manual'));

INSERT INTO public.news_sources (
  id, name, base_url, feed_url, feed_type, language,
  trust_tier, auto_publish, active, notes
) VALUES (
  'pickle-asia',
  'Pickle Asia',
  'https://pickle.asia',
  NULL,
  'json_api',
  'en',
  2,
  false,
  true,
  'Public Supabase JSON API used by pickle.asia frontend. Reference-only source; new items stay draft for editorial review. Requires PICKLE_ASIA_API_KEY on news-fetcher.'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  feed_url = EXCLUDED.feed_url,
  feed_type = EXCLUDED.feed_type,
  language = EXCLUDED.language,
  trust_tier = EXCLUDED.trust_tier,
  auto_publish = EXCLUDED.auto_publish,
  active = true,
  last_error = NULL,
  notes = EXCLUDED.notes,
  updated_at = now();
