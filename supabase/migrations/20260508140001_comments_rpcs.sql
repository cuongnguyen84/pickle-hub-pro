-- ============================================================================
-- Sprint 4 Phase 4C — Comment RPCs (add / edit / delete / get)
-- ============================================================================
-- Four RPCs paired with the polymorphic public.social_comments table
-- (target_type='match'). All write RPCs are SECURITY INVOKER so the
-- existing self-write/self-update RLS policies apply; the read RPC is
-- SECURITY DEFINER so we can join profiles without RLS gymnastics.
--
-- Naming note: the column is parent_id (Sprint 1) but the API surface
-- exposes it as parent_comment_id for client clarity. The alias only
-- lives in the RETURNS TABLE shape — everything internal stays parent_id.
--
-- IDEMPOTENT: DROP FUNCTION IF EXISTS guards.
-- ============================================================================

-- ─── 1. add_match_comment ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.add_match_comment(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.add_match_comment(
  p_match_id          UUID,
  p_body              TEXT,
  p_parent_comment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id          UUID;
  v_parent_depth     INT;
  v_new_depth        INT;
  v_new_comment_id   UUID;
  v_trimmed_body     TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Validate body. Trim before measuring so a 500-space comment doesn't
  -- pass on whitespace; the DB CHECK then re-validates trimmed length.
  v_trimmed_body := COALESCE(TRIM(p_body), '');
  IF LENGTH(v_trimmed_body) = 0 THEN
    RAISE EXCEPTION 'Body cannot be empty' USING ERRCODE = '22023';
  END IF;
  IF LENGTH(v_trimmed_body) > 500 THEN
    RAISE EXCEPTION 'Body exceeds 500 chars' USING ERRCODE = '22023';
  END IF;

  -- Match must exist (polymorphic target_id has no FK).
  IF NOT EXISTS (SELECT 1 FROM public.matches WHERE id = p_match_id) THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = 'P0002';
  END IF;

  -- Depth = parent_depth + 1, capped at 4. Anonymous parents (id null)
  -- = root, depth 0. A reply to a soft-deleted parent is rejected so
  -- viewers can't bury threads under tombstones.
  IF p_parent_comment_id IS NULL THEN
    v_new_depth := 0;
  ELSE
    SELECT depth INTO v_parent_depth
      FROM public.social_comments
     WHERE id = p_parent_comment_id
       AND target_type = 'match'
       AND target_id   = p_match_id
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
    'match', p_match_id, v_user_id, v_trimmed_body,
    p_parent_comment_id, v_new_depth
  )
  RETURNING id INTO v_new_comment_id;

  RETURN jsonb_build_object(
    'comment_id', v_new_comment_id,
    'depth',      v_new_depth
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_match_comment(UUID, TEXT, UUID)
  TO authenticated;

-- ─── 2. edit_match_comment ───────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.edit_match_comment(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.edit_match_comment(
  p_comment_id UUID,
  p_body       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID;
  v_owner        UUID;
  v_trimmed_body TEXT;
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

  SELECT user_id INTO v_owner
    FROM public.social_comments
   WHERE id = p_comment_id
     AND is_deleted = FALSE;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Comment not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_owner != v_user_id THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.social_comments
     SET body       = v_trimmed_body,
         updated_at = NOW()
   WHERE id = p_comment_id;

  RETURN jsonb_build_object('updated', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.edit_match_comment(UUID, TEXT)
  TO authenticated;

-- ─── 3. delete_match_comment (soft delete) ───────────────────────────────
-- Soft delete preserves replies — the row is flagged is_deleted=TRUE,
-- get_match_comments masks the body to '[deleted]' and nulls author
-- fields, but child comments still render under the tombstone.
DROP FUNCTION IF EXISTS public.delete_match_comment(UUID);

CREATE OR REPLACE FUNCTION public.delete_match_comment(p_comment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_owner   UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT user_id INTO v_owner
    FROM public.social_comments
   WHERE id = p_comment_id
     AND is_deleted = FALSE;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Comment not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_owner != v_user_id THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.social_comments
     SET is_deleted = TRUE
   WHERE id = p_comment_id;

  RETURN jsonb_build_object('deleted', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_match_comment(UUID)
  TO authenticated;

-- ─── 4. get_match_comments (cursor pagination ASC) ───────────────────────
-- ASC ordering renders chronologically top-down; threading is a client-
-- side reduce on parent_id + depth. Soft-deleted rows are RETURNED so
-- replies stay anchored under their tombstone — but body is masked and
-- author fields nulled so the public read RLS policy isn't lying about
-- what's visible.
DROP FUNCTION IF EXISTS public.get_match_comments(UUID, INT, TIMESTAMPTZ, UUID);

CREATE OR REPLACE FUNCTION public.get_match_comments(
  p_match_id          UUID,
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
  WHERE c.target_type = 'match'
    AND c.target_id   = p_match_id
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

GRANT EXECUTE ON FUNCTION public.get_match_comments(UUID, INT, TIMESTAMPTZ, UUID)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
