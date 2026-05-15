# Tournament Features — Comprehensive Audit (2026-05-13)

> **Scope:** Read-only report. No code or migrations were changed during this audit.
> **Auditor:** Claude Code (claude-sonnet-4-6), commissioned by Cuong Nguyen.
> **Branch:** `audit/tournament-features`

---

## Executive Summary

Five tournament features were audited: **Quick Tables**, **Doubles Elimination**, **Flex Tournaments**, **Team Match (MLP-style)**, and **Referee Management**. The audit surfaced 1 P0, 3 P1, and 4 P2 findings across ~28 files.

The single P0 is a committed schema drift: nine `quick_table_*` tables were created with no `GRANT` statements in any migration, meaning production only works because of a manual SQL Editor fix applied on 2026-05-12. A future `supabase db reset` or migration replay would silently break all Quick Table writes for authenticated users. The companion `20260513000000_grant_mutations_on_tournament_tables.sql` migration (already committed on branch `fix/grant-mutations-on-tournament-tables`) covers the 22 tournament tables from other features but NOT the 9 quick_table tables — that gap must be filled separately.

P1 findings include a bare-page UX regression in the Doubles Elimination scoring screen and two error-handling defects in Quick Table mutations. P2 findings are technical debt items: hardcoded i18n strings, absent quota enforcement in three features, and a fragmented referee model.

---

## Feature Inventory

| Feature | Tables | Primary Hook(s) | Key Pages |
|---|---|---|---|
| Quick Tables | 9 (`quick_tables`, `quick_table_groups`, `quick_table_players`, `quick_table_matches`, `quick_table_registrations`, `quick_table_referees`, `quick_table_teams`, `quick_table_partner_invitations`, `quick_table_pair_requests`) | `useQuickTable.ts`, `useQuickTableMutations.ts` | `QuickTableView.tsx` |
| Doubles Elimination | 4 (`doubles_elimination_tournaments`, `_teams`, `_matches`, `_referees`) | `useDoublesElimination.ts`, `useDoublesEliminationReferees.ts` | `DoublesEliminationList`, `DoublesEliminationSetup`, `DoublesEliminationView`, `DoublesEliminationScoring` |
| Flex Tournaments | 9 (`flex_tournaments`, `_players`, `_groups`, `_group_items`, `_matches`, `_teams`, `_team_members`, `_player_stats`, `_pair_stats`) | `useFlexTournament.ts` | `FlexTournamentList`, `FlexTournamentSetup`, `FlexTournamentView` |
| Team Match (MLP) | 8 (`team_match_tournaments`, `_teams`, `_groups`, `_matches`, `_games`, `_game_templates`, `_roster`, `_referees`) | `useTeamMatch.ts`, `useTeamMatchGroups.ts`, `useTeamMatchMatches.ts`, `useTeamMatchTeams.ts`, etc. | `TeamMatchList`, `TeamMatchSetup`, `TeamMatchView` |
| Referee Management | Shared concept across 3 features (no central table) | `useQuickTableMutations.ts`, `useDoublesEliminationReferees.ts`, `useTeamMatchRefereeManagement.ts` | Embedded in View pages; shared `RefereeManagement` component |

---

## Methodology

1. Read all SQL migrations matching `quick_table*`, `doubles_elimination*`, `flex_*`, `team_match*`, `parent_tournament*` — checking table definitions, RLS policies, GRANTs, and RPC signatures.
2. Traced frontend hooks: constructor calls, mutation bodies, error handlers, loading state exposure, and auth guards.
3. Checked page-level routing in `src/App.tsx` for `ConditionalAuth`/`RequireAuth` usage.
4. Verified specific agent claims against source before including them as findings.
5. Did NOT run any SQL against `ajvlcamxemgbxduhiqrl` production.

---

## Findings

---

### [P0] Quick Table GRANT drift — 9 tables, never committed to git

**Feature:** Quick Tables  
**Location:** All migrations in `supabase/migrations/` — grep for `GRANT … quick_table` → zero results.

**Evidence:**

```
grep -i "GRANT" supabase/migrations/*.sql | grep quick_table
# (no output)
```

Tables were created across five migrations with no GRANT statements:

| Table | Migration |
|---|---|
| `quick_tables`, `quick_table_groups`, `quick_table_players`, `quick_table_matches` | `20251223034604_88ebf84f-…` |
| `quick_table_referees` | `20251224070047_7816b91f-…` |
| `quick_table_registrations` | `20251225041737_3966174b-…` |
| `quick_table_teams`, `quick_table_partner_invitations` | `20260101135910_c556875d-…` |
| `quick_table_pair_requests` | `20260103014533_c0da02d7-…` |

**Impact:** PostgREST enforces table-level privileges *before* evaluating RLS. Without `GRANT INSERT/UPDATE/DELETE`, every authenticated mutation on these tables returns HTTP 403 (PostgreSQL error 42501) — even when the RLS policy would allow the row. A manual fix was applied to production on 2026-05-12 via the Supabase SQL Editor but was never committed to git.

**Risk of leaving unresolved:** Any future `supabase db reset`, migration replay in a staging environment, or disaster-recovery restore would produce a broken Quick Tables feature with no visible schema error — only runtime 403s.

**Note:** The existing migration `20260513000000_grant_mutations_on_tournament_tables.sql` (branch `fix/grant-mutations-on-tournament-tables`) covers 22 tables from other features but explicitly omits the 9 quick_table tables. They need a separate migration.

**Recommended fix:** Create a migration after `20260513000000`:

```sql
-- GRANT backfill for quick_table_* tables (applied manually to prod 2026-05-12)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_tables TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_table_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_table_players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_table_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_table_registrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_table_referees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_table_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_table_partner_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_table_pair_requests TO authenticated;
NOTIFY pgrst, 'reload schema';
```

---

### [P1] DoublesEliminationScoring.tsx — no MainLayout, bare page

**Feature:** Doubles Elimination  
**Location:** `src/pages/DoublesEliminationScoring.tsx:1–24`

**Evidence:**

```
# Setup page — has MainLayout
head -3 src/pages/DoublesEliminationSetup.tsx
# import { MainLayout } from "@/components/layout";

# Scoring page — does not
head -3 src/pages/DoublesEliminationScoring.tsx
# import { useState, useEffect, useCallback } from "react";
# (no MainLayout import, no layout wrapper in JSX)
```

The `/tools/doubles-elimination/match/:matchId/score` route renders the page without any navigation header, sidebar, or footer. The View and Setup pages both import `MainLayout`; Scoring is the only outlier. Additionally, the View page is wrapped in `<ConditionalAuth>` in `App.tsx:569`, but the Scoring route at `App.tsx:570` has no auth wrapper at all.

**Clarification on write safety:** Data integrity is not at risk. The `canEdit` state (line 138, set to `true` only for authenticated creators/referees, defaults to `false`) guards every write path (lines 232, 252, 268, 284, 424). An unauthenticated user who navigates directly to a scoring URL will see the UI but cannot submit scores.

**UX impact:** Users who arrive at a scoring link (e.g., sent by a tournament organiser) see a disconnected bare page with no way to navigate to the rest of the app. The "back" button at line 507 uses `navigate(-1)` which may be a dead end if the scoring URL was opened directly.

**Recommended fix:** Wrap `<DoublesEliminationScoring>` in `<MainLayout>` at the component root (same pattern as `DoublesEliminationSetup.tsx:3`). Consider adding `<ConditionalAuth>` to the route in `App.tsx:570`.

---

### [P1] useQuickTableMutations.ts — 8 empty catch blocks swallow errors

**Feature:** Quick Tables  
**Location:** `src/hooks/useQuickTableMutations.ts` — lines 253, 279, 300, 334, 355, 377, 423, 461

**Evidence:**

```
grep -n "catch {" src/hooks/useQuickTableMutations.ts
253:    } catch {
279:    } catch {
300:    } catch {
334:    } catch {
355:    } catch {
377:      } catch {
423:    } catch {
461:    } catch {
```

Eight mutation functions use bare `catch {}` — no `error` parameter, no `console.error`, no toast feedback. When a Supabase call fails (network error, constraint violation, RLS denial), the error is silently discarded. Users see nothing; developers have no log entry to diagnose the failure.

**Recommended fix:** Change each to `catch (err) { console.error('[useQuickTableMutations]', err); toast.error('…') }`. The catch block at line 32 (which does show a toast) is the correct pattern to follow.

---

### [P1] useQuickTableMutations.ts — no loading state exposed, buttons can double-fire

**Feature:** Quick Tables  
**Location:** `src/hooks/useQuickTableMutations.ts` — entire file (482 lines)

**Evidence:**

```
grep -n "isLoading\|isPending\|isMutating\|disabled" src/hooks/useQuickTableMutations.ts
# (no output)
```

The hook exposes mutation functions but returns no `isLoading` or `isPending` flag. Any call-site that renders a submit button cannot disable it while a mutation is in flight. A user who double-taps "Add Players", "Create Table", or "Delete Tournament" can fire duplicate network requests with no feedback that the first is pending.

**Recommended fix:** Expose a shared `isLoading` boolean (or per-mutation `isPending` flags from `useMutation`) and thread it into call-site buttons as `disabled={isLoading}`.

---

### [P2] 24 hardcoded Vietnamese toast strings in tournament hooks

**Feature:** All features  
**Location:** `useQuickTableMutations.ts`, `useFlexTournament.ts`, `useDoublesElimination.ts`, `useTeamMatch.ts`, `useTeamRegistration.ts`

**Evidence:**

```
grep -rn "toast\.\(error\|success\|warning\)(['\"]" \
  src/hooks/useQuickTableMutations.ts \
  src/hooks/useFlexTournament.ts \
  src/hooks/useDoublesElimination.ts \
  src/hooks/useTeamMatch.ts \
  src/hooks/useTeamRegistration.ts \
  | grep -c "'"
# 24
```

None of these hooks import or use `useI18n()`. Toast messages are hardcoded in Vietnamese (`'Không thể thêm người chơi'`, `'Đã xoá giải đấu'`, etc.). English-mode users (language toggle set to EN) see Vietnamese error messages.

**Recommended fix:** Import `useI18n()` in each hook and move strings to `src/i18n/en.ts` + `src/i18n/vi.ts`. Since Cuong is the sole maintainer and the audience is ~95% Vietnamese, this is a P2 — but it will become more visible if English-speaking admin or international users interact with tournament management.

---

### [P2] Quota enforcement only in Quick Tables

**Feature:** Flex, Doubles Elimination, Team Match  
**Location:** `src/hooks/useFlexTournament.ts`, `src/hooks/useDoublesElimination.ts`, `src/hooks/useTeamMatch.ts`

**Evidence:**

```
grep -n "quota\|get_user_quota" \
  src/hooks/useFlexTournament.ts \
  src/hooks/useDoublesElimination.ts \
  src/hooks/useTeamMatch.ts
# (no output)
```

Quick Tables enforces a per-user tournament creation limit via the `create_quick_table_with_quota` RPC (`20251230114611`), which checks `user_quota` and returns a structured error on overflow. Flex Tournaments, Doubles Elimination, and Team Match have direct `INSERT` calls with no quota gate — a single user can create unlimited tournaments of these types.

**Recommended fix:** Either (a) extend the quota RPC to cover all tournament types, or (b) add creation-count RLS policies or DB triggers on the other three tournament tables. Minimum viable: add a client-side guard in the creation hook that calls `get_user_quota_info` before INSERT.

---

### [P2] Referee model fragmented — Flex has no referee support

**Feature:** Referee Management across all features  
**Location:** `supabase/migrations/20251224070047` (quick_table_referees), `20260122020801` (doubles_elimination_referees), `20260122125549` (team_match_referees)

**Evidence:**

```
grep -r "CREATE TABLE.*referee" supabase/migrations/ --include="*.sql" -i
# quick_table_referees   → 20251224070047
# doubles_elimination_referees → 20260122020801
# team_match_referees    → 20260122125549
# (no flex_referees entry)
```

Three parallel referee tables exist with identical schemas (tournament_id FK, user_id FK, timestamps), implemented independently as three separate migrations with three separate hooks and three separate UI flows. No shared helper functions, no common `is_referee(tournament_type, tournament_id, user_id)` RPC, no unified referee view.

Flex Tournaments have no referee table at all — a flex tournament organiser cannot delegate scoring to a referee.

**Recommended fix:** P2 for now; acceptable to leave as-is. When a fourth tournament type needs referees, consider a central `tournament_referees` table with a `tournament_type` discriminator column, and a shared RPC.

---

### [P2] Auto-archive cron schedule not tracked in source control

**Feature:** All features  
**Location:** `supabase/functions/auto-archive-tournaments/index.ts`, `supabase/config.toml:63`

**Evidence:**

```
grep -A5 "\[functions.auto-archive-tournaments\]" supabase/config.toml
# [functions.auto-archive-tournaments]
# verify_jwt = false
# (no schedule line)
```

The `auto-archive-tournaments` edge function correctly handles Quick Tables, Team Match, Flex Tournaments, and Doubles Elimination (flips stale entries to `completed` after 14 days of inactivity). The function itself is healthy. However, the invocation schedule — almost certainly a Supabase Dashboard cron job — is not tracked anywhere in the repository. If the dashboard cron is deleted, the function silently stops running with no git-based record of what the schedule was.

**Recommended fix:** Add a comment block to `index.ts` documenting the intended cron schedule (e.g., `-- Scheduled: daily at 02:00 UTC via Supabase Dashboard cron`), and optionally commit the schedule definition to `supabase/config.toml` using Supabase's `[functions.<name>.schedule]` syntax if the CLI version in use supports it.

---

## Queries for Cuong to run on prod

Run these in the Supabase SQL Editor on project `ajvlcamxemgbxduhiqrl` to verify the current state.

**1. Confirm quick_table GRANT is present on prod (should show all 9 tables):**

```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name LIKE 'quick_table%'
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name, privilege_type;
```

**2. Confirm the 22 tournament-feature GRANTs from the 2026-05-13 migration are present:**

```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN (
  'flex_tournaments', 'flex_players', 'flex_groups', 'flex_group_items',
  'flex_matches', 'flex_teams', 'flex_team_members', 'flex_player_stats', 'flex_pair_stats',
  'doubles_elimination_tournaments', 'doubles_elimination_teams',
  'doubles_elimination_matches', 'doubles_elimination_referees',
  'team_match_tournaments', 'team_match_teams', 'team_match_groups',
  'team_match_matches', 'team_match_games', 'team_match_game_templates',
  'team_match_roster', 'team_match_referees',
  'parent_tournaments'
)
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name, privilege_type;
-- Expect: 66 rows (22 tables × 3 privileges)
```

**3. Spot-check for orphaned quick_table_matches (match with no parent quick_table_groups row):**

```sql
SELECT COUNT(*) AS orphaned_matches
FROM public.quick_table_matches m
LEFT JOIN public.quick_table_groups g ON g.id = m.group_id
WHERE g.id IS NULL;
```

**4. Check how many users have exceeded quota on Quick Tables vs. other formats:**

```sql
-- Quick Tables: quota-enforced
SELECT created_by, COUNT(*) AS qt_count
FROM public.quick_tables
GROUP BY created_by
ORDER BY qt_count DESC
LIMIT 10;

-- Flex: no quota enforcement
SELECT created_by, COUNT(*) AS flex_count
FROM public.flex_tournaments
GROUP BY created_by
ORDER BY flex_count DESC
LIMIT 10;
```

---

## Out of Scope

- Livestream, Social Events, News, Match Feed — not audited.
- SEO prerendering for tournament pages — covered by the Phase 2 SEO audit (PR72–PR77).
- Mobile (Capacitor) behavior — not tested.
- Performance benchmarks — no load testing was performed.
- Supabase Edge Functions other than `auto-archive-tournaments`.
- RLS policy correctness — policies are syntactically present; their business-logic correctness was not exhaustively verified (spot-checked only).
