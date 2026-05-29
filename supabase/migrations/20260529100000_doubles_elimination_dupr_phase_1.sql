-- ============================================================================
-- doubles_elimination_* DUPR Phase 1 — Setup + Seeding
-- ----------------------------------------------------------------------------
-- 2026-05-29. Adds DUPR rating enforcement + per-player profile link +
-- pre-computed DUPR avg to enable Auto-seed by DUPR in BracketSetupDialog.
--
-- Decisions (council 4-voice review 2026-05-29):
--   - Rating source ENUM is TEXT + CHECK (lowercase 'self'/'dupr'/'either').
--     This is INTENTIONALLY DIFFERENT from skill_rating_system enum (uppercase
--     'DUPR'). The lowercase here matches quick_tables.rating_source pattern
--     (Sprint B1.1). DO NOT mix cases — frontend MUST send lowercase.
--   - player1_user_id / player2_user_id are NULLABLE. Legacy text-only teams
--     remain valid; new teams can link to profiles for DUPR seed + future
--     dupr-match-submit. Dual-mode UI required.
--   - dupr_avg_rating + dupr_seed_source pre-computed at seed-time so the
--     bracket renders without re-fetching DUPR for every paint.
--   - Backfill: all existing tournaments -> 'self', all existing teams ->
--     dupr_seed_source='none'. Zero downtime.
-- ============================================================================

-- --- doubles_elimination_tournaments ----------------------------------------
ALTER TABLE public.doubles_elimination_tournaments
  ADD COLUMN IF NOT EXISTS rating_source TEXT
    NOT NULL DEFAULT 'self'
    CHECK (rating_source IN ('self', 'dupr', 'either'));

ALTER TABLE public.doubles_elimination_tournaments
  ADD COLUMN IF NOT EXISTS min_dupr_rating NUMERIC(3, 2)
    CHECK (min_dupr_rating IS NULL OR (min_dupr_rating >= 0 AND min_dupr_rating <= 8));

ALTER TABLE public.doubles_elimination_tournaments
  ADD COLUMN IF NOT EXISTS max_dupr_rating NUMERIC(3, 2)
    CHECK (max_dupr_rating IS NULL OR (max_dupr_rating >= 0 AND max_dupr_rating <= 8));

-- Cross-field sanity: if both set, min <= max.
ALTER TABLE public.doubles_elimination_tournaments
  DROP CONSTRAINT IF EXISTS doubles_elim_dupr_range_ck;
ALTER TABLE public.doubles_elimination_tournaments
  ADD CONSTRAINT doubles_elim_dupr_range_ck
  CHECK (
    min_dupr_rating IS NULL
    OR max_dupr_rating IS NULL
    OR min_dupr_rating <= max_dupr_rating
  );

COMMENT ON COLUMN public.doubles_elimination_tournaments.rating_source IS
  'DUPR Phase 1 (2026-05-29). How player rating is sourced. self=text only (legacy default, no DUPR). dupr=team must link 2 profiles with valid DUPR doubles, organizer search via DuprUserSearch. either=hybrid, prefer DUPR if available, fallback text. Lowercase enum — DO NOT mix with skill_rating_system (uppercase).';

COMMENT ON COLUMN public.doubles_elimination_tournaments.min_dupr_rating IS
  'DUPR Phase 1 (2026-05-29). Optional lower bound team avg DUPR. Inclusive. Null = no lower bound. Only meaningful when rating_source != self.';

COMMENT ON COLUMN public.doubles_elimination_tournaments.max_dupr_rating IS
  'DUPR Phase 1 (2026-05-29). Optional upper bound team avg DUPR. Inclusive. Null = no upper bound. Only meaningful when rating_source != self.';

-- --- doubles_elimination_teams ----------------------------------------------
ALTER TABLE public.doubles_elimination_teams
  ADD COLUMN IF NOT EXISTS player1_user_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.doubles_elimination_teams
  ADD COLUMN IF NOT EXISTS player2_user_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.doubles_elimination_teams
  ADD COLUMN IF NOT EXISTS dupr_avg_rating NUMERIC(3, 2)
    CHECK (dupr_avg_rating IS NULL OR (dupr_avg_rating >= 0 AND dupr_avg_rating <= 8));

ALTER TABLE public.doubles_elimination_teams
  ADD COLUMN IF NOT EXISTS dupr_seed_source TEXT
    NOT NULL DEFAULT 'none'
    CHECK (dupr_seed_source IN ('exact', 'approx', 'none'));

COMMENT ON COLUMN public.doubles_elimination_teams.player1_user_id IS
  'DUPR Phase 1 (2026-05-29). Optional link to profiles.id for player1. Nullable: legacy teams have player1_name TEXT only. When set, enables dupr-match-submit Phase 2 + profile avatar/name in OG renders.';

COMMENT ON COLUMN public.doubles_elimination_teams.player2_user_id IS
  'DUPR Phase 1 (2026-05-29). Optional link to profiles.id for player2. Same semantics as player1_user_id.';

COMMENT ON COLUMN public.doubles_elimination_teams.dupr_avg_rating IS
  'DUPR Phase 1 (2026-05-29). Pre-computed (player1.dupr_doubles + player2.dupr_doubles) / 2 at seed time. Cached so bracket rendering does not re-fetch profiles. Null when no DUPR available.';

COMMENT ON COLUMN public.doubles_elimination_teams.dupr_seed_source IS
  'DUPR Phase 1 (2026-05-29). Provenance of dupr_avg_rating. exact=both players had dupr_doubles. approx=at least one player used dupr_singles fallback. none=no DUPR data (default for legacy + manual-only teams).';

-- Lookup indexes for organizer dashboard ("my players in tournaments") and
-- future dupr-match-submit lookups.
CREATE INDEX IF NOT EXISTS doubles_elim_teams_player1_user_id_idx
  ON public.doubles_elimination_teams(player1_user_id)
  WHERE player1_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS doubles_elim_teams_player2_user_id_idx
  ON public.doubles_elimination_teams(player2_user_id)
  WHERE player2_user_id IS NOT NULL;
