-- ============================================================================
-- DUPR RaaS — Match submission tracking (PR4)
-- ----------------------------------------------------------------------------
-- Maps internal matches to the matchCode returned by DUPR's
-- POST /match/v1.0/create. Required for the update + delete lifecycle —
-- DUPR keys those operations on matchCode, not our internal id.
--
-- `identifier` is the deterministic string we sent to DUPR
-- (`tph:<source>:<internal_id>`). Unique per (env, source, internal_id)
-- so re-submits don't double up.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dupr_match_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment         text NOT NULL CHECK (environment IN ('uat', 'prod')),
  internal_source     text NOT NULL,    -- 'flex' | 'doubles' | 'team' | 'quick' | 'manual'
  internal_match_id   text NOT NULL,    -- our row id (uuid or numeric, stringified)
  identifier          text NOT NULL,    -- what we sent to DUPR (== `tph:<src>:<id>`)
  match_code          text NOT NULL,    -- DUPR matchCode (10-digit)
  hashed_match_code   text,             -- DUPR hashedMatchCode (9-char)
  submitted_by        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  club_id             bigint,           -- NULL for matchSource=PARTNER
  match_format        text NOT NULL CHECK (match_format IN ('SINGLES', 'DOUBLES')),
  match_date          date NOT NULL,
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  last_updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  raw_request         jsonb,
  raw_response        jsonb,
  UNIQUE (environment, internal_source, internal_match_id),
  UNIQUE (environment, identifier),
  UNIQUE (environment, match_code)
);

COMMENT ON TABLE public.dupr_match_submissions IS
  'Tracks every match pushed to DUPR via POST /match/v1.0/create. Holds the matchCode needed for update + delete. deleted_at != null means we issued a DELETE on DUPR side (row kept for audit).';

CREATE INDEX IF NOT EXISTS dupr_match_submissions_submitter_idx
  ON public.dupr_match_submissions (submitted_by)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS dupr_match_submissions_internal_idx
  ON public.dupr_match_submissions (internal_source, internal_match_id);

ALTER TABLE public.dupr_match_submissions ENABLE ROW LEVEL SECURITY;

-- Submitter can read their own. Admins read all (handled by role-based RPC
-- elsewhere). No client writes — edge functions use service_role.
DROP POLICY IF EXISTS dupr_match_submissions_self_read
  ON public.dupr_match_submissions;
CREATE POLICY dupr_match_submissions_self_read
  ON public.dupr_match_submissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = submitted_by);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.dupr_match_submissions TO authenticated;

NOTIFY pgrst, 'reload schema';
