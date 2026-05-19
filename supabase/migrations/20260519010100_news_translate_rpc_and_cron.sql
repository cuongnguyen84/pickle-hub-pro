-- ============================================================================
-- News Aggregator Phase 3 — claim RPC + pg_cron schedule
-- ----------------------------------------------------------------------------
-- 1. claim_pending_news_translations(p_batch_size int)
--    Atomically marks the oldest N pending EN rows as 'translating' and
--    returns them. This is the standard claim pattern — if two translate
--    runs race, each row gets claimed by exactly one. Without this, a
--    naive SELECT + UPDATE would double-translate rows.
--
-- 2. pg_cron job: news-translate every 30 minutes (set up separately by
--    seeding `vault.decrypted_secrets` with the shared auth secret first,
--    then running the cron.schedule() block below).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Claim RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_pending_news_translations(
  p_batch_size int DEFAULT 10
)
RETURNS TABLE (
  id            uuid,
  title         text,
  summary       text,
  source        text,
  source_id     text,
  source_url    text,
  image_url     text,
  category      text,
  importance    int,
  published_at  timestamptz,
  slug          text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT n.id
    FROM public.news_items n
    WHERE n.language = 'en'
      AND n.ai_translation_status = 'pending'
    ORDER BY n.published_at DESC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED        -- safe under concurrent runs
  )
  UPDATE public.news_items n
  SET    ai_translation_status = 'translating',
         ai_translated_at      = now()
  FROM   picked p
  WHERE  n.id = p.id
  RETURNING
    n.id,
    n.title,
    n.summary,
    n.source,
    n.source_id,
    n.source_url,
    n.image_url,
    n.category,
    n.importance,
    n.published_at,
    n.slug;
END;
$$;

COMMENT ON FUNCTION public.claim_pending_news_translations(int) IS
  'Atomically claim N pending EN rows for translation. SECURITY DEFINER so the news-translate edge function can call it with service_role bypassing RLS.';

-- ----------------------------------------------------------------------------
-- 2. pg_cron schedule (every 30 minutes)
-- ----------------------------------------------------------------------------
-- Requirements: extensions `pg_cron` and `pg_net` must be enabled in the
-- project (they are by default in Supabase). The secret is read from
-- vault.decrypted_secrets so it's not in pg_cron.job.command plaintext.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule any existing job with the same name (idempotent re-run).
DO $$
BEGIN
  PERFORM cron.unschedule('news-translate-every-30m')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news-translate-every-30m');
EXCEPTION WHEN OTHERS THEN
  -- cron.unschedule raises when the job doesn't exist; swallow that case.
  NULL;
END $$;

-- Note: the auth secret is fetched from Supabase Vault by NAME — we expect
-- a secret named 'news_translate_auth_secret' to exist with the same value
-- as the SCRAPER_AUTH_SECRET env var on the edge function. The post-deploy
-- script in the PR will populate it.
SELECT cron.schedule(
  'news-translate-every-30m',
  '*/30 * * * *',
  $cron$
    SELECT net.http_post(
      url     := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/news-translate',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-auth-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets
                                     WHERE name = 'news_translate_auth_secret' LIMIT 1)
                 ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$
);
