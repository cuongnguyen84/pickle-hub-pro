-- ============================================================================
-- DUPR RaaS — Hotfix: GRANT EXECUTE entitlement + club RPCs to service_role
-- ----------------------------------------------------------------------------
-- Migration 20260516050000 (dupr_security_hardening) did:
--   REVOKE ALL ON FUNCTION ... FROM public, anon, authenticated;
--   -- service_role retains EXECUTE via default-privileges.
--
-- The comment was wrong. Default privileges only apply to NEW objects, not to
-- existing functions after REVOKE. service_role had ZERO execute on these
-- two helpers, so every call to `dupr_user_has_entitlement_for` from the
-- edge function (dupr-match-submit / dupr-event-eligibility uses service-
-- role client) errored out silently — supabase-js wrapped it as a generic
-- non-2xx, the function treated the RPC error as "false", and marked every
-- player as missing BASIC_L1. UI displayed `players_missing_basic_l1` even
-- for users whose entitlement row was fresh + had BASIC_L1.
--
-- Diagnosed 2026-05-22 during DUPR partnership demo prep when a working
-- testuser101 (BASIC_L1 cached) was unexpectedly rejected. Verified by
-- inspecting pg_proc.proacl: had `postgres=X/postgres` only — service_role
-- absent.
--
-- This migration backfills the explicit GRANT so a fresh `supabase db reset`
-- yields the same DB state we ran in prod.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.dupr_user_has_entitlement_for(uuid, text, text)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.dupr_user_can_submit_club_matches_for(uuid, bigint)
  TO service_role;

NOTIFY pgrst, 'reload schema';

-- ─── Verification SELECT (paste in SQL Editor after applying) ──────────────
-- Expected: both rows have 'service_role=X/postgres' in proacl.
--
-- SELECT proname, proacl
-- FROM pg_proc
-- WHERE proname IN ('dupr_user_has_entitlement_for',
--                   'dupr_user_can_submit_club_matches_for');
