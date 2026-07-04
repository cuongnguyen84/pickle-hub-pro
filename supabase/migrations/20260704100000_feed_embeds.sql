-- ============================================================================
-- Feed embeds (lazy v1) — admin-curated Instagram reel links surfaced on /feed
-- ----------------------------------------------------------------------------
-- Deliberately NOT downloading/re-hosting any video (copyright + IG ToS +
-- App Store risk). v1 = admin pastes a link (+ optional thumbnail URL),
-- feed shows a card that out-links to Instagram. If click-through proves
-- itself, v2 upgrades thumbnail/metadata via the official IG oEmbed API.
-- ============================================================================

CREATE TABLE public.feed_embeds (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  url            text        NOT NULL,
  caption        text,
  author_name    text,
  thumbnail_url  text,
  is_active      boolean     NOT NULL DEFAULT true,
  published_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_embeds ENABLE ROW LEVEL SECURITY;

-- Feed is public (anonymous users see Trending) → active rows readable by all.
CREATE POLICY "Anyone can read active embeds"
  ON public.feed_embeds
  FOR SELECT
  USING (is_active);

-- Admin manages rows from /admin/embeds via the browser client.
-- Same convention as news_admin_rls: gate on public.is_admin().
CREATE POLICY "Admins can manage embeds"
  ON public.feed_embeds
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Management API runs DDL as a role whose default privileges only grant
-- SELECT to anon/authenticated — writes need explicit grants or the admin
-- UI gets "permission denied for table feed_embeds" before RLS even runs.
GRANT INSERT, UPDATE, DELETE ON public.feed_embeds TO authenticated;

CREATE INDEX idx_feed_embeds_active_published
  ON public.feed_embeds (published_at DESC)
  WHERE is_active;
