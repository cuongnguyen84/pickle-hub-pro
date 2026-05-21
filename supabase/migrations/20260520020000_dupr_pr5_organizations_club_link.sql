-- ============================================================================
-- DUPR RaaS — Organization ↔ DUPR Club linking (PR5)
-- ----------------------------------------------------------------------------
-- Lets a ThePickleHub organization link itself to a DUPR club so matches
-- submitted by org admins/creators get matchSource=CLUB + clubId on DUPR.
--
-- Single-club-per-org (1:1) for now. If a future requirement needs many-to-
-- many, add an `organization_dupr_clubs` table; for the partnership demo a
-- single FK is enough.
--
-- Ownership gate — see docs/dupr-pr2-5-audit.md §4 for rationale:
--   * caller has user_roles.role = 'admin', OR
--   * caller has profiles.organization_id = <org> AND user_roles.role IN
--     ('admin', 'creator').
-- Captured in the RPC user_can_admin_organization(uuid) below so edge fns
-- and RLS can reuse the same check. The RPC is intentionally permissive at
-- this stage — operator may tighten in a follow-up once a proper
-- organization_members table lands.
-- ============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS dupr_club_id    text,
  ADD COLUMN IF NOT EXISTS dupr_club_name  text,
  ADD COLUMN IF NOT EXISTS dupr_club_role  text,
  ADD COLUMN IF NOT EXISTS dupr_linked_at  timestamptz,
  ADD COLUMN IF NOT EXISTS dupr_linked_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_dupr_club_role_check
    CHECK (dupr_club_role IS NULL
        OR dupr_club_role IN ('DIRECTOR', 'ORGANIZER'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.organizations.dupr_club_id IS
  'DUPR club id (numeric stored as text for forward-compat). NULL = no club linked yet. One DUPR club per org for now.';
COMMENT ON COLUMN public.organizations.dupr_club_role IS
  'Role of the user who performed the link (DIRECTOR/ORGANIZER). Used to surface in UI; not used for gating after the link is established.';

-- One DUPR club may only be claimed by one ThePickleHub organization.
-- Partial unique index lets us also support NULL → NULL transitions on
-- unlink without violating uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS organizations_dupr_club_id_unique
  ON public.organizations (dupr_club_id)
  WHERE dupr_club_id IS NOT NULL;

-- ─── RPC: user_can_admin_organization(uuid) ────────────────────────────────
-- True if the calling user can perform admin actions on the organization.
-- See ownership gate comment at top of this file.
CREATE OR REPLACE FUNCTION public.user_can_admin_organization(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = auth.uid()
      AND p.organization_id = p_org_id
      AND ur.role IN ('admin', 'creator')
  );
$$;

COMMENT ON FUNCTION public.user_can_admin_organization(uuid) IS
  'True if the calling user is platform admin, OR is in user_roles {admin,creator} AND belongs to the organization via profiles.organization_id.';

GRANT EXECUTE ON FUNCTION public.user_can_admin_organization(uuid) TO authenticated;

-- ─── RLS on the new columns ────────────────────────────────────────────────
-- The organizations table is presumed publicly readable (it's used for
-- public pages — confirm in operator notes). The new dupr_club_* columns
-- ride along on existing SELECT policies. UPDATE is gated by the RPC above.
--
-- We add an explicit UPDATE policy ONLY for the new columns by allowing
-- authenticated users to UPDATE when user_can_admin_organization returns
-- true. If no UPDATE policy exists on organizations today, this creates
-- one with the narrow scope; if one exists for admins it is a no-op.

DO $$ BEGIN
  ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL; END $$;

DROP POLICY IF EXISTS organizations_admin_update_dupr ON public.organizations;
CREATE POLICY organizations_admin_update_dupr
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (public.user_can_admin_organization(id))
  WITH CHECK (public.user_can_admin_organization(id));

-- Standard grants — anon/authenticated already read most of the
-- organizations table for public pages. We mirror that here for safety.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.organizations TO anon, authenticated;
GRANT UPDATE (dupr_club_id, dupr_club_name, dupr_club_role,
              dupr_linked_at, dupr_linked_by)
  ON public.organizations TO authenticated;

-- Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';

-- ─── Verification SELECT (paste in SQL Editor after applying) ──────────────
-- Expected: 5 rows.
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'organizations'
--   AND column_name LIKE 'dupr_%'
-- ORDER BY column_name;
--
-- Expected: 1 row, with routine_name = 'user_can_admin_organization'.
--
-- SELECT routine_name
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name = 'user_can_admin_organization';
