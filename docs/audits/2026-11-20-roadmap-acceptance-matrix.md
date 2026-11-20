# Roadmap 9/10 — acceptance matrix, 20 November 2026

Audit cutoff: **2026-11-20T14:08:16Z**. Authority: the acceptance criteria in
[the full roadmap](../roadmap-overall-9.md), not a reduced technical subset.
Remote `main` observed through GitHub API:
`7b794501d7b3f20b438f1068e2d31830c9b7cb6a` (PR #1071). Local checkout is
dirty and older; local audits are evidence only for their stated tree/scope.
This audit made no application, database, deployment or account changes.
Its initial output was this document. The dated delta below supersedes only
the listed cutoff observations; the original matrix remains a historical snapshot.

**No new numeric score is assigned.** Merging fixes does not establish the
135/150 objective, the minimum 8.5 per category, or product outcomes.

Status vocabulary: **PASS** = the stated scoped criterion has dated evidence;
**PARTIAL** = implementation/evidence exists but the whole criterion is not
met; **MISSING** = required evidence/control absent; **WAIT** = an external
input or observation interval remains. PARTIAL/WAIT are not passes. The next
action column separates work possible now from prerequisites outside code.

## Verified delta after the initial cutoff

Reviewed 20 November after PR #1073 merged at **14:54:11 UTC**. GitHub
read-back confirms #1071 (`7b794501`), #1072 (`ca112da0`) and #1073
(`83ada796`) are MERGED. All #1073 PR checks passed; 13 local coverage
regression tests passed. These facts supersede pending/awaiting-CI statements
for those changes in the original cutoff matrix below.

- **A11Y-1:** story-tag fix is merged; authenticated and full target-state
  evidence remain incomplete.
- **A11Y-3 / QA-1:** required staging coverage/skip gate is merged. No actual
  mandatory staging run or registration/publish write-journey proof is claimed.
- **OPS-2:** strict quality/smoke branch checks, admin enforcement and PR
  policy are configured and read back. Migration drift is enabled; exact reviewed
  #1064 migration plus ledger was applied atomically, then independent run
  `44752651464` succeeded. [Release controls](2026-11-20-release-controls.md)
  supersede the absent-control observation. Full schema parity, restore and
  broader deployment reliability remain unproven; OPS is not fully closed.
- **SEC-4:** [all-finding reconciliation](2026-11-20-security-finding-reconciliation.md)
  now covers 25 historical findings. Its source/deployment distinctions and
  remaining recovery, rate-limit and other gaps preclude an all-fixed claim.
- **SEO-1 / PERF-1:** current acquisition and Vietnam-mobile rating artifacts
  exist. They do not establish URL coverage, numeric field p75 or causal results.

No numeric rescore follows from this delta. The requirements below remain the
full acceptance scope, interpreted with these updated observations.

## Every roadmap requirement

PR links below refer to `https://github.com/cuongnguyen84/pickle-hub-pro/pull/`.
The linked merged PR is source/CI evidence; deployment evidence is separately
identified where available.

| ID | Original acceptance requirement | Authoritative evidence and limits at cutoff | Status | Next action / dependency |
|---|---|---|---|---|
| SEC-1 | No reachable production high/critical advisory, or owned expiring exception. | [#1051](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1051), [#1052](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1052) merged; verified production audit reported zero advisories after Zod 4/resolver migration and regression checks. [Tracker](9-score-evidence-tracker.md) records this later result; earlier dependency audit statements about open Zod are superseded. Dev-only backlog is separate. | PASS, dated production dependency scope | Preserve the gate and re-audit lockfile changes; do not repeat a completed major migration or label all development dependencies clean. |
| SEC-2 | JS/TS and Python analyzed in CI; no new unexplained findings. | [#1047](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1047) merged, successful Security/codeql run [44549914410](https://github.com/cuongnguyen84/pickle-hub-pro/actions/runs/44549914410). Security workflow analyzes both languages and gates local SARIF against reviewed baseline. Upload is intentionally unavailable for current private-repo plan. | PASS, scoped CI criterion | Review future finding/baseline changes. Security-tab upload is not needed to re-close this criterion. |
| SEC-3 | Environment-specific verification; no durable plaintext secrets; encryption, rotation, revocation, webhook and permissions. | [Token audit](2026-11-20-dupr-token-security.md), [deployed-reader manifest](2026-11-20-dupr-deployed-source-manifest.json), [rollout preflight](2026-11-20-dupr-rollout-preflight.md), [#1066](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1066). Dual readers inspected; V1/V2 key names absent. Fail-closed writer remains local, not safe to deploy without keys. Partner-token plaintext cache and upstream revocation proof remain. [#1057](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1057) grant restriction deployed and independently verified. | PARTIAL / WAIT | NOW: review partner-cache protection, revocation/retention behavior and staged canary tests. EXTERNAL: durable key custody + independently tested recovery; then activate keys, canary writers, reviewed backfill and aggregate zero-plaintext verification. Do not ship missing-key outage. |
| SEC-4 | Every July audit finding reconciled with current code/migration/deploy and verified status; stale executive summary updated. | [July audit](../security-audit-2026-07-06.md) contains historical remediation tables plus original finding text; [current grants audit](2026-11-20-sensitive-access.md) validates a subset. No current all-finding reconciliation covering C1/H1–H4/M1–M9/low items is established by these subsets. | PARTIAL | NOW: build finding-by-finding current matrix using deployed/catalog evidence where relevant; reconcile stale summary without rewriting historic findings as current facts. |
| A11Y-1 | Whole-page contrast enabled in both themes; no unexplained violation/incomplete on target pages; CI both themes. | [#1050](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1050) guard enabled; [#1071](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1071) merged foreground fixes. [Public audit](2026-11-20-public-accessibility.md) records 16 route/theme/width scans and explicit manual layer analysis for incompletes. Its additional story-tag patch is local/pending at cutoff, not part of #1071; authenticated targets lack coverage. | PARTIAL | NOW: review/merge remaining reproduced story-tag fix; verify deployed target states and both-theme CI with manual-incomplete rationale retained. No need to redesign already-passing gradients/badges. |
| A11Y-2 | QuickTable action names, localization, keyboard/focus and mobile checks pass. | [#1044](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1044), [#1050](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1050) merged localized share/score/edit names and regression tests. These establish the named-action fixes, not a dated full keyboard/focus traversal through scoring dialogs and return focus. | PARTIAL | NOW: pin actual focus/keyboard/mobile task checks to current artifact; fix only failures observed. |
| A11Y-3 | Registration and organizer publish have integrated CI evidence without skips. | [Staging coverage audit](2026-11-20-staging-coverage.md) documents a local gate for required cases and skip reasons; explicitly says existing tests stop before registration submission/publish. Not merged evidence at cutoff; isolated staging not provisioned. | PARTIAL / WAIT | NOW: finish/review coverage gate and safe runtime backend isolation; implement actual registration/publish assertions. EXTERNAL: isolated backend/frontend, roles and fixtures. Require uploaded no-skip CI run. |
| UX-1 | DB-reconciled start/create/first score/completion/repeat, dedupe, explicit test/admin provenance, no PII. | [Lifecycle contract](../analytics/quicktable-lifecycle-contract.md); [#1067](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1067) atomic observed-score receipt, [#1069](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1069) aggregate report; [product snapshot](2026-11-20-product-evidence.md). Receipt is first qualifying observed write after rollout, may be historical correction, and is deleted with table. No verified intent classifier/full lifecycle delivery reconciliation. | PARTIAL | NOW: implement reviewed lifecycle/dedup/provenance gaps and reconcile commits vs delivery. WAIT: real sample. Never relabel 45/49 stored tables as abandoned/trial from stage alone. |
| UX-2 | Each reproduced create/publish/first-score issue has expected behavior, minimal fix, test and task verification including error/loading/empty. | [#1059](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1059)/[#1062](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1062) persisted-payment response checks; [#1065](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1065) failed score save rejects and retains editable draft. Unit/regression evidence does not cover the complete three-journey mobile task matrix. | PARTIAL | NOW: execute bounded task matrix on isolated staging, include retry/loading/error/empty, record per-finding reproduction and verify fixes. No speculative scoring redesign. |
| UX-3 | Commit-accurate publication/registration funnel, canonical publication timestamp and production sample, no PII. | [#1061](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1061), [rollout](2026-11-20-publication-rollout.md): trigger applied, 27 historical unknown timestamps preserved; 12 pgTAP checks. [Weekly report](2026-11-20-weekly-committed-evidence.md) observed zero eligible receipts/publications in pre-rollout window, not inactivity. GA4 reconciliation and new real commit sample absent. | PARTIAL / WAIT | NOW: verify registration/publication event dedup and privacy. WAIT: real post-rollout publication/registration; reconcile DB and analytics without manufactured production activity. |
| UI-1 | Main flows checked against tokens/hierarchy/responsive states; no styling drift in changed screens; visual/mobile checks. | Narrow contrast improvements and PR visual gates exist; [public audit](2026-11-20-public-accessibility.md) is initial-state accessibility, not a whole main-flow visual-system inventory. | PARTIAL | NOW: bounded audit of main screens/states with existing tokens and visual/mobile checks; only implement reproducible drift, retain already-correct styles. |
| DB-1 | Drift classified and safe reviewed reconciliation; no uncontrolled schema mutation. | [#1055](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1055), [dated ledger baseline](2026-11-20-db-drift.md): 427/427 versions at observation, 177 tables with RLS, 400 policies. Later reviewed migrations exist; the old count is not today's total. Ledger parity explicitly does not prove schema/grant/policy/function equivalence. [#1070](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1070) scoped actual-schema types. | PARTIAL | NOW: normalized clean-replay vs catalog object/grant/policy/index/function diff; classify and review each difference. Re-read ledger after later migrations. Never replay historical SQL with include-all. |
| DB-2 | pgTAP/integration concurrency, retry/idempotency proves no overbook/lost scores/double transitions or charges across score/bracket/OTP/payment. | Existing pgTAP suite and multi-session `scripts/qa/db-race.mjs`; [#1067](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1067) 15 score races plus rollback evidence; [#1059](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1059)/[#1062](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1062) claim regression fixes. This receipt race and false-success fix are not a complete OTP/payment/bracket idempotency coverage map. | PARTIAL | NOW: map existing assertions to each invariant before adding code; add only missing concurrency/retry/negative coverage, particularly OTP/payment state transitions. No real charge needed for deterministic integration checks. |
| ARCH-1 | Touched score/payment DB work isolated in tested logic/repository; components orchestrate UI. | [#1065](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1065) extracted tested `quickTableScoreSave`; [#1062](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1062) shared claim-response validation. Targeted progress, not proof all touched DB operations obey boundary. | PARTIAL | NOW: inspect touched call sites and complete only missing score/payment boundaries with tests; avoid broad refactor. |
| QA-1 | Registration, publish, save, completion/recovery happy/retry/idempotency/negative paths run staging CI with explicit skips. | [Staging coverage audit](2026-11-20-staging-coverage.md) explicitly disclaims end-to-end writes; merged unit/pgTAP/visual runs provide supporting layers, not this staging criterion. | PARTIAL / WAIT | NOW: extend existing journey tests with actual write/verify/retry/recovery cases and safe isolation gate. EXTERNAL: staging fixtures/roles; then execute and archive full CI manifest. |
| OPS-1 | Current real restore, integrity checks, measured RTO/RPO. | [#1068](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1068), [restore readiness](2026-11-20-restore-drill-readiness.md): helper and seven completed physical-backup inventory entries; no restore executed. July drill and provider inserted_at cannot establish current RTO/RPO. | WAIT, preparation PARTIAL | NOW: finalize recovery-point manifest/invariants and containment plan. EXTERNAL: paid clone eligibility/budget, isolated target and backup recovery timestamp; perform restore-to-new-project and measure verified readiness, integrity and RPO. |
| OPS-2 | Safe actionable drift monitor, Actions and branch protection evidenced, no historic false-red. | **Direct GitHub API 14:08 UTC:** migration workflow id314383775 is `disabled_manually` (updated July 29); last listed runs July27/28 failed. `branches/main/protection` returned 404 `Branch not protected`; repository rulesets returned `[]`. YAML presence and manual merge discipline do not enforce release protection. | PARTIAL; current controls absent | NOW: review current strict drift behavior against reconciled baseline, enable and execute read-only monitor; configure available branch required checks/PR controls and verify effective API state. If plan disallows protection, document exact provider limitation and equivalent enforceable alternative; do not silently mark PASS. |
| PERF-1 | Vietnam-mobile numeric p75 LCP≤2.5s, INP≤200ms, CLS≤0.1 with samples. | [Field report](2026-11-20-field-vitals.md): rating-event samples LCP3040/INP1936/CLS823, no numeric metric_value registered/export established. [#1060](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1060) reproduced news image CLS fixed; exact production URL verified. Ratings/lab isolated shift are not numeric field p75. | PARTIAL / WAIT | NOW: privacy-safe numeric distribution/raw-export path and remaining attributed shift reproduction. WAIT: representative post-fix field sample, report per-route/segment p75 and interval; do not rerun lab to manufacture field pass. |
| PERF-2 | Budget passes; representative route/video cost before/after, no IDE metadata in artifacts. | [#1043](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1043) metadata guard; [#1052](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1052) Zod Mini maintains CI budget; reported initial228.4/280KB and code1892.4/1920KB at verification. These cover artifact/budget, not full route-level/video cost evidence. | PARTIAL | NOW: read representative route initial/async/video waterfall and record before/after only where measured issue warrants optimization. Do not add speculative splitting. |
| SEO-1 | Coverage/61 404 URL dispositions, internal-link integrity, 28-day CTR, /san tracking, VI/EN parity, GSC/CWV report. | [Current acquisition report](../seo/2026-11-20/README.md), [#1058](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1058): fresh 28-day global GSC totals; coverage/404/parity not closed. Current clicks/CTR are descriptive, not post-fix causality or field CWV. | PARTIAL | NOW: acquire/reconcile current coverage and 61-URL dispositions, crawl internal links, VI/EN canonical/hreflang/render parity and /san tracker. WAIT only where property export or clean post-fix interval is necessary; existing GSC access does not justify declaring entire SEO blocked. |
| NATIVE-1 | Signed physical-device auth/deep link/locale/push/offline/payment/VoiceOver/large-text/draft evidence, build/device/OS/date, no P1. | [#1066](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1066), [native report](2026-11-20-native-simulator.md): exact SHA156a61d7 isolated simulator298 Swift tests +16 XCTest and unsigned Release build pass. This supersedes earlier non-equivalent294-test claim but is not device evidence or later-main parity. | WAIT, simulator PARTIAL | NOW: delta review and prepare device test matrix/build. EXTERNAL: physical iPhone/Android as applicable, signing/push/payment credentials/operator. Record actual results; do not substitute simulator. |
| RET-1 | Explicit real-event cohort/test exclusion and DB-reconciled activation/return ≥30 days after verified instrumentation. | [Product snapshot](2026-11-20-product-evidence.md), [tracker](9-score-evidence-tracker.md): 1/32 earlier-creator signal is exploratory, not retention. Full verified lifecycle/provenance prerequisite remains open; no legitimate cohort clock start established by receipt merge alone. | PARTIAL / WAIT | NOW: define verified meaningful action/cohort/provenance and complete instrumentation. WAIT: full30-day observation after verified start; preserve dated snapshots and deletion limits. |
| AN-1 | Dedupe, no PII, DB source of totals, verified production analytics delivery/commit reconciliation. | [#1067](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1067)/[#1069](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1069) server receipt/report; manual post-merge [run44746616112](https://github.com/cuongnguyen84/pickle-hub-pro/actions/runs/44746616112) succeeded with expected sections. GA4 global totals/field samples do not establish lifecycle dedup/privacy or commit delivery. | PARTIAL | NOW: inventory event properties/privacy, wire missing lifecycle events, verify delivery and reconcile logical IDs/retries to DB aggregates with no raw identity export. WAIT: qualifying real commits for production sample. |
| REV-1 | 5 buyer tasks,2 sellers/20buyers,≥8checkout/5validorders/3paid-delivered/≤1seller cancel, then30-day repeat. | [Tracker and validation gates](9-score-evidence-tracker.md); historical2products/1order are stale and not this cohort. Existing release code cannot establish demand/usability/fulfilment. | WAIT; current validation MISSING | NOW: confirm validation packet/query/readiness and safe pilot measurement. EXTERNAL: real inventory,2sellers/20non-team buyers, actual fulfilment/payment; V0≥4/5tasks unaided,14-day demand then30-day repeat(≥2repeat buyers or5new legitimate orders,no serious unresolved dispute). Keep indexing gate closed until criteria pass. |

## All 15 scorecard categories remain in scope

This is an evidence crosswalk, not a substitute score. A category with one
passed subtask is not automatically passed overall.

| Category | Required IDs | Acceptance state at cutoff |
|---|---|---|
| Product/positioning | UX-1,UX-2,RET-1 | Lifecycle/task work plus real classified cohort outstanding. |
| UI/visual consistency | UI-1 | Bounded main-flow evidence and observed-drift audit outstanding. |
| UX/task completion | UX-1,UX-2,NATIVE-1 | Regressions fixed; complete task and physical-device evidence outstanding. |
| Accessibility | A11Y-1,A11Y-2,A11Y-3 | Contrast/action progress; remaining patch, keyboard/focus and unskipped write journeys outstanding. |
| Codebase | ARCH-1,QA-1 | Scoped extraction progress; full touched-boundary and staging coverage outstanding. |
| Architecture/API | DB-2,ARCH-1,QA-1 | Broad existing tests; invariant map and real staging paths outstanding. |
| Database | DB-1,DB-2 | Ledger baseline, hardening and races exist; full schema/invariant closure outstanding. |
| Security/privacy | SEC-1..4,AN-1 | Dependency and CodeQL scope pass; custody/plaintext/revocation, reconciliation/privacy outstanding. |
| QA/testing | A11Y-2..3,QA-1,DB-2 | Unit/database layers strong; integrated mandatory paths not yet evidenced. |
| Web performance | PERF-1..2 | Measured image defect fixed; numeric field p75 and remaining route evidence outstanding. |
| CI/CD/operations | OPS-1..2 | Restore unexecuted; effective protection absent and scheduled drift disabled at cutoff. |
| SEO/content | SEO-1 | Current traffic baseline exists; URL disposition/parity/coverage still open. |
| Apple/native | NATIVE-1 | Exact-SHA simulator success; physical-device gate outstanding. |
| Analytics/growth | UX-1,UX-3,RET-1,AN-1 | Server observations improved; lifecycle delivery, real sample and retention still open. |
| Commerce/revenue | REV-1 | Real usability, demand, fulfilment and repeat cohort outstanding. |

## Execution split without shrinking the objective

**Implement/review now:** full July finding reconciliation; safe partner-token
protection/revocation preparation; remaining reproduced contrast patch and
keyboard/focus checks; explicit lifecycle provenance/dedup/privacy; main-flow
task/visual audit; schema/grant/function equivalence; invariant-to-test map and
missing OTP/payment/bracket tests; scoped boundaries; actual staging write
journeys with backend isolation; effective release protection and drift monitor;
numeric RUM collection; current 404/internal-link/VI–EN coverage work. First
inspect existing evidence/tests: this list does not authorize redundant rewrites.

**External prerequisites with concrete gates:** key custody and independent
recovery before encrypted production writer activation; approved paid isolated
restore target/containment before recovery drill; isolated staging fixtures
before write E2E; signed physical devices/operator for native; real committed
event sample for analytics; sufficient traffic and explicit valid cohort clocks
for CWV/retention; real sellers/buyers/inventory/fulfilment for Shop. Elapsed
time alone is not evidence; undefined instrumentation cannot start a valid clock.

Weekly aggregate automation covers its stated DB queries only. It does not
silently schedule device work, GSC inspection, key recovery or recruiting.
Track each external gate with owner, prerequisite, actual start, next check and
evidence artifact; keep independent code work running meanwhile.

## Evidence precedence and follow-up

Some tracker rows still describe GSC as stale, publication timestamp as absent,
and #1071 as awaiting CI. Those statements are superseded **only for those
claims** by current acquisition/rollout reports and merged PR status above.
The token audit's earlier unverified-deployment paragraph is similarly narrowed
by its later preflight and deployed manifest, not converted into encryption PASS.
Local staging and story-tag work do not become merged merely because their
audit files exist. The native audit contains a malformed trailing log fragment;
its explicit isolated SHA/run results are the relevant evidence, not that fragment.

Next review should refresh this matrix by ID after each reviewed merge or
external observation. Close a criterion only with its missing evidence; keep
the original15-category/135-point objective open until a defensible rescore.

## Evidence delta after PR1074 — 20 November 2026

Snapshot UTC: 2026-11-20T15:52:45.695897+00:00; remote main `95de8c26`. This delta updates only the scoped observations below; it does not close roadmap categories or assign a new score. Pending PR states are point-in-time observations, not guarantees about later CI.

- **Recovery / SEC-4:** PR1076 merged as `6a060661`; deploy-guard44763225691 success deployed only request-recovery-link. Management API source hashes confirm uniform response, independently confirmed Auth-email matching and finite future expiry guard, with no token-return branch. Cloudflare production deployment10e7d24f (same commit) completed15:34:23UTC. At15:35UTC custom domain and production Pages alias served the new acknowledgement asset without the old captcha_solved/token navigation sink. [Recovery production verification](2026-11-20-recovery-production-verification.md) links exact scope and evidence; no synthetic recovery/provider delivery test was run. Broader registration-token consumer expiry and lifecycle remain unresolved.
- **Token lifecycle / SEC-4:** [PR1083 inventory and staged predicate](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1083) is OPEN, additive helper + pgTAP only. Existing consumers are not rewired; no rotation, production application or universal expiry guarantee is claimed. Historical source inventory is not current catalog parity. Existing aggregate validity observations do not prove expiry enforcement.
- **A11Y-2:** [PR1082](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1082) OPEN, head3ee0518d. Scoped QuickTable inline editor Escape/focus restoration has7passing component tests and actual-component browser evidence at390/1280 light/dark. Failed save keeps draft/focus. CI remains pending; this is not merged/deployed/full-dialog, authenticated-journey or screen-reader acceptance. Evidence is owned by that PR and deliberately not duplicated here.
- **IndexNow / SEC-4:** Migration-first PR1078 merged as1384fc1b; primary independently applied/read back ledger, RLS, definer/empty search path, service execute/browser denial and zero bucket rows. Read-only REST schema visibility also exposes the budget RPC. Handler activation [PR1081](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1081) remains OPEN: schema presence does not establish live handler enforcement. No budget RPC invocation or IndexNow submission was performed for this evidence.
- **Sanitizer / SEC-4:** HTML5 parser sanitization [PR1079](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1079) remains OPEN; local code/tests and pending CI are not deployed SSR sanitization proof.
- **Analytics / AN-1, UX-3:** [PR1080](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1080) merged as95de8c26, allowlisting Social Event failure-code telemetry. Source commit ordering and local tests do not establish production delivery, matched-window DB/GA4 reconciliation, retention or conversion outcome.

All fifteen categories remain governed by the full roadmap. These scoped fixes and verified deployments do not establish135/150, a minimum8.5/category or an overall9/10.
