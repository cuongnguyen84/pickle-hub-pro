# Roadmap status report — 2026-07-21 (for review)

Snapshot of `docs/roadmap-8.5-9.md` after the 2026-07-20 session. Written to be
challenged: the point of the review is to catch wrong status claims, missing
dependencies, mis-prioritised work, and risk I have talked myself past.

Counts: **66 done · 1 partial · 5 later · 4 blocked.**

---

## Shipped this session (2026-07-20 → 07-21)

| PR | Task | Prod? | Evidence |
|---|---|---|---|
| #422 | ARCH-03 Team Match orchestration | merged + deployed | third-place slot race fixed with guarded `.is(field,null)` claim; games realtime channel scoped per-tournament; ~90 dup lines → `lib/teamMatchGames.ts`. Mutation-verified (drop guard → 3 tests red). Migration-free. |
| #424 | null-slot guard (follow-up to #422) | merged | next-match write was unguarded on the assumption `next_match_slot ∈ {1,2}`, which nothing enforces; NULL now claims a free slot. Mutation-verified. |
| #423 | UX-06 (done) + UX-07 (partial) | merged + **2 prod migrations applied** | see below |
| #426 | A11Y filter-pill contrast | **open, CI green incl. lighthouse** | `.tl-filter.active .count` was 3.7:1; fixed at usage via oklab mix (6.1:1). Re-enabled `color-contrast` in the axe suite, scoped per-component. |

### #423 detail — the cluster that was not a UX cluster

`/idea` panel (4 agents, 2 rounds, GPT-5.6 cross-vendor) reframed UX-06/07 and
surfaced **7 live prod bugs**, each verified by reading the file:

1. Deleting a paid MLP team destroys the only proof it paid (no ledger, no
   refund); native did it on one tap. → **#423: DB trigger `PH001` blocks it
   (web + native + cascade-from-tournament) + native confirm dialog**
2. `register_team_for_doubles_elimination` — check-then-insert, no lock (the
   DB-01 shape, never applied to the tournament branch). → **#423: advisory
   lock migration**
3. QuickTable registration `.insert()`s straight from the browser, no DB
   capacity check. → **NOT fixed** — deferred; only matters if a guest path
   is ever opened.
4. `Login.tsx` dropped `?redirect` after onboarding → new player following a
   bracket link lost the tournament. → **#423: `lib/auth/postLoginRedirect`**
5. `/tournaments` never opened the Community tab (dead-code default). →
   **#423: default fixed, ui-ux-verifier confirmed A/B vs prod**
6. "Your brackets" heading covered only Quick Tables. → **#423: copy fixed**
7. Quota counts completed tournaments → effectively lifetime. → **NOT a bug —
   Cuong confirmed 3-tournaments-for-life is intended (D4). Escape valve is
   admin `set_user_quota`, not code.**

**Two migrations are on prod** (`20260721000000` trigger, `20260721010000`
lock), applied in order after web deploy, verified by catalog + a live
`BEGIN…ROLLBACK` smoke that raised `PH001` without touching the 19 real teams.
Both are RED (revert-proof) and were approved by Cuong directly in-session.

### UX-07 is `partial`, not `done` — on purpose

The three journey-blocking bugs are fixed and the tournament-registration
branch is now instrumented (`auth_wall_viewed` / `auth_wall_click` /
`registration_complete`). But UX-07's central claim — "the login wall is what
loses players" — is **unmeasured and contested** (disagreement D5): ui-ux-critic
+ GPT-5.6 say yes; solution-architect refutes with prod numbers
(`quick_table_registrations` = 0 rows ever; 12/105 tables have
`requires_registration` on, 0 in 60 days). Zero rows fits both "the wall kills
100%" and "nobody enabled the feature". **Decision gate: read the funnel
~2026-08-02.** high wall_view + low complete → build the guest path (RED, not
built); near-zero wall_view → close UX-07, the problem is upstream.

---

## Remaining work

### `later` — actionable, but each needs a specific input

| Task | Effort | Blocked on |
|---|---|---|
| **QA-04** stable E2E for 10 journeys | 5d | **UNBLOCKED 2026-07-21**: secrets set + wired into `playwright.yml` (PR #431). Remaining work is writing the ten journeys — run in a fresh session. |
| **OPS-04** SLO dashboards + alerts | 4d | **UNBLOCKED 2026-07-21**: Cuong picked option A — extend the existing Telegram alert (`errors-telegram-alert` + CI Telegram secrets already in place). |
| **PERF-05** validate CWV p75 with VN field data | 3d | Time — needs ~1 week of RUM post-PERF-04. Earliest ~2026-07-24. |
| **CLOSE-03** final UX/a11y/perf/security/codebase audit | 3d | "All phases" — now nearly satisfiable; the a11y gate hole (below) is exactly the kind of thing it should catch. |
| **CLOSE-04** publish scorecard | 1d | CLOSE-03. |

### `partial`

- **UX-07** — see above. Continue-or-close decided by the ~08-02 funnel read.

### `blocked` — need external resources, not code

| Task | Blocked on |
|---|---|
| **BASE-07** 5 player + 5 organizer usability sessions | recruiting real participants |
| **UX-09** repeat sessions + SUS score | UX-01..08 + participants |
| **OPS-02** DB restore drill | production/backup access |
| **A11Y-05** VoiceOver / Dynamic Type / keyboard / contrast manual audit | test devices |

---

## Open risks / debt not tracked as roadmap rows

These are the items I would most want a second opinion on — some are arguably
higher priority than the `later` rows above.

1. **The RED approval gate — FIXED 2026-07-21.** Machine account
   `thepicklehubnet` (Write collaborator, this repo only) + classic PAT
   `GITHUB_BOT_PAT` in `~/Downloads/secrets.local.md` (classic because
   fine-grained PATs cannot target another personal account's repo; blast
   radius is still one repo). `release-pilot` now runs all `gh` ops as the bot
   and — per Cuong's explicit decision — may merge RED **only** on an APPROVED
   PR review authored by `cuongnguyen84`, which the bot token cannot produce.
   Comments and relayed quotes remain untrusted. (`ops-runbook §1b`,
   `.claude/agents/release-pilot.md`.)

2. **The a11y gate was blind, and half of it still is.** `tests/a11y.spec.ts`
   disabled `color-contrast` outright ("Lighthouse flagged them repo-wide" — a
   false belief). That is why `.tl-filter.active .count` sat at 3.7:1 for
   months. #426 re-enables it scoped-per-component, but the page-wide scans are
   still `disableRules(["color-contrast"])`. There is unmeasured contrast debt
   on the public pages behind that blanket disable. CLOSE-03 should quantify it.

3. **Lighthouse "green" is timing-dependent and does not prove absence of
   bugs.** The bug above only surfaced once UX-08 changed SPA render timing;
   earlier greens were false greens. Any gate that snapshots a mid-hydration SPA
   can silently pass. Prefer the settled-route axe suite (A11Y-04) for
   contrast, not Lighthouse.

4. **Team-match payment flow is unused, not dead — and its 0-signup tournament
   is NOT D5 evidence.** Prod: 19 teams, 100% `unpaid`; exactly 1 of 15
   tournaments has a fee configured (`MLP Hà Nội lần 1`, created 07-09) with
   **0 teams**. Not a code bug (RPCs are SECURITY DEFINER, web/native parity
   holds). Cuong confirmed 2026-07-21 the reason for 0 signups: **no marketing
   has run for it yet, and overall awareness of thepicklehub is still too low**
   — a top-of-funnel/awareness constraint, not a login-wall or discovery-UX
   problem. So this tournament corroborates neither side of D5; do not read it
   as a login-wall signal.

   **Implication for the ~08-02 funnel read:** if awareness is the binding
   constraint site-wide, the funnel will likely show thin volume across every
   step regardless of the login wall. That is the report's own "near-zero
   wall_view → problem is upstream, close UX-07" branch, and Cuong's point is
   direct evidence it may land there. It strengthens the case for NOT building
   the guest-registration path speculatively — a lower wall converts nobody if
   nobody arrives.

5. **Loose ends carried from prior checkpoints** (still open): enforce `.tl-btn`
   ratchet HARD after 2026-08-01 (`check-theline` Rule 4); manual admin push
   broadcast verify; regenerate Supabase types (`--schema public`); SEC-06
   migration-ledger reconciliation (>100 rows of known drift — never
   `db push --include-all`); `docs/manual-test-backlog.md` items 8–14 awaiting
   Cuong's hands (now includes the DB guards live on prod).

---

## What I want reviewed

- Are any `done` claims above overstated — especially #423's DB guards, which
  protect a state (`claimed`/`confirmed`) that has never occurred on prod?
- Is deferring bug #3 (QuickTable capacity) defensible, given #2 was fixed?
- Is UX-07 correctly `partial` rather than done, and is the ~08-02 funnel gate
  the right decision mechanism?
- Priority call: is the bot-identity separation (risk 1) more urgent than any
  `later` roadmap row? I think it is.
- Anything in the blocked/loose-ends lists that is actually actionable now.
