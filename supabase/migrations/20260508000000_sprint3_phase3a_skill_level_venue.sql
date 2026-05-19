-- ============================================================================
-- Sprint 3 Phase 3A — skill_level + favorite_venue_id on profiles
-- ============================================================================
-- Branch: feat/social-sprint-3-phase-3a
-- Date: 2026-05-08
--
-- Onboarding wizard (Sprint 3 Phase 3A) collects:
--   Step 1: skill_level — beginner/intermediate/advanced/pro
--   Step 3: favorite_venue_id — user's home court for community matchmaking
--
-- Phase 3A scaffolding originally tracked these in wizard state only because
-- the columns hadn't been added yet — bug surfaced when Step 1 attempted to
-- persist skill_level. This migration adds both columns so each step's
-- onSubmit can write directly to profiles.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS guards re-runs.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skill_level TEXT
    CHECK (skill_level IS NULL OR skill_level IN (
      'beginner', 'intermediate', 'advanced', 'pro'
    ));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_venue_id UUID
    REFERENCES public.venues(id) ON DELETE SET NULL;

-- Index speeds up "players at this venue" queries planned for Phase 3B+
-- venue-detail pages and the Sprint 5 leaderboard. Partial index keeps
-- bytes minimal — only profiles that actually picked a favorite are listed.
CREATE INDEX IF NOT EXISTS idx_profiles_favorite_venue
  ON public.profiles(favorite_venue_id)
  WHERE favorite_venue_id IS NOT NULL;

-- Reload PostgREST schema cache so the new columns are queryable
-- immediately without a function-runtime restart.
NOTIFY pgrst, 'reload schema';
