-- Add Pickle Asia (requested 2026-09-08). The site is a client-rendered SPA:
-- /feed returns the app shell and common RSS/Atom paths return 404. Its frontend
-- reads published posts from a public, RLS-protected Supabase REST endpoint, so
-- news-fetcher uses a narrow json_api adapter for that same dataset.
--
-- Deploy order: configure PICKLE_ASIA_API_KEY on news-fetcher, deploy the
-- worker, then apply this migration. The key is public in Pickle Asia's browser
-- bundle, but remains a Worker secret so rotation does not require a code change.
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
  'https://idepcrgxqnyexinwjqjj.supabase.co/rest/v1/blog_posts',
  'json_api',
  'en',
  2, false, true,
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
