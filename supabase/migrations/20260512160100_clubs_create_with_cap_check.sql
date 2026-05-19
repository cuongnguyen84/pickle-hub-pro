-- ============================================================================
-- Social Events MVP — PR55 follow-up: atomic club creation with cap check
-- ============================================================================
-- Codex review bug 1: the two-step "check count via user_club_count RPC,
-- then INSERT" path in CreateClub.tsx has a race: two concurrent submits
-- can both read count=2, both pass the cap check, both INSERT, ending
-- with 4 clubs for the user.
--
-- Fix: collapse the gate + INSERT into a single SECURITY DEFINER function
-- that holds a per-user advisory lock for the duration of the txn so a
-- parallel session blocks until we commit. The function raises a tagged
-- exception "CLUB_CAP_EXCEEDED" which the client maps to a user-friendly
-- toast.
--
-- An earlier draft used `SELECT COUNT(*) ... FOR UPDATE`, but Postgres
-- rejects FOR UPDATE on aggregate queries ("FOR UPDATE is not allowed
-- with aggregate functions"). Splitting it into PERFORM ... FOR UPDATE
-- + a separate SELECT COUNT also doesn't work for fresh users (zero
-- rows = nothing to lock = phantom-row race). Advisory lock works
-- regardless of whether any rows exist and is auto-released at txn end.
--
-- Note: PR57 will refresh this RPC to also exclude archived clubs (mirror
-- of the user_club_count update there) — the archived_at column doesn't
-- exist yet at this migration's slot.
--
-- IDEMPOTENT.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_club_with_cap_check(
  p_slug          TEXT,
  p_name          TEXT,
  p_description   TEXT,
  p_location_text TEXT,
  p_logo_url      TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count   INTEGER;
  v_new_id  UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- Serialise concurrent submits from the same user with a per-user
  -- advisory lock — auto-released at txn end. See header comment for
  -- why FOR UPDATE doesn't fit here.
  PERFORM pg_advisory_xact_lock(
    hashtext('club_cap:' || v_user_id::text)::bigint
  );

  SELECT COUNT(*) INTO v_count
  FROM public.clubs
  WHERE created_by = v_user_id;

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'CLUB_CAP_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.clubs (
    slug, name, description, location_text, logo_url, created_by
  )
  VALUES (
    p_slug,
    p_name,
    NULLIF(trim(coalesce(p_description, '')), ''),
    p_location_text,
    p_logo_url,
    v_user_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_club_with_cap_check(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_club_with_cap_check(TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_club_with_cap_check(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.create_club_with_cap_check(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.create_club_with_cap_check(TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Atomic cap-check + INSERT for self-service club creation. Replaces the racy two-step user_club_count + INSERT path. Raises CLUB_CAP_EXCEEDED (sqlstate P0001) when the caller already owns >= 3 clubs. See migration 20260512160100.';
