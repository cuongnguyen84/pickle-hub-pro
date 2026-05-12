-- ============================================================================
-- Social Events MVP — PR53 Codex review bug 2
-- ============================================================================
-- `/u/:slug` clients pass the dashless first 8 (or 12 in the collision
-- fallback) hex chars of the profile UUID. The lookup was running
--
--   .filter("id", "ilike", `${slug}%`)
--
-- against `profiles.id`, which is stored WITH dashes — so an 8-char
-- slug accidentally worked (the first 8 hex chars precede the first
-- dash) but a 12-char slug never matched because the dash at position
-- 9 doesn't appear in the slug.
--
-- Fix: materialize the slug as its own column on profiles, indexed for
-- O(log n) lookup. Trigger keeps it in sync on insert (id is immutable
-- so update doesn't apply). 12-char prefix gives 16^12 ≈ 2.8 × 10^14
-- distinct values — effectively zero collision probability at our scale.
--
-- The client switches from a substring-match on id to a plain equals
-- on profile_slug; the 8-char lookup case becomes `like '<slug>%'`
-- (still indexable as a prefix search).
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_slug TEXT;

-- Backfill every existing row. `LEFT(REPLACE(id::text, '-', ''), 12)`
-- mirrors the JS `profileIdToSlug` helper output extended to 12 chars
-- to support the collision fallback (8-char prefix is also derivable
-- from this via LIKE prefix match).
UPDATE public.profiles
SET profile_slug = LEFT(REPLACE(id::text, '-', ''), 12)
WHERE profile_slug IS NULL;

-- After backfill, lock the column shape — non-null going forward.
ALTER TABLE public.profiles
  ALTER COLUMN profile_slug SET NOT NULL;

-- Slugs are derived deterministically from id so they're already
-- unique — make the index enforce that.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_profile_slug_idx
  ON public.profiles (profile_slug);

-- ─── Keep-in-sync trigger ───────────────────────────────────────────────
-- id is immutable in our model (FK to auth.users, no UPDATE path) but
-- we still wire BEFORE-INSERT so any future ghost-profile insert (e.g.
-- phone-otp-verify, walk-in RPC) doesn't need to manually compute the
-- slug — the trigger fills it from NEW.id.

CREATE OR REPLACE FUNCTION public.tg_profiles_set_profile_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.profile_slug IS NULL THEN
    NEW.profile_slug := LEFT(REPLACE(NEW.id::text, '-', ''), 12);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_profile_slug ON public.profiles;
CREATE TRIGGER trg_profiles_set_profile_slug
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_profiles_set_profile_slug();

COMMENT ON COLUMN public.profiles.profile_slug IS
  'First 12 hex chars of the profile UUID with dashes removed — used as the path component for /u/:slug. Auto-filled on INSERT via trigger; deterministic from id so the unique index is implicit. See migration 20260512150004.';
