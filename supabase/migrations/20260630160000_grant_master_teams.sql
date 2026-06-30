-- ============================================================================
-- Schema drift fix — GRANT INSERT/UPDATE/DELETE on master_teams tables
-- ============================================================================
-- Same root cause as 20260513000000_grant_mutations_on_tournament_tables.sql:
-- RLS policies for INSERT/UPDATE/DELETE exist and are correct, but the
-- table-level GRANT for `authenticated` only included SELECT. PostgREST checks
-- privileges BEFORE RLS, so authenticated mutations fail with PostgreSQL error
-- 42501 ("permission denied for table master_teams"), surfacing as HTTP 403.
--
-- master_teams + master_team_roster (added 2026-01-08) were missed by the
-- 2026-05-13 remediation. Captain "Create team" registration hits this on the
-- master_teams INSERT. anon stays SELECT-only. GRANT is idempotent.
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_team_roster TO authenticated;

NOTIFY pgrst, 'reload schema';
