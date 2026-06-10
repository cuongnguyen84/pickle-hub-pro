-- Audit fix 2026-06-10 — close ghost-profile hijack in merge_my_ghost_by_phone.
--
-- Before: the wrapper trusted the caller-supplied p_phone and merged WHICHEVER
-- ghost profile matched that phone into auth.uid()'s profile. A logged-in user
-- who knew a victim's phone could call the RPC directly (supabase-js) and absorb
-- the victim's ghost history (event registrations, match results, rating, club
-- memberships) into their own account.
--
-- Root cause: no server-side proof that the caller owns p_phone. The OTP-ownership
-- check lived only in the UI convention.
--
-- Fix: require p_phone to equal the caller's OWN verified profile phone. A user's
-- profile.phone is only set through the OTP-verified flow (Settings / onboarding),
-- so this is the server-side ownership proof. Same source of truth already used by
-- authed_user_skip_otp (`SELECT phone FROM profiles WHERE id = v_uid`). A caller can
-- now only merge ghosts that match their own verified phone — never an arbitrary one.
--
-- Behavior preserved for the legitimate flow: Settings/auto-claim already set
-- profile.phone to the verified number before calling this RPC.

CREATE OR REPLACE FUNCTION public.merge_my_ghost_by_phone(p_phone TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_ghost_id      UUID;
  v_profile_phone TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  -- Ownership proof: caller's own profile phone must match the requested phone.
  SELECT phone INTO v_profile_phone FROM public.profiles WHERE id = v_uid;

  IF v_profile_phone IS NULL OR v_profile_phone <> p_phone THEN
    RAISE EXCEPTION 'phone_not_verified' USING ERRCODE = '42501';
  END IF;

  -- Merge ghost into the caller (target is always auth.uid(); no override possible).
  v_ghost_id := public.merge_ghost_into_profile(v_uid, p_phone);

  RETURN v_ghost_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_my_ghost_by_phone(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_my_ghost_by_phone(TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.merge_my_ghost_by_phone(TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.merge_my_ghost_by_phone(TEXT) TO service_role;

COMMENT ON FUNCTION public.merge_my_ghost_by_phone(TEXT) IS
  'Authenticated wrapper: merge ghost profile with phone = p_phone into the caller. SECURITY: p_phone must equal the caller''s own verified profile.phone (set via OTP flow) — prevents merging arbitrary victims'' ghosts. Hardened 2026-06-10 (audit).';
