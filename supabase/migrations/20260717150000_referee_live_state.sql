-- ARCH-04 scoring S2 (2026-07-17): full referee live-state persistence.
-- The shared RefereeScoringScreen persists its complete in-progress state
-- (engine ScoreState + undo history + timeouts + notes, versioned envelope)
-- to the match row so a device switch or reload resumes exactly, and
-- spectators can read serve/rotation/timeout state from the row realtime.
-- Additive + nullable: no backfill, no RLS change (writers already hold
-- UPDATE on these rows via the existing referee/creator policies).
-- Rollback: ALTER TABLE ... DROP COLUMN referee_live_state; (x3)

ALTER TABLE public.quick_table_matches
  ADD COLUMN IF NOT EXISTS referee_live_state jsonb;

ALTER TABLE public.team_match_games
  ADD COLUMN IF NOT EXISTS referee_live_state jsonb;

ALTER TABLE public.doubles_elimination_matches
  ADD COLUMN IF NOT EXISTS referee_live_state jsonb;
