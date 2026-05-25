-- ============================================================================
-- Drop email path from event_registrations notification trigger
-- ============================================================================
-- Per user decision 2026-05-22: only push + bell badge are needed for
-- organizers. Removing the email branch from the trigger so the call to
-- send-event-registration-email no longer fires on every registration
-- (Resend domain is unverified, so the call was failing silently anyway,
-- but cleanest to just delete it).
--
-- This is a revert of the email branch added in 20260522160000. The push
-- and bell-badge branches are kept verbatim from 20260522150000.
--
-- IDEMPOTENT.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_notify_organizers_on_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_event     RECORD;
  v_actor     UUID;
  v_payload   JSONB;
  v_title     TEXT;
  v_recipients UUID[];
  v_anon_key  TEXT;
  v_push_body TEXT;
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
  v_actor := NEW.profile_id;
  v_payload := jsonb_build_object(
    'event_id',        v_event.id,
    'event_slug',      v_event.slug,
    'event_title',     v_event.title_vi,
    'player_name',     NEW.display_name,
    'registration_id', NEW.id
  );

  -- Recipient set (creator + club managers, minus actor)
  v_recipients := ARRAY[]::UUID[];
  IF v_event.created_by IS NOT NULL
     AND (v_actor IS NULL OR v_actor <> v_event.created_by) THEN
    v_recipients := array_append(v_recipients, v_event.created_by);
  END IF;
  IF v_event.club_id IS NOT NULL THEN
    SELECT array_cat(v_recipients, array_agg(m.profile_id))
    INTO v_recipients
    FROM public.club_managers m
    WHERE m.club_id = v_event.club_id
      AND m.profile_id <> v_event.created_by
      AND (v_actor IS NULL OR m.profile_id <> v_actor);
  END IF;
  IF v_recipients IS NULL OR array_length(v_recipients, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Bell-badge rows
  INSERT INTO public.social_notifications
    (user_id, type, title, body, link_url, payload)
  SELECT
    r,
    'event_registration',
    v_title,
    v_event.title_vi,
    '/social/' || v_event.slug || '/danh-sach',
    v_payload
  FROM unnest(v_recipients) r;

  -- FCM push (best-effort)
  BEGIN
    SELECT decrypted_secret INTO v_anon_key
    FROM vault.decrypted_secrets
    WHERE name = 'internal_anon_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_anon_key := NULL;
  END;

  IF v_anon_key IS NOT NULL THEN
    v_push_body := COALESCE(NULLIF(trim(NEW.display_name), ''), '(không tên)')
                || ' • ' || v_event.title_vi;
    BEGIN
      PERFORM net.http_post(
        url     := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key,
          'apikey', v_anon_key
        ),
        body    := jsonb_build_object(
          'user_ids', to_jsonb(v_recipients),
          'title',   'Đăng ký mới',
          'body',    v_push_body,
          'data',    jsonb_build_object(
            'type',            'event_registration',
            'event_slug',      v_event.slug,
            'registration_id', NEW.id::TEXT,
            'player_name',     COALESCE(NEW.display_name, '')
          )
        ),
        timeout_milliseconds := 5000
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_notify_organizers_on_registration() IS
  'AFTER INSERT trigger on event_registrations — drops social_notifications rows for the bell badge and fires an FCM push. Email path removed per user decision 2026-05-22. See migrations 20260522140000 + 20260522150000 + 20260522170000.';
