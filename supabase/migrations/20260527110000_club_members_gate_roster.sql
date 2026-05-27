-- ============================================================================
-- 20260527110000_club_members_gate_roster.sql
-- ----------------------------------------------------------------------------
-- Tighten public.list_club_members so the roster is only visible to people
-- who are part of the club (active members, managers, creator, or site
-- admins). Previously the RPC returned the active-member list to ANY caller,
-- which leaked the roster to anonymous users who hit the API directly.
--
-- The CLB landing page (`/clb/:slug`) is now adding a member-roster section
-- gated behind useMyMembership(). For that UI gate to be a real privacy
-- boundary (and not just a CSS hide), the server-side RPC must also gate.
--
-- Behaviour matrix after this migration:
--
--   caller                            | rows returned
--   ----------------------------------|-------------------------------------
--   anonymous / non-member             | (empty)
--   pending join request               | (empty)
--   active member                      | all ACTIVE members (no pending)
--   club manager / creator / admin     | all members (active + pending),
--                                        with email + phone fields filled
--
-- Email + phone masking for non-organizers is unchanged from migration
-- 20260522120000 — only organizers see PII columns.
--
-- The RETURNS TABLE shape preserves the 4 DUPR columns (dupr_id,
-- dupr_singles, dupr_doubles, dupr_connected_via) that were added to the
-- production function by an out-of-repo DUPR migration. We keep the
-- columns here so the deployed CREATE OR REPLACE succeeds (Postgres
-- forbids changing the row type of an existing function in-place) and
-- so DUPR-aware callers don't regress.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_club_members(p_club_id UUID)
RETURNS TABLE (
  profile_id          UUID,
  display_name        TEXT,
  email               TEXT,
  phone               TEXT,
  avatar_url          TEXT,
  status              TEXT,
  added_at            TIMESTAMPTZ,
  added_by            UUID,
  approved_at         TIMESTAMPTZ,
  dupr_id             TEXT,
  dupr_singles        NUMERIC,
  dupr_doubles        NUMERIC,
  dupr_connected_via  TEXT
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
    m.approved_at,
    p.dupr_id,
    p.dupr_singles,
    p.dupr_doubles,
    p.dupr_connected_via
  FROM public.club_members m
  JOIN public.profiles p ON p.id = m.profile_id
  WHERE m.club_id = p_club_id
    -- NEW: caller must belong to the club to see ANY row. Active members
    -- and organizers both qualify; anonymous + pending + non-members get
    -- an empty list.
    AND (
      public.is_club_member(p_club_id, auth.uid())
      OR public.is_club_organizer(p_club_id, auth.uid())
    )
    -- Pending rows stay organizer-only (unchanged from 20260522120000).
    AND (
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

COMMENT ON FUNCTION public.list_club_members(UUID) IS
  'Club roster RPC. Visibility tiers: (1) anonymous + non-members + pending requesters get an empty list; (2) active members + organizers see ACTIVE rows with display_name + avatar_url + DUPR cols; (3) organizers (creator/manager/admin) additionally see PENDING rows and the PII columns (email, phone). See migration 20260527110000.';
