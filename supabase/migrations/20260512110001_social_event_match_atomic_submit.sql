-- ============================================================================
-- Social Events MVP — PR47 Codex review bug 2 (P1 RACE CONDITION)
-- ============================================================================
-- submit-match-score's player path used a read-then-update pattern: SELECT
-- the match to read the OTHER team's `confirmed_by_team_X` flag, decide
-- locally whether this submission completes the match, then UPDATE with
-- that decision. If team A and team B submit within the same window, both
-- read confirmed_by_other=false and both UPDATE with status=in_progress,
-- leaving the row in a "both teams confirmed but status=in_progress" zombie
-- state.
--
-- Fix: a single atomic UPDATE whose status + winning_team SET clauses
-- inspect the row's CURRENT (committed) state via inline CASE expressions.
-- Postgres row-level locking serializes concurrent UPDATEs on the same row,
-- so the second UPDATE always sees the first one's commit and triggers the
-- completion transition correctly.
--
-- Exposed via a SECURITY DEFINER function so the edge function (running as
-- service_role) can invoke it with a single round-trip. The function lives
-- in the public schema and is grant-revoked from anon/authenticated — only
-- service_role can EXECUTE.
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.social_event_match_player_submit(
  p_match_id     UUID,
  p_team         TEXT,
  p_score_a      INTEGER,
  p_score_b      INTEGER
)
RETURNS TABLE (
  status                TEXT,
  winning_team          TEXT,
  confirmed_by_team_a   BOOLEAN,
  confirmed_by_team_b   BOOLEAN,
  team_a_score          INTEGER,
  team_b_score          INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_team NOT IN ('a', 'b') THEN
    RAISE EXCEPTION 'invalid_team' USING ERRCODE = '22023';
  END IF;
  IF p_score_a IS NULL OR p_score_b IS NULL
     OR p_score_a < 0 OR p_score_b < 0
     OR p_score_a > 99 OR p_score_b > 99 THEN
    RAISE EXCEPTION 'invalid_score' USING ERRCODE = '22023';
  END IF;

  -- Single UPDATE. All SET expressions evaluate against the row's
  -- pre-update column values, which Postgres reads under a row lock
  -- after acquiring it. Concurrent calls serialize: second caller sees
  -- the first one's committed flag and the CASE correctly transitions
  -- status to 'completed'.
  --
  -- The WHERE guard prevents writing to a match that's already completed
  -- (idempotent: a third concurrent caller is a no-op).
  RETURN QUERY
  UPDATE public.social_event_matches m
  SET
    team_a_score = p_score_a,
    team_b_score = p_score_b,
    confirmed_by_team_a = CASE
      WHEN p_team = 'a' THEN true
      ELSE m.confirmed_by_team_a
    END,
    confirmed_by_team_b = CASE
      WHEN p_team = 'b' THEN true
      ELSE m.confirmed_by_team_b
    END,
    status = CASE
      WHEN (p_team = 'a' AND m.confirmed_by_team_b)
        OR (p_team = 'b' AND m.confirmed_by_team_a)
      THEN 'completed'
      ELSE 'in_progress'
    END,
    winning_team = CASE
      WHEN (p_team = 'a' AND m.confirmed_by_team_b)
        OR (p_team = 'b' AND m.confirmed_by_team_a)
      THEN CASE
        WHEN p_score_a > p_score_b THEN 'a'
        WHEN p_score_b > p_score_a THEN 'b'
        ELSE NULL
      END
      ELSE m.winning_team
    END
  WHERE m.id = p_match_id
    AND m.status <> 'completed'
  RETURNING
    m.status,
    m.winning_team,
    m.confirmed_by_team_a,
    m.confirmed_by_team_b,
    m.team_a_score,
    m.team_b_score;
END;
$$;

-- Lock down EXECUTE: only the service role (used by the edge function) may
-- call this. Revoke from PUBLIC first because CREATE FUNCTION grants
-- EXECUTE to PUBLIC by default.
REVOKE ALL ON FUNCTION public.social_event_match_player_submit(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_event_match_player_submit(UUID, TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.social_event_match_player_submit(UUID, TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.social_event_match_player_submit(UUID, TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.social_event_match_player_submit(UUID, TEXT, INTEGER, INTEGER) IS
  'Atomic player score submission. Single UPDATE with inline CASE on confirmed_by_team_* so concurrent A+B submissions serialize correctly. Service role only — invoked from supabase/functions/submit-match-score. See migration 20260512110001.';
