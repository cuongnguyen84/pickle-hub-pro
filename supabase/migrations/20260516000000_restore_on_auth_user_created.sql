-- ============================================================================
-- Restore on_auth_user_created trigger + backfill missing profile rows
-- ----------------------------------------------------------------------------
-- Trigger `on_auth_user_created` was created in migration 20251221153808
-- (first schema migration) but is missing from the live DB — likely dropped
-- by a Supabase platform migration that recreated auth.users.
--
-- Symptom: 69 rows in auth.users have no matching public.profiles row.
-- When the affected user signs in and the SPA queries `profiles.id=eq.<uuid>`
-- with `.single()`, PostgREST returns 406 PGRST116 and the SPA enters a
-- retry loop (observed on testuser101@picklehub.test, 2026-05-16).
--
-- Fix:
--   1. Re-create the trigger function (idempotent CREATE OR REPLACE).
--   2. Attach the trigger to auth.users (DROP + CREATE for replay safety).
--   3. Backfill profile rows for every auth.users row missing one.
--      profile_slug is auto-filled by trg_profiles_set_profile_slug
--      (migration 20260512150004). user_roles defaults to 'viewer'.
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      SPLIT_PART(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Backfill missing profiles ──────────────────────────────────────────────
INSERT INTO public.profiles (id, email, display_name)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data ->> 'display_name',
    SPLIT_PART(u.email, '@', 1)
  )
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'viewer'
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

NOTIFY pgrst, 'reload schema';
