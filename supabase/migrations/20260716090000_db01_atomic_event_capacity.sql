-- DB-01: make social-event capacity checks atomic.
--
-- Both reactivate-registration and phone-otp-verify enforced max_players (and
-- per-slot capacity) with a count → check → write sequence across separate
-- PostgREST round-trips. Two concurrent requests could both observe a free
-- slot and both commit, pushing an event past max_players (DB-00 CONFIRMED).
--
-- These RPCs serialize every capacity-consuming write per event with a
-- transaction-scoped advisory lock and perform the check + write in one
-- transaction. Cancel paths only ever decrease the count and stay lock-free.
--
-- The two callers historically used different "active" predicates
-- (cancelled_at IS NULL vs status <> 'cancelled'); each RPC keeps its
-- caller's exact predicate so behavior is unchanged apart from atomicity.

CREATE OR REPLACE FUNCTION public.social_event_reactivate_registration(
  p_registration_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_event_id UUID;
  v_cancelled_at TIMESTAMPTZ;
  v_max_players INTEGER;
  v_active BIGINT;
BEGIN
  SELECT er.event_id, er.cancelled_at
    INTO v_event_id, v_cancelled_at
    FROM public.event_registrations AS er
    WHERE er.id = p_registration_id;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF v_cancelled_at IS NULL THEN
    RETURN 'already_active';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('event_capacity:' || v_event_id::text, 0)
  );

  SELECT se.max_players
    INTO v_max_players
    FROM public.social_events AS se
    WHERE se.id = v_event_id;

  SELECT COUNT(*)
    INTO v_active
    FROM public.event_registrations AS er
    WHERE er.event_id = v_event_id
      AND er.cancelled_at IS NULL;

  IF v_active >= COALESCE(v_max_players, 0) THEN
    RETURN 'event_full';
  END IF;

  UPDATE public.event_registrations
    SET status = 'registered',
        cancelled_at = NULL,
        cancelled_reason = NULL
    WHERE id = p_registration_id
      AND cancelled_at IS NOT NULL;
  IF NOT FOUND THEN
    RETURN 'already_active';
  END IF;

  RETURN 'reactivated';
END;
$$;

REVOKE ALL ON FUNCTION public.social_event_reactivate_registration(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_event_reactivate_registration(UUID)
  TO service_role;

COMMENT ON FUNCTION public.social_event_reactivate_registration(UUID) IS
  'DB-01. Atomic capacity check + reactivation under a per-event advisory lock; service-role only (reactivate-registration edge function).';

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
    RETURN QUERY SELECT 'already_registered'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
    RETURN;
  END;

  RETURN QUERY SELECT 'registered'::TEXT, v_id, v_registered_at;
END;
$$;

REVOKE ALL ON FUNCTION public.social_event_guest_register(
  UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, INTEGER
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_event_guest_register(
  UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, INTEGER
) TO service_role;

COMMENT ON FUNCTION public.social_event_guest_register(
  UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, INTEGER
) IS
  'DB-01. Atomic event + slot capacity check and registration insert under a per-event advisory lock; service-role only (phone-otp-verify edge function).';
