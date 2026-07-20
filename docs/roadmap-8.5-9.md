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
| HOT-05 | done | 0.25d | Memoize the auth context value (`src/hooks/useAuth.tsx:103`) | — |
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
| BASE-02 | done | 3d | Instrument player registration and organizer publish funnels | BASE-01 |
| BASE-03 | done | 2d | Add route-level Web Vitals RUM segmented by device, with Vietnam as the primary segment and an international segment kept separate | — |
| BASE-04 | done | 1d | Inventory only the 5–8 screens on the two north-star journeys, with start point, completion point, and observed drop-off point per journey (trimmed from top-20 routes: measurement, not documentation) | BASE-01 |
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
| SEC-01 | done | 4d | Secure the production Capacitor iOS transition: remove tokens from callback with Universal Links + PKCE, unless SwiftUI release retires Capacitor first | BASE-05 |
| SEC-02 | done | 3d | Harden `batch-view-events`: derive user and organization server-side, validate target, add rate limits | BASE-06 |
| SEC-03 | done | 2d | Harden `log-client-event`: derive/null user, body cap, rate limit, retention | BASE-06 |
| SEC-04 | done | 3d | Enforce the auth registry and fail CI for unclassified `verify_jwt=false` or service-role functions. Apply the five actor policies (public, user, admin, cron, internal service) together with operation-specific controls: public reads need validation + rate/cache controls; public mutations/callbacks need proof-of-purpose + abuse controls; user actions derive identity from JWT; admin actions add a role check; cron uses `requireCronRequest`; internal services use an approved machine credential | BASE-06 |
| SEC-05 | done | 3d | Audit exposed views, RLS, function grants, and `SECURITY DEFINER search_path` | — |
| SEC-06 | done | 2d | Automate production migration drift check | Supabase CI credential |
| BE-01 | done | 2d | Edge Function CORS/serve sweep: move `corsHeaders` into `_shared/cors.ts`, preserve all 15 characterized policy variants, remove all inline declarations, and leave all 76 handlers on `Deno.serve` | SEC-04 |
| BE-03 | done | 3d | Pin one supabase-js version across functions — target @2.89.0 (already proven on mux-create-livestream). **Stage 1 done:** 34 floating @2 imports frozen to @2.89.0 (no-op vs deployed reality — floaters resolve latest at deploy). **Stage 2 (quiet window):** bump the 42×@2.39.0 imports in category batches with canary | BE-01 |
| BE-02 | done | 3d | Fix admin push broadcast at the root (known bug #1): resolve recipients server-side with service_role, batch FCM sends via `Promise.allSettled` chunks, prune tokens FCM reports UNREGISTERED, add the missing confirm dialog (known bug #2) | SEC-04 |
| OPS-01 | done | 2d | Document secret rotation, cron caller update, rollback, and incident procedures | SEC-04 |
| OPS-02 | blocked | 2d | Run and record a database restore drill | Production/backup access |
| DB-00 | done | 2d | Verify (do not assume) the suspected race conditions before scheduling DB-01/DB-02: read `cancel-registration`/`reactivate-registration`/bracket advancement paths and attempt a two-concurrent-request reproduction against disposable Supabase. Output: confirmed/refuted per path, which sets DB-01/DB-02 scope | SEC-05 |

### Phase 1 exit

- No token is transported in a URL.
- Public telemetry cannot impersonate authenticated users.
- Every privileged Edge Function has a tested auth classification.
- Drift, secret rotation, and recovery have documented evidence.

## Phase 2 — Design system and accessibility (Weeks 6–9)

| ID | Status | Effort | Task | Depends on |
|---|---|---:|---|---|
| DS-01 | done | 2d | Standardize the semantic token list (names + meanings), grounded in the 5–8 journey screens from BASE-04 | BASE-05, BASE-04 |
| DS-02 | done | 2d | Hand-write one web token file and one Swift token file sharing the DS-01 names, plus a lightweight parity check. **Shipped 2026-07-18** (#401): Swift gains 12 canonical tokens (green/dim/glow, gold-glow, blue/glow, dim, hairline, 4 format accents — dynamic dark+light); web deletes legacy aliases fg-1/bg-1/bg-2 (14 call sites migrated); `src/lib/__tests__/design-token-parity.test.ts` (54 assertions) fails on missing canonical token either side or undocumented Swift extra. accentInk/accentText kept as documented platform-local (deliberate dual-accent, not remnants). No codegen | DS-01 |
| DS-03 | done | 5d | Standardize Button, IconButton, Input, Select, Card, Badge, Dialog, and Sheet. **Shipped 2026-07-18** (#403, proposal ds-03-component-standardization qua /idea 2 vòng panel): Button + variant `tl-primary` (kem) theo bảng map D4 (green→default, base→outline); 44px touch targets (default h-11, icon 44×44, lg h-12) — phần Button của A11Y-02 đóng luôn; 4 journey screens rời `.tl-btn`; ratchet changed-files trong check-theline (report-only → HARD sau 2026-08-01); native TLButton(.green/.cream/.outline) + TLIconButton(label bắt buộc)/TLBadge/TLSelect/TLSheet(ScrollView)/TLDialog + TLComponentsRenderTests chạy AX3 trong CI (bộ UI test native đầu tiên). App Store submit vẫn RED-gated chờ checklist test tay | DS-02 |
| DS-04 | done | 3d | Standardize Empty, Loading, Error, Offline, and Permission states. **Shipped 2026-07-19** (#404): `src/components/states/PageStates.tsx` — LoadingState (page + fullScreen, role=status), ErrorState (role=alert + retry Button), OfflineBanner (navigator.onLine, mounted 1 lần trong App.tsx); `useSocialEvent`/`useClub` throw thay vì nuốt lỗi → hết class "lỗi mạng hiện 404 giả" (P1/O1 wire isError→ErrorState); dedupe 4 spinner tự chế (PageLoader/RequireAuth/ConditionalAuth/wizard); i18n `errors.offline`; convention chốt ở `docs/state-patterns.md` (Empty giữ `.tl-empty`, mutation giữ toast, permission giữ RequireAuth redirect — legacy sites migrate khi chạm, không big-bang); 5 jsdom contract tests | DS-03 |
| A11Y-01 | done | 3d | Add skip link, route focus management, heading rules, and dialog focus tests | BASE-04 |
| A11Y-02 | done | 4d | Raise primary mobile touch targets to 44px and provide drag alternatives. **Button 44px shipped trong DS-03 (#403)**; phần còn lại **shipped 2026-07-20** (#418 `53519830`): shadcn Checkbox/Radio/Switch hit-area 44px tại GỐC (visual 20px + after-inset, contract test touch-targets.test.tsx), 12 site raw input journey (wizard/registration/edit) → label min-h-11, 2 link mono CreateSocialEvent, ManualGroupAssignment rows/chips; 5 setup dialog hoá ra đã compliant (hidden-radio + card label). Drag alternatives ĐÃ TỒN TẠI từ trước (flex mobile = tabs tap-to-select, quicktable manual = tap-only) — chỉ document rule vào design-tokens.md | DS-03 |
| A11Y-03 | done | 3d | Add global reduced-motion behavior and audit animations | BASE-04 |
| A11Y-04 | done | 4d | Add axe and keyboard tests for the 5–8 screens on the two north-star journeys, then expand by traffic/risk. **Shipped 2026-07-19** (#405): project Playwright `a11y` (tests/a11y.spec.ts, single-worker) — axe wcag2a/aa fail ở serious/critical (color-contrast tắt tạm, nợ cũ Lighthouse) cho P1 event detail + O1 club landing + P2 modal mở; keyboard contract cho modal đăng ký (focus trap, Escape đóng, focus về CTA); O2 wizard gated mint env + `PLAYWRIGHT_ORGANIZER_CLUB_SLUG`, tự skip trên CI; slug discovery từ listing sống (fallback quét 6 club landing đầu). Kèm project `mobile-webkit` (iPhone 13) chạy mobile.spec — bịt điểm mù iOS Safari, CI cài chromium+webkit. P3/P4/O3/O4 = expansion theo traffic/risk khi có event tương lai + form-fill flow | A11Y-01, DS-03 |
| A11Y-05 | blocked | 3d | Run VoiceOver, Dynamic Type, keyboard-only, and contrast manual audit | DS-03, test devices |

### Phase 2 exit

- Web and SwiftUI share the same semantic token names and values, verified by the parity check.
- Core components meet state, focus, and touch specifications.
- Lighthouse accessibility is at least 95 on critical routes.
- No critical or serious axe issue remains.

## Phase 3 — Player and organizer UX (Weeks 10–15)

| ID | Status | Effort | Task | Depends on |
|---|---|---:|---|---|
| UX-01 | done | 4d | Design and implement organizer setup checklist/status model. **Shipped 2026-07-19** (#407/#409, proposal ux-01-05-organizer-wizard): card "Bản nháp" resume trên ClubManage (D4) + StepHeader hợp nhất 5 flow (một ngôn ngữ wizard duy nhất, WizardProgress xoá). Checklist đầy đủ hơn (per-step status model) để lại cho vòng UX-09 nếu evidence đòi | DS-03, partial BASE-07 |
| UX-02 | done | 5d | Add tournament/event templates for the five most common formats. **Shipped 2026-07-19** (#409, scope D3 Cuong chốt): 3 preset TĨNH cho social wizard, whitelist type CẤM bank trio; template cho 4 bracket flow GATED bằng funnel organizer_tournament (~2 tuần data) theo journey-screens.md — "clone từ buổi cũ" = feature riêng kèm guard STK | UX-01 |
| UX-03 | done | 5d | Apply progressive disclosure to advanced tournament settings. **Shipped 2026-07-19** (#409, D2 resolution — 3 việc consolidation, không chờ funnel): TeamMatch 5→4 bước (Dreambreaker → toggle trong Thể thức, payload không đổi), fee-mode radio Miễn phí/Có thu phí với clear-state khi Free (guard risk #4), StepHeader thay 2 hệ kicker | UX-01 |
| UX-04 | done | 4d | Add draft autosave and visible last-saved state. **Shipped 2026-07-19** (#407 web + #408 native): useAutosaveDraft/DraftStore.swift — localStorage/UserDefaults-only (KHÔNG DB, không enum — thiết kế đã gỡ RED vòng 1), debounce 750ms + flush background, "Đã lưu trên thiết bị lúc HH:MM" reserve-height aria-live, fail-loud quota; bank trio bị LOẠI khỏi draft (CodeQL clear-text-storage) | UX-01 |
| UX-05 | done | 4d | Add pre-publish validation with direct recovery actions. **Shipped 2026-07-19** (#409 + #406): panel missingFields → role=alert semantic + mỗi dòng = nút jump-to-field (lật step + focus); weekly-repeat partial có retry thật (batchResumeIndex, chỉ tạo tuần thiếu); guard xác nhận tên chủ STK khi bank prefill (#406 — chặn lỗ hổng prod tiền-vào-STK-cũ pre-mortem tìm ra) | UX-01 |
| UX-06 | done | 4d | Add undo/rollback for reversible destructive organizer actions. **Shipped 2026-07-20** (#423) — reframed after a 4-agent panel unanimously rejected general undo: soft-delete would touch ~83 read sites + 39 migration references for a failure Cuong confirmed has never happened, and its own failure mode (one missed read filter leaking deleted rows into public pages/sitemaps) is worse than what it prevents. What shipped instead: (a) `useConfirm()` on the two roster-removal paths that had NO confirmation (`TeamJoinPanel.tsx`, `TeamOverviewCard.tsx`) while `TeamRosterManager` already guarded the same action; (b) delete dialog now counts what is destroyed, and for Team Match counts teams with `payment_status IN (claimed,confirmed)` + warns there is no refund path — fails soft, does not hang on a spinner; (c) native `TeamMatchManageTeamsView.swift` deleted a team on ONE TAP with no confirm and no a11y label → `confirmationDialog` + 44pt hit area; (d) removed dead `deleteMatchesMutation`; (e) **DB trigger `BEFORE DELETE` (PH001)** refusing to delete a paid team — a trigger not an RPC because RLS+`GRANT DELETE` let the browser `.delete()` directly, and because `tournament_id` is ON DELETE CASCADE one trigger covers web, native, direct delete AND whole-tournament delete. pgTAP 11/11 with an `authenticated`-role control probe (42501 class has recurred 3+ times); dropping the trigger reddens 4 tests. Applied to prod + verified by catalog + live rollback smoke. NOTE: prod has 0 teams in claimed/confirmed — the guard protects a state that has never occurred, so pgTAP is its only backing evidence; also worth asking whether the team-match payment flow is used at all | UX-01 |
| UX-07 | partial | 4d | Simplify player discovery-to-registration journey. **Increments shipped 2026-07-20** (#423) — the panel found UX-07 is mostly NOT a design problem, it is three bugs: (a) `/tournaments` never opened the Community tab, ever — the default read `hasWatchContent ? watch : community` but `useTournaments()` selects every pro tournament with no status filter so it was always true and the community branch was dead code; a player sent a bracket link landed on finished PPA broadcasts (verified against prod, and ui-ux-verifier confirmed the A/B on preview); (b) `Login.tsx` dropped `?redirect` for not-yet-onboarded users and the wizard landed them on their own profile, so a new player following a bracket link lost the tournament entirely — both decisions now in `lib/auth/postLoginRedirect`, revalidated inside the wizard; (c) the tournament branch had ZERO journey instrumentation, now emits `auth_wall_viewed`/`auth_wall_click`/`registration_complete`. Also VI format labels and honest "Quick Table của bạn" copy. **STILL OPEN — D5, needs data not opinion:** "the login wall is what loses players" is contested. ui-ux-critic + GPT-5.6 (independent vendors) say yes; solution-architect refutes with prod numbers (`quick_table_registrations` = 0 rows ever; 12/105 tables have requires_registration on, 0 in 60 days) — zero rows is equally consistent with "nobody enabled the feature". Read the funnel ~2026-08-02 with `organizer_tournament`: high wall_view + low complete → build the guest path (gated on increment 7, now shipped); near-zero wall_view → the problem is upstream, CLOSE UX-07. Guest+OTP deliberately NOT built: 10-14 half-days, RED, needs schema + RLS rewrite + real SMS cost, for an unmeasured hypothesis | DS-03, partial BASE-07 |
| UX-08 | done | 3d | Standardize mobile back, deep-link, scroll, and state restoration behavior. **Shipped 2026-07-19** (#414 `7e0bec2e`): Rankings scope/format + Tournaments status → URL params (hook chung `useUrlBackedState`, mẫu useFeedTab); TheLineLayout back fallback về section root khi landing deep-link không history (95% traffic FB deep-link); Feed shuffle seed → sessionStorage (back không reorder, đúng ý "session shuffle"); xoá dead useSwipeNavigation; convention chốt ở architecture-boundaries.md §Navigation. Deferred có lý do: wizard-step vào history (autosave UX-04 đã cứu), Capacitor backButton (không có Android — BASE-05), content deep-link native (SwiftUI thay Capacitor) | BASE-05, DS-03 |
| UX-09 | blocked | 3d | Repeat usability sessions and calculate task success, time, and SUS | UX-01..UX-08, participants |

### Phase 3 exit

- Organizer setup time is at least 40% faster.
- Player and organizer critical task success is at least 90%.
- SUS is at least 80.
- Setup abandonment and support questions show a measurable reduction.

## Phase 4 — Architecture, transactions, and quality (Weeks 16–22)

| ID | Status | Effort | Task | Depends on |
|---|---|---:|---|---|
| ARCH-01 | done | 2d | Define feature/domain module boundaries and dependency rules | BASE-04 |
| ARCH-02 | done | 5d | Refactor Social Event registration/payment into domain/application/infrastructure/UI layers. **All increments shipped 2026-07-18**: inc.0 DB-01c (#384) · inc.1 (#397: cancel/reactivate-registration → Deno-free handler.ts + 16 contract vitest) · inc.2 (#399: 21 jsdom characterization tests pinning the RegistrationModal money path — first component-test infra in the repo: jsdom + @testing-library/react, per-file `@vitest-environment jsdom`, explicit `afterEach(cleanup)`) · inc.3-5 (#400: 7 supabase calls → `registrationApi.ts`; capacity math → `src/lib/social-events/slotCapacity.ts` + unit tests; 4 hardcoded VI strings → i18n with EN added; unpaid badge raw hsl → `--tl-gold`). Parity 21/21 green after every increment, bundle ±0. Inc.6 (split SocialEvent pages) deliberately skipped per proposal (YAGNI until a real feature touches them). NOTE kept: tests under `_shared/__tests__/` trigger deploy-guard full-fleet redeploy (75 functions) | ARCH-01 |
| ARCH-03 | done | 5d | Refactor Team Match orchestration and realtime boundaries. **Shipped 2026-07-20** (#421) — scoped DOWN after recon: the layered refactor ARCH-03 was written for is already satisfied (the 4 TeamMatch pages make ZERO direct supabase calls, Setup sits on `SetupShell` and Scoring on the shared `RefereeScoringScreen` engine via ARCH-04, result logic is pure in `lib/teamMatchResult.ts` with tests, and `architecture-boundaries.md:112` keeps match/bracket management per-format ON PURPOSE). What was actually left: (a) **data-loss race** — the third-place seat used the same stale first-empty-slot + unguarded UPDATE shape DB-00 CONFIRMED and DB-02a fixed for DoublesElimination only; two semifinals finishing at once dropped one losing team from the bracket. Now a guarded `.is(field, null)` claim + re-seat idempotency, in new `src/lib/teamMatchAdvancement.ts` (propagation lifted out of the react-query mutation so it is testable) with 9 tests that go red when the guard is removed (verified by mutation); (b) **realtime boundary** — the `team_match_games` channel had NO filter (the table has no tournament_id), so every client watching any team match refetched its matches list on every game write site-wide; payloads are now scoped to this tournament's matches, DELETE `new`-is-`{}` handled; (c) ~90 duplicated game-creation lines collapsed into pure `lib/teamMatchGames.ts` + 5 tests (Dreambreaker only on an EVEN template count); (d) reused the existing `uniqueChannelSuffix()` helper, dropped 5 prod `console.log`. Net -141 lines. Deliberately NOT done: re-scoring a semifinal with a DIFFERENT winner still leaves the previous loser seated in the third-place match (pre-existing, same limit as DB-02a); 11 other files still hand-roll the channel suffix | ARCH-01 |
| ARCH-04 | done | 12d | Split across multiple PRs (one format at a time onto the shared core). Extract a shared scoring/setup core for the four tournament formats (QuickTable, TeamMatch, DoublesElimination, Flex), then refactor orchestration onto it. The four formats look alike but carry different rules — write characterization tests per format FIRST (QA-07 is the first of these), refactor second. Evidence: MatchScoring vs DoublesEliminationScoring are ~1,300 near-duplicate lines each; setup pages share 206 identical lines | ARCH-01, QA-07 |
| ARCH-05 | done | 2d | Collapse the manual `/vi/*` route mirror in `src/App.tsx` (real count: 63 pairs) into one wrapper route or a route-config array mapped twice. **Shipped 2026-07-18** (#393 characterization net + #396): 120 literal lines → 60-entry `MIRRORED` array mapped twice; static parity test proves exactly 3 intended diffs (/vi/feed + /vi/rankings gain ViLanguageWrapper — SPA-nav language fix; /vi/* VI NotFound). SocialEventLive keeps unwrapped mount pending socket audit. New localized route = ONE MIRRORED entry | ARCH-01 |
| DB-01 | done | 3d | Transactional RPC for reactivation and final-slot capacity — DB-00 confirmed the race; shipped as advisory-locked RPCs | DB-00 |
| DB-02 | done | 5d | Transactionalize bracket advancement — DB-00 scope: CONFIRMED DoublesElimination R3→R4 client-side slot fill (`DoublesEliminationBracket.tsx:938-998`, stale-state first-empty-slot scan + unguarded UPDATE); quick_table deterministic mapping mostly safe; also dedupe the `match-confirm` double DUPR submit side effect | DB-00, ARCH-03, ARCH-04 |
| QA-01 | done | 4d | Reduce React Hook warnings to zero with behavior tests | — |
| QA-02 | done | 8d | Remove `@ts-nocheck`, type critical boundaries, and reach repository lint green (267 grandfathered errors; also re-enable `no-unused-vars` — currently nothing catches dead code). Split by domain, one PR per domain | QA-01 |
| QA-03 | done | 4d | Add RLS/auth matrix and concurrency tests against disposable Supabase. **Shipped:** supabase/tests/rls_auth_matrix.test.sql (19 assertions: blanket RLS-enabled checks, role self-grant/cross-profile/api_keys escalation probes with positive control) + scripts/qa/db-race.mjs (DB-01 capacity RPCs raced from 2 parallel psql sessions, 15 rounds each, wired into pgtap.yml) | SEC-05 |
| QA-04 | later | 5d | Add stable E2E coverage for ten critical journeys | BASE-04, QA-03 |
| QA-05 | done | 4d | Add visual regression for key routes, themes, locales, and states. **Shipped 2026-07-19** (#411 `413d91d8` + 23a1898c): 24 baselines CI-Linux (12 route public gồm /vi + /vi/rankings + /vi/news × Desktop Chrome + Pixel 7); visual.yml hết self-skip, chạy advisory pixel-diff mọi PR (đã pass end-to-end lần đầu); visual-baseline.yml fallback mở PR khi branch protected (GH006). Deferred có lý do: themes (public surface hiện dark-only), DS states (cần seeded data). NOTE: baseline home/home-vi chụp lúc livestream on-air — refresh 1 lần khi hết stream | DS-04, BASE-04 |
| QA-06 | done | 2.5d | Run all 42 `apple/Tests` cases in CI on a macOS runner with XcodeGen + `xcodebuild test`; direct Swift package versions are pinned so clean generations do not drift | — |
| QA-07 | done | 2d | Characterization tests for MLP total-score mode on web AND Swift (each game to 7, match total = sum of games, NOT fixed 28 — the known-trickiest rule, untested on both platforms) | — |
| QA-08 | done | 3d | Unit-test the money path: extract `create-payment-order` / `mark-payment-claimed` handler logic into `_shared` and cover with the existing Vitest-over-supabase-shared pattern | — |

### Phase 4 exit

- Repository-wide lint/type/test/build are green.
- Critical data transitions are atomic.
- Critical journeys have unit, contract, database, and E2E protection.
- Large features have documented module boundaries.

## Phase 5 — Performance, SEO, and operations (Weeks 23–26)

| ID | Status | Effort | Task | Depends on |
|---|---|---:|---|---|
| PERF-01 | done | 3d | Establish route, initial JS, CSS, image, and PWA precache budgets | BASE-03 |
| PERF-02 | done | 5d | Split Mux/HLS, charts, and heavy workspaces at feature boundaries. Note (2026-07-14 audit): Mux/HLS (`vendor-video`, 1.07 MB) and charts (411 kB) are ALREADY lazy — verify with `ANALYZE=1 npm run build` before spending here; the remaining real targets are `TeamMatchView` (241 kB single route chunk) and the entry itself (see PERF-06) | PERF-01, ARCH-01 |
| PERF-03 | done | 2d | Reduce PWA precache below 3MB and define offline behavior. Root cause already identified: `globIgnores: ["**/blog-data*"]` in `vite.config.ts:103` matches nothing since blog content became per-slug chunks; fix patterns for blog chunks + `vendor-charts*` + `TeamMatchView*` + `QuickTableView*` | PERF-01 |
| PERF-04 | done | 4d | Optimize responsive images, aspect ratios, fonts, and content loading. **Shipped 2026-07-20** (#417 `29cbe75e`): 10 blog hero 13.5MB→1.6MB (1600w q75 ≤228KB, đóng dòng budget "unaudited" perf-budgets) + 42 biến thể -768.webp + srcset/sizes BlogPost/Blog; fix GỐC optimizeImageUrl Mux no-op (hostname-parse, LiveCard/ReplayCard hưởng tự động); 3 Lighthouse image-asserts (warn); 7 unit test image-utils. Fonts skip — preload/swap/runtime-cache đã xong từ trước; prefetch select(*) trim BỎ QUA có chủ đích (type coupling); CLS hero đã có aspect-ratio sẵn | PERF-01 |
| PERF-05 | later | 3d | Validate CWV p75 targets with Vietnam field data | PERF-02..PERF-04 |
| PERF-06 | done | 2d | Lazy-load locale dictionaries through `I18nProvider`; standalone consumers read the active bundle, and locale chunks stay out of precache but are runtime-cached for offline reloads | — |
| SEO-01 | done | 3d | Specify a single content manifest for React, SSR, sitemap, RSS, hreflang, and OG | — |
| SEO-02 | done | 5d | Generate current SEO surfaces from the manifest — must subsume `BLOG_POST_META` (`functions/_lib/render/index.ts:1257`) and `EN_BLOG_SLUGS` (`functions/sitemap-static.xml.ts:26`), collapsing the 5 manual blog touch points to ≤3 | SEO-01 |
| SEO-03 | done | 3d | Add CI validation for canonical, reciprocal locale links, schema, image, and bot 200 status. Include a fixture test that fails when a `src/content/blog/metadata.ts` slug is missing from any generated SEO surface (automates the exact failure class of HOT-03). **Shipped:** slug-parity fixture tests (#347) + `tests/seo.spec.ts` now asserts canonical, JSON-LD validity + required fields (BlogPosting/NewsArticle), og:image, hreflang reciprocity, and a bot-200 sweep sampling the first URL of every sitemap segment (tournaments/matches/news/venues/players/orgs/blog) on every PR (preview) and main push (prod) | SEO-02 |
| SEO-04 | done | 3d | Split `functions/_lib/render/index.ts` by domain. **Shipped:** 2,423 lines -> 50-line barrel + 14 domain files (home, live-video, tournaments, news, forum, org, tools, blog, rankings, profile, match-page, feed, static-pages, shared); export surface unchanged (43 symbols, diff empty); cache-bump changelog moved to `docs/prerender-cache-log.md` | SEO-02 |
| OPS-03 | done | 3d | Define availability, auth, registration, scoring, cron, and latency SLOs | BASE-02 |
| OPS-04 | later | 4d | Build actionable dashboards and alerts tied to SLOs | OPS-03, BASE-03 |

### Phase 5 exit

- Mobile p75 CWV meets the good thresholds.
- PWA precache is below 3MB.
- SEO metadata is generated from one manifest.
- Actionable SLO dashboards and alerts are live.

## Phase 6 — Consolidation and final audit (Weeks 27–28)

| ID | Status | Effort | Task | Depends on |
|---|---|---:|---|---|
| CLOSE-01 | done | 3d | Remove deprecated mobile, auth, component, and feature paths. **Done:** `src/pages/preview/` deleted (~3,900 lines, 12 routes; shared `Countdown` + `formatDate/Time/Relative` helpers extracted to `src/components/Countdown.tsx` + `src/lib/format-datetime.ts`); `PublicProfile.tsx` was already gone — stale marker comment removed. Total gz JS 1950.0 → 1903.8 KB. **Remainder shipped:** Red5 columns dropped (migration 20260716170000), legacy `sitemap` edge function deleted (0 hits/7d), recon found no other dead paths (no .legacy.tsx, no orphan pages) | Earlier phases |
| CLOSE-02 | done | 2d | Update architecture docs, runbooks, and developer onboarding. **Shipped 2026-07-19** (PR này): refresh `architecture-boundaries.md` (ARCH-02/05 templates, shared UI building blocks DS-02..04 + UX-01..05, journeys), `ops-runbook.md` (+§5.5 deploy-race flake, +§7 CI gates: bundle INITIAL/CODE/CONTENT, visual regression, a11y/mobile-webkit, `.tl-btn` ratchet), `handoff-state-of-the-pickle-hub.md` (mục 0 onboarding: /idea→/ship + agents, manual-test-backlog, memory; sửa secrets path, blog 4-file→SEO-02, Playwright 10 project, visual đã bật) | Earlier phases |
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
| 2026-07-15 | Load locale dictionaries on demand, keep them out of the Workbox precache, and let an explicit `/vi` route override cached or in-flight geo detection | Preloading both dictionaries made every visitor pay for both languages; precaching the split chunks would preserve that cost indirectly, while a late geo response must not undo an explicit localized URL or user choice | PERF-06; retain one-locale production browser checks when changing i18n or PWA caching |
| 2026-07-15 | Make the Edge auth registry strict in ordinary CI and compare deployed names plus `verify_jwt` against it in a credentialed daily production guard | Source/config checks cannot detect a dashboard-only function or gateway toggle; production parity needs a separate secret-bearing workflow that never downloads function secrets | SEC-04; keep `quality` and `edge-auth-parity` blocking on every finding |
| 2026-07-15 | Standardize scheduled functions on the Vault-backed `cron_secret`; treat DUPR's payload `CLIENT_KEY` as a fail-closed shared callback secret and compensate for the missing separate signature with body bounds, replay protection, redaction, and retention | Multiple scheduled credentials increased rotation and drift risk. The observed DUPR integration contract authenticates with `clientId=CLIENT_KEY`, so accepting the numeric client identifier would be fail-open and persisting the key would create a second secret store | SEC-04; revisit the callback credential only if DUPR adds a verifiable signature contract |
| 2026-07-15 | Centralize Edge CORS in a dedicated shared module while preserving 13 exact endpoint policy variants instead of widening every function to a single union policy | CORS is transport policy rather than authentication, and a broad union would silently authorize headers/methods that narrower webhook, cron, telemetry, and proxy endpoints did not previously allow | BE-01; keep the characterization test blocking inline CORS, auth re-exports, policy drift, and legacy server imports |

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
| 2026-07-15 | SEC-03 | Source commit `9ccfa939`; migration `20260715170000` recorded as applied; `log-client-event` v12 active; retention cron job `28` active | Optional user identity and user agent are server-derived; JS/CSP fields are whitelisted and bounded; URL query/fragment/credential stripping applies to URL fields (not arbitrary message/stack text); bodies are capped at 32 KiB; Reporting API batches at 20; hashed fixed windows allow 60 authenticated or 120 anonymous events/10m. The private daily cron retains `client_errors` for 90 days; `view_events` has separate lifecycle. |
| 2026-07-15 | QA-06 | Source commit `5fc6d89e`; GitHub Actions run `29401010455` | A clean `macos-15` runner installed XcodeGen 2.45.4, generated the ignored Xcode project and placeholder secrets, then passed 42/42 Swift tests on Xcode 16.4 with an iOS 18.5 iPhone 16 Pro simulator in 6m15s. The same clean-generation path passed 42/42 locally on Xcode 26.3/iOS 26.2. Supabase Swift 2.48.0 and Google Sign-In 7.1.0 are exact direct dependencies; no production credentials are required. Quality, Security, Deploy guard, and Playwright were also green on the source commit. |
| 2026-07-15 | PERF-06 | Source commits `b8ca5688` + `99755138` plus active-bundle/runtime-cache follow-up | Dynamic imports isolate `en`/`vi`; standalone consumers no longer statically import both dictionaries, and Workbox runtime-caches same-origin locale chunks for offline reloads. Production browser verification remains valid for `/` and `/vi`; rerun bundle/offline checks after deployment. |
| 2026-07-15 | SEC-04 | Source commit `9142ad1f`; migration `20260715180000`; GitHub Actions runs `29406129841`, `29406129844`, `29406129873`, `29406130179`, and `29406130201` | Registry enforcement is strict across 76 source/config/production functions with zero findings. Quality blocks drift and the new scheduled production guard blocks deployed orphans and `verify_jwt` mismatches. Five scheduled handlers use `requireCronRequest`/Vault `cron_secret`; the obsolete duplicate news job is gone. DUPR callback bodies are capped at 32 KiB, secrets are compared fail-closed, exact retries use a unique SHA-256 event key, all 661 historical payload/client identifiers were redacted, and retention is 30 days. Eight handlers are ACTIVE after deploy (`auto-cancel` v31, `dupr-sync` v42, webhook v33, feed embeds v13, feed generator v42, news translation v30, notification v38, mailer v27). Production probes returned the expected 400/401/413/200 contracts; a synthetic authenticated DUPR event was fingerprinted, redacted, deduplicable, processed, then deleted with the profile snapshot restored. Five cron-authenticated production dispatches returned HTTP 200. Vitest 664 pass/10 skipped with 83.59% statement coverage; targeted ESLint, TypeScript, build, 1,943.2/1,950 KB bundle guard, clean 277-migration replay/duplicate guard, and all eight GitHub checks pass. The first smoke attempt overlapped the Cloudflare asset switch; the unchanged attempt 2 passed after deployment stabilized. Rollback: restore each legacy caller credential before redeploying its prior handler; keep the independently safe callback redaction/index/retention migration and never restore historical secrets. |
| 2026-07-16 | PERF-03 | PR #344 | PWA precache 7.8MB/379 → 1.44MB/29 via whitelist glob + blog-post chunk prefix; lazy-chunks runtime CacheFirst for offline. Verified precache line + full local smoke |
| 2026-07-16 | SEC-06 | PR #346 | Strict two-way drift gate on deploy-guard + daily scheduled report-only workflow; ledger verified reconciled (283=283). Reconciliation stays manual, never db push --include-all |
| 2026-07-16 | SEO-02/03 (partial) | PR #347 | BLOG_POST_META extracted to pure module; slug-parity CI guard locks 3 surfaces to same slug set (HOT-03 class). Full manifest generation deferred — machine diff found 37 title mismatches = a content decision |
| 2026-07-16 | QA-01 | PR #339 | 30 exhaustive-deps warnings → 0 repo-wide, each read and classified (useCallback for pure helpers/loaders; justified per-site disables where deps would wipe input or loop). Two real bugs removed: token-refresh reload in DoublesEliminationScoring, stale reconnect catch-up in useChatMessages |
| 2026-07-16 | BASE-02 | PR #340 | src/lib/journeys.ts envelope + player (RegistrationModal, both OTP/member paths) and organizer (CreateSocialEvent incl. weekly-repeat batches) funnels per the BASE-01 contract; 5 vitest lifecycle cases. Live GA4 verification owed after first real registration/publish |
| 2026-07-16 | QA-07 + total-score rule | PRs #325, #327 | Pure computeTeamMatchResult (web) / TeamMatchRepository.computeMatchResult (Swift), web duplication removed; 10 mirrored tests per platform. Product rule shipped: total-score mode awards the match to the higher cumulative total once every game is decided; ties stay undecided |
| 2026-07-16 | QA-08 | PR #328 | create-payment-order + mark-payment-claimed split into Deno-free handlers; 18 vitest cases incl. exactly-once organizer push on the winning claim transition. No behavior change |
| 2026-07-16 | DB-02 | PRs #329, #330 | DoublesElim R3→R4: fresh read + guarded slot claim (`IS NULL` UPDATE) + re-propagation idempotency; match-confirm: pending→verified guarded transition gates DUPR auto-submit + notifications to exactly one concurrent winner |
| 2026-07-16 | SEC-05 | PR #331; migration `20260716120000` applied to prod + ledgered pre-merge | search_path pinned on last 3 unpinned definers; error_alert_dedup RLS'd + grants revoked; 11 gated RPCs stripped of PUBLIC/anon EXECUTE (revoking anon alone is a no-op — ACL default is PUBLIC). pgTAP sec05_hardening pins repo-wide invariants; prod verified incl. anon blog counts still serving |
| 2026-07-16 | OPS-01 | PR #332 | docs/ops-runbook.md — every command production-proven |
| 2026-07-16 | ARCH-01 | PR #334 | docs/architecture-boundaries.md |
| 2026-07-16 | BASE-04 | PR #336 | docs/journey-screens.md — 8 screens, drop-off columns pending BASE-02 |
| 2026-07-16 | DS-01/PERF-01/SEO-01/OPS-03 | PR #335 | docs/design-tokens.md, perf-budgets.md (guard bumped 1950→1970 in #333, ratchet rule recorded), seo-content-manifest-spec.md, slo.md |
| 2026-07-16 | A11Y-01 + A11Y-03 | PR #337 | Skip link + route focus management + #main-content target + global reduced-motion; 2 Playwright smoke assertions verified against a production build |
| 2026-07-16 | BE-02 | PR #322, merge `e120cc10`; `send-push-notification` redeployed by Deploy guard | Root cause fixed: admin broadcast resolved recipients client-side through push_tokens RLS (admin saw only own rows). Recipients/counts now resolve server-side with service_role: `broadcast: true` paginates past the PostgREST 1000-row cap; `dry_run: true` feeds the confirm dialog real counts; FCM sends batched in Promise.allSettled chunks of 50; UNREGISTERED tokens pruned. Handler split Deno-free with 8 vitest cases. Internal callers keep the `user_ids` contract. Production: function 401 without auth after redeploy. Real broadcast send still needs a manual admin-UI verification |
| 2026-07-16 | HOT-05 | PR #323, merge `9385f9f8` | Auth context value memoized on [user, session, loading]; handlers stable. Vitest 694 pass; tsc/lint/build green |
| 2026-07-16 | DB-00 | Static analysis + local two-connection repro (no prod mutation) | CONFIRMED: event capacity (reactivate-registration + phone-otp-verify count→check→write, no lock/constraint) and DoublesElimination R3→R4 client-side slot fill. REFUTED: submit-match-score (atomic RPC 20260512110001), create-payment-order (UNIQUE + re-read), mark-payment-claimed (guarded UPDATE). UNCERTAIN: quick_table advance (deterministic column mapping), match-confirm concurrent confirms double-submitting to DUPR (external side effect). Full verdicts in memory `db-00-race-verdicts` |
| 2026-07-16 | DB-01 | PR #324, merge; migration `20260716090000` applied to prod + ledgered BEFORE merge so Deploy guard's function redeploy found the RPCs | `social_event_reactivate_registration` + `social_event_guest_register`: per-event `pg_advisory_xact_lock`, check+write in one transaction, SECURITY INVOKER, service_role-only, callers keep their historical active-row predicates. pgTAP 18/18 on fresh replay; two-connection local repro: second session blocks ~2.4s then gets `event_full`, active_count stays at max_players. Prod probes: RPC returns `not_found` for unknown id; redeployed edge function 404s an unknown magic token. Rollback: redeploy prior function bundles; RPCs are inert without callers |
| 2026-07-18 | perf-js-gzip (bundle gates + recharts removal) | PR #389, squash `a195b0a3` | INITIAL 372.5→264.7 KB gz (−29% first-paint, 6 requests), CODE 1,576.8→1,469.7, total 1,929.9→1,822.9/1970. New CI gates: INITIAL ≤280, CODE ≤1800, blog chunk ≤20 KB, initial-load ⊆ precache globs. recharts (eagerly preloaded on every page via manualChunks hoisting) removed; 3 consumers on zero-dep tiny-chart with sparse-data tests. Full audit trail: `docs/proposals/perf-js-gzip/` (4-agent panel + GPT-5.6 ×2, debate ledger green). Prod verified: vendor-charts absent, 5 modulepreloads, / + /feed 200. Owed: PERF-05 VN p75 before/after with ~1 week RUM |
| 2026-07-17 | ARCH-04 + QA-02 + SEO-02 + BE-03 + SEC-01 + smoke-flake cleanup | PRs #345, #356–#382 (29 PRs) | Repo lint 0 errors with repo-wide gate; shared tournament scoring core; SEO manifest generation live; supabase-js pinned; Capacitor transition secured. Details in memory `session-2026-07-17-shipped` |
| 2026-07-15 | BE-01 | Source commit `38e4ec43`; GitHub Actions runs `29407903704`, `29407903849`, `29407903607`, `29407903803`, `29407903875`, and post-deploy parity run `29408201177` | `_shared/cors.ts` now owns 13 exact CORS presets used directly by 72 handlers: all 37 inline declarations and the 35 former imports through `_shared/auth.ts` are gone. The implementation audit corrected the roadmap's stale count from seven to six std HTTP server imports (five `std@0.168`, one `std@0.190`); all 76 function entrypoints now use `Deno.serve`, with zero legacy server imports. Characterization coverage asserts the 37 mappings, 72 direct imports, 13 policies, and 76 entrypoints. Vitest passed 667 tests/10 skipped across 49 files at 83.70% statement coverage; targeted ESLint, TypeScript, production build, the 1,942.9/1,950 KB strict bundle guard, strict 76/76/76 auth registry, clean 277-migration duplicate guard, and all eight commit checks passed. Deploy guard processed 76/76 functions successfully (53 unchanged bundles, 23 updated), then the manually repeated production auth-parity workflow passed with zero drift. Production preflight verification matched every expected header on 72/72 endpoints across all 13 presets (70 HTTP 200, two HTTP 204); the six migrated entrypoints each returned HTTP 200. Rollback: revert `38e4ec43` and let deploy guard redeploy the prior per-function CORS declarations and std server entrypoints; no database rollback is required. |

## Handoff notes for the next agent

### 2026-07-18 bundle state (perf-js-gzip SHIPPED — PR #389, squash `a195b0a3`)

- `check-bundle-size.mjs` now gates THREE numbers (see `docs/perf-budgets.md`): INITIAL first-paint gz (entry + modulepreload + recursive static imports parsed from `dist/index.html`; budget 280 KB, now ~265) · CODE gz excl. blog content (budget 1800, now ~1470) · per-blog-chunk cap 20 KB; total 1970 stays as backstop only. STRICT also asserts initial-load ⊆ precache globs (offline-PWA protection).
- recharts REMOVED (was 107.8 KB gz eagerly modulepreloaded on every page — the single real initial-load bug; found by the /idea debate round, both agents verified on dist). 3 consumers migrated to zero-dep `src/components/ui/tiny-chart.tsx`. Total 1,929.9 → 1,822.9 KB gz.
- Remaining aggregate is legitimately lazy: blog content 353 KB (47 per-slug chunks, grows per article — counted as CONTENT, not CODE), vendor-video 297 KB (live/video pages only). Do NOT chase aggregate reductions that don't move INITIAL — Option C (drop mux-player, ~−220 KB aggregate, live-path risk) was evaluated and rejected; see `docs/proposals/perf-js-gzip/proposal.md`.
- Owed: PERF-05 — compare Vietnam-segment p75 LCP/INP/CLS (GA4 `web_vital` RUM) before/after once ~1 week of post-deploy data exists.

- Review findings already fixed in `c5dc0206`: active-bundle i18n lookup, offline locale runtime caching, last-hop XFF fallback, the two missed inline CORS handlers, and recursive CORS regression coverage.
- 2026-07-16 update: the old "cleanup backlog" here is DONE and removed — pgTAP CI gate, cron fail-loud, cron-health fixes (transient `running`, GitHub 403), `view_event_rate_limits(window_start)` index, and milestone RPC pagination all shipped 2026-07-15/16 (see completion log). Do not re-do them.
- Still open from that list: review raw `viewer_ip`/`user_id` retention claims; set `GITHUB_TOKEN` secret so cron-health stops skipping the GitHub monitor (optional, no false alerts meanwhile).
- 2026-07-18: **CodeQL backlog CLOSED — 0 open alerts** (was 28). #383/#385/#386 (earlier) + #390/#391/#392 shipped; 4 Cloudflare Workers wrangler-deployed + HTTP-probed (drift risk closed); 5 fixpoint-loop alerts dismissed as false positive with documented reasoning (checker cannot model do/while fixpoints; behavior runtime-verified). Prerender cache now `pr:v30`. Blog hero 404s found by smoke: 2 `vi_blog_posts.cover_image_url` rows fixed in prod, 1 metadata.ts ref fixed in #391.
- 2026-07-18: `DUPR_CLIENT_KEY` entropy CONFIRMED sufficient — 64 hex chars = 256 bits (checked via Management API secrets endpoint, characteristics only, value never printed). Fingerprint scheme `sha256(clientId).slice(0,16)` stays as-is; item closed.
- GitHub guard workflow is mandatory after every push: inspect `gh run list --json ...`, wait for Quality, Security, Deploy guard, Playwright smoke, and Edge auth parity; never call an in-progress run green. Current branch protection was observed as `strict=false`, required checks `quality` + `smoke`, no required review, admin bypass enabled.
- Coding conventions: TypeScript strict, shared Edge helpers under `supabase/functions/_shared`, exact CORS presets (do not widen unions), `Deno.serve`, fail-closed auth, bounded request bodies, constant-time secret comparison, service-role only for privileged RPCs, and production probes must clean up synthetic rows/state. Never stage generated mobile/build artifacts or local secret files.

## Current execution checkpoint

Last updated: 2026-07-19 after DS-04 (#404) + A11Y-04 (#405) shipped — the DS chain and the first axe/keyboard e2e coverage are done; `mobile-webkit` Playwright project now covers the iOS Safari blind spot. Sessions 2026-07-18 closed ARCH-02 (#399/#400), DS-02 (#401), DS-03 (#403), perf-js-gzip (#389), CodeQL backlog (0 alerts) — details in the task table + memory `session-2026-07-18b-arch02-done`.

Remaining open work: UX-01..09 (Phase 3 — UX-01..05 organizer cluster is the highest-value next block, unblocked by DS-03/04) · QA-04/05 · PERF-04/05 (PERF-05 waits for RUM ~24/07) · OPS-04 · CLOSE-03/04 (CLOSE-02 done 2026-07-19) · blocked: BASE-07 (participants), OPS-02 (backup access), A11Y-05 (devices) · loose ends: enforce `.tl-btn` ratchet HARD after 2026-08-01 (check-theline Rule 4), `docs/manual-test-backlog.md` 8 items waiting on Cuong, gen Supabase types (`--schema public`), manual admin push broadcast verify, 2 bugs from /idea (member overbooking DB-01c confirmed race; /vi stuck EN), optional GITHUB_TOKEN for cron-health.

Previous checkpoint (2026-07-16 round 3) follows for history:

- Active: none. Complete: `HOT-01`..`HOT-07`, `BASE-01`, min-scope `BASE-03`, `BASE-04`, `BASE-05`, `BASE-06`, `OPS-00`, `OPS-01`, `OPS-03`, `SEC-02`..`SEC-05`, `BE-01`, `BE-02`, `QA-06`, `QA-07`, `QA-08`, `PERF-01`, `PERF-06`, `SEO-01`, `DS-01`, `DB-00`, `DB-01`, `DB-02`, `ARCH-01`, `A11Y-01`, `A11Y-03`. Total-score winner rule shipped per product decision (#327).
- Manual verification still owed: one real admin push broadcast from `/admin/push-notification` UI (dry_run counts + actual delivery + prune telemetry).
- `QA-01` and `BASE-02` are now complete too. Next: Phase-2/5 implementation tasks unblocked by the specs — DS-02, PERF-02/03, SEO-02, OPS-04, A11Y-02/04 — plus BE-03 (supabase-js pin) and the remaining blocked items (BASE-07 participants, SEC-06 credential, OPS-02 drill, SEC-01 decision).
- Bundle guard now 1970 KB after two stopgap bumps — the ratchet rule in docs/perf-budgets.md governs any future change.
- `BE-01` production state: source commit `38e4ec43` has 8/8 green checks. All 76 handlers use `Deno.serve`; 72 handlers import one of 13 exact policies directly from `_shared/cors.ts`; no inline CORS declaration, auth-module CORS re-export, or std HTTP server import remains. Deploy guard processed 76/76 functions, post-deploy auth parity passed, and production preflights matched on 72/72 endpoints (70 HTTP 200, two HTTP 204). The corrected legacy-entrypoint count is six, not the roadmap audit's stale seven.
- `SEC-04` production state: migration `20260715180000` is recorded as applied; all 76 deployed functions match the strict registry with `verify_jwt=false`. Eight changed handlers are ACTIVE at versions 31/42/33/13/42/30/38/27 respectively. Scheduled callers use Vault-backed `x-cron-secret`; the duplicate news job is removed; the DUPR ledger has a unique event key, redacted history, and 30-day retention. Negative, positive service, cron, and synthetic callback probes all passed and the synthetic callback/profile state was cleaned up. Source commit `9142ad1f` has 8/8 green checks, including Cloudflare Pages, Supabase Preview, production parity, Quality, Security, Deploy guard, and Playwright smoke attempt 2.
- `PERF-06` production state: `/` loads only the English dictionary and `/vi` loads only the Vietnamese dictionary; both locale chunks return JavaScript 200, document language is correct, and the browser observed no page errors. Source commit `99755138` passed Quality, Playwright smoke, Security (`npm-audit` + CodeQL), and Deploy guard; CI total gzipped JavaScript is 1,949.3 KB against the 1,950 KB budget.
- `QA-06` CI state: GitHub Actions run `29401010455` passed 42/42 Apple tests on a clean `macos-15` runner with Xcode 16.4/iOS 18.5; source commit `5fc6d89e` also passed Quality, Security, Deploy guard, and Playwright.
- `SEC-03` production state: migration `20260715170000` is recorded as applied; `log-client-event` v12 and retention cron job `28` are active. Contract probes covered 405/400/413/204/429 responses and verified server-derived identity/user-agent plus URL/detail sanitization. Probe rows and limiter state were removed; `client_errors` returned to 898 rows. SEC-04 subsequently closed the remaining registry findings and enabled strict enforcement.
- `SEC-02` production state: migration `20260715160000` is recorded as applied and `batch-view-events` v44 is active. Identity, organization, and replay state are server-derived; valid, dedup, invalid-target, over-limit, and spoof-resistance probes returned the expected results. Test analytics were removed after verification.
- `BASE-06` production/source state: 76 source functions, 76 explicit config sections, 76 active production functions, and zero registry drift errors. SEC-04 subsequently moved the registry from report-only to strict Quality and production-parity enforcement with zero findings.
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
