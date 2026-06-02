-- 20260602000000_realtime_club_members.sql
-- ---------------------------------------------------------------------------
-- Enable Supabase Realtime for public.club_members.
--
-- The organizer dashboard hook `useClubMembers` (src/hooks/useClubMembers.ts,
-- PR 20260527) subscribes to a realtime channel:
--     supabase.channel(`club-members-${clubId}`)
--       .on('postgres_changes', { table: 'club_members', filter: club_id=eq.X })
-- to refresh the roster live when a join request arrives or is approved.
--
-- BUG: public.club_members was NOT a member of the `supabase_realtime`
-- publication, so the channel subscribed but never received any
-- INSERT/UPDATE/DELETE events. A new "pending" join request therefore only
-- showed up after a full web reload or an iOS Capacitor force-quit (cold
-- start re-runs the query). social_notifications was already published (the
-- notification bell updated live); club_members was the missing table.
--
-- FIX: add the table to the publication. RLS already exposes the rows to the
-- subscribing organizer (policy `club_members_select_all` USING (true)), so
-- realtime authorization passes. REPLICA IDENTITY default is sufficient:
-- club_id is part of the PK (club_id, profile_id), so it is present on
-- INSERT/UPDATE/DELETE change payloads and the `club_id=eq.X` filter matches.
--
-- NOTE: this change was already applied to the live database on 2026-06-02
-- via the Management API; this migration records it for repo history and
-- fresh-environment reproducibility. Idempotent so a re-run / `supabase db
-- push` is a safe no-op.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'club_members'
  ) then
    alter publication supabase_realtime add table public.club_members;
  end if;
end $$;
