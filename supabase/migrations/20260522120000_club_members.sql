-- ============================================================================
-- Club members — invite + request-to-join membership
-- ============================================================================
-- A CLB now has 3 tiers of relationship with a profile:
--   1. CREATOR  (clubs.created_by)         — singular owner, full power.
--   2. MANAGER  (public.club_managers)     — co-organizer (full power minus archive).
--   3. MEMBER   (public.club_members)      — joined player; skip OTP at event
--                                            registration, see club-only events.
--
-- Join model (per product decision 2026-05-22): HYBRID.
--   * Owner/manager can invite by email/phone (auto status = 'active').
--   * Any logged-in user can request to join from /clb/:slug (status = 'pending').
--   * Owner/manager approves → status flips to 'active'.
--   * Member can leave anytime (DELETE own row).
--
-- Phone OTP bypass: when a member registers for one of the club's events
-- and is authenticated, the RegistrationModal skips the OTP step entirely
-- and INSERTs into event_registrations directly via RLS (the
-- event_registrations_insert_self policy already permits this).
-- Pre-payment + slot selection flows stay unchanged.
--
-- IDEMPOTENT — replay-safe.
-- ============================================================================

-- ─── 1. club_members table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.club_members (
  club_id      UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  profile_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending',
  added_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at  TIMESTAMPTZ,
  PRIMARY KEY (club_id, profile_id)
);

ALTER TABLE public.club_members
  DROP CONSTRAINT IF EXISTS club_members_status_check;
ALTER TABLE public.club_members
  ADD CONSTRAINT club_members_status_check
  CHECK (status IN ('pending', 'active'));

CREATE INDEX IF NOT EXISTS idx_club_members_profile_id
  ON public.club_members (profile_id);
CREATE INDEX IF NOT EXISTS idx_club_members_status_pending
  ON public.club_members (club_id, added_at DESC)
  WHERE status = 'pending';

COMMENT ON TABLE public.club_members IS
  'CLB membership join table. status=''pending'' rows are awaiting owner approval. status=''active'' rows skip OTP at event registration time. See migration 20260522120000.';

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone can list members of any club (rosters are public-readable
-- by design — same precedent as club_managers). The display fields come
-- back via list_club_members RPC which joins profiles.
DROP POLICY IF EXISTS "club_members_select_all" ON public.club_members;
CREATE POLICY "club_members_select_all" ON public.club_members
  FOR SELECT
  USING (true);

-- INSERT: 2 paths
--   (a) Owner/manager creates an ACTIVE member row (invite path).
--   (b) Any authenticated user creates their OWN pending row (request-to-join).
DROP POLICY IF EXISTS "club_members_insert_invite_or_request" ON public.club_members;
CREATE POLICY "club_members_insert_invite_or_request" ON public.club_members
  FOR INSERT
  WITH CHECK (
    -- Path A: organizer invites someone (any status).
    public.is_club_organizer(club_id, auth.uid())
    -- Path B: self-request — only when inserting own row with status='pending'.
    OR (
      auth.uid() IS NOT NULL
      AND auth.uid() = profile_id
      AND status = 'pending'
    )
  );

-- UPDATE: owner/manager only (used by approve flow to flip pending → active).
DROP POLICY IF EXISTS "club_members_update_organizer" ON public.club_members;
CREATE POLICY "club_members_update_organizer" ON public.club_members
  FOR UPDATE
  USING (public.is_club_organizer(club_id, auth.uid()))
  WITH CHECK (public.is_club_organizer(club_id, auth.uid()));

-- DELETE: 2 paths
--   (a) Owner/manager removes / rejects a member row.
--   (b) Member leaves the club themselves (DELETE own row).
DROP POLICY IF EXISTS "club_members_delete_organizer_or_self" ON public.club_members;
CREATE POLICY "club_members_delete_organizer_or_self" ON public.club_members
  FOR DELETE
  USING (
    public.is_club_organizer(club_id, auth.uid())
    OR auth.uid() = profile_id
  );

GRANT SELECT                       ON public.club_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_members TO authenticated;

-- ─── 2. is_club_member helper ──────────────────────────────────────────────
-- Used by RegistrationModal logic (via dedicated RPC below) to decide
-- whether to skip the OTP step. SECURITY DEFINER so RLS doesn't hide
-- the membership row from the caller's own view.

CREATE OR REPLACE FUNCTION public.is_club_member(
  p_club_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = p_club_id
        AND m.profile_id = p_user_id
        AND m.status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.is_club_member(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_club_member(UUID, UUID) TO anon;
GRANT  EXECUTE ON FUNCTION public.is_club_member(UUID, UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_club_member(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.is_club_member(UUID, UUID) IS
  'TRUE iff user has an ACTIVE row in club_members for this club. Used by the registration flow to skip phone OTP. See migration 20260522120000.';

-- ─── 3. RPC list_club_members ──────────────────────────────────────────────
-- Returns active + pending rows joined with profile display data so the
-- admin UI + the public roster can render avatars + names. Anyone can
-- call this (RLS is "public SELECT") but pending rows are only surfaced
-- to organizers — non-organizers always see status='active' rows only.

CREATE OR REPLACE FUNCTION public.list_club_members(p_club_id UUID)
RETURNS TABLE (
  profile_id    UUID,
  display_name  TEXT,
  email         TEXT,
  phone         TEXT,
  avatar_url    TEXT,
  status        TEXT,
  added_at      TIMESTAMPTZ,
  added_by      UUID,
  approved_at   TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    m.profile_id,
    p.display_name,
    CASE WHEN public.is_club_organizer(p_club_id, auth.uid()) THEN p.email ELSE NULL END AS email,
    CASE WHEN public.is_club_organizer(p_club_id, auth.uid()) THEN p.phone ELSE NULL END AS phone,
    p.avatar_url,
    m.status,
    m.added_at,
    m.added_by,
    m.approved_at
  FROM public.club_members m
  JOIN public.profiles p ON p.id = m.profile_id
  WHERE m.club_id = p_club_id
    AND (
      -- Public: only active members are listed for non-organizers.
      m.status = 'active'
      OR public.is_club_organizer(p_club_id, auth.uid())
    )
  ORDER BY
    CASE m.status WHEN 'pending' THEN 0 ELSE 1 END,
    m.added_at ASC;
$$;

REVOKE ALL ON FUNCTION public.list_club_members(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_club_members(UUID) TO anon;
GRANT  EXECUTE ON FUNCTION public.list_club_members(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.list_club_members(UUID) TO service_role;

-- ─── 4. RPC my_club_membership_status ──────────────────────────────────────
-- Single query the join button on /clb/:slug uses to decide its label:
-- 'creator' | 'manager' | 'active' | 'pending' | 'none' | 'anonymous'.

CREATE OR REPLACE FUNCTION public.my_club_membership_status(p_club_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_creator UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'anonymous';
  END IF;

  SELECT created_by INTO v_creator FROM public.clubs WHERE id = p_club_id;
  IF v_creator IS NULL THEN
    RETURN 'none';
  END IF;
  IF v_creator = v_uid THEN
    RETURN 'creator';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.club_managers
    WHERE club_id = p_club_id AND profile_id = v_uid
  ) THEN
    RETURN 'manager';
  END IF;
  RETURN COALESCE(
    (SELECT status FROM public.club_members WHERE club_id = p_club_id AND profile_id = v_uid),
    'none'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_club_membership_status(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.my_club_membership_status(UUID) TO anon;
GRANT  EXECUTE ON FUNCTION public.my_club_membership_status(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.my_club_membership_status(UUID) TO service_role;

-- ─── 5. RPC invite_club_member ─────────────────────────────────────────────
-- Owner/manager-only. Inserts an ACTIVE row immediately (no approval step).
-- Looks up profile by id (UI already resolved email/phone → profile via
-- search_profile_for_manager). Errors mirror club_managers conventions.

CREATE OR REPLACE FUNCTION public.invite_club_member(
  p_club_id    UUID,
  p_profile_id UUID
)
RETURNS public.club_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_creator  UUID;
  v_existing TEXT;
  v_is_ghost BOOLEAN;
  v_row      public.club_members;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT created_by INTO v_creator FROM public.clubs WHERE id = p_club_id;
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_club_organizer(p_club_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT is_ghost INTO v_is_ghost FROM public.profiles WHERE id = p_profile_id;
  IF v_is_ghost IS NULL OR v_is_ghost IS TRUE THEN
    -- Ghost profiles can't log in → can't be members.
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_profile_id = v_creator THEN
    RAISE EXCEPTION 'already_creator' USING ERRCODE = '23505';
  END IF;

  -- If a row already exists, either it's pending (approve via separate
  -- RPC instead) or already active (no-op).
  SELECT status INTO v_existing
  FROM public.club_members
  WHERE club_id = p_club_id AND profile_id = p_profile_id;
  IF v_existing = 'active' THEN
    RAISE EXCEPTION 'already_member' USING ERRCODE = '23505';
  END IF;
  IF v_existing = 'pending' THEN
    -- Approve the existing pending row in-place.
    UPDATE public.club_members
    SET status = 'active',
        approved_at = now(),
        added_by = COALESCE(added_by, auth.uid())
    WHERE club_id = p_club_id AND profile_id = p_profile_id
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  INSERT INTO public.club_members (club_id, profile_id, status, added_by, approved_at)
  VALUES (p_club_id, p_profile_id, 'active', auth.uid(), now())
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_club_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invite_club_member(UUID, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.invite_club_member(UUID, UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.invite_club_member(UUID, UUID) TO service_role;

-- ─── 6. RPC request_to_join_club ───────────────────────────────────────────
-- Self-service join request. Inserts a pending row for the caller. No-op
-- if the caller is already a member / pending / creator / manager.

CREATE OR REPLACE FUNCTION public.request_to_join_club(p_club_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_creator UUID;
  v_status  TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT created_by INTO v_creator FROM public.clubs WHERE id = p_club_id;
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_creator = v_uid THEN
    RAISE EXCEPTION 'already_creator' USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.club_managers
    WHERE club_id = p_club_id AND profile_id = v_uid
  ) THEN
    RAISE EXCEPTION 'already_manager' USING ERRCODE = '23505';
  END IF;

  SELECT status INTO v_status FROM public.club_members
  WHERE club_id = p_club_id AND profile_id = v_uid;
  IF v_status IS NOT NULL THEN
    RETURN v_status;
  END IF;

  INSERT INTO public.club_members (club_id, profile_id, status, added_by)
  VALUES (p_club_id, v_uid, 'pending', v_uid);
  RETURN 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.request_to_join_club(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_to_join_club(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.request_to_join_club(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.request_to_join_club(UUID) TO service_role;

-- ─── 7. RPC approve_club_member ────────────────────────────────────────────
-- Flip a pending row to active. Owner/manager only. Returns the row.

CREATE OR REPLACE FUNCTION public.approve_club_member(
  p_club_id    UUID,
  p_profile_id UUID
)
RETURNS public.club_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.club_members;
BEGIN
  IF NOT public.is_club_organizer(p_club_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.club_members
  SET status = 'active',
      approved_at = now(),
      added_by = COALESCE(added_by, auth.uid())
  WHERE club_id = p_club_id AND profile_id = p_profile_id
    AND status = 'pending'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_club_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_club_member(UUID, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.approve_club_member(UUID, UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.approve_club_member(UUID, UUID) TO service_role;

-- ─── 8. RPC remove_club_member ─────────────────────────────────────────────
-- Used both to reject a pending row and to remove an active member. Also
-- callable by the member themselves to leave the club. Returns the
-- number of rows deleted (0 or 1).

CREATE OR REPLACE FUNCTION public.remove_club_member(
  p_club_id    UUID,
  p_profile_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;
  -- Allowed if caller is the member themselves OR an organizer.
  IF auth.uid() <> p_profile_id
     AND NOT public.is_club_organizer(p_club_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.club_members
  WHERE club_id = p_club_id AND profile_id = p_profile_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_club_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_club_member(UUID, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.remove_club_member(UUID, UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.remove_club_member(UUID, UUID) TO service_role;

-- ─── 9. RPC register_event_as_member ───────────────────────────────────────
-- Authenticated members of the event's club skip the phone OTP step.
-- This RPC validates membership + capacity + slot + then inserts a row
-- into event_registrations on behalf of the caller. Returns the new
-- registration plus the magic_token a future cancel flow can use.
--
-- payment + prepayment status: identical to phone-otp-verify path, so
-- existing payment flow (create-payment-order + QRPaymentStep) still
-- works without changes downstream.

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

  -- Membership gate: must be active member, or organizer (creator +
  -- manager + admin). Organizers register themselves too via this path
  -- so they can test their own event.
  IF v_event.club_id IS NULL OR NOT (
    public.is_club_member(v_event.club_id, v_uid)
    OR public.is_club_organizer(v_event.club_id, v_uid)
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  -- Capacity check (race-safe via re-count + unique index on profile/phone).
  SELECT COUNT(*) INTO v_active_count
  FROM public.event_registrations
  WHERE event_id = p_event_id AND status <> 'cancelled';
  IF v_active_count >= v_event.max_players THEN
    RAISE EXCEPTION 'event_full' USING ERRCODE = '23505';
  END IF;

  -- Slot validation mirrors phone-otp-verify.
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

  -- Payment status seed mirrors phone-otp-verify: pending_payment for
  -- prepayment-required paid events, unpaid otherwise (free events stay
  -- unpaid too).
  v_payment := CASE
    WHEN v_event.requires_prepayment IS TRUE AND v_event.price_vnd > 0
      THEN 'pending_payment'
    ELSE 'unpaid'
  END;

  -- Idempotency: if this user already has an ACTIVE registration we
  -- surface a friendlier error rather than the raw unique-violation.
  IF EXISTS (
    SELECT 1 FROM public.event_registrations
    WHERE event_id = p_event_id AND profile_id = v_uid AND status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'already_registered' USING ERRCODE = '23505';
  END IF;

  -- Use profile display_name; fallback to email local-part if NULL.
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

  -- Magic token mirrors phone-otp-verify so the existing cancel /
  -- recovery flow keeps working for member-path registrations too.
  INSERT INTO public.registration_secrets (registration_id, magic_token)
  VALUES (v_reg_id, v_token);

  RETURN QUERY SELECT v_reg_id, v_uid, v_token, v_reg_at;
END;
$$;

REVOKE ALL ON FUNCTION public.register_event_as_member(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_event_as_member(UUID, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.register_event_as_member(UUID, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.register_event_as_member(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.register_event_as_member(UUID, TEXT) IS
  'Authenticated 1-click event registration for active club members + organizers. Skips phone OTP. Validates membership + capacity + slot + already-registered. Returns registration_id + magic_token. See migration 20260522120000.';
