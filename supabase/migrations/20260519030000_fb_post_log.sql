-- ============================================================================
-- fb_post_log — Track which news_items have been posted to the Facebook Page
-- ============================================================================
--
-- Purpose:
--   The `social-poster` Cloudflare Worker reads news_items (language='vi',
--   ai_translated=true, status='published') and posts to the ThePickleHub FB
--   Page. This table is the dedupe + audit trail so:
--     1. We never post the same news_item twice (UNIQUE on news_item_id).
--     2. We can rate-limit (check last_posted_at globally to space posts).
--     3. We can debug failures (status + error_message + raw_response).
--
-- Trigger flow:
--   Supabase DB Webhook on news_items INSERT/UPDATE → calls worker.
--   Worker checks fb_post_log for existing row.
--     - If exists & status='posted'  → skip.
--     - If exists & status='failed'  → retry (UPDATE row, increment attempt).
--     - If not exists                → INSERT with status='pending', call
--                                      Gemini + Graph API, then UPDATE row
--                                      to 'posted' or 'failed'.
--
-- Rate limit:
--   Worker queries MAX(posted_at) FROM fb_post_log WHERE status='posted'.
--   If gap < FB_POST_MIN_GAP_MINUTES (env, default 30), defer (return 202
--   without posting) and rely on the next webhook or manual /run.
--
-- RLS:
--   Service role only — Worker uses SERVICE_ROLE_KEY. No public access.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fb_post_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_item_id    UUID NOT NULL REFERENCES public.news_items(id) ON DELETE CASCADE,
  fb_post_id      TEXT,                    -- e.g. "1234567890_9876543210"
  fb_permalink    TEXT,                    -- https://www.facebook.com/{page}/posts/{id}
  caption         TEXT,                    -- Final caption sent to FB (Gemini output)
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'posted', 'failed', 'skipped')),
  attempt_count   INT NOT NULL DEFAULT 0,
  error_message   TEXT,                    -- Last error string if failed
  raw_response    JSONB,                   -- Graph API response for debugging
  posted_at       TIMESTAMPTZ,             -- When actually posted to FB
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per news_item, ever. Worker MUST INSERT ... ON CONFLICT DO UPDATE
-- to handle retries.
CREATE UNIQUE INDEX IF NOT EXISTS fb_post_log_news_item_id_key
  ON public.fb_post_log (news_item_id);

-- Used by rate-limit query: most recent posted row.
CREATE INDEX IF NOT EXISTS fb_post_log_posted_at_idx
  ON public.fb_post_log (posted_at DESC) WHERE status = 'posted';

-- Used by admin dashboard: list failures.
CREATE INDEX IF NOT EXISTS fb_post_log_status_created_at_idx
  ON public.fb_post_log (status, created_at DESC);

-- updated_at auto-maintained.
CREATE OR REPLACE FUNCTION public.tg_fb_post_log_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fb_post_log_updated_at ON public.fb_post_log;
CREATE TRIGGER fb_post_log_updated_at
  BEFORE UPDATE ON public.fb_post_log
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_fb_post_log_updated_at();

-- RLS: service_role only. No anon/authenticated access.
ALTER TABLE public.fb_post_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fb_post_log_service_role_all ON public.fb_post_log;
CREATE POLICY fb_post_log_service_role_all
  ON public.fb_post_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin users can SELECT for the admin dashboard (future UI).
DROP POLICY IF EXISTS fb_post_log_admin_select ON public.fb_post_log;
CREATE POLICY fb_post_log_admin_select
  ON public.fb_post_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

COMMENT ON TABLE public.fb_post_log IS
  'Dedupe + audit trail for social-poster Worker. One row per news_item posted to Facebook Page.';
