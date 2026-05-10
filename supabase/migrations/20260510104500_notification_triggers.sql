-- ============================================================================
-- Sprint 5 PR-C — Notification triggers (5 events)
-- ============================================================================
-- Auto-create rows in social_notifications when:
--   1. follow            INSERT social_follows         → notify followed_id
--   2. match_kudo        INSERT kudos (match)          → notify each match
--                                                         participant ≠ actor
--   3. match_comment     INSERT social_comments        → notify each match
--                        parent_id IS NULL              participant ≠ actor
--   4. comment_reply     INSERT social_comments        → notify parent
--                        parent_id IS NOT NULL          comment author
--                                                         (skip self-reply)
--   5. comment_mention   INSERT social_comments        → notify each
--                        body matches @username regex   mentioned profile
--                                                         (skip self-mention)
--
-- Path note: reuses social_notifications (Sprint 1) and the existing
-- self-read / self-update RLS policies. INSERT happens via SECURITY
-- DEFINER triggers (not granted to authenticated), so the policies
-- correctly remain UPDATE-only for the row owner.
--
-- Mention parser uses POSIX class [[:alnum:]_.-]{1,32} which matches the
-- Phase 4C frontend regex (`/[A-Za-z0-9_.-]{1,32}/` in
-- src/lib/social/comment-helpers.ts).
--
-- All trigger functions are SECURITY DEFINER + SET search_path=public so
-- they bypass the (owner-only) UPDATE RLS to write into another user's
-- notification row.
--
-- IDEMPOTENT: DROP TRIGGER IF EXISTS + CREATE OR REPLACE FUNCTION guards.
-- ============================================================================

-- ─── Helper: actor metadata snapshot ─────────────────────────────────────
-- Returns a JSONB blob with the actor's username/display_name/avatar_url so
-- notifications render without a JOIN at read time. Inlined into each
-- trigger via SELECT INTO so the helper itself doesn't need to be a
-- function (keeps the migration self-contained).
--
-- All trigger functions follow this pattern:
--   1. Resolve actor_id from the inserted row
--   2. Fetch (username, display_name, avatar_url) from profiles
--   3. INSERT social_notifications with title (vi fallback) + structured
--      payload that NotificationItem can re-render bilingual

-- ─── 1. follow ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor RECORD;
BEGIN
  -- social_follows has a CHECK (follower_id != followed_id), so self-follow
  -- can't reach this trigger. Defensive RETURN anyway in case the CHECK is
  -- ever loosened.
  IF NEW.follower_id = NEW.followed_id THEN
    RETURN NEW;
  END IF;

  SELECT username, display_name, avatar_url
    INTO v_actor
    FROM public.profiles
   WHERE id = NEW.follower_id;

  INSERT INTO public.social_notifications (
    user_id, type, title, body, link_url, payload
  ) VALUES (
    NEW.followed_id,
    'follow',
    COALESCE(v_actor.display_name, '@' || COALESCE(v_actor.username, 'someone'))
      || ' đã theo dõi bạn',
    NULL,
    CASE
      WHEN v_actor.username IS NOT NULL
        THEN '/nguoi-choi/' || v_actor.username
      ELSE '/notifications'
    END,
    jsonb_build_object(
      'actor_id',           NEW.follower_id,
      'actor_username',     v_actor.username,
      'actor_display_name', v_actor.display_name,
      'actor_avatar_url',   v_actor.avatar_url
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_follow ON public.social_follows;
CREATE TRIGGER notify_on_follow
  AFTER INSERT ON public.social_follows
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_follow();

-- ─── 2. match_kudo ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_match_kudo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor   RECORD;
  v_match   RECORD;
BEGIN
  -- Polymorphic kudos table covers match/clip/comment. Only fire for matches.
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

  -- One row per participant, excluding the actor themselves.
  INSERT INTO public.social_notifications (
    user_id, type, title, body, link_url, payload
  )
  SELECT
    mp.player_id,
    'match_kudo',
    COALESCE(v_actor.display_name, '@' || COALESCE(v_actor.username, 'someone'))
      || ' đã thích trận đấu của bạn',
    NULL,
    '/tran-dau/' || v_match.slug,
    jsonb_build_object(
      'actor_id',           NEW.user_id,
      'actor_username',     v_actor.username,
      'actor_display_name', v_actor.display_name,
      'actor_avatar_url',   v_actor.avatar_url,
      'match_id',           NEW.target_id,
      'match_slug',         v_match.slug
    )
  FROM public.match_participants mp
  WHERE mp.match_id  = NEW.target_id
    AND mp.player_id <> NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_match_kudo ON public.kudos;
CREATE TRIGGER notify_on_match_kudo
  AFTER INSERT ON public.kudos
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_match_kudo();

-- ─── 3 / 4 / 5. match_comment + comment_reply + comment_mention ──────────
-- Single trigger function dispatches all three flavors so we walk the
-- inserted row once and don't need per-event hooks fighting over the same
-- INSERT.

CREATE OR REPLACE FUNCTION public.notify_on_match_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor          RECORD;
  v_match          RECORD;
  -- v_parent_user_id is a UUID, not a RECORD. Original draft used a
  -- RECORD and only SELECT INTO'd it in the reply path (Path B); the
  -- mention dedupe subquery (Path C) then read v_parent.user_id which
  -- raises "record 'v_parent' is not assigned yet" for ANY top-level
  -- comment INSERT. Codex P1 on PR #22. Plain UUID defaults to NULL,
  -- which is exactly the dedupe semantic we want for top-level rows
  -- (no parent author to skip).
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
  -- bell row, long enough to give context. Trim whitespace so we don't
  -- emit a body that's all leading newlines.
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

  -- ─── Path C: @mentions (independent of A/B; one comment can both
  -- be a top-level + mention multiple users) ─────────────────────────
  -- POSIX regex mirrors the Phase 4C JS pattern in comment-helpers.ts.
  -- (?<![\\S]) (no PCRE lookbehind in POSIX) is approximated by the
  -- alternation `(^|[[:space:]])` capturing leading boundary; we strip
  -- that boundary in the join.
  WITH mentions AS (
    SELECT DISTINCT lower(m[1]) AS handle
      FROM regexp_matches(
        NEW.body,
        '(?:^|[[:space:]])@([[:alnum:]_.-]{1,32})',
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

DROP TRIGGER IF EXISTS notify_on_match_comment ON public.social_comments;
CREATE TRIGGER notify_on_match_comment
  AFTER INSERT ON public.social_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_match_comment();

NOTIFY pgrst, 'reload schema';
