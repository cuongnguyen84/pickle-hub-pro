-- Codex review 2026-07-16 (DB-01 follow-up): social_event_guest_register
-- mapped EVERY unique_violation to 'already_registered'. Only the two
-- registration-identity constraints mean that; any future unique index or
-- trigger-raised violation would be mis-reported as a duplicate instead of
-- surfacing as an error. Scope the handler to the expected constraint names
-- and re-raise everything else so the caller returns 500.

CREATE OR REPLACE FUNCTION public.social_event_guest_register(
  p_event_id UUID,
  p_profile_id UUID,
  p_phone TEXT,
  p_display_name TEXT,
  p_self_rated_level NUMERIC,
  p_payment_status TEXT,
  p_slot_id TEXT,
  p_slot_capacity INTEGER
)
RETURNS TABLE (
  outcome TEXT,
  registration_id UUID,
  registered_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_max_players INTEGER;
  v_active BIGINT;
  v_id UUID;
  v_registered_at TIMESTAMPTZ;
  v_constraint TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('event_capacity:' || p_event_id::text, 0)
  );

  SELECT se.max_players
    INTO v_max_players
    FROM public.social_events AS se
    WHERE se.id = p_event_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'event_missing'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT COUNT(*)
    INTO v_active
    FROM public.event_registrations AS er
    WHERE er.event_id = p_event_id
      AND er.status <> 'cancelled';
  IF v_active >= COALESCE(v_max_players, 0) THEN
    RETURN QUERY SELECT 'event_full'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF p_slot_id IS NOT NULL THEN
    SELECT COUNT(*)
      INTO v_active
      FROM public.event_registrations AS er
      WHERE er.event_id = p_event_id
        AND er.slot_id = p_slot_id
        AND er.status <> 'cancelled';
    IF v_active >= COALESCE(p_slot_capacity, 0) THEN
      RETURN QUERY SELECT 'slot_full'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
      RETURN;
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.event_registrations
      (event_id, profile_id, phone, display_name, self_rated_level,
       status, payment_status, slot_id)
    VALUES
      (p_event_id, p_profile_id, p_phone, p_display_name, p_self_rated_level,
       'registered', p_payment_status, p_slot_id)
    RETURNING event_registrations.id, event_registrations.registered_at
      INTO v_id, v_registered_at;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IN (
      'uq_event_registrations_event_phone',
      'uq_event_registrations_event_profile'
    ) THEN
      RETURN QUERY SELECT 'already_registered'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
      RETURN;
    END IF;
    -- Any other unique violation is a real error, not a duplicate signup.
    RAISE;
  END;

  RETURN QUERY SELECT 'registered'::TEXT, v_id, v_registered_at;
END;
$$;

COMMENT ON FUNCTION public.social_event_guest_register(
  UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, INTEGER
) IS
  'DB-01. Atomic event + slot capacity check and registration insert under a per-event advisory lock; service-role only (phone-otp-verify edge function). already_registered maps only the two registration-identity unique constraints.';
