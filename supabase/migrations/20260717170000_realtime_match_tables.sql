-- ARCH-04 scoring S3c (2026-07-17): spectator realtime + takeover detection.
-- quick_table_matches and doubles_elimination_matches were NEVER in the
-- supabase_realtime publication ON PROD — MatchScoring's existing spectator
-- subscription has been silently dead (the known one-dead-binding gotcha).
-- team_match_games is already published. RLS still applies to
-- postgres_changes, so this exposes nothing new.
-- Guarded (no ALTER PUBLICATION ... IF NOT EXISTS in Postgres): the local
-- replay already has quick_table_matches published via an old local-only
-- migration from the pre-SEC-06 drift set — prod did not.
-- Rollback: ALTER PUBLICATION supabase_realtime DROP TABLE ...; (x2)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quick_table_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_table_matches;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'doubles_elimination_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.doubles_elimination_matches;
  END IF;
END $$;
