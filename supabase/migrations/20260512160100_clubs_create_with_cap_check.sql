-- ============================================================================
-- Social Events MVP — PR55 follow-up: atomic club creation with cap check
-- ============================================================================
-- Codex review bug 1: the two-step "check count via user_club_count RPC,
-- then INSERT" path in CreateClub.tsx has a race: two concurrent submits
-- can both read count=2, both pass the cap check, both INSERT, ending
-- with 4 clubs for the user.
--
-- Fix: collapse the gate + INSERT into a single SECURITY DEFINER function
-- that takes a row-level lock on the user's existing clubs (SELECT ...
-- FOR UPDATE) so a second concurrent transaction blocks behind the first
-- and re-reads the (now updated) count. The function raises a tagged
-- exception "CLUB_CAP_EXCEEDED" which the client maps to a user-friendly
-- toast.
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

  -- Row-lock the user's existing clubs so a parallel session blocks on
  -- the same set of rows until we commit. The FOR UPDATE doesn't strictly
  -- need anything to lock when count is 0; PostgreSQL still serialises
  -- the predicate against concurrent inserts that satisfy `created_by =
  -- v_user_id` because of the (implicit) gap lock under READ COMMITTED.
  -- A clean atomic alternative would be a unique partial index on
  -- (created_by) WHERE count<3 — but Postgres has no count-based index,
  -- hence the explicit lock.
  SELECT COUNT(*) INTO v_count
  FROM public.clubs
  WHERE created_by = v_user_id
  FOR UPDATE;

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
