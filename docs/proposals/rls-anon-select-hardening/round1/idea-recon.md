# idea-recon — rls-anon-select-hardening (nguyên văn)

This is NOT already built — the leak is confirmed live (anon `select('*')` on `team_match_teams` via public route), and there's a ready-made template for the fix pattern already in the repo (profiles PII lockdown migration), but no column-grant work has been done on these 5 tables yet.

## Prior art
- `supabase/migrations/20260706120000_profiles_pii_column_lockdown.sql` — exact template for this class of fix: `REVOKE SELECT ... FROM anon, authenticated` + dynamic `GRANT SELECT (col)` loop over non-PII columns + `SECURITY DEFINER` RPCs for the legitimate cross-user reads it broke (`search_players`, `find_profile_by_phone`, `get_table_registration_emails`). No equivalent exists yet for team_match/quick_table tables.
- `src/lib/registrationCounts.ts:43-49` — `attachTeamMatchApprovedCounts` already selects only `tournament_id` from `team_match_teams` (narrow, no leak) — shows the narrow-select pattern is already used elsewhere in the same file.
- `quick_table_partner_invitations` (migration `20260101135910_c556875d...sql:56-96`) — invite codes for quick-table doubles pairing live in a *separate* table with RLS scoped to `invited_by_user_id`/`invited_user_id`/table creator — never a public `USING(true)` row. This is the "separate the secret column into its own guarded table" pattern the ask could mirror, though `team_match_teams` embeds `invite_code` directly in the publicly-readable row instead.

## Touch surface (likely)
- `supabase/migrations/20260107133349_4d81fec4...sql:278-281` — `CREATE POLICY "Teams are publicly viewable" ON team_match_teams FOR SELECT USING (true)` — the actual leak source.
- `src/hooks/useTeamMatchTeams.ts:60-65` (`useTeamMatchTeams`, `select('*')`) and `:81-85` (`useTeamMatchTeam`, `select('*')`) — main read hooks, called from `src/pages/TeamMatchView.tsx:113` and `:109`, a route (`/tools/team-match/:id`, `src/App.tsx:546`) that is **public by default** — `ConditionalAuth` (`src/components/auth/ConditionalAuth.tsx:10-22`) only gates on a system setting flag, default off.
- Confirmed dead-weight: none of the public display components (`src/components/teamMatch/TeamList.tsx`, `StandingsTable.tsx`, `GroupStandingsTable.tsx`, `src/pages/TeamMatchView.tsx`) reference `payment_status`, `invite_code`, or `captain_user_id` at all — grep returns zero hits. Anon genuinely does not need those 3 columns anywhere in the public UI.
- `src/pages/MyTournaments.tsx:224-231` — organizer-only delete-impact query, selects `payment_status` scoped by own `tournament_id` (fine, but relies on RLS row-level, would need column grant to authenticated + organizer check).
- `src/components/teamMatch/TeamDetailSheet.tsx:133` — passes `team.invite_code` (already fetched via the `select('*')` above) down to child for display — presumably gated by `isCaptain`/`isOwner` in UI only, not by the query.
- `apple/ThePickleHub/Core/TeamMatch/TeamMatchRepository.swift:44-45` — native list-teams query already narrows to `id, team_name, seed, group_id, status, payment_status, created_at` — still leaks `payment_status` (not `invite_code`/`captain_user_id`) in the public list; `:426-427` and `:407-408` fetch `payment_status`/`captain_user_id` but scoped by `.eq("captain_user_id", ...)` — a client-side filter, not RLS enforcement.
- `src/hooks/useTeamMatchTeams.ts:614-628` — `useTeamByInviteCode` (looks up team BY invite_code, i.e. code is already known client-side) is dead code — zero callers found repo-wide. `src/pages/JoinTeam.tsx` is a legacy/retired page for the unrelated `quick_table_partner_invitations` flow, not `team_match_teams`.
- `supabase/functions/invite-team-to-tournament/index.ts:1-43` — service_role client (`createClient` w/ `SUPABASE_SERVICE_ROLE_KEY`, line 42-43), bypasses RLS/column grants entirely — unaffected by any hardening here.

## Data
- `team_match_teams` (types.ts:6434-6450): `id, tournament_id, team_name, captain_user_id, invite_code, master_team_id, payment_status, payment_claimed_at, payment_confirmed_at, seed, status, group_id, created_at, updated_at`. Sensitive: `invite_code`, `captain_user_id`, `payment_status`/`payment_claimed_at`/`payment_confirmed_at`.
- `team_match_roster` (the actual sibling — `team_match_players` does not exist in this codebase): `id, team_id, user_id, player_name, gender, skill_level, is_captain, status, created_at`. RLS SELECT `USING(true)` (migration `20260107133349...sql:312-315`). Sensitive: `user_id` (low severity, no email/phone here).
- `team_match_games` (types.ts:6108-6132): includes `live_referee_id`, `referee_live_state` (Json), `dupr_match_code`, `dupr_submit_error` — RLS SELECT `USING(true)` (same migration:387-390). Not named in the ask but worth a look — referee-state/DUPR fields are semi-internal.
- `quick_table_registrations` (types.ts:5186-5203): `btc_notes, btc_override_skill, profile_link, skill_*, user_id` — SELECT policy scoped to `is_public OR creator_user_id = auth.uid()` (migration `20251225041737...sql:42-52`), not `USING(true)`. Lower risk; no invite_code column here.
- `quick_table_teams` (types.ts:5248-5273): `player1/2_user_id, player1/2_profile_link, btc_notes, btc_approved_at` — SELECT policy same public/creator scoping (`20251225041737...sql` and `20260101135910...sql:78-86`). No invite_code embedded (lives in sibling table, see Prior art).
- No column-level GRANT currently applied to any of these 5 tables; `20260513000000_grant_mutations_on_tournament_tables.sql:45` grants table-level `SELECT, INSERT, UPDATE, DELETE ON team_match_teams TO authenticated` (blanket, no column scoping).
- No public view wraps any of these 5 tables.
- Helper functions available for policy composition: `is_team_match_creator`, `is_team_captain`, `get_tournament_from_team`, `get_tournament_from_match` (all `SECURITY DEFINER`, migration `20260107133349...sql:154-210`).

## Binding constraints found
- `.claude/memory/lessons-learned.md` pattern (via profiles migration comment) — "RLS is ROW-level and cannot hide COLUMNS" — REVOKE + column-GRANT is the only mechanism; any UI/RPC reading a revoked column server-side must switch to `SECURITY DEFINER`.
- Profiles-lockdown migration comment: "service_role ... bypasses column privileges" — edge functions (`invite-team-to-tournament`) unaffected, confirmed above.
- No CLAUDE.md/ADR entry specific to team_match RLS found.

## Test coverage today
- `supabase/tests/rls_auth_matrix.test.sql` (QA-03, PR #352) — blanket RLS-enabled checks cover `user_roles, profiles, event_registrations, notifications, chat_messages, payment_orders, api_keys, livestreams, social_events` only; zero mentions of `team_match_*` or `quick_table_*` (confirmed by grep, no hits). Full gap — no pgTAP coverage for any of the 5 tables in scope, but the file's blanket-matrix pattern (loop over `pg_tables`/`pg_policies`) is directly reusable.
- `supabase/tests/ux06_block_delete_paid_team.test.sql` touches `team_match_teams` but for delete-guard logic, not column exposure.

## Unknowns worth asking Cuong
1. Native app (`apple/.../TeamMatchRepository.swift:44-45`) still requests `payment_status` in the public team-list query even though no web UI displays it — is `payment_status` meant to be visible read-only to all viewers (e.g. future "paid" badge), or is it pure leak like `invite_code`/`captain_user_id`?
2. `team_match_games` (referee state, DUPR match code) wasn't named in the ask but shares the same `USING(true)` pattern and `live_referee_id` — in scope or explicitly deferred?
3. `useTeamByInviteCode` (`useTeamMatchTeams.ts:614`) has no callers — confirm it's genuinely dead before deciding whether invite-code lookup needs a replacement RPC path.
