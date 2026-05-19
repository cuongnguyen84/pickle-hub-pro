-- ============================================================================
-- Social Events MVP — PR47 follow-up: walk-in registrations need profile_id
-- ============================================================================
-- Bug: SocialEventRoster's "Thêm thủ công" (manualAdd) inserted directly
-- into event_registrations without a profile_id. Walk-ins ended up with
-- profile_id = NULL.
--
-- Knock-on bug: when the organizer saved a matchmaking schedule, the save
-- mapper did `regById.get(...).profile_id` for every player. For walk-ins
-- that lookup returned NULL, so all 4 team player columns on the inserted
-- `social_event_matches` rows were NULL → useEventLive couldn't identify
-- any player → live page rendered blank, standings empty, score submission
-- impossible.
--
-- Fix:
--   (1) Backfill existing null-profile_id event_registrations rows with
--       fresh ghost profiles (matching the phone-otp-verify pattern).
--   (2) New SECURITY DEFINER function `add_walk_in_registration` so the
--       roster's manualAdd path creates ghost profile + registration in
--       one atomic transaction with proper organizer/admin authorization.
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

-- ─── 1. Backfill ────────────────────────────────────────────────────────────
-- For each event_registrations row without a profile_id, either reuse an
-- existing ghost profile keyed by phone (so two registrations with the
-- same phone end up pointing at the same ghost identity, matching the
-- phone-otp-verify behavior), or create a fresh ghost profile.

DO $$
DECLARE
  rec               RECORD;
  v_profile_id      UUID;
BEGIN
  FOR rec IN
    SELECT id, phone, display_name, self_rated_level
    FROM public.event_registrations
    WHERE profile_id IS NULL
  LOOP
    v_profile_id := NULL;

    -- Reuse an existing phone-keyed profile when possible.
    IF rec.phone IS NOT NULL THEN
      SELECT id INTO v_profile_id
      FROM public.profiles
      WHERE phone = rec.phone
      LIMIT 1;
    END IF;

    IF v_profile_id IS NULL THEN
      v_profile_id := gen_random_uuid();
      INSERT INTO public.profiles (
        id, email, phone, display_name, is_ghost, self_rating, source_provider
      ) VALUES (
        v_profile_id,
        'ghost+' || v_profile_id::text || '@guest.thepicklehub.net',
        rec.phone,
        rec.display_name,
        true,
        rec.self_rated_level,
        'community'
      );
    END IF;

    UPDATE public.event_registrations
    SET profile_id = v_profile_id
    WHERE id = rec.id;
  END LOOP;
END $$;

-- ─── 2. RPC for future walk-ins ─────────────────────────────────────────────
-- The roster page's manualAdd handler calls this so a fresh walk-in always
-- ends up with a usable profile_id. Authorization is enforced inside the
-- function (caller must be the event organizer or have the admin role).
--
-- Why a SECURITY DEFINER function rather than a client-side two-step
-- insert: the profile insert + registration insert must be atomic so we
-- never leak an orphaned ghost profile when the second insert fails.

CREATE OR REPLACE FUNCTION public.add_walk_in_registration(
  p_event_id          UUID,
  p_display_name      TEXT,
  p_phone             TEXT DEFAULT NULL,
  p_self_rated_level  NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller          UUID := auth.uid();
  v_event_owner     UUID;
  v_is_admin        BOOLEAN;
  v_profile_id      UUID;
  v_registration_id UUID;
  v_clean_name      TEXT;
BEGIN
  -- ─── Validate inputs ────────────────────────────────────────────────────
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'event_id_required' USING ERRCODE = '22023';
  END IF;

  v_clean_name := trim(coalesce(p_display_name, ''));
  IF length(v_clean_name) = 0 THEN
    RAISE EXCEPTION 'display_name_required' USING ERRCODE = '22023';
  END IF;
  IF length(v_clean_name) > 80 THEN
    RAISE EXCEPTION 'display_name_too_long' USING ERRCODE = '22023';
  END IF;

  IF p_phone IS NOT NULL AND p_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = '22023';
  END IF;

  IF p_self_rated_level IS NOT NULL
     AND (p_self_rated_level < 1 OR p_self_rated_level > 7) THEN
    RAISE EXCEPTION 'invalid_level' USING ERRCODE = '22023';
  END IF;

  -- ─── Authorize the caller (organizer or admin) ──────────────────────────
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT created_by INTO v_event_owner
  FROM public.social_events
  WHERE id = p_event_id;

  IF v_event_owner IS NULL THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_is_admin := public.has_role(v_caller, 'admin'::public.app_role);

  IF v_event_owner <> v_caller AND NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- ─── Find or create ghost profile ───────────────────────────────────────
  IF p_phone IS NOT NULL THEN
    SELECT id INTO v_profile_id
    FROM public.profiles
    WHERE phone = p_phone
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    v_profile_id := gen_random_uuid();
    INSERT INTO public.profiles (
      id, email, phone, display_name, is_ghost, self_rating, source_provider
    ) VALUES (
      v_profile_id,
      'ghost+' || v_profile_id::text || '@guest.thepicklehub.net',
      p_phone,
      v_clean_name,
      true,
      p_self_rated_level,
      'community'
    );
  END IF;

  -- ─── Insert registration ────────────────────────────────────────────────
  INSERT INTO public.event_registrations (
    event_id, profile_id, phone, display_name,
    self_rated_level, status, payment_status
  ) VALUES (
    p_event_id, v_profile_id, p_phone, v_clean_name,
    p_self_rated_level, 'registered', 'unpaid'
  )
  RETURNING id INTO v_registration_id;

  RETURN v_registration_id;
END;
$$;

-- ─── 3. EXECUTE grants ──────────────────────────────────────────────────────
-- authenticated only (organizer/admin check happens inside the function);
-- anon explicitly revoked so the public landing page can't somehow invoke
-- this if a future RPC route exposes it.

REVOKE ALL ON FUNCTION public.add_walk_in_registration(UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_walk_in_registration(UUID, TEXT, TEXT, NUMERIC) FROM anon;
GRANT  EXECUTE ON FUNCTION public.add_walk_in_registration(UUID, TEXT, TEXT, NUMERIC) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.add_walk_in_registration(UUID, TEXT, TEXT, NUMERIC) TO service_role;

COMMENT ON FUNCTION public.add_walk_in_registration(UUID, TEXT, TEXT, NUMERIC) IS
  'Atomic walk-in registration: organizer/admin-authorized find-or-create ghost profile + insert event_registrations row. Replaces the direct insert path that left walk-ins with NULL profile_id and broke the matchmaking save flow. See migration 20260512120000.';
