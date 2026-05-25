-- ============================================================================
-- mark_match_submitted_to_dupr — manual organizer override for DUPR submit
-- ============================================================================
-- Until the DUPR Partner RAAS API is granted to ThePickleHub, organizers
-- submit matches via the DUPR dashboard manually and paste the returned
-- matchCode back into the system. This RPC writes that matchCode into
-- the `matches` row + flips `submitted_to_dupr = true`.
--
-- Once the real edge function `dupr-match-submit` ships, that function
-- will call this RPC internally (or update the columns directly via
-- service_role) — the audit-trail shape stays the same.
--
-- Permission model:
--   * Caller must be a CLB organizer (creator + manager) for the match's
--     club_id, OR a global `admin` user_role.
--   * Refuses if match has no club_id (this RPC is club-match-only).
--   * Refuses to overwrite if already submitted (audit immutability).
--
-- IDEMPOTENT — replay-safe (CREATE OR REPLACE).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_match_submitted_to_dupr(
  p_match_id      UUID,
  p_dupr_match_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid              UUID := auth.uid();
  v_club_id          UUID;
  v_already_submitted BOOLEAN;
  v_is_admin         BOOLEAN := FALSE;
  v_dupr_code        TEXT := trim(coalesce(p_dupr_match_id, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  IF length(v_dupr_code) < 1 THEN
    RAISE EXCEPTION 'dupr_match_id_required' USING ERRCODE = '22023';
  END IF;

  -- DUPR matchCode is typically a 10-digit numeric or alphanumeric token.
  -- We don't strictly enforce shape here (operator may paste hashedMatchCode
  -- variants), just cap length so the column doesn't get garbage.
  IF length(v_dupr_code) > 64 THEN
    RAISE EXCEPTION 'dupr_match_id_too_long' USING ERRCODE = '22023';
  END IF;

  SELECT club_id, submitted_to_dupr
  INTO v_club_id, v_already_submitted
  FROM public.matches
  WHERE id = p_match_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'match_not_in_club' USING ERRCODE = 'P0002';
  END IF;

  IF v_already_submitted IS TRUE THEN
    RAISE EXCEPTION 'already_submitted' USING ERRCODE = '23505';
  END IF;

  -- Global admin bypass — useful when troubleshooting from /admin.
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT (v_is_admin OR public.is_club_organizer(v_club_id, v_uid)) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.matches
  SET submitted_to_dupr  = TRUE,
      dupr_match_id      = v_dupr_code,
      dupr_submitted_at  = NOW(),
      ready_for_dupr     = FALSE,  -- remove from queue once submitted
      updated_at         = NOW()
  WHERE id = p_match_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_match_submitted_to_dupr(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_match_submitted_to_dupr(UUID, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.mark_match_submitted_to_dupr(UUID, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.mark_match_submitted_to_dupr(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.mark_match_submitted_to_dupr(UUID, TEXT) IS
  'Manual organizer override to mark a club match as submitted to DUPR with the matchCode pasted from the DUPR dashboard. Will be reused by the future dupr-match-submit edge function once the Partner RAAS API is granted. Organizer or global admin only, refuses to overwrite already-submitted matches. See migration 20260525140000.';
