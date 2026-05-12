-- ============================================================================
-- Social Events MVP — PR53: user_badges
-- ============================================================================
-- One row per (user, badge_code) tuple. UNIQUE constraint on the pair so
-- `ON CONFLICT DO NOTHING` is the idempotent award path used by the
-- triggers in 20260512150002.
--
-- FK is to auth.users(id), NOT profiles(id) — per Option A: badges only
-- accrue for users who completed Supabase Auth signup. Ghost profiles
-- (phone-only registrants) do not get badges; the trigger filters them
-- out via an EXISTS check on auth.users. Rationale: badges are a
-- retention nudge that should reward the conversion to a real account.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_code  TEXT NOT NULL,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata    JSONB,
  UNIQUE (user_id, badge_code)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id
  ON public.user_badges (user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_earned_at
  ON public.user_badges (earned_at DESC);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_badges_select_public" ON public.user_badges;
CREATE POLICY "user_badges_select_public" ON public.user_badges
  FOR SELECT
  USING (true);

-- INSERT / UPDATE / DELETE intentionally service-role only (no policies).
-- Awards happen via SECURITY DEFINER triggers; the client never writes
-- here directly.

-- ─── GRANTs ─────────────────────────────────────────────────────────────────
GRANT SELECT ON public.user_badges TO anon;
GRANT SELECT ON public.user_badges TO authenticated;

COMMENT ON TABLE public.user_badges IS
  'Per-user earned badges (Option A — auth.users only, ghost profiles excluded). Awarded by AFTER-INSERT/UPDATE triggers on event_registrations + social_event_matches. UNIQUE(user_id, badge_code) makes the award path idempotent. See migration 20260512150000.';
