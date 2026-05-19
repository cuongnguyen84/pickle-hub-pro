-- ============================================================================
-- HOTFIX: notify_on_match_comment regex syntax (Sprint 5 PR-C / PR #22)
-- ============================================================================
-- Critical prod regression: every match comment INSERT failed after the
-- 20260510104500_notification_triggers.sql migration applied.
--
-- Symptom (Cuong repro): UI toast "Không thể đăng bình luận — Lỗi không
-- xác định" on every comment submit, even body="test" with no @mentions.
--
-- Root cause: the mention dedupe CTE uses
--
--   regexp_matches(NEW.body, '(?:^|[[:space:]])@([[:alnum:]_.-]{1,32})', 'g')
--
-- The `(?:...)` non-capturing group is PCRE syntax. PostgreSQL's regex
-- engine ("Advanced Regular Expressions" / ARE) parses `(?xyz...)` as an
-- embedded options sequence where the chars between `(?` and the first
-- non-flag char are interpreted as options (i for case-insensitive, etc.).
-- `:` is NOT a valid ARE option, so the regex compile fails with
-- something like:
--
--   ERROR: invalid regular expression: invalid embedded option: ":"
--
-- The compile fails BEFORE any match attempt, so comments with no `@`
-- still trigger the error. The trigger raises, the parent INSERT to
-- social_comments rolls back, and the API returns the generic error
-- the UI shows.
--
-- Fix: replace `(?:^|[[:space:]])` (non-capturing) with `(^|[[:space:]])`
-- (capturing). The boundary becomes capture group 1, the username
-- becomes capture group 2 — read m[2] instead of m[1]. Same matching
-- semantic; valid ARE syntax.
--
-- This migration uses CREATE OR REPLACE FUNCTION so the trigger keeps
-- pointing at the new function body. The original migration file
-- (20260510104500_notification_triggers.sql) is left intact per the
-- "never edit applied migrations" convention.
--
-- After apply, verify with:
--
--   INSERT INTO public.social_comments (
--     user_id, target_type, target_id, body, parent_id
--   ) VALUES (
--     '<your-uuid>', 'match', '<a-real-match-uuid>', 'sql-test', NULL
--   );
--
-- Should succeed and emit notifications to other match participants.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_match_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor          RECORD;
  v_match          RECORD;
  v_parent_user_id UUID;
  v_excerpt        TEXT;
BEGIN
  -- Only match-targeted comments fire match notifications. Other
  -- target_types (clip/venue/etc.) skip — Sprint 6+ adds those.
  IF NEW.target_type <> 'match' THEN
    RETURN NEW;
  END IF;

  SELECT username, display_name, avatar_url
    INTO v_actor
    FROM public.profiles
   WHERE id = NEW.user_id;

  SELECT slug INTO v_match
    FROM public.matches
   WHERE id = NEW.target_id;

  -- 64-char excerpt for the notification body — short enough to fit the
  -- bell row, long enough to give context.
  v_excerpt := LEFT(REGEXP_REPLACE(TRIM(NEW.body), '\s+', ' ', 'g'), 64);

  -- ─── Path A: top-level comment → notify match participants ─────────
  IF NEW.parent_id IS NULL THEN
    INSERT INTO public.social_notifications (
      user_id, type, title, body, link_url, payload
    )
    SELECT
      mp.player_id,
      'match_comment',
      COALESCE(v_actor.display_name, '@' || COALESCE(v_actor.username, 'someone'))
        || ' đã bình luận trận đấu của bạn',
      v_excerpt,
      '/tran-dau/' || v_match.slug || '#comments',
      jsonb_build_object(
        'actor_id',           NEW.user_id,
        'actor_username',     v_actor.username,
        'actor_display_name', v_actor.display_name,
        'actor_avatar_url',   v_actor.avatar_url,
        'match_id',           NEW.target_id,
        'match_slug',         v_match.slug,
        'comment_id',         NEW.id,
        'comment_excerpt',    v_excerpt
      )
    FROM public.match_participants mp
    WHERE mp.match_id  = NEW.target_id
      AND mp.player_id <> NEW.user_id;
  ELSE
    -- ─── Path B: reply → notify parent comment author (skip self-reply)
    SELECT user_id INTO v_parent_user_id
      FROM public.social_comments
     WHERE id = NEW.parent_id;

    IF v_parent_user_id IS NOT NULL AND v_parent_user_id <> NEW.user_id THEN
      INSERT INTO public.social_notifications (
        user_id, type, title, body, link_url, payload
      ) VALUES (
        v_parent_user_id,
        'comment_reply',
        COALESCE(v_actor.display_name, '@' || COALESCE(v_actor.username, 'someone'))
          || ' đã trả lời bình luận của bạn',
        v_excerpt,
        '/tran-dau/' || v_match.slug || '#comments',
        jsonb_build_object(
          'actor_id',           NEW.user_id,
          'actor_username',     v_actor.username,
          'actor_display_name', v_actor.display_name,
          'actor_avatar_url',   v_actor.avatar_url,
          'match_id',           NEW.target_id,
          'match_slug',         v_match.slug,
          'comment_id',         NEW.id,
          'parent_comment_id',  NEW.parent_id,
          'comment_excerpt',    v_excerpt
        )
      );
    END IF;
  END IF;

  -- ─── Path C: @mentions ─────────────────────────────────────────────
  -- HOTFIX: regex changed from `(?:^|[[:space:]])@(...)` (PCRE non-
  -- capturing group, NOT supported by PostgreSQL ARE — caused the
  -- prod regression) to `(^|[[:space:]])@(...)` (capturing). Boundary
  -- becomes group 1, username becomes group 2 — read m[2] below.
  -- Pattern semantic mirrors the Phase 4C JS regex
  -- `/(^|[\s])@([A-Za-z0-9_.-]{1,32})/` in
  -- src/lib/social/comment-helpers.ts.
  WITH mentions AS (
    SELECT DISTINCT lower(m[2]) AS handle
      FROM regexp_matches(
        NEW.body,
        '(^|[[:space:]])@([[:alnum:]_.-]{1,32})',
        'g'
      ) AS m
  ),
  resolved AS (
    SELECT p.id AS user_id
      FROM mentions
      JOIN public.profiles p ON lower(p.username) = mentions.handle
     WHERE p.is_ghost = FALSE
       AND p.id <> NEW.user_id
       -- Skip if we already notified them via match_comment / comment_reply.
       -- v_parent_user_id is NULL on top-level inserts (Path A); the
       -- WHERE filter naturally drops the row, so the UNION leg is a no-op
       -- on those, and the participant leg is the only one that contributes.
       AND p.id NOT IN (
         SELECT mp.player_id
           FROM public.match_participants mp
          WHERE mp.match_id = NEW.target_id
            AND NEW.parent_id IS NULL
         UNION
         SELECT v_parent_user_id WHERE v_parent_user_id IS NOT NULL
       )
  )
  INSERT INTO public.social_notifications (
    user_id, type, title, body, link_url, payload
  )
  SELECT
    r.user_id,
    'comment_mention',
    COALESCE(v_actor.display_name, '@' || COALESCE(v_actor.username, 'someone'))
      || ' đã nhắc đến bạn trong bình luận',
    v_excerpt,
    '/tran-dau/' || v_match.slug || '#comments',
    jsonb_build_object(
      'actor_id',           NEW.user_id,
      'actor_username',     v_actor.username,
      'actor_display_name', v_actor.display_name,
      'actor_avatar_url',   v_actor.avatar_url,
      'match_id',           NEW.target_id,
      'match_slug',         v_match.slug,
      'comment_id',         NEW.id,
      'comment_excerpt',    v_excerpt
    )
  FROM resolved r;

  RETURN NEW;
END;
$$;

-- Trigger binding from the original migration is preserved; CREATE OR
-- REPLACE FUNCTION updates the body in place. No DROP TRIGGER + CREATE
-- TRIGGER needed.

NOTIFY pgrst, 'reload schema';
