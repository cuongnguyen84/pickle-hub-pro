-- ============================================================================
-- DUPR RaaS — Match sync status columns on matches (PR4 completion)
-- ----------------------------------------------------------------------------
-- The existing dupr_match_submissions table (20260516030000) is the audit
-- trail. But the social-match UI needs a status flag and the matchCode + the
-- last error directly on the matches row so it can render a badge without
-- JOINing the audit table. Mirror writes happen inside dupr-match-submit.
--
-- Columns added (all nullable; existing rows stay NULL until first submit):
--   - dupr_sync_status         pending | submitted | failed | superseded
--   - dupr_sync_error          DUPR error message captured on last attempt
--   - dupr_sync_attempted_at   timestamp of last attempt (success or fail)
--   - dupr_hashed_match_code   DUPR's 9-char hashedMatchCode
--
-- Existing dupr_match_id / dupr_submitted_at / submitted_to_dupr stay where
-- they are (per PR2-5 prompt: "do NOT add parallel columns").
-- ============================================================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS dupr_sync_status       text,
  ADD COLUMN IF NOT EXISTS dupr_sync_error        text,
  ADD COLUMN IF NOT EXISTS dupr_sync_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS dupr_hashed_match_code text;

DO $$ BEGIN
  ALTER TABLE public.matches
    ADD CONSTRAINT matches_dupr_sync_status_check
    CHECK (dupr_sync_status IS NULL
        OR dupr_sync_status IN ('pending', 'submitted', 'failed', 'superseded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.matches.dupr_sync_status IS
  'NULL = not yet attempted. pending = submit in-flight. submitted = DUPR returned a matchCode. failed = last attempt errored, see dupr_sync_error. superseded = a delete was issued (match still exists locally).';

COMMENT ON COLUMN public.matches.dupr_hashed_match_code IS
  'DUPR''s hashedMatchCode (9-char). Used by the MatchDuprStatus badge to deep-link into the DUPR app.';

-- ─── Index for the admin "find failed submissions" query ───────────────────
CREATE INDEX IF NOT EXISTS matches_dupr_sync_failed_idx
  ON public.matches (dupr_sync_attempted_at DESC)
  WHERE dupr_sync_status = 'failed';

-- Existing RLS on matches already lets the recording user + admins read this
-- row; no additional grants required (status columns ride along on the
-- existing SELECT policy).

-- Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';

-- ─── Verification SELECT (paste in SQL Editor after applying) ──────────────
-- Expected: 4 rows.
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'matches'
--   AND column_name IN ('dupr_sync_status', 'dupr_sync_error',
--                       'dupr_sync_attempted_at', 'dupr_hashed_match_code')
-- ORDER BY column_name;
