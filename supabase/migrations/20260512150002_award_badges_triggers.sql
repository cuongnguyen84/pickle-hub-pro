-- ============================================================================
-- Social Events MVP — PR53: award_badges triggers
-- ============================================================================
-- Two triggers, two scopes:
--
--   1. After INSERT on event_registrations →
--      first_event, event_5, event_10, event_25, event_50, night_owl
--   2. After UPDATE on social_event_matches (status → 'completed') →
--      first_match, match_10, match_50, match_100, first_win,
--      win_streak_3, win_streak_5  (for each of the 4 players)
--
-- Both helpers run SECURITY DEFINER so they can read auth.users (RLS
-- locked otherwise) + write user_badges (service-role-only). They skip
-- ghost players via an EXISTS check on auth.users — Option A per PR53.
--
-- Idempotent award path: INSERT ... ON CONFLICT (user_id, badge_code)
-- DO NOTHING. Retry-safe; trigger firing twice on the same row is OK.
-- ============================================================================

-- ─── Helper: current win streak for a player ────────────────────────────────
-- Counts the length of the leading run of wins in their completed-match
-- history (most-recent-first by updated_at). Resets at the first loss.
-- Returns 0 when the player has no completed matches.
CREATE OR REPLACE FUNCTION public.compute_player_win_streak(p_player_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_streak INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      CASE
        WHEN (m.winning_team = 'a'
              AND (m.team_a_player1_id = p_player_id OR m.team_a_player2_id = p_player_id))
          OR (m.winning_team = 'b'
              AND (m.team_b_player1_id = p_player_id OR m.team_b_player2_id = p_player_id))
        THEN 'W'
        WHEN (m.winning_team = 'b'
              AND (m.team_a_player1_id = p_player_id OR m.team_a_player2_id = p_player_id))
          OR (m.winning_team = 'a'
              AND (m.team_b_player1_id = p_player_id OR m.team_b_player2_id = p_player_id))
        THEN 'L'
        ELSE 'T'
      END AS result
    FROM public.social_event_matches m
    WHERE m.status = 'completed'
      AND (
        m.team_a_player1_id = p_player_id OR m.team_a_player2_id = p_player_id
        OR m.team_b_player1_id = p_player_id OR m.team_b_player2_id = p_player_id
      )
    ORDER BY m.updated_at DESC
  LOOP
    IF rec.result = 'W' THEN
      v_streak := v_streak + 1;
    ELSE
      -- A loss or tie resets the streak. We could also bail out early
      -- here (RETURN v_streak) but the cursor is fast enough.
      EXIT;
    END IF;
  END LOOP;
  RETURN v_streak;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_player_win_streak(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.compute_player_win_streak(UUID) TO authenticated, service_role;

-- ─── Trigger: registration-side badges ──────────────────────────────────────
-- Fires per inserted event_registrations row. Awards:
--   - first_event (profile's first non-cancelled registration ever)
--   - event_5 / 10 / 25 / 50 (distinct-event milestones)
--   - night_owl (event start_at after 21:00 Asia/Ho_Chi_Minh)

CREATE OR REPLACE FUNCTION public.award_registration_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id     UUID;
  v_event_count INTEGER;
  v_event       RECORD;
  v_local_hour  INTEGER;
BEGIN
  -- Only auth users get badges; ghost profiles silently skip.
  IF NEW.profile_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT u.id INTO v_user_id
  FROM auth.users u
  WHERE u.id = NEW.profile_id;
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Distinct non-cancelled event count for this user.
  SELECT COUNT(DISTINCT event_id) INTO v_event_count
  FROM public.event_registrations
  WHERE profile_id = NEW.profile_id
    AND status <> 'cancelled';

  IF v_event_count = 1 THEN
    INSERT INTO public.user_badges (user_id, badge_code)
    VALUES (v_user_id, 'first_event')
    ON CONFLICT (user_id, badge_code) DO NOTHING;
  END IF;
  IF v_event_count >= 5 THEN
    INSERT INTO public.user_badges (user_id, badge_code) VALUES (v_user_id, 'event_5')
    ON CONFLICT (user_id, badge_code) DO NOTHING;
  END IF;
  IF v_event_count >= 10 THEN
    INSERT INTO public.user_badges (user_id, badge_code) VALUES (v_user_id, 'event_10')
    ON CONFLICT (user_id, badge_code) DO NOTHING;
  END IF;
  IF v_event_count >= 25 THEN
    INSERT INTO public.user_badges (user_id, badge_code) VALUES (v_user_id, 'event_25')
    ON CONFLICT (user_id, badge_code) DO NOTHING;
  END IF;
  IF v_event_count >= 50 THEN
    INSERT INTO public.user_badges (user_id, badge_code) VALUES (v_user_id, 'event_50')
    ON CONFLICT (user_id, badge_code) DO NOTHING;
  END IF;

  -- Night owl: event starts after 21:00 in ICT (UTC+7).
  SELECT start_at INTO v_event FROM public.social_events WHERE id = NEW.event_id;
  IF v_event.start_at IS NOT NULL THEN
    v_local_hour := EXTRACT(HOUR FROM (v_event.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh'));
    IF v_local_hour >= 21 THEN
      INSERT INTO public.user_badges (user_id, badge_code)
      VALUES (v_user_id, 'night_owl')
      ON CONFLICT (user_id, badge_code) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_registration_badges ON public.event_registrations;
CREATE TRIGGER trg_award_registration_badges
  AFTER INSERT ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.award_registration_badges();

-- ─── Trigger: match-completion badges ───────────────────────────────────────
-- Fires on UPDATE where status transitions to 'completed'. For each of
-- the 4 players (skipping nulls + ghosts), awards match-count + win
-- milestones + win-streak badges.

CREATE OR REPLACE FUNCTION public.award_match_badges_for_player(
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
  v_user_id        UUID;
  v_matches_played INTEGER;
  v_wins           INTEGER;
  v_streak         INTEGER;
  v_won_this_match BOOLEAN;
BEGIN
  IF p_player_id IS NULL THEN RETURN; END IF;

  -- Skip ghost — Option A.
  SELECT u.id INTO v_user_id FROM auth.users u WHERE u.id = p_player_id;
  IF v_user_id IS NULL THEN RETURN; END IF;

  v_won_this_match := (p_winning_team = p_on_team);

  -- matches_played = completed matches this player appears in.
  SELECT COUNT(*) INTO v_matches_played
  FROM public.social_event_matches m
  WHERE m.status = 'completed'
    AND (
      m.team_a_player1_id = p_player_id OR m.team_a_player2_id = p_player_id
      OR m.team_b_player1_id = p_player_id OR m.team_b_player2_id = p_player_id
    );

  IF v_matches_played = 1 THEN
    INSERT INTO public.user_badges (user_id, badge_code)
    VALUES (v_user_id, 'first_match') ON CONFLICT DO NOTHING;
  END IF;
  IF v_matches_played >= 10 THEN
    INSERT INTO public.user_badges (user_id, badge_code)
    VALUES (v_user_id, 'match_10') ON CONFLICT DO NOTHING;
  END IF;
  IF v_matches_played >= 50 THEN
    INSERT INTO public.user_badges (user_id, badge_code)
    VALUES (v_user_id, 'match_50') ON CONFLICT DO NOTHING;
  END IF;
  IF v_matches_played >= 100 THEN
    INSERT INTO public.user_badges (user_id, badge_code)
    VALUES (v_user_id, 'match_100') ON CONFLICT DO NOTHING;
  END IF;

  -- Win-only badges only when this match was a win for this player.
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
      INSERT INTO public.user_badges (user_id, badge_code)
      VALUES (v_user_id, 'first_win') ON CONFLICT DO NOTHING;
    END IF;

    v_streak := public.compute_player_win_streak(p_player_id);
    IF v_streak >= 3 THEN
      INSERT INTO public.user_badges (user_id, badge_code, metadata)
      VALUES (v_user_id, 'win_streak_3', jsonb_build_object('match_id', p_match_id))
      ON CONFLICT (user_id, badge_code) DO NOTHING;
    END IF;
    IF v_streak >= 5 THEN
      INSERT INTO public.user_badges (user_id, badge_code, metadata)
      VALUES (v_user_id, 'win_streak_5', jsonb_build_object('match_id', p_match_id))
      ON CONFLICT (user_id, badge_code) DO NOTHING;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_match_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only fire when transitioning INTO 'completed'.
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF OLD.status = 'completed' THEN RETURN NEW; END IF;

  PERFORM public.award_match_badges_for_player(NEW.id, NEW.team_a_player1_id, NEW.winning_team, 'a');
  PERFORM public.award_match_badges_for_player(NEW.id, NEW.team_a_player2_id, NEW.winning_team, 'a');
  PERFORM public.award_match_badges_for_player(NEW.id, NEW.team_b_player1_id, NEW.winning_team, 'b');
  PERFORM public.award_match_badges_for_player(NEW.id, NEW.team_b_player2_id, NEW.winning_team, 'b');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_match_badges ON public.social_event_matches;
CREATE TRIGGER trg_award_match_badges
  AFTER UPDATE ON public.social_event_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.award_match_badges();

COMMENT ON FUNCTION public.compute_player_win_streak(UUID) IS
  'Returns the length of the leading W-run in the player''s completed-match history (sorted by updated_at desc). 0 if no matches. See migration 20260512150002.';

COMMENT ON FUNCTION public.award_registration_badges() IS
  'AFTER INSERT trigger on event_registrations. Awards first_event, event_5/10/25/50, night_owl. Ghost profiles (no auth.users row) silently skip. See migration 20260512150002.';

COMMENT ON FUNCTION public.award_match_badges() IS
  'AFTER UPDATE trigger on social_event_matches. Fires on status→completed; awards match-count + win + streak badges for each of the 4 players. Ghost profiles skip. See migration 20260512150002.';
