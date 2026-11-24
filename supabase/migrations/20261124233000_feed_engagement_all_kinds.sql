-- ============================================================================
-- Feed engagement for every card kind (2026-11-24)
-- ============================================================================
-- Kudos + comments today only work for matches, but both tables were
-- built polymorphic (target_type + target_id). This migration:
--   1. Widens the target_type CHECKs on public.kudos and
--      public.social_comments to every feed card kind.
--   2. Adds generic RPCs mirroring the match ones (same rules: auth
--      required to write, body trimmed 1..500, threading depth <= 4,
--      soft delete with tombstones, moderation delete paths) -
--      toggle_target_kudos / add_target_comment / get_target_comments /
--      delete_target_comment. The match RPCs stay untouched.
--   3. Adds get_engagement_counts for batched card counts.
-- Target kinds and their id sources:
--   news       -> news_items.id
--   blog       -> deterministic UUID derived from the canonical slug
--                 (blogs are file modules, no table row - existence
--                 check skipped for this kind only)
--   post       -> social_posts.id
--   video      -> videos.id
--   highlight  -> feed_highlights.id
--   embed      -> feed_embeds.id
--   livestream -> livestreams.id
--   tournament -> doubles_elimination_tournaments.id
--   event      -> social_events.id
-- ============================================================================

-- ─── 1. Widen CHECKs ─────────────────────────────────────────────────────
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.kudos'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%target_type%';
  IF c IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.kudos DROP CONSTRAINT ' || quote_ident(c);
  END IF;
END $$;

ALTER TABLE public.kudos
  ADD CONSTRAINT kudos_target_type_check
  CHECK (target_type IN ('match', 'clip', 'comment', 'news', 'blog',
                         'post', 'video', 'highlight', 'embed',
                         'livestream', 'tournament', 'event'));

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.social_comments'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%target_type%';
  IF c IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.social_comments DROP CONSTRAINT ' || quote_ident(c);
  END IF;
END $$;

ALTER TABLE public.social_comments
  ADD CONSTRAINT social_comments_target_type_check
  CHECK (target_type IN ('match', 'clip', 'venue', 'tournament', 'profile',
                         'news', 'blog', 'post', 'video', 'highlight',
                         'embed', 'livestream', 'event'));

-- ─── 2. Existence helper ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.engagement_target_exists(
  p_target_type TEXT,
  p_target_id   UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN CASE p_target_type
    WHEN 'news'       THEN EXISTS (SELECT 1 FROM public.news_items WHERE id = p_target_id)
    WHEN 'post'       THEN EXISTS (SELECT 1 FROM public.social_posts WHERE id = p_target_id)
    WHEN 'video'      THEN EXISTS (SELECT 1 FROM public.videos WHERE id = p_target_id)
    WHEN 'highlight'  THEN EXISTS (SELECT 1 FROM public.feed_highlights WHERE id = p_target_id)
    WHEN 'embed'      THEN EXISTS (SELECT 1 FROM public.feed_embeds WHERE id = p_target_id)
    WHEN 'livestream' THEN EXISTS (SELECT 1 FROM public.livestreams WHERE id = p_target_id)
    WHEN 'tournament' THEN EXISTS (SELECT 1 FROM public.doubles_elimination_tournaments WHERE id = p_target_id)
    WHEN 'event'      THEN EXISTS (SELECT 1 FROM public.social_events WHERE id = p_target_id)
    WHEN 'match'      THEN EXISTS (SELECT 1 FROM public.matches WHERE id = p_target_id)
    WHEN 'blog'       THEN TRUE  -- file-based content, no row to check
    ELSE FALSE
  END;
END;
$$;

-- ─── 3. toggle_target_kudos ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_target_kudos(
  p_target_type TEXT,
  p_target_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_existed   BOOLEAN;
  v_new_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.engagement_target_exists(p_target_type, p_target_id) THEN
    RAISE EXCEPTION 'Target not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.kudos
    WHERE target_type = p_target_type
      AND target_id   = p_target_id
      AND user_id     = v_user_id
  ) INTO v_existed;

  IF v_existed THEN
    DELETE FROM public.kudos
    WHERE target_type = p_target_type
      AND target_id   = p_target_id
      AND user_id     = v_user_id;
  ELSE
    INSERT INTO public.kudos (user_id, target_type, target_id)
    VALUES (v_user_id, p_target_type, p_target_id)
    ON CONFLICT (user_id, target_type, target_id) DO NOTHING;
  END IF;

  SELECT COUNT(*)::INT INTO v_new_count
  FROM public.kudos
  WHERE target_type = p_target_type AND target_id = p_target_id;

  RETURN jsonb_build_object(
    'kudoed', NOT v_existed,
    'count',  v_new_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_target_kudos(TEXT, UUID)
  TO authenticated;

-- ─── 4. add_target_comment ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_target_comment(
  p_target_type       TEXT,
  p_target_id         UUID,
  p_body              TEXT,
  p_parent_comment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_parent_depth   INT;
  v_new_depth      INT;
  v_new_comment_id UUID;
  v_trimmed_body   TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  v_trimmed_body := COALESCE(TRIM(p_body), '');
  IF LENGTH(v_trimmed_body) = 0 THEN
    RAISE EXCEPTION 'Body cannot be empty' USING ERRCODE = '22023';
  END IF;
  IF LENGTH(v_trimmed_body) > 500 THEN
    RAISE EXCEPTION 'Body exceeds 500 chars' USING ERRCODE = '22023';
  END IF;

  IF NOT public.engagement_target_exists(p_target_type, p_target_id) THEN
    RAISE EXCEPTION 'Target not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_parent_comment_id IS NULL THEN
    v_new_depth := 0;
  ELSE
    SELECT depth INTO v_parent_depth
      FROM public.social_comments
     WHERE id = p_parent_comment_id
       AND target_type = p_target_type
       AND target_id   = p_target_id
       AND is_deleted  = FALSE;
    IF v_parent_depth IS NULL THEN
      RAISE EXCEPTION 'Parent comment not found or deleted'
        USING ERRCODE = 'P0002';
    END IF;
    v_new_depth := v_parent_depth + 1;
    IF v_new_depth > 4 THEN
      RAISE EXCEPTION 'Max threading depth reached (5 levels)'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.social_comments (
    target_type, target_id, user_id, body, parent_id, depth
  ) VALUES (
    p_target_type, p_target_id, v_user_id, v_trimmed_body,
    p_parent_comment_id, v_new_depth
  )
  RETURNING id INTO v_new_comment_id;

  RETURN jsonb_build_object(
    'comment_id', v_new_comment_id,
    'depth',      v_new_depth
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_target_comment(TEXT, UUID, TEXT, UUID)
  TO authenticated;

-- ─── 5. get_target_comments ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_target_comments(
  p_target_type       TEXT,
  p_target_id         UUID,
  p_limit             INT DEFAULT 50,
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_comment_id UUID DEFAULT NULL
)
RETURNS TABLE (
  comment_id        UUID,
  parent_comment_id UUID,
  depth             INT,
  body              TEXT,
  user_id           UUID,
  username          TEXT,
  display_name      TEXT,
  avatar_url        TEXT,
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  is_deleted        BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id                                                          AS comment_id,
    c.parent_id                                                   AS parent_comment_id,
    c.depth,
    CASE WHEN c.is_deleted THEN '[deleted]' ELSE c.body END        AS body,
    c.user_id,
    p.username,
    CASE WHEN c.is_deleted THEN NULL ELSE p.display_name END       AS display_name,
    CASE WHEN c.is_deleted THEN NULL ELSE p.avatar_url END         AS avatar_url,
    c.created_at,
    c.updated_at,
    c.is_deleted
  FROM public.social_comments c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.target_type = p_target_type
    AND c.target_id   = p_target_id
    AND (
      p_cursor_created_at IS NULL
      OR c.created_at > p_cursor_created_at
      OR (
        c.created_at = p_cursor_created_at
        AND p_cursor_comment_id IS NOT NULL
        AND c.id > p_cursor_comment_id
      )
    )
  ORDER BY c.created_at ASC, c.id ASC
  LIMIT GREATEST(LEAST(p_limit, 200), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_target_comments(TEXT, UUID, INT, TIMESTAMPTZ, UUID)
  TO anon, authenticated;

-- ─── 6. delete_target_comment ────────────────────────────────────────────
-- Same permission paths as the match moderation delete (owner, admin,
-- moderator; plus match participant when the target is a match).
CREATE OR REPLACE FUNCTION public.delete_target_comment(p_comment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID;
  v_owner      UUID;
  v_type       TEXT;
  v_target_id  UUID;
  v_acted_as   TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT user_id, target_type, target_id
    INTO v_owner, v_type, v_target_id
    FROM public.social_comments
   WHERE id = p_comment_id
     AND is_deleted = FALSE;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Comment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner = v_user_id THEN
    v_acted_as := 'owner';
  ELSIF public.has_role(v_user_id, 'admin') THEN
    v_acted_as := 'admin';
  ELSIF public.has_role(v_user_id, 'moderator') THEN
    v_acted_as := 'moderator';
  ELSIF v_type = 'match' AND EXISTS (
    SELECT 1
      FROM public.match_participants mp
     WHERE mp.match_id  = v_target_id
       AND mp.player_id = v_user_id
  ) THEN
    v_acted_as := 'participant';
  ELSE
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.social_comments
     SET is_deleted = TRUE
   WHERE id = p_comment_id;

  RETURN jsonb_build_object('deleted', TRUE, 'acted_as', v_acted_as);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_target_comment(UUID)
  TO authenticated;

-- ─── 7. get_engagement_counts ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_engagement_counts(
  p_target_type TEXT,
  p_target_ids  UUID[]
)
RETURNS TABLE (
  target_id     UUID,
  kudos_count   INT,
  comment_count INT,
  viewer_kudoed BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id AS target_id,
    (SELECT COUNT(*)::INT FROM public.kudos k
      WHERE k.target_type = p_target_type AND k.target_id = t.id),
    (SELECT COUNT(*)::INT FROM public.social_comments c
      WHERE c.target_type = p_target_type AND c.target_id = t.id
        AND c.is_deleted = FALSE),
    EXISTS (SELECT 1 FROM public.kudos k
      WHERE k.target_type = p_target_type AND k.target_id = t.id
        AND k.user_id = auth.uid())
  FROM UNNEST(p_target_ids) AS t(id);
$$;

GRANT EXECUTE ON FUNCTION public.get_engagement_counts(TEXT, UUID[])
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
