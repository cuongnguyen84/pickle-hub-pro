-- ============================================================================
-- Bet #1 Social Layer — Option A resolution
-- ============================================================================
-- Resolves the 3 tables deferred in 20260503131017_bet1_social_layer.sql.
--
-- Decision (Sprint 1 PR #4): create separate `social_*` tables. Existing
-- public.follows / public.comments / public.notifications are untouched —
-- they continue to power org-follow / video-comment / livestream-notify
-- features without regression. Bet #1 social features write to the new
-- tables only.
--
-- IDEMPOTENT: every CREATE/ALTER guarded with IF NOT EXISTS.
-- ============================================================================

-- ─── 3.5  SOCIAL_FOLLOWS  (user → user) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_follows (
  follower_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followed_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, followed_id),
  CONSTRAINT social_follows_no_self CHECK (follower_id != followed_id)
);

CREATE INDEX IF NOT EXISTS idx_social_follows_followed ON public.social_follows(followed_id);

ALTER TABLE public.social_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_follows_public_read"   ON public.social_follows;
DROP POLICY IF EXISTS "social_follows_self_insert"   ON public.social_follows;
DROP POLICY IF EXISTS "social_follows_self_delete"   ON public.social_follows;

CREATE POLICY "social_follows_public_read"
  ON public.social_follows FOR SELECT USING (TRUE);
CREATE POLICY "social_follows_self_insert"
  ON public.social_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "social_follows_self_delete"
  ON public.social_follows FOR DELETE USING (auth.uid() = follower_id);

GRANT SELECT                         ON public.social_follows TO anon;
GRANT SELECT, INSERT, DELETE         ON public.social_follows TO authenticated;

-- ─── 3.7  SOCIAL_COMMENTS  (UGC entity comments) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.social_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('match', 'clip', 'venue', 'tournament', 'profile')),
  target_id   UUID NOT NULL,
  parent_id   UUID REFERENCES public.social_comments(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (LENGTH(body) BETWEEN 1 AND 2000),
  is_deleted  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_comments_target ON public.social_comments(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_comments_user   ON public.social_comments(user_id);

ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_comments_public_read"   ON public.social_comments;
DROP POLICY IF EXISTS "social_comments_self_write"    ON public.social_comments;
DROP POLICY IF EXISTS "social_comments_self_update"   ON public.social_comments;

CREATE POLICY "social_comments_public_read"
  ON public.social_comments FOR SELECT USING (is_deleted = FALSE);
CREATE POLICY "social_comments_self_write"
  ON public.social_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "social_comments_self_update"
  ON public.social_comments FOR UPDATE USING (auth.uid() = user_id);

GRANT SELECT                          ON public.social_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.social_comments TO authenticated;

-- ─── 3.11  SOCIAL_NOTIFICATIONS  (free-text type + JSONB payload) ─────────
CREATE TABLE IF NOT EXISTS public.social_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  link_url    TEXT,
  payload     JSONB,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_notifications_user_unread
  ON public.social_notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.social_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_notifications_self_read"   ON public.social_notifications;
DROP POLICY IF EXISTS "social_notifications_self_update" ON public.social_notifications;

CREATE POLICY "social_notifications_self_read"
  ON public.social_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "social_notifications_self_update"
  ON public.social_notifications FOR UPDATE USING (auth.uid() = user_id);

-- INSERT only via service_role from notification-send edge function;
-- not granted to authenticated. (Users don't insert their own notifications.)
GRANT SELECT, UPDATE  ON public.social_notifications TO authenticated;

-- ─── Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
