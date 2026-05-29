-- ============================================================================
-- doubles_elimination_matches DUPR Phase 2 — submit-after-score columns
-- ----------------------------------------------------------------------------
-- 2026-05-29. Mirrors dupr_match_id / dupr_sync_status / dupr_submitted_at
-- columns already present on the `matches` table (PR4 wiring). For doubles
-- elimination we use a leaner set: dupr_submitted (bool) + dupr_match_code
-- (DUPR's returned matchCode) + timestamps + a freeform error string.
--
-- Why a separate column set rather than reusing matches schema:
--   - doubles_elimination_matches is a DIFFERENT table from `matches`
--     (different row shape, different lifecycle, no parent_tournaments link).
--   - dupr-match-submit edge function already mirrors onto `matches` when
--     internal_source='match'. For 'doubles_elim_match' the frontend will
--     read the function response and UPDATE this table directly — keeps
--     the edge function untouched.
-- ============================================================================

ALTER TABLE public.doubles_elimination_matches
  ADD COLUMN IF NOT EXISTS dupr_submitted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.doubles_elimination_matches
  ADD COLUMN IF NOT EXISTS dupr_match_code TEXT;

ALTER TABLE public.doubles_elimination_matches
  ADD COLUMN IF NOT EXISTS dupr_submitted_at TIMESTAMPTZ;

ALTER TABLE public.doubles_elimination_matches
  ADD COLUMN IF NOT EXISTS dupr_submit_error TEXT;

COMMENT ON COLUMN public.doubles_elimination_matches.dupr_submitted IS
  'DUPR Phase 2 (2026-05-29). True when scoring page has successfully POSTed this match result to DUPR via dupr-match-submit (action=create). Idempotent: re-submission attempts are no-ops once true.';

COMMENT ON COLUMN public.doubles_elimination_matches.dupr_match_code IS
  'DUPR Phase 2 (2026-05-29). DUPR-returned matchCode (alphanumeric ~10 char). Persisted so we can later update/delete via the same edge function.';

COMMENT ON COLUMN public.doubles_elimination_matches.dupr_submitted_at IS
  'DUPR Phase 2 (2026-05-29). UTC timestamp of successful DUPR submission.';

COMMENT ON COLUMN public.doubles_elimination_matches.dupr_submit_error IS
  'DUPR Phase 2 (2026-05-29). Last submission error message when dupr_submitted=false but an attempt was made. Null = no attempt yet. Truncated to ~500 chars by the client.';

CREATE INDEX IF NOT EXISTS doubles_elim_matches_dupr_submitted_idx
  ON public.doubles_elimination_matches(dupr_submitted)
  WHERE dupr_submitted = true;
