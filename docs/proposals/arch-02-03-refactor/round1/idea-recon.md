# Recon — arch-02-03-refactor

## ARCH-01 boundaries (docs/architecture-boundaries.md, PR #334)

- Layering rule (web): `pages → components → hooks → lib → integrations`. Pure
  logic (scoring/capacity/eligibility/money math) belongs in `src/lib/` with
  `lib/__tests__/`. Direct `supabase.from()` belongs in hooks, not JSX
  handlers — **existing violations tolerated until their ARCH task**
  (bracket propagation in `DoublesEliminationBracket.tsx` named explicitly).
- Edge layering: `index.ts` (transport) → `handler.ts` (Deno-free domain
  logic, injected stores) → `_shared/`. Money/state-transition logic must
  live in a Deno-free `handler.ts` with vitest coverage — `create-payment-order`
  and `mark-payment-claimed` are named as the templates (already done, QA-08).
- **Not lint/CI enforced.** Doc says explicitly: "Lightweight for now (solo
  repo): this document + review. If violations recur after ARCH-02/03, add
  `eslint-plugin-boundaries`... not before." So no `scripts/check-*` or
  eslint rule polices any of this today — grepped `eslint.config.js` and
  `scripts/check-*.mjs`, none reference boundaries/layering.
- ARCH-04 section (added same doc, done 2026-07-17) states what "deliberately
  REMAINS per-format": match/bracket management (slots, save-game
  side-effects, propagation, DUPR submission) — explicitly flagged as
  business rules ARCH-02/03 would still touch, not duplication ARCH-04 ate.

## ARCH-02 surface — Social Event registration/payment

| File | Lines | Note |
|---|---|---|
| `src/components/social-events/RegistrationModal.tsx` | 1398 | largest single file; 8 direct `supabase.rpc()` calls inline in JSX handlers (lines 231, 593, 1314) — boundary violation #3, not yet cleaned |
| `src/components/social-events/ProxyRegistrationModal.tsx` | 649 | |
| `src/components/social-events/ManualAddRegistrationModal.tsx` | 300 | |
| `src/pages/SocialEventDetail.tsx` | 792 | |
| `src/pages/SocialEventLive.tsx` | 800 | |
| `src/pages/SocialEventMatchmaking.tsx` | 714 | |
| `src/pages/SocialEventRoster.tsx` | 741 | |
| `src/pages/SocialEventList.tsx` | 177 | |
| `src/hooks/useRegistration.ts` | 343 | |
| `src/hooks/useTeamRegistration.ts` | 478 | |
| `src/hooks/useEventRegistrations.ts` | 57 | |
| `src/components/social/create-event/Step2Payment.tsx` | 261 | |
| edge: `create-payment-order` (index 113 + handler 183) | 296 | handler already Deno-free + unit-tested (QA-08) |
| edge: `mark-payment-claimed` (index 146 + handler 184) | 330 | same, already the layering template |
| edge: `cancel-registration/index.ts` | 165 | **still monolithic index.ts, no handler.ts split** |
| edge: `reactivate-registration/index.ts` | 161 | same — no handler.ts split |

QA-08 (#328) extracted `processCreatePaymentOrder` and
`processMarkPaymentClaimed` into `handler.ts` with a store-interface pattern
(`PaymentOrderStore`, `ClaimStore`) and unit tests in
`supabase/functions/_shared/__tests__/payment-handlers.test.ts` — covers
idempotent order creation (reference_code collision retry) and the
false→true claim transition firing organizer push exactly once.
`cancel-registration` / `reactivate-registration` were NOT touched by QA-08 —
still index.ts-only, no handler split, no unit tests found.

DB-01 (event capacity race) RPC: `supabase/tests/event_capacity_rpc.test.sql`
covers the capacity RPC pgTAP-side; called from `useRegistration.ts` /
`RegistrationModal.tsx` per the domain table (`event_registrations`,
`payment_orders`, `registration_secrets`).

## ARCH-03 surface — Team Match orchestration + realtime

| File | Lines | Note |
|---|---|---|
| `src/pages/TeamMatchSetup.tsx` | 1348 | largest; migrated onto `SetupShell` under ARCH-04 (setup 3/4, #367) |
| `src/pages/TeamMatchView.tsx` | 1025 | **0 direct `supabase.from/channel/rpc` calls** — already routes through hooks, boundary rule #3 already respected here |
| `src/components/teamMatch/TeamMatchScoringSheet.tsx` | 1045 | imports `RefereeScoringScreen` (line 11, used line 1014) — the scoring board itself is ARCH-04's shared engine now; this file is the "thin loader/overlay" wiring (RefereeLoaded + claim/persist/finish callbacks) that the boundaries doc says deliberately stays per-format |
| `src/components/teamMatch/TeamMatchMatchesTab.tsx` | 397 | |
| `src/components/teamMatch/TeamMatchPaymentSection.tsx` | 293 | |
| `src/components/teamMatch/TeamMatchSettingsDialog.tsx` | 313 | |
| `src/components/teamMatch/TeamMatchOverviewTab.tsx` | 237 | |
| `src/components/teamMatch/TeamMatchInfoCards.tsx` | 210 | |
| `src/hooks/useTeamMatchMatches.ts` | 1021 | |
| `src/hooks/useTeamMatchTeams.ts` | 632 | |
| `src/hooks/useTeamMatchStandings.ts` | 477 | |
| `src/hooks/useTeamMatch.ts` | 444 | |
| `src/hooks/useTeamMatchGroups.ts` | 267 | |
| `src/hooks/useTeamMatchRefereeManagement.ts` | 159 | |
| `src/hooks/useTeamMatchRealtime.ts` | 150 | dedicated realtime hook — subscribes `team_match_matches` postgres_changes, per-mount random channel name, invalidates react-query on change |
| `src/lib/refereeScoring.ts` + tests | 334 + 3 test files (285 lines) | ARCH-04 engine, already covered |
| `src/lib/teamMatchResult.ts` + test | 64 + 161 | QA-07 extraction, already covered |
| migration `20260717150000_referee_live_state.sql` | — | `referee_live_state` jsonb on the 3 match tables, realtime-published — this is the ARCH-04 realtime spectator/resume mechanism |

**What ARCH-04 already ate from "Team Match orchestration and realtime
boundaries":** the scoring engine, the live-state persistence/resume
envelope, the spectator realtime follow, contention lockout — all now live
in `RefereeScoringScreen` + `refereeScoring.ts`, consumed by
`TeamMatchScoringSheet` as a thin wrapper.

**What's still fully TeamMatch-owned, untouched by ARCH-04:** `TeamMatchView.tsx`
(1025 lines, tab orchestration/state), `TeamMatchSetup.tsx` (1348 lines),
the whole `useTeamMatch*` hook family (~3.3k lines combined), match/group/
standings computation, `useTeamMatchRealtime.ts` (separate realtime channel
from the referee live-state one — subscribes raw table changes, not the
envelope).

DB-02 (bracket advancement transactional) shipped as two PRs: #329
(`fix(doubles-elim)` — guarded slot claim, `DoublesEliminationBracket.tsx`)
and #330 (`fix(match-confirm)` — pending→verified guarded transition gating
DUPR submit). **Neither PR touches Team Match files** — DB-02's actual diff
is DoublesElimination + match-confirm, not TeamMatch, despite being listed
as an ARCH-03 dependency in the roadmap table.

## Commit heat since 2026-04-01

- Social Event pages/components/registration hooks: **113 commits**
- Team Match pages/components/hooks: **46 commits**
- Payment edge functions (create-payment-order, mark-payment-claimed,
  cancel/reactivate-registration): **7 commits**

Social Event surface changes ~2.4x more often than Team Match in this repo's
recent history — includes non-refactor churn like BASE-02 analytics
instrumentation, QA-01/QA-02 lint sweeps, strictNullChecks waves that
touched `social/feed` broadly.

## Test coverage today

- **Social Event / registration:** no `lib/__tests__` or component unit
  tests found for `RegistrationModal`/`useRegistration`/`useTeamRegistration`.
  Money-path coverage exists only at the edge-function handler level
  (`payment-handlers.test.ts`, QA-08) — UI/hook layer (capacity checks,
  proxy/manual add flows) is untested.
- **Team Match:** `src/lib/__tests__/` has 538 lines across
  `refereeScoring.test.ts`, `refereeManualMode.test.ts`,
  `refereeManualSets.test.ts`, `refereeLiveState.test.ts`,
  `teamMatchResult.test.ts` — all cover the ARCH-04 engine/pure-fn layer.
  Zero tests for `TeamMatchView.tsx`, `TeamMatchSetup.tsx`, or any
  `useTeamMatch*` hook (standings computation, group logic, realtime).
- `supabase/tests/`: `event_capacity_rpc.test.sql` (DB-01, social event
  domain) and `rls_auth_matrix.test.sql`/`feed_generate_aggregates.test.sql`
  — nothing team-match-specific.
- `tests/contract/edge-contracts.spec.ts` — grepped for
  create-payment-order/mark-payment-claimed/cancel-registration/
  reactivate-registration/team-match: **zero matches**, no contract
  coverage for either domain's edge functions.
- No Playwright/e2e specs found under `tests/` for either domain (no
  `tests/e2e` dir at all currently — only `tests/contract` and
  `tests/helpers`).

## Native branch conflict risk

`git branch -a` shows several live feature branches, all unmerged:
`feat/mlp-captain-registration`, `feat/mlp-repechage-web`,
`feat/team-match-settings`, `feat/web-referee-doubles-mlp`,
`feat/native-ios-phase-1`, plus remotes `feat/team-match-event-discounts`,
`perf/perf-02-teammatch-split`, `qa/qa-07-mlp-total-score`.

Diff-stat against `main` for files ARCH-03 would touch:

- `feat/mlp-captain-registration` (stale — last commit 2026-07-09, 19
  commits ahead/diverged, per memory not yet merged): touches
  `TeamMatchMatchesTab.tsx`, `useTeamMatch.ts`, `useTeamMatchMatches.ts`,
  `useTeamMatchStandings.ts`, `TeamMatchSetup.tsx`, `TeamMatchView.tsx` —
  **158 lines changed across exactly the files ARCH-03 would refactor.**
- `feat/web-referee-doubles-mlp`: touches `TeamMatchScoringSheet.tsx` (76
  lines) — the ARCH-04/ARCH-03 seam file.
- `origin/feat/team-match-event-discounts`: touches
  `useTeamMatch.ts`, `TeamMatchSetup.tsx`, `TeamMatchView.tsx`,
  `components/teamMatch/index.ts` — **401 lines**, largest overlap of any
  branch.
- `feat/mlp-repechage-web`, `feat/team-match-settings`: no diff against the
  TeamMatch file set checked (may touch other team-match files not in this
  glob, not fully ruled out).

ARCH-02 file set (SocialEvent*/RegistrationModal/social-events) was not
checked against these branches — they are named as team-match-specific, no
similar check was requested for ARCH-02 and none of the branch names suggest
social-event overlap.

## Unknowns worth asking Cuong

1. `feat/team-match-event-discounts` and `feat/mlp-captain-registration`
   both modify `TeamMatchView.tsx`/`useTeamMatch.ts`/`TeamMatchSetup.tsx`
   directly — are these landing before or after an ARCH-03 refactor, or
   abandoned? Sequencing changes the diff size ARCH-03 has to rebase through.
2. `cancel-registration`/`reactivate-registration` edge functions are still
   monolithic (no handler.ts split, unlike their QA-08 siblings) — is
   bringing them to the same template in-scope for ARCH-02, or out of scope
   (money-path only = create-payment-order + mark-payment-claimed)?
3. DB-02's actual shipped diff is DoublesElimination + match-confirm, not
   TeamMatch — the roadmap lists it as an ARCH-03 dependency anyway. Does
   ARCH-03's scope still assume DB-02 "done" or does TeamMatch's own
   bracket/slot-fill logic (if any) still need the same guarded-UPDATE
   treatment?
