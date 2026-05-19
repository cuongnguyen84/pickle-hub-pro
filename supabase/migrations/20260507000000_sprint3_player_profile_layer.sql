-- ============================================================================
-- Sprint 3 Phase 1 — Player Profile + Follow + DUPR foundation
-- ============================================================================
-- Spec: docs picklehub-bet1-spec-v2.md (Tuần 5-6)
-- Branch: feat/social-sprint-3-phase-1
-- Date: 2026-05-07
--
-- Adds DB foundation that Phase 2 (dupr-link / dupr-sync edge functions) and
-- Phase 3 (onboarding wizard, /nguoi-choi/:username PlayerProfile, FollowButton,
-- Settings page) build on.
--
-- IDEMPOTENT: every CREATE/ALTER guarded with IF NOT EXISTS, every CREATE
-- POLICY preceded by DROP POLICY IF EXISTS. Safe to re-run.
--
-- Scope (Phase 1, schema only):
--   1. profiles ALTER — onboarding state + DUPR ingest meta
--   2. dupr_rating_history — snapshot table for 30-day rating chart
--   3. dupr_sync_runs — internal ops log for the daily DUPR scrape cron
--
-- Out of scope (Phase 2/3 follow-ups):
--   - Edge functions, cron schedule, UI, types regen
-- ============================================================================

-- ─── 1. profiles ALTER — onboarding + DUPR ingest meta ─────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- DUPR scrape source-of-truth caching (Phase 2 dupr-link/dupr-sync writes here).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dupr_profile_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dupr_last_error TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dupr_last_attempt_at TIMESTAMPTZ;

-- Partial index: lets <RequireOnboarding> route guard cheap-check incomplete users.
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_incomplete
  ON public.profiles(id) WHERE onboarding_completed_at IS NULL;

-- ─── 2. dupr_rating_history — 30-day chart snapshots ──────────────────────
-- Public read so /nguoi-choi/:username SSR + bot prerender can fetch series
-- without auth. INSERT confined to service_role (Phase 2 dupr-sync edge
-- function) — not granted to authenticated.
CREATE TABLE IF NOT EXISTS public.dupr_rating_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source       TEXT NOT NULL DEFAULT 'dupr_scrape'
    CHECK (source IN ('dupr_scrape', 'manual', 'match_inferred')),
  dupr_singles NUMERIC(4,2),
  dupr_doubles NUMERIC(4,2),
  recorded_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (profile_id, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_dupr_history_profile_time
  ON public.dupr_rating_history(profile_id, recorded_at DESC);

ALTER TABLE public.dupr_rating_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dupr_history_public_read" ON public.dupr_rating_history;

CREATE POLICY "dupr_history_public_read"
  ON public.dupr_rating_history FOR SELECT USING (TRUE);

GRANT SELECT ON public.dupr_rating_history TO anon, authenticated;
-- INSERT/UPDATE/DELETE only via service_role (RLS bypass).

-- ─── 3. dupr_sync_runs — internal ops log ─────────────────────────────────
-- Tracked by the Phase 2 daily cron (03:00 UTC+7). LIMIT 100 profiles/run,
-- so a single row records a "batch attempt" with totals + duration + error
-- summary. RLS enabled with NO policies = deny-all for anon + authenticated;
-- only service_role can read/write. Admins inspect via Supabase Studio.
CREATE TABLE IF NOT EXISTS public.dupr_sync_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  profiles_total  INTEGER NOT NULL DEFAULT 0,
  profiles_ok     INTEGER NOT NULL DEFAULT 0,
  profiles_failed INTEGER NOT NULL DEFAULT 0,
  duration_ms     INTEGER,
  error_summary   TEXT
);

CREATE INDEX IF NOT EXISTS idx_dupr_sync_runs_started
  ON public.dupr_sync_runs(started_at DESC);

ALTER TABLE public.dupr_sync_runs ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies — deny-by-default for anon + authenticated.
-- service_role bypasses RLS to INSERT/UPDATE from cron edge function.

-- ─── Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
