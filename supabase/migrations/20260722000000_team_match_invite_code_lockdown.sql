-- ============================================================================
-- SECURITY (2026-07-22): lock down team_match_teams.invite_code
-- ----------------------------------------------------------------------------
-- The SELECT policy "Teams are publicly viewable" (USING (true), migration
-- 20260107133349) plus the blanket table-level SELECT grant let ANY caller —
-- including anonymous ones via the public anon key — read invite_code for
-- every team:
--     supabase.from('team_match_teams').select('invite_code')
-- An invite code is a join secret: a stranger who reads it can add themselves
-- to someone else's roster. Verified live on prod 2026-07-21.
--
-- RLS is ROW-level and cannot hide COLUMNS, so we enforce this at the column
-- privilege level (same pattern as 20260706120000_profiles_pii_column_lockdown):
-- revoke the blanket table SELECT and re-GRANT SELECT on every column EXCEPT
-- invite_code. Public row visibility (team lists, standings, the /tournaments
-- registration-count badge) is preserved.
--
-- Deliberately NOT revoked (cross-vendor panel verdict, proposal
-- rls-anon-select-hardening): payment_status and captain_user_id are named in
-- queries hardcoded into installed native iOS binaries
-- (apple/.../TeamMatchRepository.swift) — Postgres requires SELECT privilege on
-- every referenced column (including WHERE), so revoking them would break every
-- installed app with no remediation path. They are low-sensitivity (bare UUID /
-- coarse status; PII already locked at the profiles layer).
--
-- No RPC replaces invite_code reads: the only client reader was dead code
-- (useTeamByInviteCode, 0 callers) and the copy-invite-code button copied a
-- code no flow consumes. Both are deleted in the same PR. The live invite path
-- is the invite-team-to-tournament edge function (service_role — bypasses
-- column privileges, unaffected).
--
-- ⚠️ APPLY ORDER (approved runbook): apply this ONLY AFTER the web deploy that
-- narrows select('*') is confirmed live. Old bundles select('*') on this table
-- and the whole query 42501s once a column is revoked.
--
-- Rollback: GRANT SELECT (invite_code) ON public.team_match_teams
--           TO anon, authenticated;  (restores the leak, seconds).
-- ============================================================================

REVOKE SELECT ON public.team_match_teams FROM anon;
REVOKE SELECT ON public.team_match_teams FROM authenticated;

-- Re-grant SELECT on every column except invite_code. Built from the live
-- schema so fresh-schema replay stays compatible with any prod-only columns.
--
-- ⚠️ MAINTENANCE: a new column on team_match_teams is granted automatically by
--    this pattern ONLY when this migration replays (fresh schemas / CI). On
--    prod, ADDing a column later requires its own
--    GRANT SELECT (new_col) ON public.team_match_teams TO anon, authenticated;
--    unless the column is itself secret.
DO $$
DECLARE
  column_name TEXT;
BEGIN
  FOR column_name IN
    SELECT c.column_name
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'team_match_teams'
      AND c.column_name <> 'invite_code'
  LOOP
    EXECUTE format(
      'GRANT SELECT (%I) ON public.team_match_teams TO anon, authenticated',
      column_name
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
