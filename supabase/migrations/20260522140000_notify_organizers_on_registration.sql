-- ============================================================================
-- Notify organizers + club managers when a player registers for an event
-- ============================================================================
-- After every INSERT into event_registrations, drop a row into
-- public.social_notifications for the event creator AND every club
-- manager (when the event belongs to a club). useNotifications hook is
-- already subscribed to social_notifications via Supabase Realtime, so
-- the bell badge + dropdown pick this up immediately without any
-- frontend wiring.
--
-- Skip conditions:
--   - status='cancelled' on the new row (the cancel + re-register flow
--     reactivates an existing row via UPDATE, so INSERT path is always
--     a fresh registration). Defensive only.
--   - Player isn't notifying themselves (creator/manager registering
--     for their own event still notifies the OTHER organizers, but we
--     don't fan a notification back to the actor).
--
-- Notification shape:
--   type:      'event_registration'
--   title:     'Đăng ký mới: <display_name>'        -- VN canonical (see notification-formatters.ts)
--   body:      '<event.title_vi>'
--   link_url:  '/social/<event.slug>/danh-sach'
--   payload:   { event_id, event_slug, event_title, player_name, registration_id }
--
-- IDEMPOTENT — replay-safe.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_notify_organizers_on_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event   RECORD;
  v_actor   UUID;
  v_payload JSONB;
  v_title   TEXT;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT id, club_id, slug, title_vi, created_by
  INTO v_event
  FROM public.social_events
  WHERE id = NEW.event_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_title := 'Đăng ký mới: ' || COALESCE(NULLIF(trim(NEW.display_name), ''), '(không tên)');
  v_actor := NEW.profile_id;  -- the player who just registered (may be NULL for guest OTP)
  v_payload := jsonb_build_object(
    'event_id',        v_event.id,
    'event_slug',      v_event.slug,
    'event_title',     v_event.title_vi,
    'player_name',     NEW.display_name,
    'registration_id', NEW.id
  );

  -- 1) Event creator. Skip if the actor IS the creator (creator
  --    registering for their own event doesn't notify themselves).
  IF v_event.created_by IS NOT NULL
     AND (v_actor IS NULL OR v_actor <> v_event.created_by) THEN
    INSERT INTO public.social_notifications
      (user_id, type, title, body, link_url, payload)
    VALUES
      (
        v_event.created_by,
        'event_registration',
        v_title,
        v_event.title_vi,
        '/social/' || v_event.slug || '/danh-sach',
        v_payload
      );
  END IF;

  -- 2) Club managers (when event belongs to a club). Skip the creator
  --    (already notified above) and skip the actor (no self-notify).
  IF v_event.club_id IS NOT NULL THEN
    INSERT INTO public.social_notifications
      (user_id, type, title, body, link_url, payload)
    SELECT
      m.profile_id,
      'event_registration',
      v_title,
      v_event.title_vi,
      '/social/' || v_event.slug || '/danh-sach',
      v_payload
    FROM public.club_managers m
    WHERE m.club_id = v_event.club_id
      AND m.profile_id <> v_event.created_by
      AND (v_actor IS NULL OR m.profile_id <> v_actor);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_notify_organizers_on_registration() IS
  'AFTER INSERT trigger on event_registrations — drops a notification row for the event creator and every club manager when a new registration lands. Skips self-notify when the player IS an organizer. See migration 20260522140000.';

DROP TRIGGER IF EXISTS trg_event_registrations_notify_organizers
  ON public.event_registrations;
CREATE TRIGGER trg_event_registrations_notify_organizers
  AFTER INSERT ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notify_organizers_on_registration();
