-- ARCH-04 scoring S3c (2026-07-17): spectator realtime + takeover detection.
-- quick_table_matches and doubles_elimination_matches were NEVER in the
-- supabase_realtime publication — MatchScoring's existing spectator
-- subscription has been silently dead (the known one-dead-binding gotcha).
-- team_match_games is already published. RLS still applies to
-- postgres_changes, so this exposes nothing new.
-- Rollback: ALTER PUBLICATION supabase_realtime DROP TABLE ...; (x2)

ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_table_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doubles_elimination_matches;
