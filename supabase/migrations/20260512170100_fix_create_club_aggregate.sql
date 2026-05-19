-- ============================================================================
-- Social Events MVP — PR57 follow-up: fix create_club_with_cap_check
-- ============================================================================
-- The earlier drafts of this RPC (in 20260512160100 and the refresh in
-- 20260512170000) used `SELECT COUNT(*) ... FOR UPDATE` to serialise
-- concurrent submits from the same user. Postgres rejects that combo at
-- call time with:
--
--   ERROR: FOR UPDATE is not allowed with aggregate functions
--
-- so the function errored on every real call. This migration redefines
-- the function with a per-user advisory lock + plain COUNT, which is
-- functionally equivalent (auto-released at txn end), free of the
-- aggregate restriction, and works correctly when the user owns zero
-- existing rows (FOR UPDATE only locks existing rows, so a fresh user
-- could still race two concurrent INSERTs through).
--
-- Already-deployed environments run this once to converge. Fresh deploys
-- get the fixed body from 20260512160100 / 20260512170000 directly and
-- this migration is a no-op CREATE OR REPLACE.
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

  -- Serialise concurrent submits from the same user. Per-user lock key
  -- so different users don't block each other. Auto-released at txn end.
  PERFORM pg_advisory_xact_lock(
    hashtext('club_cap:' || v_user_id::text)::bigint
  );

  SELECT COUNT(*) INTO v_count
  FROM public.clubs
  WHERE created_by = v_user_id
    AND archived_at IS NULL;

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
