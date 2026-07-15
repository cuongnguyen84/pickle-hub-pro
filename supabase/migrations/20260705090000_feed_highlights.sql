-- ============================================================================
-- Feed highlights — system-generated feed cards (roadmap directions #4-#7)
-- ----------------------------------------------------------------------------
-- One table for everything the feed-generate cron produces:
--   milestone   — per-player: 5th/10th/... event participation, DUPR band
--                 crossings (public profiles only)
--   leaderboard — weekly top DUPR climbers digest (Mondays)
--   protour     — yesterday's pro tour results digest (daily)
--   recap       — Gemini-written weekly community recap (Sundays)
--
-- dedupe_key makes generation idempotent: the cron can re-attempt every
-- hour and upsert+ignoreDuplicates guarantees one card per fact.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feed_highlights (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text        NOT NULL CHECK (kind IN ('milestone', 'leaderboard', 'protour', 'recap')),
  dedupe_key    text        NOT NULL UNIQUE,
  title_vi      text        NOT NULL,
  title_en      text        NOT NULL,
  body_vi       text,
  body_en       text,
  href          text,
  is_active     boolean     NOT NULL DEFAULT true,
  published_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_highlights ENABLE ROW LEVEL SECURITY;

-- Feed is public (anonymous Trending) → active rows readable by all.
DROP POLICY IF EXISTS "Anyone can read active highlights" ON public.feed_highlights;
CREATE POLICY "Anyone can read active highlights"
  ON public.feed_highlights
  FOR SELECT
  USING (is_active);

-- Admin can hide/delete a bad card from the browser client.
DROP POLICY IF EXISTS "Admins can manage highlights" ON public.feed_highlights;
CREATE POLICY "Admins can manage highlights"
  ON public.feed_highlights
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Management-API DDL grants only SELECT by default (see feed_embeds).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_highlights TO authenticated;

CREATE INDEX IF NOT EXISTS idx_feed_highlights_active_published
  ON public.feed_highlights (published_at DESC)
  WHERE is_active;

-- ----------------------------------------------------------------------------
-- pg_cron: run feed-generate hourly at :50 (same shared secret as the other
-- generator crons; live vault name is 'scraper_auth_secret').
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('feed-generate-hourly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'feed-generate-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'feed-generate-hourly',
  '50 * * * *',
  $cron$
    SELECT net.http_post(
      url     := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/feed-generate',
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
