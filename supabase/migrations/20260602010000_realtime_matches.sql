-- 20260602010000_realtime_matches.sql
-- ---------------------------------------------------------------------------
-- Enable Supabase Realtime for public.matches.
--
-- The CLB matches list hook `useClubMatches` (src/hooks/useClubMatches.ts)
-- subscribes to a realtime channel:
--     supabase.channel(`club-matches-${clubId}`)
--       .on('postgres_changes', { table: 'matches', filter: club_id=eq.X })
-- so the list refreshes live when an opponent confirms a score
-- (UPDATE → confirmation_status='confirmed' / submitted_to_dupr=true) or a
-- new match is logged (INSERT).
--
-- BUG (same class as migration 20260602000000 for club_members): public.matches
-- was NOT a member of the `supabase_realtime` publication, so the channel
-- subscribed but never received events. An opponent's confirmation therefore
-- only showed up after a full web reload or an iOS Capacitor force-quit
-- (cold start re-runs list_club_matches).
--
-- FIX: add the table to the publication. RLS already exposes club matches to
-- the subscriber (policy `matches_public_read` USING (is_public = true); CLB
-- matches are logged with is_public = TRUE), so realtime authorization passes.
--
-- REPLICA IDENTITY note: matches PK is `id` (not club_id), so the
-- `club_id=eq.X` filter matches on INSERT/UPDATE (the new-row image carries
-- club_id) but NOT on DELETE (old image = PK only). That is acceptable: the
-- live use case is confirm (UPDATE) + log (INSERT); a deleted row simply
-- disappears on the next list refetch.
--
-- NOTE: this change was also applied to the live database on 2026-06-02 via
-- the Management API; this migration records it for repo history and
-- fresh-environment reproducibility. Idempotent so a re-run / `supabase db
-- push` is a safe no-op.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
