-- ============================================================================
-- Team Match (MLP) DUPR integration — Phase 1
-- ----------------------------------------------------------------------------
-- Mirrors the doubles-elimination DUPR pattern (migrations
-- 20260529100000 / 20260529110000). Adds:
--   1. team_match_tournaments: rating_source + optional DUPR range
--   2. team_match_games: per-game DUPR submission mirror columns
--
-- NOTE on enum case (carries the Sprint B/D lesson):
--   rating_source is LOWERCASE 'self' | 'dupr' | 'either'. This is
--   INTENTIONALLY different from the skill_rating_system enum which is
--   UPPERCASE 'DUPR'. Mixing the two caused 22P02 invalid-enum errors in
--   Sprint B. Do NOT "normalize" them.
--
-- Each completed team_match_games row is the DUPR-submittable unit (one
-- game between specific roster players). The submit helper resolves the
-- lineup roster ids → team_match_roster.user_id → profiles.dupr_id and
-- calls dupr-match-submit with internal_source='team_match_game'.
-- That source does NOT trigger the matches-table mirror (only 'match' /
-- 'club_match' do), so the helper writes matchCode back onto the game row
-- directly via the columns added below.
-- ============================================================================

-- ─── 1. team_match_tournaments: DUPR config ────────────────────────────────
ALTER TABLE public.team_match_tournaments
  ADD COLUMN IF NOT EXISTS rating_source TEXT NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS min_dupr_rating NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS max_dupr_rating NUMERIC(3,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_match_tournaments_rating_source_check'
  ) THEN
    ALTER TABLE public.team_match_tournaments
      ADD CONSTRAINT team_match_tournaments_rating_source_check
      CHECK (rating_source IN ('self', 'dupr', 'either'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_match_tournaments_dupr_range_check'
  ) THEN
    ALTER TABLE public.team_match_tournaments
      ADD CONSTRAINT team_match_tournaments_dupr_range_check
      CHECK (
        min_dupr_rating IS NULL
        OR max_dupr_rating IS NULL
        OR min_dupr_rating <= max_dupr_rating
      );
  END IF;
END $$;

COMMENT ON COLUMN public.team_match_tournaments.rating_source IS
  'self = legacy self-report | dupr = DUPR recommended + games auto-submit | either = prefer DUPR, allow self. LOWERCASE — not the uppercase skill_rating_system enum.';

-- ─── 2. team_match_games: DUPR submission mirror ───────────────────────────
ALTER TABLE public.team_match_games
  ADD COLUMN IF NOT EXISTS dupr_submitted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dupr_match_code TEXT,
  ADD COLUMN IF NOT EXISTS dupr_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dupr_submit_error TEXT;

CREATE INDEX IF NOT EXISTS idx_team_match_games_dupr_submitted
  ON public.team_match_games (match_id)
  WHERE dupr_submitted = true;

-- ─── 3. Grants (tables pre-exist with table-level grants from
--        20260513000000_grant_mutations_on_tournament_tables; the new
--        columns inherit table-level UPDATE. Re-affirm + reload cache.) ─────
GRANT SELECT, UPDATE ON public.team_match_games TO authenticated;
GRANT SELECT, UPDATE ON public.team_match_tournaments TO authenticated;

NOTIFY pgrst, 'reload schema';
