-- ============================================================================
-- Auto-fire social-poster Worker when news_items becomes eligible for FB post
-- ============================================================================
--
-- This replaces a Supabase Database Webhook (which is just sugar over the same
-- pg_net.http_post call). Doing it as a real migration means:
--   1. The webhook config is in version control, not Studio UI clicks.
--   2. We can express the eligibility filter precisely (only fire on rows
--      transitioning into vi+ai_translated+published state) — Studio webhooks
--      fire on every INSERT/UPDATE and the Worker has to filter.
--   3. SCRAPER_AUTH_SECRET lives in pg_settings vault so we never echo it in
--      migration text.
--
-- Eligibility rule (must match Worker's checkEligible()):
--   language     = 'vi'
--   ai_translated = true
--   status       = 'published'
--
-- Fire conditions:
--   - INSERT of an eligible row  → fire
--   - UPDATE where row IS eligible now AND (was NOT eligible before
--                                          OR  was eligible but key fields
--                                              changed in a meaningful way)
--   We don't want to fire on every UPDATE (e.g. updated_at touch) when the row
--   was already posted. The Worker has fb_post_log dedupe as a second line of
--   defense, but minimizing webhook fires saves quota.
--
-- Worker URL is hard-coded; if the URL changes, write a new migration that
-- ALTERs / replaces this function.
-- ============================================================================

-- Store secret in vault (idempotent). Vault is Supabase's secure storage that
-- pg_net can read without leaking into pg_dump / migration text.
-- We use a known name; the actual secret value was set out-of-band via the
-- Management API by the social-poster setup script.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'social_poster_auth_secret'
  ) THEN
    -- Placeholder. The actual secret must be set via:
    --   SELECT vault.create_secret('<SCRAPER_AUTH_SECRET>', 'social_poster_auth_secret', 'Shared secret for social-poster Worker');
    -- This migration deliberately does NOT inject the secret value.
    RAISE NOTICE 'social_poster_auth_secret not yet present in vault. Set it via vault.create_secret() before this webhook will work.';
  END IF;
END$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.tg_news_items_social_poster_fire()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_auth_secret TEXT;
  v_request_id  BIGINT;
  v_payload     JSONB;
BEGIN
  -- Skip if the new row is not eligible.
  IF NEW.language IS DISTINCT FROM 'vi'
     OR NEW.ai_translated IS DISTINCT FROM true
     OR NEW.status IS DISTINCT FROM 'published'
  THEN
    RETURN NEW;
  END IF;

  -- For UPDATE: only fire when the row transitions into eligibility,
  -- not on every touch (e.g. updated_at, view counter bumps).
  IF TG_OP = 'UPDATE' THEN
    IF OLD.language        = NEW.language
       AND OLD.ai_translated = NEW.ai_translated
       AND OLD.status        = NEW.status
       AND COALESCE(OLD.title, '')        = COALESCE(NEW.title, '')
       AND COALESCE(OLD.summary, '')      = COALESCE(NEW.summary, '')
       AND COALESCE(OLD.content_html, '') = COALESCE(NEW.content_html, '')
    THEN
      -- Nothing material changed; skip.
      RETURN NEW;
    END IF;
  END IF;

  -- Fetch auth secret from vault. If missing, log and skip (don't break inserts).
  SELECT decrypted_secret INTO v_auth_secret
  FROM vault.decrypted_secrets
  WHERE name = 'social_poster_auth_secret'
  LIMIT 1;

  IF v_auth_secret IS NULL THEN
    RAISE WARNING 'social-poster fire skipped: social_poster_auth_secret missing from vault';
    RETURN NEW;
  END IF;

  -- Build payload matching the Worker's SupabaseWebhookPayload interface.
  v_payload := jsonb_build_object(
    'type',       TG_OP,
    'table',      'news_items',
    'schema',     'public',
    'record',     to_jsonb(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
  );

  -- Fire-and-forget. pg_net runs async, returns request id immediately.
  SELECT net.http_post(
    url := 'https://social-poster.thecuong.workers.dev/',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Auth-Secret', v_auth_secret
    ),
    body    := v_payload,
    timeout_milliseconds := 25000
  ) INTO v_request_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_news_items_social_poster_fire() IS
  'AFTER INSERT/UPDATE trigger that fires social-poster Worker when news_items becomes eligible for FB Page posting.';

-- Drop old trigger if present (allow re-run)
DROP TRIGGER IF EXISTS news_items_social_poster_fire ON public.news_items;

-- Create the trigger
CREATE TRIGGER news_items_social_poster_fire
AFTER INSERT OR UPDATE ON public.news_items
FOR EACH ROW
EXECUTE FUNCTION public.tg_news_items_social_poster_fire();
