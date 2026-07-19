# idea-recon — cụm UX-01..05 (organizer wizard), 2026-07-19

> Nguyên văn output agent idea-recon (vòng 0).

## Prior art

- `src/pages/CreateSocialEvent.tsx` — most-built of the 5 flows: 2-step wizard (`WizardProgress`), `validateStep1`/`validateStep2` (from `src/components/social/create-event/types.ts`), inline `missingFields` hint list (line 145-183) shown when a step's submit is disabled, `status: publish ? "published" : "draft"` (line 359) writes real DB draft rows, `save_draft` vs `publish` submit_action tracked, weekly-repeat batch creation (lines 326-428, partial/complete result) — this is UX-04's "draft" half and a chunk of UX-02's "template/repeat" half already shipped for social events only.
- `src/integrations/supabase/types.ts:5817` — `social_events.status` CHECK `('draft','published','cancelled','completed')` (migration `20260511120000_social_events_foundation.sql:103,120-123`). No equivalent draft state on the other 4: `quick_tables.status` uses enum `quick_table_status` (registration-lifecycle values, no `draft`), `team_match_tournaments.status` uses enum `team_match_status`, `doubles_elimination_tournaments.status` / `flex_tournaments.status` are plain `TEXT`. `DoublesEliminationSetup.tsx:198,374` comments confirm rows are created immediately at `status='registration_open'` — no draft state exists for tournaments, only for social events.
- `apple/ThePickleHub/Features/Social/Organizer/SocialEventFormView.swift`, `apple/ThePickleHub/Features/Bracket/CreateQuickTableView.swift`, `CreateTeamMatchView.swift`, `CreateDoublesElimView.swift`, `CreateFlexView.swift` — all 5 native creation screens already exist on `main`. Not empty stubs (there's `apple/Tests/TeamMatchWizardTests.swift`). Need to actually read these before assuming parity with web — not yet done in this pass.
- `src/components/tournament/SetupShell.tsx` — shared `SetupBreadcrumb`/`SetupPageHead`/`SetupLoginGate` wrapper already used by the 4 tournament setup pages; no shared step/progress/validation model equivalent to `WizardProgress` exists outside social events.
- `FlexTournamentSetup.tsx` (211 lines, single-page form, no steps) is the simplest/least-built flow — no wizard, no draft, no progressive disclosure.
- No `Collapsible`/`Accordion`/"advanced" toggle found in any of the 5 flow files — UX-03 progressive disclosure does not exist anywhere yet.
- No template/prefill-from-previous-event code outside social-event weekly-repeat; QuickTable/TeamMatch/Doubles/Flex have nothing analogous.

## Touch surface (likely)

- `src/pages/CreateSocialEvent.tsx` + `src/components/social/create-event/*` (Step1Info.tsx, Step2Payment.tsx, WizardProgress.tsx, types.ts)
- `src/pages/QuickTableSetup.tsx`, `src/pages/TeamMatchSetup.tsx` (1348 lines — largest), `src/pages/DoublesEliminationSetup.tsx` (1420 lines — largest), `src/pages/FlexTournamentSetup.tsx`
- `src/components/tournament/SetupShell.tsx`, `setup-styles.ts` — shared shell, natural home for a cross-flow checklist/status component (UX-01)
- `src/lib/journeys.ts` — only `organizer_event` journey kind exists; tournament flows (quick_table/team_match/doubles/flex) emit no journey events at all today
- `docs/journey-screens.md` O2-O4 rows — only cover social event wizard, not the 4 tournament flows
- Native: `apple/ThePickleHub/Features/Social/Organizer/SocialEventFormView.swift`, `Features/Bracket/Create{QuickTable,TeamMatch,DoublesElim,Flex}View.swift`
- New DB migration needed to add `draft` status to `quick_table_status`/`team_match_status` enums + `doubles_elimination_tournaments`/`flex_tournaments` TEXT status if UX-04/05 require draft persistence for tournaments

## Data

- `social_events.status` — has `draft` (migration `20260511120000`)
- `quick_tables.status` — enum `quick_table_status`, no draft value (needs check of enum definition before assuming it can hold one)
- `team_match_tournaments.status` — enum `team_match_status`
- `doubles_elimination_tournaments.status`, `flex_tournaments.status` — plain TEXT, no CHECK constraint found in this pass
- RLS not inspected this pass — flag as unknown, not fact

## Binding constraints found

- `docs/journey-screens.md:34-39` — O2/O3/O4: "O3 bank-config friction: payment fields are optional but read as required" — named structural drop-off cause, directly relevant to UX-03/UX-05
- `docs/journey-screens.md:51` — "Total: 8 screens. Anything outside this list is out of scope for the first DS/A11Y/UX passes — expand only from traffic/risk evidence." The 4 tournament flows are NOT in the current 8-screen north-star scope.
- `docs/north-star-journeys.md` §organizer — not yet read line-by-line this pass; contract for event names/dedup semantics referenced by `journeys.ts:1-6`.

## Test coverage today

- `apple/Tests/TeamMatchWizardTests.swift` — native team match wizard has some test coverage; web wizards have none located in this pass (`tests/` not grepped for wizard-specific specs — gap unconfirmed either way).

## Unknowns worth asking Cuong

- UX-04 draft autosave for the 4 tournament flows: is "draft" a new DB status value (schema migration), or web-local `localStorage` autosave only (no server round-trip until publish)? Changes touch surface a lot.
- `feat/mlp-captain-registration` (local, unmerged, per memory has native MLP/QuickTable creation work) — should this recon/rebuild assume that branch's state, or main's as checked here?
- Native SwiftUI screens already exist for all 5 flows — does "same batch" mean bringing native up to whatever new web wizard model ships, or are both sides being redesigned together from scratch?
