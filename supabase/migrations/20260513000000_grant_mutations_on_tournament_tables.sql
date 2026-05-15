-- ============================================================================
-- Schema drift fix — GRANT INSERT/UPDATE/DELETE on tournament feature tables
-- ============================================================================
-- Root cause: RLS policies for INSERT/UPDATE/DELETE exist and are correct on
-- all 22 tables below, but table-level GRANTs only included SELECT for the
-- `authenticated` role. PostgREST enforces privileges BEFORE evaluating RLS,
-- so any authenticated mutation fails immediately with PostgreSQL error 42501
-- (permission denied), surfacing as HTTP 403 to the client — even when the
-- corresponding RLS policy would have allowed the row.
--
-- Pattern confirmed across 3 feature schemas: flex, doubles_elimination,
-- team_match, and parent_tournaments. See docs/schema-drift-audit-2026-05.md
-- for the full remediation record.
--
-- Fix applied manually to prod (ajvlcamxemgbxduhiqrl) on 2026-05-13 via
-- Supabase SQL Editor. This migration commits the same statements to git so
-- the repo stays in sync with production.
--
-- anon role: keeps SELECT-only (no change). Only `authenticated` is affected.
-- GRANT is idempotent — safe to re-run.
-- ============================================================================

-- ─── Flex (9 tables) ──────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flex_tournaments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flex_players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flex_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flex_group_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flex_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flex_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flex_team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flex_player_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flex_pair_stats TO authenticated;

-- ─── Doubles elimination (4 tables) ───────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doubles_elimination_tournaments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doubles_elimination_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doubles_elimination_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doubles_elimination_referees TO authenticated;

-- ─── Team match (8 tables) ────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_match_tournaments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_match_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_match_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_match_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_match_games TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_match_game_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_match_roster TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_match_referees TO authenticated;

-- ─── Other (1 table) ──────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_tournaments TO authenticated;

NOTIFY pgrst, 'reload schema';
