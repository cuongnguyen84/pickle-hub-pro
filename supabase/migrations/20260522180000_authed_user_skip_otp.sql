-- ============================================================================
-- Authenticated users skip OTP at event registration
-- ============================================================================
-- Previously register_event_as_member required the caller to be a club
-- member or organizer. Per user decision 2026-05-22: any authenticated
-- user (already proved their identity at sign-up) should be allowed
-- to skip OTP. The function name + comment are kept for backwards
-- compatibility; the membership gate is replaced with a plain auth.uid()
-- check.
--
-- Slot validation, capacity check, payment seeding, and magic-token
-- issuance are unchanged. Anonymous callers still hit the OTP flow
-- via phone-otp-verify edge function (this RPC's auth gate is enforced
-- by the SECURITY DEFINER + auth.uid() check).
--
-- IDEMPOTENT — replay-safe.
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
  v_reg_id       UUID;
  v_reg_at       TIMESTAMPTZ;
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

  -- 2026-05-22 relaxation: any authenticated user can use this path.
  -- The previous membership/organizer gate is dropped — sign-up already
  -- verified the user's identity, so a second OTP would just be
  -- friction. visibility='club_only' is currently cosmetic (no RLS
  -- enforcement); if/when that ships, this RPC can layer the
  -- membership check back in for club_only events only.

  -- Capacity check (race-safe re-count).
  SELECT COUNT(*) INTO v_active_count
  FROM public.event_registrations
  WHERE event_id = p_event_id AND status <> 'cancelled';
  IF v_active_count >= v_event.max_players THEN
    RAISE EXCEPTION 'event_full' USING ERRCODE = '23505';
  END IF;

  -- Slot validation — mirrors phone-otp-verify exactly.
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
    FROM public.event_registrations
    WHERE event_id = p_event_id
      AND slot_id = p_slot_id
      AND status <> 'cancelled';
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
    SELECT 1 FROM public.event_registrations
    WHERE event_id = p_event_id AND profile_id = v_uid AND status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'already_registered' USING ERRCODE = '23505';
  END IF;

  SELECT COALESCE(NULLIF(trim(display_name), ''), split_part(email, '@', 1))
  INTO v_display
  FROM public.profiles
  WHERE id = v_uid;

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
  RETURNING id, registered_at INTO v_reg_id, v_reg_at;

  INSERT INTO public.registration_secrets (registration_id, magic_token)
  VALUES (v_reg_id, v_token);

  RETURN QUERY SELECT v_reg_id, v_uid, v_token, v_reg_at;
END;
$$;

COMMENT ON FUNCTION public.register_event_as_member(UUID, TEXT) IS
  'Authenticated 1-click event registration. Skips phone OTP. Any logged-in user can call — membership/organizer gate removed 2026-05-22. Slot + capacity validation unchanged. See migration 20260522180000.';
