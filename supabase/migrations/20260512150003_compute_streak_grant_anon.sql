-- ============================================================================
-- Social Events MVP — PR53 Codex review bug 1
-- ============================================================================
-- /u/:slug is a public route — anonymous visitors hit
-- compute_player_win_streak via supabase.rpc() to fill the "current
-- streak" stat card. The original GRANT in 20260512150002 only allowed
-- `authenticated` + `service_role`, so anon requests came back with a
-- permission error and the UI silently rendered 0. Extend the grant to
-- `anon` so the public profile page shows the real value.
--
-- The function reads `social_event_matches` + uses `SECURITY DEFINER`
-- so RLS on the underlying table isn't a concern; the only thing this
-- exposes is a single integer derived from already-public match data.
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.compute_player_win_streak(UUID) TO anon;
