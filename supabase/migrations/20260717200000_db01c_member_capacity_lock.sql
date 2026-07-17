-- ============================================================================
-- DB-01c: close the member-path capacity race in register_event_as_member.
-- ============================================================================
-- DB-01 (20260716090000) serialized the guest and reactivate capacity paths
-- with a per-event advisory lock, but register_event_as_member (the authed
-- 1-click path from RegistrationModal) kept the bare COUNT → check → INSERT
-- sequence: two members grabbing the last seat concurrently could both pass
-- the check and push the event past max_players (same class as DB-00
-- CONFIRMED race; found during the arch-02 risk audit, 2026-07-17).
--
-- Fix: take the SAME lock key as DB-01 ('event_capacity:' || event_id) before
-- the capacity/slot counts, so member registrations serialize against guest
-- registrations and reactivations too, not just against each other.
--
-- Function body is otherwise verbatim from 20260522190000 (ambiguity fix).
-- Rollback: re-run the CREATE FUNCTION from 20260522190000 (lock-free def).
-- IDEMPOTENT.
-- ============================================================================

-- Replay-safety (auto): drop prod-seeded overload before refresh.
DROP FUNCTION IF EXISTS public.register_event_as_member(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.register_event_as_member(
  p_event_id UUID,
  p_slot_id  TEXT DEFAULT NULL
)
RETURNS TABLE (
  registration_id UUID,
  profile_id      UUID,
  magic_token     UUID,
  registered_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_event        RECORD;
  v_active_count INT;
  v_slot         JSONB;
  v_slot_cap     INT;
  v_slot_count   INT;
  v_payment      TEXT;
  v_inserted     public.event_registrations%ROWTYPE;
  v_token        UUID := gen_random_uuid();
  v_display      TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT id, club_id, status, visibility, start_at, max_players,
         allow_guests, price_vnd, requires_prepayment, slots
  INTO v_event
  FROM public.social_events
  WHERE id = p_event_id;
  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_event.status <> 'published' THEN
    RAISE EXCEPTION 'event_not_published' USING ERRCODE = '22023';
  END IF;
  IF v_event.start_at < now() THEN
    RAISE EXCEPTION 'event_started_or_ended' USING ERRCODE = '22023';
  END IF;

  -- DB-01c: serialize every capacity-consuming write for this event.
  -- Same key namespace as DB-01 so member/guest/reactivate all queue on
  -- one lock. Released automatically at transaction end.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('event_capacity:' || p_event_id::text, 0)
  );

  -- Capacity check.
  SELECT COUNT(*) INTO v_active_count
  FROM public.event_registrations er
  WHERE er.event_id = p_event_id AND er.status <> 'cancelled';
  IF v_active_count >= v_event.max_players THEN
    RAISE EXCEPTION 'event_full' USING ERRCODE = '23505';
  END IF;

  -- Slot validation.
  IF jsonb_typeof(v_event.slots) = 'array' AND jsonb_array_length(v_event.slots) > 0 THEN
    IF p_slot_id IS NULL OR length(p_slot_id) = 0 THEN
      RAISE EXCEPTION 'slot_required' USING ERRCODE = '22023';
    END IF;
    SELECT elem INTO v_slot
    FROM jsonb_array_elements(v_event.slots) elem
    WHERE elem->>'id' = p_slot_id;
    IF v_slot IS NULL THEN
      RAISE EXCEPTION 'slot_not_found' USING ERRCODE = 'P0002';
    END IF;
    v_slot_cap := COALESCE((v_slot->>'capacity')::INT, 0);
    IF v_slot_cap < 1 THEN
      RAISE EXCEPTION 'slot_capacity_invalid' USING ERRCODE = '22023';
    END IF;
    SELECT COUNT(*) INTO v_slot_count
    FROM public.event_registrations er
    WHERE er.event_id = p_event_id
      AND er.slot_id = p_slot_id
      AND er.status <> 'cancelled';
    IF v_slot_count >= v_slot_cap THEN
      RAISE EXCEPTION 'slot_full' USING ERRCODE = '23505';
    END IF;
  END IF;

  v_payment := CASE
    WHEN v_event.requires_prepayment IS TRUE AND v_event.price_vnd > 0
      THEN 'pending_payment'
    ELSE 'unpaid'
  END;

  IF EXISTS (
    SELECT 1 FROM public.event_registrations er
    WHERE er.event_id = p_event_id
      AND er.profile_id = v_uid
      AND er.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'already_registered' USING ERRCODE = '23505';
  END IF;

  SELECT COALESCE(NULLIF(trim(p.display_name), ''), split_part(p.email, '@', 1))
  INTO v_display
  FROM public.profiles p
  WHERE p.id = v_uid;

  INSERT INTO public.event_registrations (
    event_id, profile_id, phone, display_name,
    status, payment_status, slot_id
  )
  VALUES (
    p_event_id,
    v_uid,
    (SELECT phone FROM public.profiles WHERE id = v_uid),
    v_display,
    'registered',
    v_payment,
    NULLIF(p_slot_id, '')
  )
  RETURNING * INTO v_inserted;

  INSERT INTO public.registration_secrets (registration_id, magic_token)
  VALUES (v_inserted.id, v_token);

  RETURN QUERY SELECT v_inserted.id, v_uid, v_token, v_inserted.registered_at;
END;
$$;

REVOKE ALL ON FUNCTION public.register_event_as_member(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_event_as_member(UUID, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.register_event_as_member(UUID, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.register_event_as_member(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.register_event_as_member(UUID, TEXT) IS
  'Authenticated 1-click event registration (skip OTP). Any logged-in user can call. Slot + capacity validation under the per-event advisory lock (DB-01c, same key as DB-01). Returns registration_id + magic_token.';
