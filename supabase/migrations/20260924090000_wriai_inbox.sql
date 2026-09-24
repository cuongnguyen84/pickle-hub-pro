-- ============================================================================
-- Inbox for articles pushed by Wriai (wriai.com, "Custom Webhook / REST API").
--
-- `functions/api/wriai-webhook.ts` writes here and NOTHING reads it on the
-- site. A Wriai article is a raw AI draft in Vietnamese; it only reaches
-- production after it has been reviewed and rewritten into a normal
-- ThePickleHub post (EN + VI, metadata.ts, vi_blog_posts, barrel, GEO opening
-- — see CLAUDE.md "New blog post checklist"). Then the row is marked
-- 'converted' with the slug it became.
--
-- Why not publish straight into vi_blog_posts: Wriai's radar already proposed
-- "how to watch PPA Tour Asia free on ThePickleHub" — a claim that is false
-- (no PPA broadcast rights). Unreviewed AI copy does not go live.
--
-- The review queue:
--
--   SELECT id, title, slug, received_at FROM public.wriai_inbox
--    WHERE status = 'new' ORDER BY received_at;
--
-- Service-role only: RLS on with no policy, same shape as promo_filter_shadow.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wriai_inbox (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status           text NOT NULL DEFAULT 'new'
                   CHECK (status IN ('new', 'converted', 'rejected', 'deleted')),
  slug             text,
  title            text NOT NULL,
  meta_title       text,
  meta_description text,
  category         text,
  content_html     text,
  content_markdown text,
  featured_image   jsonb,
  images           jsonb,
  faq_schema       jsonb,
  author           jsonb,
  -- The whole event as received, so a field we did not map is never lost.
  raw              jsonb NOT NULL,
  -- Set on status = 'converted': the ThePickleHub slug the draft became.
  converted_slug   text,
  received_at      timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wriai_inbox IS
  'Raw Wriai drafts awaiting review. Never rendered on the site. Service-role only.';

ALTER TABLE public.wriai_inbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.wriai_inbox FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.wriai_inbox TO service_role;
