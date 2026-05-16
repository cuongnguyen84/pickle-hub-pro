# PR W2.4 — Team Match (MLP) Children Refresh — Audit

**Branch:** `refresh/team-match-children`
**Status:** GATE BREACHED — refresh deferred to a future stacked PR plan
**Date:** 2026-05-16

## Gate result

- **Tier A count:** 12 components — **exceeds 8 threshold**
- **Total audited:** 22 components, ~6,221 lines — under 25 threshold

Because Tier A alone exceeds the 8-component ceiling defined in the PR brief, the
refresh has been stopped. No source files were modified on this branch — only this
audit file was added.

## Discovery method

- `src/pages/TeamMatchList.tsx` (441 lines) — already on TheLineLayout tokens (no
  child refresh required at the page level; only `TeamMatchSeoContent` is in scope).
- `src/pages/TeamMatchView.tsx` (834 lines) — already on TheLineLayout tokens; renders
  the bulk of the children (Tabs → Overview / Teams / Matches / Standings) and all
  Sheets / Dialogs.
- `src/pages/TeamMatchSetup.tsx` (924 lines) — already on TheLineLayout tokens;
  renders the wizard with `GameTemplateEditor` for step 2.
- `src/components/teamMatch/TeamMatchOverviewTab.tsx` (184) — container that
  re-exports child cards; itself still uses shadcn `Card`/`Button` for BTC action
  prompts plus three `RegisteredTeamsSummary` / `TeamOverviewCard` / `AllTeamsOverview`
  surfaces.
- `src/components/teamMatch/TeamMatchMatchesTab.tsx` (219) — container that wires
  `MatchList`, `GroupMatchList`, `PlayoffBracket` and four shadcn `Card`-based action
  prompts.

## Component inventory + tier triage

| Tier | Component | Lines | Visibility |
|---|---|---|---|
| A | TeamMatchOverviewTab | 184 | Overview tab body (default tab) — always renders for any tournament viewer |
| A | TeamMatchMatchesTab | 219 | Matches tab body — always renders when user opens matches tab |
| A | RegisteredTeamsSummary | 270 | Overview tab — visible whenever ≥1 team registered (owner + non-captain visitors) |
| A | TeamOverviewCard | 86 | Overview tab — visible to a captain (non-owner with a team) |
| A | AllTeamsOverview | 126 | Overview tab — visible to a captain (non-owner with a team) |
| A | TeamRosterDisplay | 104 | Teams tab — visible to a captain (non-owner with userTeam) |
| A | TeamList | 173 | Teams tab — visible to owner or any non-captain viewer (default list) |
| A | StandingsTable | 211 | Standings tab — always visible when format ≠ single_elim and no groups |
| A | GroupStandingsTable | 331 | Standings tab — always visible when groups exist |
| A | MatchList | 300 | Matches tab — primary RR match grid |
| A | GroupMatchList | 385 | Matches tab — primary grouped-RR match grid |
| A | PlayoffBracket | 370 | Matches tab — primary playoff/SE bracket display |
| B | CreateTeamDialog | 190 | Dialog — owner only when creating a team for someone |
| B | TeamRegistrationDialog | 522 | Dialog — non-owner registering as a team |
| B | TeamDetailSheet | 82 | Sheet — opens on team click; hosts TeamRosterManager |
| B | TeamRosterManager | 493 | Inside TeamDetailSheet (admin / captain roster CRUD) |
| B | MatchDetailSheet | 339 | Sheet — opens on match click; shows scores + meta |
| B | TeamMatchScoringSheet | 587 | Sheet — opens for live scoring (admin/referee) |
| B | LineupSelectionSheet | 469 | Sheet — opens for lineup submission |
| B | TeamMatchSettingsDialog | 46 | Dialog — owner-only referee management |
| B | InviteTeamDialog | 179 | Dialog — owner-only email invite |
| B | GameTemplateEditor | 218 | Setup wizard step 2 (creation flow only, not view) |
| B | GenerateMatchesDialog | 149 | Dialog — owner-only schedule generation confirm |
| B | PlayoffSetupDialog | 230 | Dialog — owner-only playoff seeding |
| B | GroupSetupDialog | 188 | Dialog — owner-only group draw |
| B | SingleEliminationSetupDialog | 372 | Dialog — owner-only SE pairing |
| C | MyTeamCard | 98 | Not imported by any current parent (dead path) — kept for future re-introduction |

### Tally

- Tier A: **12** (threshold: 8) — **OVER**
- Tier B: 14
- Tier C: 1
- **Total:** 27 (threshold for audit-only: 25) — **OVER** the audit ceiling as well when MyTeamCard is counted; **22** in-tree children excluding the unused MyTeamCard

Either way, the **Tier A > 8** gate trips first.

## Why the Tier A surface is this large

The MLP Team Match feature has four parallel match-display surfaces (RR list, grouped
RR list, playoff bracket, SE bracket — all reachable from the Matches tab depending
on format/status) and three parallel team-display surfaces (captain's own card,
all-teams overview for captains, registered-teams summary for owners) plus two
standings tables. Each is its own component because the data shape and interaction
model differs per format.

A faithful refresh of all of these requires both visual token translation and
re-implementing the per-status badges/CTAs already token-driven on the parent pages.
None can be safely combined without changing the public props surface or shifting
business logic.

## Recommended split (W2.4a / W2.4b / W2.4c)

Stack three PRs, each ≤ 8 Tier-A components touched (plus their direct deps), each
branched on top of the previous tip per the project's stacked-PR convention.

### PR W2.4a — Matches surfaces (4 Tier A)
- `TeamMatchMatchesTab` (container — strip shadcn Cards, use surfaceCard tokens)
- `MatchList`
- `GroupMatchList`
- `PlayoffBracket`
- Plus: `TeamMatchSeoContent` polish (independent, low risk — keep it in this PR
  as the page-level SEO partner since `/tools/team-match` is the canonical entry)

### PR W2.4b — Overview + Teams surfaces (5 Tier A)
- `TeamMatchOverviewTab` (container — same Card→surfaceCard pass)
- `RegisteredTeamsSummary`
- `TeamOverviewCard`
- `AllTeamsOverview`
- `TeamRosterDisplay`
- `TeamList`

### PR W2.4c — Standings + sweep Tier B sheets (3 Tier A + dialogs)
- `StandingsTable`
- `GroupStandingsTable`
- (after Tier A is clean, opportunistically refresh the most-visible Tier B sheets:
  `MatchDetailSheet`, `TeamMatchScoringSheet`, `LineupSelectionSheet`)

### Cleanup PR (optional W2.4d)
- Owner-only setup dialogs (`*SetupDialog`, `*Dialog`) and `GameTemplateEditor`.
- `MyTeamCard` decision: either re-wire into a parent or remove from `index.ts`.

## What this PR contains

- Only this audit file (`WAVE1_W2_4_AUDIT.md`) at worktree root.
- No source files changed.

## Required pre-existing observations (logged for next slice)

- `TeamMatchOverviewTab.tsx` and `TeamMatchMatchesTab.tsx` use Tailwind-palette
  colours directly (`text-green-600`, `bg-yellow-500/50`, `border-primary/50`,
  `bg-primary/5`, `text-amber-600`). These violate the no-Tailwind-palette guard
  defined in the brief and must be replaced with tokens during the refresh.
- `AllTeamsOverview.tsx`, `RegisteredTeamsSummary.tsx`, `TeamOverviewCard.tsx`,
  `MyTeamCard.tsx`, `TeamList.tsx` have hard-coded Vietnamese strings (`'Chờ duyệt'`,
  `'Đã duyệt'`, `'Từ chối'`) in module-level `STATUS_LABELS` constants. They need
  bilingual rendering via `useI18n()` per the brief.
- `PlayoffBracket.tsx` has hard-coded `ROUND_NAMES` in Vietnamese — same bilingual
  issue.
- `catch` blocks in `TeamMatchView.tsx` swallow errors silently (comment-only). The
  `console.error('[<ComponentName>] <action>:', error)` convention from W1.2b should
  be added during the refresh of each affected dialog.
