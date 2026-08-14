-- ============================================================================
-- Feed embeds v2 — auto-ingest reels from curated Instagram accounts
-- ----------------------------------------------------------------------------
-- Admin registers IG usernames in feed_embed_sources; the feed-embeds-sync
-- edge function (pg_cron, hourly) reads each account's recent media via the
-- official Instagram Graph API business_discovery edge (no scraping) and
-- inserts new reels into feed_embeds. Dedupe is on shortcode.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Sources table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feed_embed_sources (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  username         text        NOT NULL UNIQUE,
  active           boolean     NOT NULL DEFAULT true,
  -- false = ingest as hidden (is_active=false) for manual review in admin
  auto_publish     boolean     NOT NULL DEFAULT true,
  last_checked_at  timestamptz,
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_embed_sources ENABLE ROW LEVEL SECURITY;

-- Admin-only surface; sync function uses service_role (bypasses RLS).
DROP POLICY IF EXISTS "Admins can manage embed sources" ON public.feed_embed_sources;
CREATE POLICY "Admins can manage embed sources"
  ON public.feed_embed_sources
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Management API DDL role grants only SELECT by default (see feed_embeds
-- migration) — writes need explicit grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_embed_sources TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Dedupe key + provenance on feed_embeds
-- ----------------------------------------------------------------------------
ALTER TABLE public.feed_embeds
  ADD COLUMN IF NOT EXISTS shortcode text,
  ADD COLUMN IF NOT EXISTS source_username text;

-- Full UNIQUE constraint (not a partial index): PostgREST upsert
-- onConflict needs a real constraint, and Postgres treats NULLs as
-- distinct so hand-pasted rows without a shortcode still coexist.
ALTER TABLE public.feed_embeds
  DROP CONSTRAINT IF EXISTS feed_embeds_shortcode_key;
ALTER TABLE public.feed_embeds
  ADD CONSTRAINT feed_embeds_shortcode_key UNIQUE (shortcode);

-- ----------------------------------------------------------------------------
-- 3. pg_cron: run feed-embeds-sync hourly at :20
-- ----------------------------------------------------------------------------
-- Auth reuses the shared scraper secret already seeded in Vault
-- ('scraper_auth_secret' = SCRAPER_AUTH_SECRET env on edge functions; NB:
-- the news-translate migration file references 'news_translate_auth_secret'
-- but the live vault name is 'scraper_auth_secret') — one rotation point.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('feed-embeds-sync-hourly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'feed-embeds-sync-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'feed-embeds-sync-hourly',
  '20 * * * *',
  $cron$
    SELECT net.http_post(
      url     := public.ops_project_url() || '/functions/v1/feed-embeds-sync',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-auth-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets
                                     WHERE name = 'scraper_auth_secret' LIMIT 1)
                 ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$
);
