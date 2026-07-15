-- ============================================================================
-- SECURITY C1 (2026-07-06): close mass PII exposure on public.profiles
-- ----------------------------------------------------------------------------
-- The SELECT policies "profiles_authenticated_view_all" (TO authenticated
-- USING TRUE, migration 20260504100000) and "Anon can view basic profile info"
-- (TO anon USING TRUE, migration 20260123092516) let ANY caller SELECT every
-- column of every row of profiles — including email, phone, contact_email and
-- zalo_user_id. Any logged-in user (and, via the anon policy + the public
-- anon key, potentially any anonymous caller) could dump the full contact
-- book of ~1669 users:
--     supabase.from('profiles').select('id,email,phone').limit(2000)
--
-- RLS is ROW-level and cannot hide COLUMNS, so we enforce this at the column
-- privilege level: revoke the blanket table SELECT and re-GRANT SELECT only on
-- the NON-PII columns. Broad row visibility (needed by player search, @mentions,
-- club rosters, chat, live-viewer display) is preserved; the four PII columns
-- become unreadable by the anon / authenticated roles.
--
-- Legitimate cross-user email/phone access is served by SECURITY DEFINER RPCs
-- (below), each with explicit gating (admin, table-organizer, or non-returning
-- phone match). Own email/phone come from the auth session (auth.users), not
-- from the profiles table.
--
-- NOTE: service_role (used by edge functions) is unaffected — it bypasses
-- column privileges — so add-registration-direct / invite-team-to-tournament /
-- phone-otp-verify / match-proposal continue to work unchanged.
-- ============================================================================

-- ─── 1. Column-level lockdown ────────────────────────────────────────────────
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;

-- Re-grant SELECT on every NON-PII column. This list mirrors the generated
-- src/integrations/supabase/types.ts Row (2026-07-06) MINUS the four PII
-- columns: email, phone, contact_email, zalo_user_id.
--
-- ⚠️ MAINTENANCE: when you ADD a column to profiles, add it here too (unless
--    it is itself PII). A column not listed here becomes unreadable by the
--    frontend. Keep this in sync with the profiles schema.
-- Build the grant from the columns that exist in this schema revision. This
-- keeps fresh-schema replay compatible with production-only historical fields.
DO $$
DECLARE
  column_name TEXT;
BEGIN
  FOR column_name IN
    SELECT c.column_name
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'profiles'
      AND c.column_name NOT IN ('email', 'phone', 'contact_email', 'zalo_user_id')
  LOOP
    EXECUTE format(
      'GRANT SELECT (%I) ON public.profiles TO anon, authenticated',
      column_name
    );
  END LOOP;
END $$;

-- ─── 2. search_players: partner search, now phone-aware + DEFINER ────────────
-- Was plain SQL (ran as caller). After lockdown the caller can no longer read
-- phone, so the "find partner by phone" branch would break. Make it SECURITY
-- DEFINER and match phone INTERNALLY — phone is used only in the WHERE clause,
-- never returned. Only exact phone matches (so it cannot be used to enumerate).
CREATE OR REPLACE FUNCTION public.search_players(
  p_query      TEXT,
  p_limit      INT DEFAULT 10,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
  username      TEXT,
  display_name  TEXT,
  avatar_url    TEXT,
  city          TEXT,
  dupr_doubles  NUMERIC,
  is_verified   BOOLEAN,
  is_ghost      BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.username, p.display_name, p.avatar_url, p.city,
    p.dupr_doubles, p.is_verified, p.is_ghost
  FROM public.profiles p
  WHERE p.username IS NOT NULL
    AND (p_exclude_id IS NULL OR p.id != p_exclude_id)
    AND (
      p.username      ILIKE p_query || '%'
      OR p.display_name ILIKE '%' || p_query || '%'
      -- Exact phone match only (query must look like a phone number).
      OR (p_query ~ '^\+?[0-9]{6,15}$' AND p.phone = p_query)
    )
  ORDER BY
    (p.dupr_doubles IS NOT NULL) DESC,
    p.is_verified DESC,
    p.is_ghost ASC,
    p.dupr_doubles DESC NULLS LAST,
    p.username ASC
  LIMIT GREATEST(LEAST(p_limit, 50), 1);
$$;
GRANT EXECUTE ON FUNCTION public.search_players(TEXT, INT, UUID) TO anon, authenticated;

-- ─── 3. find_profile_by_phone: ghost-dedup lookup (no email/phone returned) ──
-- Used when creating a ghost profile to auto-select an existing player with the
-- same phone. Returns only safe display columns; matches phone internally.
CREATE OR REPLACE FUNCTION public.find_profile_by_phone(p_phone TEXT)
RETURNS TABLE (
  id            UUID,
  username      TEXT,
  display_name  TEXT,
  avatar_url    TEXT,
  dupr_doubles  NUMERIC,
  is_ghost      BOOLEAN,
  city          TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.dupr_doubles, p.is_ghost, p.city
  FROM public.profiles p
  WHERE p_phone IS NOT NULL AND p_phone <> '' AND p.phone = p_phone
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.find_profile_by_phone(TEXT) TO authenticated;

-- ─── 4. admin_get_profile_emails: admin-only id → email map ──────────────────
CREATE OR REPLACE FUNCTION public.admin_get_profile_emails(p_ids UUID[])
RETURNS TABLE (id UUID, email TEXT, display_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.display_name
  FROM public.profiles p
  WHERE public.is_admin() AND p.id = ANY(p_ids);
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_profile_emails(UUID[]) TO authenticated;

-- ─── 5. admin_search_profiles: admin-only search incl. email ─────────────────
CREATE OR REPLACE FUNCTION public.admin_search_profiles(
  p_query TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id              UUID,
  email           TEXT,
  display_name    TEXT,
  username        TEXT,
  avatar_url      TEXT,
  organization_id UUID,
  created_at      TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.display_name, p.username, p.avatar_url,
         p.organization_id, p.created_at
  FROM public.profiles p
  WHERE public.is_admin()
    AND (
      p_query IS NULL OR p_query = ''
      OR p.email        ILIKE '%' || p_query || '%'
      OR p.display_name ILIKE '%' || p_query || '%'
    )
  ORDER BY p.created_at DESC
  LIMIT GREATEST(LEAST(p_limit, 500), 1);
$$;
GRANT EXECUTE ON FUNCTION public.admin_search_profiles(TEXT, INT) TO authenticated;

-- ─── 6. admin_lookup_profiles_by_email: admin push audience resolver ─────────
CREATE OR REPLACE FUNCTION public.admin_lookup_profiles_by_email(p_emails TEXT[])
RETURNS TABLE (id UUID, email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email
  FROM public.profiles p
  WHERE public.is_admin() AND p.email = ANY(p_emails);
$$;
GRANT EXECUTE ON FUNCTION public.admin_lookup_profiles_by_email(TEXT[]) TO authenticated;

-- ─── 7. get_table_registration_emails: organizer-only registrant emails ──────
-- The BTC/creator of a quick_table needs registrant contact emails. Gated to
-- the table's creator (quick_tables.creator_user_id) or an admin.
CREATE OR REPLACE FUNCTION public.get_table_registration_emails(p_table_id UUID)
RETURNS TABLE (user_id UUID, email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.user_id, p.email
  FROM public.quick_table_registrations r
  JOIN public.profiles p ON p.id = r.user_id
  WHERE r.table_id = p_table_id
    AND EXISTS (
      SELECT 1 FROM public.quick_tables t
      WHERE t.id = p_table_id
        AND (t.creator_user_id = auth.uid() OR public.is_admin())
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_table_registration_emails(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
