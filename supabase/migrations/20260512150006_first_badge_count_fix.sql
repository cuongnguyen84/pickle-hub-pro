-- ============================================================================
-- Social Events MVP — PR53 follow-up: backfill-correct "first_*" awards
-- ============================================================================
-- Migration 20260512150005 introduced helpers that gated the
-- `first_event` / `first_match` / `first_win` badges behind
-- `IF v_count = 1`. That works when the trigger fires live (count is
-- exactly 1 the instant the milestone is hit), but the same migration
-- also runs a retroactive backfill against ALL existing rows — at
-- which point a player who has already played multiple matches has
-- count >= 2 by the time the helper is called for any one of their
-- matches, so the `= 1` condition never fires and the badge is
-- silently skipped.
--
-- Verified in prod: 4 ghost players, 2 completed matches, each
-- player in both matches. `first_event` awarded correctly (each
-- player has 1 event registration → count = 1) but `first_match`
-- awarded for ZERO players (each player has 2 matches → count = 2).
-- `first_win` only fired for the subset whose win count happened to
-- equal 1 — the rest were missed by the same logic flaw.
--
-- Fix: drop the `= 1` guards on first_*. Those badges represent
-- "you've earned this milestone at least once" — the ON CONFLICT
-- (profile_id, badge_code) DO NOTHING already enforces idempotency,
-- so always inserting is correct. The "true count" milestones
-- (event_5/10/25/50, match_10/50/100, win_streak_3/5) stay as-is
-- with `>= N` checks since those genuinely need a threshold.
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

-- ─── 1. Rewrite the helpers without the `= 1` guards ───────────────────────

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

  -- The caller only invokes this helper from a registration context,
  -- so the player has at least one registration → first_event has
  -- been earned. Insert unconditionally; ON CONFLICT keeps it
  -- idempotent on replays + on retroactive backfill.
  INSERT INTO public.user_badges (profile_id, badge_code)
  VALUES (p_profile_id, 'first_event')
  ON CONFLICT (profile_id, badge_code) DO NOTHING;

  SELECT COUNT(DISTINCT event_id) INTO v_event_count
  FROM public.event_registrations
  WHERE profile_id = p_profile_id
    AND status <> 'cancelled';

  IF v_event_count >= 5 THEN
    INSERT INTO public.user_badges (profile_id, badge_code)
    VALUES (p_profile_id, 'event_5')
    ON CONFLICT (profile_id, badge_code) DO NOTHING;
  END IF;
  IF v_event_count >= 10 THEN
    INSERT INTO public.user_badges (profile_id, badge_code)
    VALUES (p_profile_id, 'event_10')
    ON CONFLICT (profile_id, badge_code) DO NOTHING;
  END IF;
  IF v_event_count >= 25 THEN
    INSERT INTO public.user_badges (profile_id, badge_code)
    VALUES (p_profile_id, 'event_25')
    ON CONFLICT (profile_id, badge_code) DO NOTHING;
  END IF;
  IF v_event_count >= 50 THEN
    INSERT INTO public.user_badges (profile_id, badge_code)
    VALUES (p_profile_id, 'event_50')
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
  v_streak         INTEGER;
  v_won_this_match BOOLEAN;
BEGIN
  IF p_player_id IS NULL THEN RETURN; END IF;

  v_won_this_match := (p_winning_team = p_on_team);

  -- Caller invokes this helper only from a player slot on a
  -- completed match → first_match earned. Unconditional insert.
  INSERT INTO public.user_badges (profile_id, badge_code)
  VALUES (p_player_id, 'first_match')
  ON CONFLICT (profile_id, badge_code) DO NOTHING;

  SELECT COUNT(*) INTO v_matches_played
  FROM public.social_event_matches m
  WHERE m.status = 'completed'
    AND (
      m.team_a_player1_id = p_player_id OR m.team_a_player2_id = p_player_id
      OR m.team_b_player1_id = p_player_id OR m.team_b_player2_id = p_player_id
    );

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
    -- Same simplification — being inside the won-this-match branch
    -- already means first_win is earned. The previous SELECT-then-
    -- IF-count-equals-1 dance is what dropped test_3 / test_4 in
    -- the prod data when their win count was retroactively >= 1
    -- at the moment the helper saw them.
    INSERT INTO public.user_badges (profile_id, badge_code)
    VALUES (p_player_id, 'first_win') ON CONFLICT DO NOTHING;

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

-- ─── 2. Re-run backfill against existing data ──────────────────────────────
-- Same shape as the backfill in 20260512150005 — replays through the
-- newly-fixed helpers. ON CONFLICT keeps it idempotent against the
-- rows that were already correctly awarded last round.

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
