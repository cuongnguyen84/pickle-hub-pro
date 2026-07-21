# Change under review: column-level SELECT hardening on live Postgres/Supabase tables

## Context (self-contained — you cannot see the repo)
- Product: a bilingual pickleball platform, ~2000 real users, solo-operated, mid-season.
- Backend: Supabase (Postgres + PostgREST). Frontend: React SPA on Cloudflare Pages.
- Mobile: a native iOS app (Swift, uses supabase-swift client directly against PostgREST).
  The native app is ALREADY INSTALLED on user devices and CANNOT be force-updated — any
  new build ships only through App Store review (days), with no rollback button.
- DB migrations are applied to PRODUCTION directly via a Management API PAT, and take effect
  INSTANTLY. Cloudflare Pages client deploy is a SEPARATE step that lags the migration.

## The confirmed problem being fixed
Table `team_match_teams` has an RLS SELECT policy `USING (true)` (fully public) AND a
table-level `GRANT SELECT` to roles `anon` + `authenticated`. So anyone with the public anon
key can run `select('*')` and receive every column, including:
- `invite_code`  — a secret code; knowing it lets a stranger JOIN someone's team.
- `captain_user_id` — a user UUID (no email/phone; those are already column-locked elsewhere).
- `payment_status` / `payment_claimed_at` / `payment_confirmed_at` — a team's payment state.
This leak is verified live. The genuine harm is `invite_code` (stranger joins team).

## The proposed fix
A production migration that does, on `team_match_teams` (and audits sibling tables
`team_match_roster`, `team_match_games`, `quick_table_registrations`, `quick_table_teams`):
```sql
REVOKE SELECT ON public.team_match_teams FROM anon, authenticated;
-- then re-GRANT SELECT on each SAFE column, omitting the sensitive ones
GRANT SELECT (id, tournament_id, team_name, status, seed, group_id, created_at, ...) TO anon, authenticated;
-- SECURITY DEFINER RPCs restore captain/organizer reads of the omitted columns
```
There is prior art: the same REVOKE + per-column-GRANT + DEFINER-RPC pattern was already
shipped for the `profiles` table (to hide email/phone) and works in production.

## Known facts about the consumers (verified in repo)
- Web read hooks use `select('*')`. PostgREST expands `*` to only the columns the role can
  access, so `*` queries DEGRADE gracefully (return a subset) — they do NOT error.
- BUT the native iOS app issues NAMED-column selects, e.g. on the PUBLIC team-list query
  (filtered only by tournament_id, run on every tournament-detail open):
    .select("id, team_name, seed, group_id, status, payment_status, created_at")
  and a captain-scoped query:
    .select("id, team_name, seed, group_id, status, payment_status").eq("captain_user_id", uid)
- A web organizer query also names `payment_status`:
    .from('team_match_teams').select('payment_status').eq('tournament_id', target.id)
- The web captain UI displays `invite_code` (share-to-teammate button), sourced from the
  `select('*')` hook — so if invite_code is revoked, `team.invite_code` becomes undefined and
  the captain can no longer see/share their own invite code.
- A live social-proof badge counts approved teams via `.select('tournament_id').eq('status','approved')`.

## Questions for you
1. What is the single most likely production failure this change causes, and what does a real
   user see? Name the mechanism and the trigger.
2. PostgREST/Postgres: if a role lacks column privilege on a column that appears ONLY in a
   WHERE/filter (`.eq('payment_status', ...)`) or in a row-scoped query
   (`.eq('captain_user_id', uid)`), does the query still fail with 42501, or does row-scoping
   or filter-only-usage exempt it? Be precise.
3. Given the native binary names `payment_status` in a public, non-scoped query and cannot be
   updated, is it safe to revoke `payment_status` at all? What is the correct scope of what can
   be revoked without breaking installed native clients?
4. Deploy ordering: migration hits prod instantly, web client deploy lags, native can't update.
   What ordering (and what "do not revoke" list) avoids a user-visible break?
5. Rollback: is `REVOKE`/`GRANT` cleanly reversible? What is NOT reversible here?
6. Is there any failure mode in the sibling-table audit (games with referee/DUPR state,
   quick_table_*) that a reviewer focused on team_match_teams would miss?

Be concrete and brief. If part of the plan is genuinely safe, say so plainly. Reject generic
risk language.
