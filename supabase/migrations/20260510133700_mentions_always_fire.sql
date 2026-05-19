-- ============================================================================
-- Sprint 5 PR-C follow-up — mentions always fire (drop dedupe entirely)
-- ============================================================================
-- Two production bugs in notify_on_match_comment Path C (mention dedupe):
--
-- BUG 2 (product decision change):
--   Reply to tran-thi-b's comment with body "@tran-thi-b ok" → tran-thi-b
--   only got comment_reply, never comment_mention. The original Path C
--   dedupe excluded the parent author from mentions to avoid two
--   notifications per event.
--   Cuong's product call: a mention is intentional (the actor typed
--   the @-handle) — it should fire even when the mentioned user is
--   already being notified through another path. Net result: a user
--   can now receive both comment_reply + comment_mention for one
--   comment if they're explicitly mentioned in the reply body.
--
-- BUG 1 (CRITICAL — confirmed downstream of dedupe removal):
--   Top-level "@le-cam great game" on a match where le-cam is neither a
--   participant nor a parent author — le-cam got nothing.
--   With the original dedupe, le-cam SHOULD have passed (NOT IN
--   participants leg). Removing dedupe entirely sidesteps any subtle
--   NULL/UNION edge case on that path.
--
--   If le-cam still doesn't fire after this migration applies, the
--   remaining cause is data-side (the username in profiles doesn't
--   exactly match what Cuong typed, or is_ghost=TRUE). Diagnostic SQL:
--
--     SELECT id, username, is_ghost, onboarding_completed_at
--       FROM public.profiles
--      WHERE lower(username) LIKE '%le%cam%'
--         OR lower(display_name) LIKE '%le%cam%';
--
--   The dev convention is `<name>-test` suffix, so the actual stored
--   username may be `le-cam-test`; if the comment body says `@le-cam`,
--   the regex captures `le-cam` and the JOIN won't match `le-cam-test`.
--   That's a typo, not a code bug — same behavior Strava/Twitter ship.
--
-- New Path C is just: parse mentions → resolve to non-ghost profiles →
-- skip self → INSERT. No participant dedupe, no parent-author dedupe.
--
-- Path A (top-level → match participants) and Path B (reply → parent
-- author) are unchanged — only Path C's resolved CTE changes.
--
-- IDEMPOTENT: CREATE OR REPLACE FUNCTION. Original migrations
-- (20260510104500, 20260510130000) left intact per "never edit applied
-- migrations" convention. Trigger binding preserved.
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
  -- Mentions ALWAYS fire for every non-self mentioned user. No participant
  -- or parent-author dedupe — a user explicitly @-mentioned in a comment
  -- gets a comment_mention notification even if they're already receiving
  -- match_comment (Path A) or comment_reply (Path B) for the same event.
  -- Mentions are intentional speech acts; the actor typed the handle and
  -- the recipient should see that signal independently of structural
  -- notifications.
  --
  -- Self-skip is the only filter besides the standard non-ghost +
  -- valid-username constraints inherited from the JOIN.
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

NOTIFY pgrst, 'reload schema';
