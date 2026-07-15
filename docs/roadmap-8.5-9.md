# ThePickleHub Roadmap 8.5–9.0

> Living plan for product, UX, engineering, security, SEO, and operations.
> Baseline: 2026-07-11, commit `4482ebc`. Owner: Cuong + Codex.
> Revised: 2026-07-14 — merged with the Claude codebase audit (5-dimension deep scan with file:line evidence). New tasks carry `HOT-*`, `BE-*`, or notes marked "(2026-07-14 audit)". See "Verified findings" section.

## Objective

Raise the product from the current estimated **7.6/10** to a measured **8.5–9.0/10** without expanding feature scope faster than the platform can support.

The strategy is:

1. Close verified production defects.
2. Establish measurable baselines and two north-star journeys.
3. Consolidate mobile and design-system sources of truth.
4. Simplify organizer and player journeys.
5. Harden security, transactions, testing, and operations.
6. Reduce bundle, architecture, lint, and content-pipeline debt.

## Definition of 8.5+

The roadmap is complete only when all of these are true:

- Player and organizer critical-task success rate is at least 90%.
- System Usability Scale (SUS) is at least 80.
- WCAG 2.2 AA audit has no critical or serious findings.
- Mobile p75: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1.
- Critical journey E2E tests are stable in CI.
- Repository-wide lint, typecheck, unit tests, and build are green.
- Every `verify_jwt=false` Edge Function has a machine-checked auth strategy.
- No access or refresh token is transported in a URL.
- Production migration drift and RLS checks are automated.
- One primary mobile source of truth is documented and enforced.
- Organizer median setup time is reduced by at least 40%.
- Production SLOs have remained healthy for 30 consecutive days.

## Working agreement

- Reference tasks by stable ID, for example: `Start BASE-01`.
- One task should normally fit in one PR. Split it if it exceeds five focused development days.
- Every task ends with evidence: tests, metrics, screenshots, audit output, or a production verification record.
- Do not mix unrelated generated Android/iOS artifacts into roadmap PRs.
- Preserve the ES256/HS256 workaround: user-facing functions keep `verify_jwt=false` and verify internally.
- Prefer characterization tests before refactoring large or risky modules.
- No new feature is prioritized unless it directly improves activation, retention, reliability, or a roadmap exit metric.
- Manage execution in two-week cycles, not a fixed multi-month commitment. Each cycle must ship at least one user-visible or production-verifiable improvement; re-plan the next cycle from evidence, not from this document's week numbers (they are estimates, not promises).
- Every hotfix, even a one-line migration, follows the full loop: change → regression test → typecheck/test/build → deploy → production verification → documented rollback path.

## Score targets

Re-baselined 2026-07-14 after the verified-findings audit (rows marked ↓ were lowered from the 2026-07-11 estimates so before/after claims stay honest).

| Area | Baseline | Target |
|---|---:|---:|
| Product value | 8.7 | 9.0 |
| Visual design | 8.0 | 8.8 |
| UX | 7.3 | 8.7 |
| Mobile | 7.2 | 8.6 |
| Accessibility | 6.6 | 8.6 |
| Performance | 7.2 ↓ | 8.7 |
| Frontend architecture | 7.2 | 8.5 |
| Backend/database | 7.5 ↓ | 8.8 |
| Security | 7.4 ↓ | 8.8 |
| Testing/CI | 6.8 ↓ | 8.7 |
| SEO/content | 8.0 ↓ | 9.1 |
| Maintainability | 6.6 ↓ | 8.5 |
| Operations | 7.5 | 8.6 |

## Status legend

- `ready`: can start now.
- `blocked`: requires a product choice, credential, data, or an earlier task.
- `later`: deliberately deferred until its dependencies are complete.
- `in-progress`: actively being implemented.
- `done`: acceptance criteria verified.

## Verified findings (2026-07-14 audit)

Live defects confirmed by reading code and, where noted, probing production. These justify Phase 0.5 running before Phase 0.

1. **Over-permissive notification INSERT policy (latent, not currently exploitable).** Policy `"Service can insert notifications"` is `FOR INSERT WITH CHECK (true)` with no `TO` clause (`supabase/migrations/20251222080505_...sql:63`). Production verification on 2026-07-14 found that `authenticated` currently has no table-level `INSERT` grant, so users cannot exploit the policy today; however, a future grant would immediately enable cross-user notification forgery. Drop verified safe: the only DB-side inserter is the `SECURITY DEFINER` trigger `notify_followers_on_livestream` (same file, line 77), the table has no `FORCE ROW LEVEL SECURITY`, and Edge Functions insert via service_role which bypasses RLS.
2. **feed-generate count truncation.** `supabase/functions/feed-generate/index.ts:113` (and lines ~150, ~241) selects all `event_registrations` with no `.limit()`; PostgREST caps at 1000 rows, so milestone counts go wrong once tables pass 1000 rows (~1669 users exist).
3. **EN blog post missing from sitemap.** `ppa-beijing-open-2026-recap` is in `BLOG_POST_META` (`functions/_lib/render/index.ts:1276`) but absent from `EN_BLOG_SLUGS` (`functions/sitemap-static.xml.ts:26`) — verified 0 occurrences in the live sitemap. The URL still serves 200; impact is reduced discovery/indexing, not a 404. Root cause: the blog pipeline has **five** manual touch points, not the four documented in CLAUDE.md.
4. **`mux-sync-assets` has no auth gate** (any anon-key holder can trigger Mux API sweeps); `log-client-event` accepts spoofable `user_id`, uncapped `details`, no rate limit.
5. **Entry bundle carries both locale dictionaries.** `src/i18n/en.ts` + `vi.ts` (356 KB source) load eagerly via `I18nProvider` (`src/App.tsx:8`) — entry chunk is 558 KB / 170 KB gzip while ~95% of users need one language. Largest remaining LCP lever.
6. **PWA precache is 8 MB / 376 entries** because `globIgnores: ["**/blog-data*"]` (`vite.config.ts:103`) no longer matches the per-slug blog chunks the build now emits.
7. **Test gaps at the money/rules layer:** 0/51 Edge Function handlers have tests (including `create-payment-order`, `mark-payment-claimed`); MLP total-score (sum, not fixed 28) is untested on both web and Swift; `apple/Tests` has 28 real tests that no CI workflow runs.
8. **Docs drift:** prerender cache key is `pr:v26`, CLAUDE.md says `pr:v6`; blog checklist says 4 steps, reality is 5.

## Phase 0.5 — Verified hotfixes (Days 1–3, before or parallel to Phase 0)

Small, evidence-backed, independently shippable. Each follows the full hotfix loop from the working agreement.

| ID | Status | Effort | Task | Depends on |
|---|---|---:|---|---|
| HOT-01 | done | 1d | Defense-in-depth migration: drop policy `"Service can insert notifications"`; add an RLS regression test proving the policy still blocks cross-user inserts even if table-level INSERT is granted later, and verify the livestream trigger remains operational; verify in production | — |
| HOT-02 | done | 1.5d | Fix `feed-generate` 1000-row truncation: replace unbounded selects with count RPCs or pagination in all three generators; assert counts against a seeded >1000-row fixture; verify a production feed-generate run produces correct milestone counts | — |
| HOT-03 | done | 0.25d | Add `ppa-beijing-open-2026-recap` to `EN_BLOG_SLUGS`; verify the slug appears in the deployed sitemap | — |
| HOT-04 | done | 1d | Gate `mux-sync-assets` — caller first, gate second. The 4-hourly schedule in `docs/cron-schedules.md` has NO matching `cron.schedule` in any migration, so the real caller lives only in production: (1) query `cron.job` via the Management API to locate it; if none is found, stop and resolve the drift before deploying any gate. (2) Add `requireCronRequest`, set `verify_jwt=false` in config.toml, update the caller to send `x-cron-secret`. Acceptance: GET → 405; POST with missing/wrong secret → 401; POST with correct secret → 200; the next scheduled run succeeds; no secret lands in a migration or the repository | — |
| HOT-05 | ready | 0.25d | Memoize the auth context value (`src/hooks/useAuth.tsx:103`) | — |
| HOT-06 | done | 0.25d | Update CLAUDE.md: cache key `pr:v26`, document the 5th blog touch point (`EN_BLOG_SLUGS`) until SEO-02 removes it | — |
| OPS-00 | done | 1.5d | Per-schedule cron health alerts for the three most critical crons (expand later): expected interval + grace period per job (4-hourly → alert at 6h; daily → 26h; weekly → 8d), distinguishing never-ran vs ran-and-failed vs partial-success vs caller-got-401/503. Do not wait for Phase 5 SLO work | — |
| HOT-07 | done | 0.5d | Restore and secure the production-only `zalo-token-refresh`: caller first to Vault-backed cron secret, then fail-closed function gate and source/config parity | BASE-06 inventory |

### Phase 0.5 exit

- All four production defects (HOT-01..04) verified fixed in production with a recorded check.
- A monitored cron silently failing triggers an alert within its configured interval plus grace period.

## Phase 0 — Baseline and decisions (Weeks 1–2)

| ID | Status | Effort | Task | Depends on |
|---|---|---:|---|---|
| BASE-01 | done | 2d | Define player and organizer north-star journeys and activation events | — |
| BASE-02 | ready | 3d | Instrument player registration and organizer publish funnels | BASE-01 |
| BASE-03 | done | 2d | Add route-level Web Vitals RUM segmented by device, with Vietnam as the primary segment and an international segment kept separate | — |
| BASE-04 | ready | 1d | Inventory only the 5–8 screens on the two north-star journeys, with start point, completion point, and observed drop-off point per journey (trimmed from top-20 routes: measurement, not documentation) | BASE-01 |
| BASE-05 | done | 1d | Decide mobile source of truth: SwiftUI replaces production Capacitor iOS; Android does not exist yet | — |
| BASE-06 | done | 2d | Create the Edge Function auth/service-role registry and CI validator design | — |
| BASE-07 | blocked | 3d | Run five player and five organizer baseline usability sessions | Recruiting participants |

### Phase 0 exit

- Activation definitions are version-controlled.
- Funnel and Web Vitals events are visible in production.
- The mobile decision is recorded as an ADR.
- Each future task has a measurable before/after value.

## Phase 1 — Security and platform foundation (Weeks 3–5)

| ID | Status | Effort | Task | Depends on |
|---|---|---:|---|---|
| SEC-01 | ready | 4d | Secure the production Capacitor iOS transition: remove tokens from callback with Universal Links + PKCE, unless SwiftUI release retires Capacitor first | BASE-05 |
| SEC-02 | done | 3d | Harden `batch-view-events`: derive user and organization server-side, validate target, add rate limits | BASE-06 |
| SEC-03 | done | 2d | Harden `log-client-event`: derive/null user, body cap, rate limit, retention | BASE-06 |
| SEC-04 | ready | 3d | Enforce the auth registry and fail CI for unclassified `verify_jwt=false` or service-role functions. Apply the five actor policies (public, user, admin, cron, internal service) together with operation-specific controls: public reads need validation + rate/cache controls; public mutations/callbacks need proof-of-purpose + abuse controls; user actions derive identity from JWT; admin actions add a role check; cron uses `requireCronRequest`; internal services use an approved machine credential | BASE-06 |
| SEC-05 | ready | 3d | Audit exposed views, RLS, function grants, and `SECURITY DEFINER search_path` | — |
| SEC-06 | blocked | 2d | Automate production migration drift check | Supabase CI credential |
| BE-01 | ready | 2d | Edge Function CORS/serve sweep (2026-07-14 audit): move `corsHeaders` into a new `_shared/cors.ts` (CORS is not auth — don't grow `auth.ts` into a grab-bag) and point all 37 inline copies at it; migrate 7 legacy `std@0.168 serve` functions to `Deno.serve` | SEC-04 |
| BE-03 | later | 3d | Pin one supabase-js version across functions (currently @2.39.0 ×37, @2 ×33, @2.89.0 ×1) — staged, not mechanical: normalize imports, test/deploy one function group, canary it, then roll the rest | BE-01 |
| BE-02 | ready | 3d | Fix admin push broadcast at the root (known bug #1): resolve recipients server-side with service_role, batch FCM sends via `Promise.allSettled` chunks, prune tokens FCM reports UNREGISTERED, add the missing confirm dialog (known bug #2) | SEC-04 |
| OPS-01 | ready | 2d | Document secret rotation, cron caller update, rollback, and incident procedures | SEC-04 |
| OPS-02 | blocked | 2d | Run and record a database restore drill | Production/backup access |
| DB-00 | ready | 2d | Verify (do not assume) the suspected race conditions before scheduling DB-01/DB-02: read `cancel-registration`/`reactivate-registration`/bracket advancement paths and attempt a two-concurrent-request reproduction against disposable Supabase. Output: confirmed/refuted per path, which sets DB-01/DB-02 scope | SEC-05 |

### Phase 1 exit

- No token is transported in a URL.
- Public telemetry cannot impersonate authenticated users.
- Every privileged Edge Function has a tested auth classification.
- Drift, secret rotation, and recovery have documented evidence.

## Phase 2 — Design system and accessibility (Weeks 6–9)

| ID | Status | Effort | Task | Depends on |
|---|---|---:|---|---|
| DS-01 | ready | 2d | Standardize the semantic token list (names + meanings), grounded in the 5–8 journey screens from BASE-04 | BASE-05, BASE-04 |
| DS-02 | later | 2d | Hand-write one web token file and one Swift token file sharing the DS-01 names, plus a lightweight parity check (checklist or small test) that every required token exists on both platforms. No codegen — build a generator only if parity drift actually recurs | DS-01 |
| DS-03 | later | 5d | Standardize Button, IconButton, Input, Select, Card, Badge, Dialog, and Sheet | DS-02 |
| DS-04 | later | 3d | Standardize Empty, Loading, Error, Offline, and Permission states | DS-03 |
| A11Y-01 | ready | 3d | Add skip link, route focus management, heading rules, and dialog focus tests | BASE-04 |
| A11Y-02 | later | 4d | Raise primary mobile touch targets to 44px and provide drag alternatives | DS-03 |
| A11Y-03 | ready | 3d | Add global reduced-motion behavior and audit animations | BASE-04 |
| A11Y-04 | later | 4d | Add axe and keyboard tests for the 5–8 screens on the two north-star journeys, then expand by traffic/risk | A11Y-01, DS-03 |
| A11Y-05 | blocked | 3d | Run VoiceOver, Dynamic Type, keyboard-only, and contrast manual audit | DS-03, test devices |

### Phase 2 exit

- Web and SwiftUI share the same semantic token names and values, verified by the parity check.
- Core components meet state, focus, and touch specifications.
- Lighthouse accessibility is at least 95 on critical routes.
- No critical or serious axe issue remains.

## Phase 3 — Player and organizer UX (Weeks 10–15)

| ID | Status | Effort | Task | Depends on |
|---|---|---:|---|---|
| UX-01 | later | 4d | Design and implement organizer setup checklist/status model. May start from analytics, support feedback, and the first 3–5 usability sessions; the full BASE-07 baseline is only required before UX-09 concludes effectiveness | DS-03, partial BASE-07 |
| UX-02 | later | 5d | Add tournament/event templates for the five most common formats | UX-01 |
| UX-03 | later | 5d | Apply progressive disclosure to advanced tournament settings | UX-01 |
| UX-04 | later | 4d | Add draft autosave and visible last-saved state | UX-01 |
| UX-05 | later | 4d | Add pre-publish validation with direct recovery actions | UX-01 |
| UX-06 | later | 4d | Add undo/rollback for reversible destructive organizer actions | UX-01 |
| UX-07 | later | 4d | Simplify player discovery-to-registration journey. Same relaxed dependency as UX-01: start on partial research, conclude on full baseline | DS-03, partial BASE-07 |
| UX-08 | later | 3d | Standardize mobile back, deep-link, scroll, and state restoration behavior | BASE-05, DS-03 |
| UX-09 | blocked | 3d | Repeat usability sessions and calculate task success, time, and SUS | UX-01..UX-08, participants |

### Phase 3 exit

- Organizer setup time is at least 40% faster.
- Player and organizer critical task success is at least 90%.
- SUS is at least 80.
- Setup abandonment and support questions show a measurable reduction.

## Phase 4 — Architecture, transactions, and quality (Weeks 16–22)

| ID | Status | Effort | Task | Depends on |
|---|---|---:|---|---|
| ARCH-01 | ready | 2d | Define feature/domain module boundaries and dependency rules | BASE-04 |
| ARCH-02 | later | 5d | Refactor Social Event registration/payment into domain/application/infrastructure/UI layers | ARCH-01 |
| ARCH-03 | later | 5d | Refactor Team Match orchestration and realtime boundaries | ARCH-01 |
| ARCH-04 | later | 12d | Split across multiple PRs (one format at a time onto the shared core). Extract a shared scoring/setup core for the four tournament formats (QuickTable, TeamMatch, DoublesElimination, Flex), then refactor orchestration onto it. The four formats look alike but carry different rules — write characterization tests per format FIRST (QA-07 is the first of these), refactor second. Evidence: MatchScoring vs DoublesEliminationScoring are ~1,300 near-duplicate lines each; setup pages share 206 identical lines | ARCH-01, QA-07 |
| ARCH-05 | later | 2d | Collapse the manual `/vi/*` route mirror in `src/App.tsx` (~45 duplicated entries) into one wrapper route or a route-config array mapped twice | ARCH-01 |
| DB-01 | later | 3d | Transactional RPC for reactivation and final-slot capacity — only if DB-00 confirms the race; close as "not needed" if DB-00 refutes it | DB-00 confirms race |
| DB-02 | later | 5d | Transactionalize bracket advancement and sensitive state transitions — only paths DB-00 confirmed | DB-00, ARCH-03, ARCH-04 |
| QA-01 | ready | 4d | Reduce React Hook warnings to zero with behavior tests | — |
| QA-02 | later | 8d | Remove `@ts-nocheck`, type critical boundaries, and reach repository lint green (267 grandfathered errors; also re-enable `no-unused-vars` — currently nothing catches dead code). Split by domain, one PR per domain | QA-01 |
| QA-03 | ready | 4d | Add RLS/auth matrix and concurrency tests against disposable Supabase | SEC-05 |
| QA-04 | later | 5d | Add stable E2E coverage for ten critical journeys | BASE-04, QA-03 |
| QA-05 | later | 4d | Add visual regression for key routes, themes, locales, and states | DS-04, BASE-04 |
| QA-06 | done | 2.5d | Run all 42 `apple/Tests` cases in CI on a macOS runner with XcodeGen + `xcodebuild test`; direct Swift package versions are pinned so clean generations do not drift | — |
| QA-07 | ready | 2d | Characterization tests for MLP total-score mode on web AND Swift (each game to 7, match total = sum of games, NOT fixed 28 — the known-trickiest rule, untested on both platforms) | — |
| QA-08 | ready | 3d | Unit-test the money path: extract `create-payment-order` / `mark-payment-claimed` handler logic into `_shared` and cover with the existing Vitest-over-supabase-shared pattern | — |

### Phase 4 exit

- Repository-wide lint/type/test/build are green.
- Critical data transitions are atomic.
- Critical journeys have unit, contract, database, and E2E protection.
- Large features have documented module boundaries.

## Phase 5 — Performance, SEO, and operations (Weeks 23–26)

| ID | Status | Effort | Task | Depends on |
|---|---|---:|---|---|
| PERF-01 | ready | 3d | Establish route, initial JS, CSS, image, and PWA precache budgets | BASE-03 |
| PERF-02 | later | 5d | Split Mux/HLS, charts, and heavy workspaces at feature boundaries. Note (2026-07-14 audit): Mux/HLS (`vendor-video`, 1.07 MB) and charts (411 kB) are ALREADY lazy — verify with `ANALYZE=1 npm run build` before spending here; the remaining real targets are `TeamMatchView` (241 kB single route chunk) and the entry itself (see PERF-06) | PERF-01, ARCH-01 |
| PERF-03 | later | 2d | Reduce PWA precache below 3MB and define offline behavior. Root cause already identified: `globIgnores: ["**/blog-data*"]` in `vite.config.ts:103` matches nothing since blog content became per-slug chunks; fix patterns for blog chunks + `vendor-charts*` + `TeamMatchView*` + `QuickTableView*` | PERF-01 |
| PERF-04 | later | 4d | Optimize responsive images, aspect ratios, fonts, and content loading | PERF-01 |
| PERF-05 | later | 3d | Validate CWV p75 targets with Vietnam field data | PERF-02..PERF-04 |
| PERF-06 | ready | 2d | Lazy-load locale dictionaries: dynamic-import `vi.ts`/`en.ts` in `I18nProvider`, ship only the active language. Cuts ~50–80 kB gzip from the 170 kB entry — the single largest LCP lever; independent of other PERF tasks and safe to pull into an early cycle | — |
| SEO-01 | ready | 3d | Specify a single content manifest for React, SSR, sitemap, RSS, hreflang, and OG | — |
| SEO-02 | later | 5d | Generate current SEO surfaces from the manifest — must subsume `BLOG_POST_META` (`functions/_lib/render/index.ts:1257`) and `EN_BLOG_SLUGS` (`functions/sitemap-static.xml.ts:26`), collapsing the 5 manual blog touch points to ≤3 | SEO-01 |
| SEO-03 | later | 3d | Add CI validation for canonical, reciprocal locale links, schema, image, and bot 200 status. Include a fixture test that fails when a `src/content/blog/metadata.ts` slug is missing from any generated SEO surface (automates the exact failure class of HOT-03) | SEO-02 |
| SEO-04 | later | 3d | Split `functions/_lib/render/index.ts` (2,435 lines, 38 handlers) by domain, following the existing `match-seo.ts`/`venues.ts` pattern; move the ~150-line cache-bump changelog out of the middleware into a doc | SEO-02 |
| OPS-03 | ready | 3d | Define availability, auth, registration, scoring, cron, and latency SLOs | BASE-02 |
| OPS-04 | later | 4d | Build actionable dashboards and alerts tied to SLOs | OPS-03, BASE-03 |

### Phase 5 exit

- Mobile p75 CWV meets the good thresholds.
- PWA precache is below 3MB.
- SEO metadata is generated from one manifest.
- Actionable SLO dashboards and alerts are live.

## Phase 6 — Consolidation and final audit (Weeks 27–28)

| ID | Status | Effort | Task | Depends on |
|---|---|---:|---|---|
| CLOSE-01 | later | 3d | Remove deprecated mobile, auth, component, and feature paths — including `src/pages/preview/` (~4,000 lines of the retired "The Line" web redesign, 12 routes still mounted) and `PublicProfile.tsx` (already marked "delete once confirmed", `src/App.tsx:131`) | Earlier phases |
| CLOSE-02 | later | 2d | Update architecture docs, runbooks, and developer onboarding | Earlier phases |
| CLOSE-03 | later | 3d | Run final UX, accessibility, performance, security, and codebase audit | All phases |
| CLOSE-04 | later | 1d | Publish scorecard with evidence and remaining exceptions | CLOSE-03 |

## Recommended first cycles

A solo two-week cycle holds roughly 8–10 focused days once review, deploys, production verification, and surprises are counted. Plan against that, not against summed estimates.

### Cycle 1 (~8 days committed)

Committed:

1. `HOT-01`..`HOT-04` — verified production defects (~3.75d with regression tests and production checks).
2. `HOT-06` — CLAUDE.md drift fix (0.25d).
3. `BASE-01` — north-star journeys and activation definitions (2d).
4. `BASE-03` — Web Vitals RUM at minimal instrumentation level (collect first, dashboards later) (2d).

Stretch, only if the committed list lands early:

- `HOT-05` — auth context memo (0.25d).
- `OPS-00` — per-schedule cron health alerts (1.5d).

### Cycle 2

1. Whatever slipped from Cycle 1 (including `OPS-00` if unstarted — do not let it slip past Cycle 2).
2. `BASE-06` — privileged Edge Function auth registry design.
3. `SEC-02` / `SEC-03` — harden telemetry endpoints.
4. `QA-06` — turn on `apple/Tests` in CI (pure activation).
5. `PERF-06` — lazy-load locale dictionaries, if capacity allows; otherwise it opens Cycle 3.

`BASE-05` is complete. The next mobile decision belongs inside `SEC-01`: compare the expected SwiftUI App Store release date with the cost of securing the transitional Capacitor callback, then choose the safer path with the least duplicated work.

## Task execution template

When starting a task, use this format:

```text
Start TASK-ID.
Goal: <one measurable outcome>
Scope: <files/surfaces included>
Out of scope: <explicit exclusions>
Acceptance: <tests/metrics/evidence>
```

At completion, update the task status and append a short record:

```text
Completed: TASK-ID
PR/commit: <reference>
Evidence: <commands, metrics, screenshots, production checks>
Follow-ups: <new task IDs or none>
```

## Decision log

Record durable choices here or link an ADR.

| Date | Decision | Reason | Follow-up |
|---|---|---|---|
| 2026-07-11 | Target 8.5–9 through consolidation before feature expansion | Maintainability, UX complexity, and platform duplication are current constraints | Execute Phase 0 |
| 2026-07-11 | SwiftUI `/apple` is the target iOS app and will replace the App Store Capacitor WebView app; Android has not been built yet | Avoid maintaining two permanent iOS implementations and avoid carrying the transitional OAuth design into Android | ADR-001, SEC-01 |
| 2026-07-14 | Merge Claude audit into this roadmap; add Phase 0.5 hotfixes ahead of Phase 0 | Four production defects were verified with file:line/production evidence; measuring for two weeks while known defects run is the wrong order | HOT-01..06, OPS-00 |
| 2026-07-14 | Dropping the notifications INSERT policy confirmed safe; production metadata showed the issue is latent rather than currently exploitable | `authenticated` has no INSERT table grant today; the only DB-side inserter is the SECURITY DEFINER trigger `notify_followers_on_livestream`; no FORCE RLS on the table; Edge Functions use service_role | HOT-01 |
| 2026-07-14 | Two-week cycles replace fixed week-number commitments | Solo-dev roadmap dies in a multi-week refactor with nothing shipping; week numbers stay as estimates only | Working agreement |
| 2026-07-14 | Race conditions must be verified before transaction work is scheduled | DB-01/DB-02 scope was assumption-based; DB-00 added as the gate | DB-00 |
| 2026-07-14 | Codex review round 1 applied: HOT-04 must locate and update the production cron caller (no `cron.schedule` for `mux-sync-assets` exists in migrations — caller is prod-only, drift must be resolved first); design tokens stay hand-written per platform with a parity check, codegen only if drift recurs; Cycle 1 capped at ~8 committed days; OPS-00 uses per-schedule interval+grace, not a flat 26h; DB-01 gated on DB-00 confirming the race; A11Y scope aligned to the 5–8 journey screens; efforts padded (HOT-01/02/04, OPS-00, QA-06, ARCH-04, QA-02); CORS helper split into `_shared/cors.ts`; supabase-js pin staged as BE-03 with canary; score baselines lowered to post-audit values | Codex review verdict: usable as the official roadmap after these fixes | — |
| 2026-07-15 | Keep five Edge auth actor classes, but model operation, credential, and authorization separately | Public mutations, guest magic-token actions, and provider callbacks cannot safely be mislabeled as “public read-only”; service-role client use is also distinct from accepting service role as caller auth | BASE-06 registry; SEC-04 enforcement |
| 2026-07-15 | Preserve the existing 30-second view-event measurement semantics while deriving identity, organization, and replay state server-side; cap fixed windows at 120 authenticated or 600 anonymous ticks per 10 minutes | The 30-day production baseline was 2,701 ticks and the highest identity window was 15 ticks per 10 minutes. The authenticated limit leaves 8x headroom; the higher anonymous allowance reduces shared-NAT false positives while still bounding abuse | SEC-02; re-evaluate from rate-limit telemetry if legitimate traffic approaches the cap |
| 2026-07-15 | Retain client errors for 90 days; limit ingestion to 60 authenticated or 120 anonymous events per 10 minutes, 20 CSP reports per request, and 32 KiB per body | The admin UI needs at most 30 days. Production had 423 events/30d, a 30-event system-wide peak per 10 minutes, and a 3,048-byte maximum reconstructed payload; the selected controls preserve 3x history and substantial traffic/payload headroom while bounding a public write endpoint | SEC-03; revisit only if legitimate limiter telemetry approaches the cap |
| 2026-07-15 | Pin the Apple app's direct Swift packages and update them intentionally | A clean XcodeGen run resolved the broad Supabase range differently from the existing developer project; CI must test a reproducible dependency graph instead of silently upgrading it | QA-06; update pins in a dedicated dependency change |

## Completion log

| Date | Task | PR/commit | Evidence |
|---|---|---|---|
| 2026-07-11 | BASE-05 | Source commit `e91961fd` | ADR-001 records current mobile state and migration direction |
| 2026-07-14 | HOT-01 | Source commit `e91961fd`; migration `20260714090000` recorded as applied | Production: permissive policy count `1 → 0`; authenticated INSERT grant remains false; simulated future INSERT grant is still blocked by RLS; trigger count `1`; function remains `SECURITY DEFINER`; TypeScript/build pass; Vitest 557 pass, 10 skipped; 269 migrations have no duplicate versions/content |
| 2026-07-14 | HOT-02 | Source commit `e91961fd`; migration `20260714100000` recorded as applied; `feed-generate` v36 active | Three service-role-only `SECURITY INVOKER` aggregate RPCs replace unbounded reads; pgTAP 10/10 with 1,001 registrations + 1,001 DUPR snapshots; production event aggregate matches direct SQL; production run returned HTTP 200 with all generators successful; TypeScript/build pass; Vitest 557 pass, 10 skipped; 270 migrations have no duplicate versions/content. Rollback: redeploy the prior `feed-generate` bundle, then drop the three `feed_*` RPCs (leave ledger reconciliation to `SEC-06`) |
| 2026-07-14 | HOT-03 | Source commit `e91961fd`; Cloudflare Pages production deployment `9554f704` | Regression test passes; `www.thepicklehub.net/sitemap-static.xml` returns HTTP 200 with the Beijing recap `<loc>` and reciprocal hreflang references (3 slug occurrences total). Rollback: remove the manifest entry and redeploy the previous Pages bundle |
| 2026-07-14 | HOT-04 | Source commit `e91961fd`; `mux-sync-assets` v36; production cron job `19` | Production had no mux caller and no `cron_secret` Vault entry, so the drift was resolved before gating: job `mux-sync-assets-every-4-hours` now runs `0 */4 * * *`, reads the existing shared secret through Vault, and sends `x-cron-secret`. GET 405; missing/wrong POST 401; correct POST 200. Scheduled verification run `17759` succeeded and pg_net recorded HTTP 200, then the schedule was restored after the temporary every-minute test. The test first exposed an escaped dollar-quote in the new caller; run `17758` failed parse, the command was corrected, and no gate was declared complete until the next run passed. No secret is in source or migrations. Rollback: deactivate job `19`, redeploy the prior function bundle, and remove the unused Vault alias only after checking references |
| 2026-07-14 | HOT-06 | Source commit `e91961fd` | `CLAUDE.md` now matches `pr:v26` and documents all five manual blog touch points, including the `EN_BLOG_SLUGS` sitemap manifest. Rollback: revert the two documentation corrections |
| 2026-07-14 | BASE-01 | Source commit `e91961fd`; `docs/north-star-journeys.md` | Player self-registration and organizer publication have versioned start/completion events, branch properties, 30-minute/24-hour funnel windows, dedup/PII rules, database truth definitions, and explicit proxy/manual/draft exclusions. The missing organizer `published_at` transition timestamp is recorded for BASE-02. Rollback: revert the contract before any BASE-02 instrumentation depends on it |
| 2026-07-14 | BASE-03 | Source commit `e91961fd`; Cloudflare Pages production deployment `9554f704` | `web-vitals` v5.3.0 is lazy-loaded as a separate 6.31 kB chunk; GA4 receives `web_vital` with sanitized route, device class, market segment, locale, app surface, rating, and raw metric value. `/api/rum-context` maps Cloudflare country to `vn` / `international` / `unknown` with `no-store`; production returned `vn`. Chrome mobile verification observed FCP and TTFB for `/social/:id` with `device_class=mobile`, `market_segment=vn`, and no page errors on the source-linked deployment. Browser verification also caught that initial direct deployment `28b00bab` had been built without Vite environment variables; it was immediately superseded by `aed17d73`, then the push-linked build `9554f704`. The first post-push quality run exposed statement coverage at 82.17%; a runtime observer regression test raised it to 84.53%. Vitest 572 pass/10 skipped; TypeScript, ESLint, production build, and production dependency audit pass. Rollback: redeploy the prior Pages deployment and remove the RUM bootstrap/dependency/context endpoint |
| 2026-07-15 | OPS-00 | Source commit `b46f6f83`; migrations `20260715130000` + `20260715140000` recorded as applied; `errors-telegram-alert` v15 active | Production audit caught the exact false-green failure this task targets: `errors-telegram-alert-10min` was marked succeeded by pg_cron while pg_net returned HTTP 401. The caller now sends the Vault-backed `x-cron-secret`; all five cron-only callers were moved off plaintext `cron.job.command` secrets and the shared secret was rotated across Vault/Edge. Three per-schedule monitors are active: Mux 4h+2h, DUPR backfill 24h+2h, and GitHub weekly rankings 7d+1d. Instrumented production runs and the next real 10-minute scheduled run returned HTTP 200; all three states are `healthy` and alert-state rows have no errors/incidents. Evaluator distinguishes `never_ran`, `stale`, `ran_failed`, `partial_success`, and `caller_auth_failed` (401/503), with incident dedupe/reminders and recovery messages. A concurrently merged scheduler-only monitor was reconciled and removed because it could not observe downstream pg_net HTTP status; production has zero duplicate monitor jobs. Vitest 622 pass/10 skipped; TypeScript, targeted ESLint, production build, migration transaction validation, ledger verification, and plaintext-secret scan pass. Repository-wide lint remains on its pre-existing legacy baseline (119 errors) and is tracked by QA-01/QA-02. Rollback: disable the three `ops_cron_monitors`, redeploy function v11, and leave the inert ledger tables/callers in place—the Vault-backed caller change is independently safe. |
| 2026-07-15 | HOT-07 | Source commit `8a95d1dd`; migration `20260715150000` recorded as applied; `zalo-token-refresh` v21 active | BASE-06 production parity found a deployed orphan whose documented service-role gate was absent and whose cron command embedded an `sb_secret_…` credential. Caller moved first to Vault-backed `x-cron-secret`; source restored with `requireCronRequest`. Production: GET 405; missing/wrong POST 401; correct Vault-secret POST 200; job `9` remains active at `0 */23 * * *`; command uses Vault and contains no plaintext secret. Rollback: redeploy function v20 only after restoring a secured caller; do not restore the plaintext job command. |
| 2026-07-15 | BASE-06 | Source commit `8a95d1dd`; `docs/edge-function-auth-registry.md` | Registry covers 76/76 source functions and 76/76 config sections with 95 auth flows, 70 service-role clients, and 14 service-role bearer endpoints. Network-free report validator has zero schema/coverage/drift errors and 15 explicit warnings queued for SEC-02/03/04; strict CI activation is designed but deliberately deferred to SEC-04. Production list matches source after HOT-07. Vitest 628 pass/10 skipped across 44 files; 83.58% statement coverage; TypeScript, targeted ESLint, production build, dependency audit, migration duplicate check, and registry tests pass. Rollback: revert the registry/docs/validator; HOT-07 is independently safe and should remain. |
| 2026-07-15 | SEC-02 | Source commit `60116593`; migration `20260715160000` recorded as applied; `batch-view-events` v44 active | The endpoint now discards caller-supplied user/organization/replay fields, resolves targets and organization/replay state server-side, derives optional user identity from the JWT, enforces a 32 KiB/20-event contract, and atomically rate-limits hashed identities without storing raw identity in the limiter. Production: valid anonymous tick 200/inserted once; immediate repeat 200/deduplicated; mismatched target 400; 21 ticks 413; a spoof probe stored server-derived values. The probe row and exact aggregate increment were removed afterward. The old permissive INSERT policy is gone and only `service_role` can execute the limiter RPC. Vitest 633 pass/10 skipped across 45 files with 83.61% statement coverage; TypeScript, targeted ESLint, production build, dependency audit, migration duplicate check, registry validation, transaction validation, and production contract checks pass. Rollback: restore the preceding Pages deployment together with function v43; leave the inert limiter objects in place until a follow-up migration removes them. |
| 2026-07-15 | SEC-03 | Source commit `9ccfa939`; migration `20260715170000` recorded as applied; `log-client-event` v12 active; retention cron job `28` active | Optional user identity and user agent are server-derived; JS/CSP fields are whitelisted and bounded; URL queries/fragments/credentials and data/blob bodies are stripped; bodies are capped at 32 KiB; Reporting API batches at 20; hashed fixed windows allow 60 authenticated or 120 anonymous events/10m. A private daily cron retains 90 days, and anonymous table SELECT was revoked. Production returned 405/400/413/204/429 for the method, malformed, oversized, valid, and saturated-limit probes. Stored probes contained sanitized/server fields and no spoofed/query data; both rows and limiter state were removed, returning to the 898-row baseline. Vitest 640 pass/10 skipped across 46 files with 83.91% statement coverage; TypeScript, targeted ESLint, production build, dependency audit, migration duplicate check, registry validation, transaction validation, and production contract checks pass. Rollback: restore the preceding Pages deployment and function v11 together; leave the independently safe grant/retention objects in place unless a follow-up migration explicitly removes them. |
| 2026-07-15 | QA-06 | Source commit `5fc6d89e`; GitHub Actions run `29401010455` | A clean `macos-15` runner installed XcodeGen 2.45.4, generated the ignored Xcode project and placeholder secrets, then passed 42/42 Swift tests on Xcode 16.4 with an iOS 18.5 iPhone 16 Pro simulator in 6m15s. The same clean-generation path passed 42/42 locally on Xcode 26.3/iOS 26.2. Supabase Swift 2.48.0 and Google Sign-In 7.1.0 are exact direct dependencies; no production credentials are required. Quality, Security, Deploy guard, and Playwright were also green on the source commit. |

## Current execution checkpoint

Last updated: 2026-07-15 after completing QA-06.

- Active task: none. `HOT-01`..`HOT-04`, `HOT-06`, `HOT-07`, `BASE-01`, minimum-scope `BASE-03`, `BASE-06`, `OPS-00`, `SEC-02`, `SEC-03`, and `QA-06` are complete.
- Next task: `PERF-06` per the Cycle 2 list. `SEC-04` is also unblocked because both telemetry endpoints are hardened.
- `QA-06` CI state: GitHub Actions run `29401010455` passed 42/42 Apple tests on a clean `macos-15` runner with Xcode 16.4/iOS 18.5; source commit `5fc6d89e` also passed Quality, Security, Deploy guard, and Playwright.
- `SEC-03` production state: migration `20260715170000` is recorded as applied; `log-client-event` v12 and retention cron job `28` are active. Contract probes covered 405/400/413/204/429 responses and verified server-derived identity/user-agent plus URL/detail sanitization. Probe rows and limiter state were removed; `client_errors` returned to 898 rows. Registry validation now has 13 report-only warnings.
- `SEC-02` production state: migration `20260715160000` is recorded as applied and `batch-view-events` v44 is active. Identity, organization, and replay state are server-derived; valid, dedup, invalid-target, over-limit, and spoof-resistance probes returned the expected results. Test analytics were removed after verification.
- `BASE-06` production/source state: 76 source functions, 76 explicit config sections, 76 active production functions, and zero registry drift errors. The report-only validator intentionally lists 13 findings; strict CI activation belongs to SEC-04.
- `HOT-07` production state: `zalo-token-refresh` v21 and cron job `9` are active; the caller reads `cron_secret` from Vault and the function requires `x-cron-secret`. GET returns 405, missing/wrong POST returns 401, and an authenticated refresh returned 200. Migration `20260715150000` is in the ledger and the job command contains no plaintext secret.
- `OPS-00` production state: migrations `20260715130000` and `20260715140000` are recorded as applied; `errors-telegram-alert` v15 is active; pg_net request/response ledgers report HTTP 200 for Mux and DUPR daily backfill; the latest scheduled GitHub rankings workflow is healthy; the alert dispatcher returns all three states as `healthy` with an empty errors array. Its next real 10-minute scheduled invocation returned HTTP 200 after the secret rotation. The superseded duplicate monitor is unscheduled/deleted, the original silent HTTP 401 is fixed, and no cron command contains a plaintext shared secret.
- `HOT-01` production state: migration `20260714090000` was applied through the Supabase Management API and recorded as applied in the migration ledger. Production verification returned policy count `0`, trigger count `1`, `SECURITY DEFINER = true`, and no authenticated table-level INSERT grant.
- Audit correction: the removed notification policy was latent defense-in-depth risk, not an actively exploitable cross-user insert, because production `authenticated` had no INSERT grant.
- `HOT-02` production state: migration `20260714100000` is recorded as applied; `feed-generate` v36 is active with `verify_jwt=false`; a production cron-authenticated run returned HTTP 200 and no generator errors. The three RPCs are executable only by `service_role` and the >1,000-row pgTAP regression passes 10/10.
- `HOT-04` production state: `mux-sync-assets` v36 is active with `verify_jwt=false`; cron job `19` is active at `0 */4 * * *`, references Vault rather than embedding a secret, and its scheduled verification produced HTTP 200 after the test caught and corrected an initial caller parse error.
- `BASE-03` production state: source-linked Pages deployment `9554f704` is active on `www.thepicklehub.net`; the country context endpoint returns the Vietnam segment for a Vietnam request and the production bundle emitted route/device/market-segmented `web_vital` events in a mobile Chrome verification.
- Direct `wrangler pages deploy dist` does not inject build-time Pages variables. Before any future local production build, load the production `VITE_*` values from the Pages project configuration into the build process; never deploy a locally built Vite bundle without the browser runtime check.
- Production migration history has substantial pre-existing ledger drift: dry-run listed more than 100 older local migrations as absent from the remote ledger. Never run `db push --include-all`. Track reconciliation under `SEC-06`; deploy narrowly scoped hotfix SQL only after inspecting production state.
- Final Cycle 1 quality evidence: `npx tsc -b --noEmit` passed; Vitest 572 passed / 10 skipped across 41 files with 84.53% statement coverage; targeted ESLint passed; production build passed; production dependency audit found 0 vulnerabilities; migration duplicate check passed for 270 migrations.
- The production-seeded replay guards originally added in PR #278 were accidentally removed by commit `19a6777d`; restoring them makes local replay pass the former `20260513140000_event_prepayment_required.sql` blocker and all later evolving-function refreshes. Fresh-schema replay now reaches `20260706120000_profiles_pii_column_lockdown.sql` and stops because `profiles.looking_for_game` is absent from migration-built schema even though it exists in production. HOT-02 SQL was also validated in an isolated Supabase Postgres and against the production schema inside `BEGIN`/`ROLLBACK`; track the remaining historical schema/ledger reconciliation under `SEC-06`.
- Credential source is outside the repository at `/Users/cm10/Downloads/secrets.local.md`. Read secrets at runtime without printing them, never copy them into code, logs, migrations, docs, or shell command literals.
- Preserve all unrelated untracked Android, Capacitor iOS, `skills-lock.json`, `docs/agent-loops-plan.md`, and other user-owned artifacts.
- Primary Cycle 1 source is committed as `e91961fd`; unrelated untracked Android, Capacitor iOS, lock, and agent-plan artifacts remain intentionally outside the roadmap commits.
