-- ============================================================================
-- Fix ambiguous column references in register_event_as_member
-- ============================================================================
-- The function's RETURNS TABLE declares OUT columns (registration_id,
-- profile_id, magic_token, registered_at) that collide with same-named
-- columns on the event_registrations / profiles tables. Postgres
-- surfaced this as:
--
--   ERROR  42702: column reference "profile_id" is ambiguous
--   ERROR  42702: column reference "registered_at" is ambiguous
--
-- The bug existed since the original migration (20260522120000) but
-- was masked by the earlier membership gate. Migration 20260522180000
-- relaxed that gate (any authed user can call) → every first-time
-- registration hit the buggy line and the modal toasted 'Lỗi kết nối'.
--
-- Fix:
--   1. Table-qualify every column reference inside the function body
--      (er.profile_id, er.event_id, er.status, er.slot_id, p.email,
--      p.display_name, etc).
--   2. Use a %ROWTYPE record (v_inserted) for the RETURNING clause so
--      registered_at is accessed via the record variable instead of
--      a bare column name.
--
-- IDEMPOTENT.
-- ============================================================================

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

COMMENT ON FUNCTION public.register_event_as_member(UUID, TEXT) IS
  'Authenticated 1-click event registration (skip OTP). Any logged-in user can call. Slot + capacity validation. Returns registration_id + magic_token. Fix 2026-05-22 (#46): table-qualified column refs + %ROWTYPE record for RETURNING to avoid OUT-column ambiguity.';
