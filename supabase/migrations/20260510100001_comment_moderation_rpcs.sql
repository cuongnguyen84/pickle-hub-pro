-- ============================================================================
-- Sprint 5 PR-B — Comment moderation: 4-path delete permission
-- ============================================================================
-- Expands delete_match_comment from owner-only to 4 permission paths:
--   1. Owner (existing)              auth.uid() = comment.user_id
--   2. Match participant (new)       auth.uid() ∈ match_participants of the
--                                    match this comment belongs to
--   3. Admin (new)                   has_role(auth.uid(), 'admin')
--   4. Moderator (new)               has_role(auth.uid(), 'moderator')
--
-- The RPC switches to SECURITY DEFINER so the soft-delete UPDATE bypasses
-- the existing social_comments_self_update RLS policy (which is correctly
-- owner-only as a defense-in-depth gate against direct PostgREST writes).
-- All non-owner moderation flows through this RPC where the 4-path
-- permission check + acted_by attribution lives.
--
-- Edit permission stays owner-only — moderation should mask content via
-- delete, not rewrite it. Sprint 6 may add an audit table; defer.
--
-- Return shape gains `acted_as` ('owner' | 'participant' | 'admin' |
-- 'moderator') so the client can show "Deleted by moderator" in UI.
--
-- IDEMPOTENT: DROP FUNCTION IF EXISTS guard.
-- ============================================================================

DROP FUNCTION IF EXISTS public.delete_match_comment(UUID);

CREATE OR REPLACE FUNCTION public.delete_match_comment(p_comment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID;
  v_owner      UUID;
  v_match_id   UUID;
  v_acted_as   TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Load comment + verify still active. is_deleted=TRUE rows act as
  -- already-deleted; idempotent re-delete returns Comment not found.
  SELECT user_id, target_id
    INTO v_owner, v_match_id
    FROM public.social_comments
   WHERE id = p_comment_id
     AND target_type = 'match'
     AND is_deleted  = FALSE;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Comment not found' USING ERRCODE = 'P0002';
  END IF;

  -- Resolve permission. Order: owner → admin → moderator → participant.
  -- Owner takes precedence over moderation roles so a moderator deleting
  -- their own comment is logged as 'owner', not 'moderator'.
  IF v_owner = v_user_id THEN
    v_acted_as := 'owner';
  ELSIF public.has_role(v_user_id, 'admin') THEN
    v_acted_as := 'admin';
  ELSIF public.has_role(v_user_id, 'moderator') THEN
    v_acted_as := 'moderator';
  ELSIF EXISTS (
    SELECT 1
      FROM public.match_participants mp
     WHERE mp.match_id  = v_match_id
       AND mp.player_id = v_user_id
  ) THEN
    v_acted_as := 'participant';
  ELSE
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.social_comments
     SET is_deleted = TRUE
   WHERE id = p_comment_id;

  RETURN jsonb_build_object(
    'deleted',  TRUE,
    'acted_as', v_acted_as
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_match_comment(UUID)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
