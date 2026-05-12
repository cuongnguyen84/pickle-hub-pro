-- ============================================================================
-- Social Events MVP — PR53 follow-up: universal profile-level badges (Hướng B)
-- ============================================================================
-- The original PR53 (migration 20260512150000) keyed user_badges on
-- auth.users(id) so only fully-authenticated users could collect
-- badges — the rationale being that ghost players (phone-OTP guests)
-- would be nudged into signing up. After end-to-end testing in prod
-- it's clear that:
--
--   1. Every event registration in the system today creates a ghost
--      profile (phone-OTP-verify + walk-in add are the only paths).
--   2. No ghost → auth-user merge path exists yet — `handle_new_user`
--      blindly inserts a fresh profile keyed on auth.users.id without
--      checking for an existing ghost by phone.
--
-- So Option A bricks the badge feature in practice: zero badges ever
-- award. This migration switches to Option B — badges keyed on
-- profiles.id, so ghosts also collect — and backfills retroactively
-- from completed matches + non-cancelled registrations.
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

-- ─── 1. Reshape user_badges: user_id → profile_id, FK to profiles ──────────

-- Drop the old auth.users FK if it's still there (replay-safe).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'user_badges'
      AND constraint_name = 'user_badges_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_badges DROP CONSTRAINT user_badges_user_id_fkey;
  END IF;
END $$;

-- Rename column. Idempotent — only run when the old column still
-- exists. (We can't simply ADD a `profile_id` column because the
-- old `user_id` already carries the keys we want to preserve.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_badges'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.user_badges RENAME COLUMN user_id TO profile_id;
  END IF;
END $$;

-- Rename the unique constraint + index for clarity. The composite
-- (user_id, badge_code) constraint was auto-named by Postgres; we
-- pin it to a deterministic name now.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_badges_user_id_badge_code_key'
      AND conrelid = 'public.user_badges'::regclass
  ) THEN
    ALTER TABLE public.user_badges
      RENAME CONSTRAINT user_badges_user_id_badge_code_key
      TO user_badges_profile_id_badge_code_key;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_user_badges_user_id'
  ) THEN
    ALTER INDEX public.idx_user_badges_user_id
      RENAME TO idx_user_badges_profile_id;
  END IF;
END $$;

-- Add the new FK to profiles. ON DELETE CASCADE matches the old
-- auth.users FK's semantics.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'user_badges'
      AND constraint_name = 'user_badges_profile_id_fkey'
  ) THEN
    ALTER TABLE public.user_badges
      ADD CONSTRAINT user_badges_profile_id_fkey
      FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── 2. Rewrite the award helper + triggers without the auth guard ──────────
-- The old triggers did a SELECT against auth.users to bail when the
-- player_id wasn't a real user. We drop that lookup so ghost
-- registrants also accumulate badges. Everything else (count + insert
-- + ON CONFLICT DO NOTHING) stays identical.

DROP TRIGGER IF EXISTS trg_award_registration_badges ON public.event_registrations;
DROP TRIGGER IF EXISTS trg_award_match_badges ON public.social_event_matches;
DROP FUNCTION IF EXISTS public.award_registration_badges();
DROP FUNCTION IF EXISTS public.award_match_badges();
DROP FUNCTION IF EXISTS public.award_match_badges_for_player(UUID, UUID, TEXT, TEXT);

-- Helper called from both the trigger AND the backfill block at the
-- bottom of this migration.
CREATE OR REPLACE FUNCTION public.award_player_event_badges(
  p_profile_id UUID,
  p_event_id   UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_count INTEGER;
  v_event       RECORD;
  v_local_hour  INTEGER;
BEGIN
  IF p_profile_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(DISTINCT event_id) INTO v_event_count
  FROM public.event_registrations
  WHERE profile_id = p_profile_id
    AND status <> 'cancelled';

  IF v_event_count = 1 THEN
    INSERT INTO public.user_badges (profile_id, badge_code)
    VALUES (p_profile_id, 'first_event')
    ON CONFLICT (profile_id, badge_code) DO NOTHING;
  END IF;
  IF v_event_count >= 5 THEN
    INSERT INTO public.user_badges (profile_id, badge_code) VALUES (p_profile_id, 'event_5')
    ON CONFLICT (profile_id, badge_code) DO NOTHING;
  END IF;
  IF v_event_count >= 10 THEN
    INSERT INTO public.user_badges (profile_id, badge_code) VALUES (p_profile_id, 'event_10')
    ON CONFLICT (profile_id, badge_code) DO NOTHING;
  END IF;
  IF v_event_count >= 25 THEN
    INSERT INTO public.user_badges (profile_id, badge_code) VALUES (p_profile_id, 'event_25')
    ON CONFLICT (profile_id, badge_code) DO NOTHING;
  END IF;
  IF v_event_count >= 50 THEN
    INSERT INTO public.user_badges (profile_id, badge_code) VALUES (p_profile_id, 'event_50')
    ON CONFLICT (profile_id, badge_code) DO NOTHING;
  END IF;

  -- Night owl: event starts after 21:00 in ICT (UTC+7).
  SELECT start_at INTO v_event FROM public.social_events WHERE id = p_event_id;
  IF v_event.start_at IS NOT NULL THEN
    v_local_hour := EXTRACT(HOUR FROM (v_event.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh'));
    IF v_local_hour >= 21 THEN
      INSERT INTO public.user_badges (profile_id, badge_code)
      VALUES (p_profile_id, 'night_owl')
      ON CONFLICT (profile_id, badge_code) DO NOTHING;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_player_match_badges(
  p_match_id      UUID,
  p_player_id     UUID,
  p_winning_team  TEXT,
  p_on_team       TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_matches_played INTEGER;
  v_wins           INTEGER;
  v_streak         INTEGER;
  v_won_this_match BOOLEAN;
BEGIN
  IF p_player_id IS NULL THEN RETURN; END IF;

  v_won_this_match := (p_winning_team = p_on_team);

  SELECT COUNT(*) INTO v_matches_played
  FROM public.social_event_matches m
  WHERE m.status = 'completed'
    AND (
      m.team_a_player1_id = p_player_id OR m.team_a_player2_id = p_player_id
      OR m.team_b_player1_id = p_player_id OR m.team_b_player2_id = p_player_id
    );

  IF v_matches_played = 1 THEN
    INSERT INTO public.user_badges (profile_id, badge_code)
    VALUES (p_player_id, 'first_match') ON CONFLICT DO NOTHING;
  END IF;
  IF v_matches_played >= 10 THEN
    INSERT INTO public.user_badges (profile_id, badge_code)
    VALUES (p_player_id, 'match_10') ON CONFLICT DO NOTHING;
  END IF;
  IF v_matches_played >= 50 THEN
    INSERT INTO public.user_badges (profile_id, badge_code)
    VALUES (p_player_id, 'match_50') ON CONFLICT DO NOTHING;
  END IF;
  IF v_matches_played >= 100 THEN
    INSERT INTO public.user_badges (profile_id, badge_code)
    VALUES (p_player_id, 'match_100') ON CONFLICT DO NOTHING;
  END IF;

  IF v_won_this_match THEN
    SELECT COUNT(*) INTO v_wins
    FROM public.social_event_matches m
    WHERE m.status = 'completed'
      AND m.winning_team IS NOT NULL
      AND (
        (m.winning_team = 'a' AND (m.team_a_player1_id = p_player_id OR m.team_a_player2_id = p_player_id))
        OR (m.winning_team = 'b' AND (m.team_b_player1_id = p_player_id OR m.team_b_player2_id = p_player_id))
      );
    IF v_wins = 1 THEN
      INSERT INTO public.user_badges (profile_id, badge_code)
      VALUES (p_player_id, 'first_win') ON CONFLICT DO NOTHING;
    END IF;

    v_streak := public.compute_player_win_streak(p_player_id);
    IF v_streak >= 3 THEN
      INSERT INTO public.user_badges (profile_id, badge_code, metadata)
      VALUES (p_player_id, 'win_streak_3', jsonb_build_object('match_id', p_match_id))
      ON CONFLICT (profile_id, badge_code) DO NOTHING;
    END IF;
    IF v_streak >= 5 THEN
      INSERT INTO public.user_badges (profile_id, badge_code, metadata)
      VALUES (p_player_id, 'win_streak_5', jsonb_build_object('match_id', p_match_id))
      ON CONFLICT (profile_id, badge_code) DO NOTHING;
    END IF;
  END IF;
END;
$$;

-- Thin trigger wrappers around the helpers above.

CREATE OR REPLACE FUNCTION public.award_registration_badges_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.award_player_event_badges(NEW.profile_id, NEW.event_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_match_badges_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF OLD.status = 'completed' THEN RETURN NEW; END IF;

  PERFORM public.award_player_match_badges(NEW.id, NEW.team_a_player1_id, NEW.winning_team, 'a');
  PERFORM public.award_player_match_badges(NEW.id, NEW.team_a_player2_id, NEW.winning_team, 'a');
  PERFORM public.award_player_match_badges(NEW.id, NEW.team_b_player1_id, NEW.winning_team, 'b');
  PERFORM public.award_player_match_badges(NEW.id, NEW.team_b_player2_id, NEW.winning_team, 'b');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_registration_badges
  AFTER INSERT ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.award_registration_badges_trg();

CREATE TRIGGER trg_award_match_badges
  AFTER UPDATE ON public.social_event_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.award_match_badges_trg();

-- ─── 3. Backfill existing data ─────────────────────────────────────────────
-- Re-run the award logic for every non-cancelled registration + every
-- already-completed match so the badges feature looks alive immediately
-- after this migration applies. ON CONFLICT DO NOTHING keeps it
-- idempotent across replays.

DO $$
DECLARE
  reg_rec RECORD;
  m_rec   RECORD;
BEGIN
  FOR reg_rec IN
    SELECT profile_id, event_id
    FROM public.event_registrations
    WHERE profile_id IS NOT NULL
      AND status <> 'cancelled'
  LOOP
    PERFORM public.award_player_event_badges(reg_rec.profile_id, reg_rec.event_id);
  END LOOP;

  FOR m_rec IN
    SELECT id, team_a_player1_id, team_a_player2_id,
           team_b_player1_id, team_b_player2_id, winning_team
    FROM public.social_event_matches
    WHERE status = 'completed'
    ORDER BY updated_at ASC
  LOOP
    PERFORM public.award_player_match_badges(m_rec.id, m_rec.team_a_player1_id, m_rec.winning_team, 'a');
    PERFORM public.award_player_match_badges(m_rec.id, m_rec.team_a_player2_id, m_rec.winning_team, 'a');
    PERFORM public.award_player_match_badges(m_rec.id, m_rec.team_b_player1_id, m_rec.winning_team, 'b');
    PERFORM public.award_player_match_badges(m_rec.id, m_rec.team_b_player2_id, m_rec.winning_team, 'b');
  END LOOP;
END $$;

-- ─── 4. EXECUTE grants for the new functions ───────────────────────────────

REVOKE ALL ON FUNCTION public.award_player_event_badges(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.award_player_event_badges(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.award_player_match_badges(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.award_player_match_badges(UUID, UUID, TEXT, TEXT) TO service_role;

COMMENT ON TABLE public.user_badges IS
  'Per-profile earned badges. Universal — ghost profiles included (PR53 follow-up; Hướng B). Awarded by AFTER-INSERT/UPDATE triggers on event_registrations + social_event_matches. UNIQUE(profile_id, badge_code) makes the award path idempotent. See migration 20260512150005.';

COMMENT ON FUNCTION public.award_player_event_badges(UUID, UUID) IS
  'Award registration-side badges for one (profile_id, event_id). Called by the AFTER-INSERT trigger and by the backfill loop in migration 20260512150005.';

COMMENT ON FUNCTION public.award_player_match_badges(UUID, UUID, TEXT, TEXT) IS
  'Award match-completion-side badges for one player slot. Called by the AFTER-UPDATE trigger and by the backfill loop in migration 20260512150005.';
