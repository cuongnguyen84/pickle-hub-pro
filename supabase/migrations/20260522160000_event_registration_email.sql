-- ============================================================================
-- Email notification path for new event registrations
-- ============================================================================
-- Extends the trigger from 20260522140000 / 20260522150000. After dropping
-- the bell-badge row + firing the FCM push, we now also collect the
-- organizers' email addresses and POST to send-event-registration-email
-- so the organizer gets a copy in their inbox — useful for organizers
-- who didn't install the mobile app and never registered a push token.
--
-- Auth: pull the shared 'internal_notify_secret' from vault and pass it
-- as the x-internal-secret header so the edge function gates against
-- random callers (verify_jwt is off — we don't have a JWT here).
--
-- Failure handling: every external call is wrapped in EXCEPTION WHEN
-- OTHERS so a flaky network never blocks the registration.
--
-- IDEMPOTENT — replay-safe via CREATE OR REPLACE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_notify_organizers_on_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_event       RECORD;
  v_actor       UUID;
  v_payload     JSONB;
  v_title       TEXT;
  v_recipients  UUID[];
  v_emails      TEXT[];
  v_anon_key    TEXT;
  v_notify_sec  TEXT;
  v_push_body   TEXT;
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

  -- ─── 1) Recipient set (creator + club managers minus actor) ───
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

  -- ─── 2) In-app notification rows for the bell badge ───
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

  -- ─── 3) FCM push (best-effort) ───
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

  -- ─── 4) Email via Resend (best-effort) ───
  -- Collect real (non-ghost) emails for the recipient set so the edge
  -- function only ever sees deliverable addresses. Skip when nobody on
  -- the list has an email or the secret isn't configured.
  SELECT array_agg(p.email)
  INTO v_emails
  FROM public.profiles p
  WHERE p.id = ANY(v_recipients)
    AND p.email IS NOT NULL
    AND p.email NOT LIKE '%@guest.thepicklehub.net'
    AND length(trim(p.email)) > 0;

  IF v_emails IS NOT NULL AND array_length(v_emails, 1) IS NOT NULL THEN
    BEGIN
      SELECT decrypted_secret INTO v_notify_sec
      FROM vault.decrypted_secrets
      WHERE name = 'internal_notify_secret'
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_notify_sec := NULL;
    END;

    IF v_notify_sec IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url     := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/send-event-registration-email',
          headers := jsonb_build_object(
            'Content-Type',      'application/json',
            'x-internal-secret', v_notify_sec
          ),
          body    := jsonb_build_object(
            'recipient_emails', to_jsonb(v_emails),
            'player_name',      NEW.display_name,
            'event_title',      v_event.title_vi,
            'event_slug',       v_event.slug,
            'registration_id',  NEW.id::TEXT
          ),
          timeout_milliseconds := 10000
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_notify_organizers_on_registration() IS
  'AFTER INSERT trigger on event_registrations — drops social_notifications rows for the bell badge, fires FCM push, and emails the organizers (creator + managers, minus actor). All external calls are best-effort. See migrations 20260522140000 + 20260522150000 + 20260522160000.';
