# 9/10 score evidence tracker

Purpose: keep the quality score tied to current evidence instead of treating a
merged PR, an old report, or a lab check as proof that a product outcome is
working. This file tracks the time-dependent evidence needed to move the
15-category review from 7.6/10 toward 9/10.

## Reviewed implementation status (2026-11-20)

- CodeQL JS/TS/Python: PR #1047 merged after CI passed.
- QuickTable compact action names/tests and page-wide light/dark contrast:
  PR #1050 merged. Public club/rankings browser checks passed; event/organizer
  paths still need suitable staging data and auth coverage.
- Dependency patches and Zod Mini migration: PR #1051/#1052 merged. Production
  dependency audit zero advisories at verification; all CI passed. This does
  not close development dependency findings.
- Weekly aggregate workflow: PR #1053 merged, first manually dispatched run
  44667223381 succeeded and produced dated artifact. Thursday 08:31 ICT schedule.
- Database ledger audit: PR #1055 merged, 427/427 parity. Schema, grants,
  policies and function authorization equivalence still need proof.
- Secret-table privilege hardening: PR #1057 merged after all five gates, including
  clean replay and race harness; applied production and independently verified
  denied browser secret reads with required metadata/service access preserved.
- DUPR fail-closed writer is local only. V1/V2 secret names absent at preflight;
  activation must follow reader parity verification and tested durable key custody.
- Fresh GSC/GA4 acquisition baselines are saved in
  [20 November report](../seo/2026-11-20/README.md). Global traffic reports do
  not establish segmented conversion, CWV or retention.

## Additional verified rollout (20 November)

- PR #1059/#1062: server and client reject unconfirmed claim success. CI passed.
- PR #1060: reserved news image geometry; exact production URL verified with
  fresh Chrome context. This closes image-load shift reproduction, not field CWV.
- PR #1061: server publication timestamp applied; trigger enabled, 27 historical
  rows remain unknown. No fabricated historical dates.
- PR #1065: failed score saves reject, editors retain draft on retry; CI passed
  with tested isolated production score module and unchanged coverage thresholds.
- PR #1067: internal score evidence applied after clean replay and multi-session
  race/rollback PASS; browser grants absent, RLS/trigger enabled, no backfill.
- PR #1069: weekly report includes server-observed evidence. Manual post-merge
  run 44746616112 succeeded; downloaded artifact confirms new report sections.
- PR #1070: scoped types generated from actual production schema; CI passed.
- PR #1071/#1072: light-mode CTA and story-tag contrast fixes merged after CI.
  Manual incomplete-node rationale remains scoped; authenticated journeys and full
  keyboard/focus acceptance are still open. No whole-product AA claim.
- PR #1073: mandatory staging coverage gate merged at 14:54:11 UTC as
  `83ada796cf050151536c1f04060c85de8a89feb5`; all PR checks passed and local
  coverage regression tests passed 13/13. No real staging no-skip run or
  registration/publish write-journey proof exists yet.
- Release protection is enabled (strict quality/smoke checks, administrator
  enforcement and PR policy). Reviewed migration #1064 was applied atomically
  with its ledger row; re-enabled drift run 44752651464 succeeded. See
  [release control evidence](2026-11-20-release-controls.md). Full schema
  equivalence and an actual restore drill remain open.
- [Current security reconciliation](2026-11-20-security-finding-reconciliation.md)
  covers all 25 historical findings with separate source/deployment status.
  This does not mean all findings are fixed; recovery authorization is a priority.
- Current fetched-main native SHA 156a61d7: 298 Swift Testing tests, 16 XCTest,
  unsigned Release simulator build passed. Physical-device checks remain open.

## Current evidence snapshot (2026-11-20)

| Area | Last known evidence | Status | What is still missing |
|---|---|---|---|
| QuickTable activation | Historical 20/10–19/11 snapshot: 49 created, 10 with scored matches, 5 completed, 34 creators, 1/34 had any earlier table. Reconciled current 21/10–20/11 cohort: 45 created, stages 14/0/21/5/5, 32 creators; stage observed 2026-11-20T01:31:53Z. Verified calendar-window reconciliation: 49 - 5 tables on Oct 20 + 1 on Nov 19 = 45. Source: [baseline](2026-11-19-event-baseline.md). | **Measured, exploratory** | No deletion inference. Snapshots are mutable; stage is not intent or abandonment. Current score/complete counts are not retention. |
| Social Event activation | 0 new registrations and 0 events past their scheduled end in the 20/10–18/11 window; all-time snapshot in the report: 27 events and 107 registrations. | **No current funnel sample** | Verify GA4 journey events against committed rows when a real event is available. Canonical publication timestamp is now deployed (#1061), with 27 historical unknowns preserved; post-rollout commit/event reconciliation is still missing. |
| Retention | Historical 1/34 returning-creator signal; current cohort has 32 creators and requires a fresh prior-activity comparison. | **Insufficient cohort** | Define first meaningful action, exclude test/admin traffic through a verified explicit marker, and observe a full 30 days. |
| GSC / indexing | [Current acquisition baseline](../seo/2026-11-20/README.md): GSC 21/10–17/11, 2,845 clicks and 83,819 impressions. | **Current acquisition; coverage partial** | URL dispositions, internal links and VI/EN parity still need representative current inspection. The historical 61-URL export is not a current error count. |
| Organic CTR | Current global 28-day CTR 3.39%, previous 3.76%; position 7.9 vs 7.4. | **Measured, descriptive** | Segment VI/EN query groups and position; this is not causal post-change improvement evidence. |
| CWV field data | [Vietnam mobile GA4 ratings](2026-11-20-field-vitals.md), 23/10–19/11: LCP 3,040 events / 76.61% good; INP 1,936 / 91.22%; CLS 823 / 70.11%. | **Current ratings; numeric p75 missing** | Rating shares are not numeric p75 or CrUX. Numeric collection and remaining route-level shifts remain open; historical p75 is not current acceptance evidence. |
| Native device quality | The manual backlog still contains unchecked iPhone payment, VoiceOver, push, offline scoring, deep-link, locale, and draft-recovery checks. | **Not verified on device** | Record device, OS, app build, date, scenario, result, and evidence for each high-risk path. |
| Shop demand | The release packet (dated 2026-08-28) says the MVP was not released; historical evidence was 2 products and 1 real order. | **Stale / owner-gated** | Run the 5-person usability check, then the 20-buyer/2-seller 14-day cohort and the 30-day repeat check. Do not treat code readiness as demand validation. |
| DUPR production readiness | [Deployed-reader preflight](2026-11-20-dupr-rollout-preflight.md) and source manifest verified dual readers; V1/V2 key names absent, fail-closed writer local only. Historical May readiness text is superseded for these facts. | **Partial / custody prerequisite** | Test durable key recovery before activation; partner-cache plaintext, rotation/revocation and zero-plaintext verification remain open. |

## Weekly protocol

### Ownership and next checks

Review dates below are not scheduled jobs unless a workflow is explicitly
listed. Weekly QuickTable and Social Event aggregate reads are implemented in
`.github/workflows/weekly-product-evidence.yml`; they run only after merge to
the default branch and require the repository's existing
`SUPABASE_ACCESS_TOKEN` Actions secret. GSC, CWV, native device tests, Shop
cohorts, and DUPR review remain manual; no background process is configured
for those areas.

| Evidence | Accountable owner | Next check (Vietnam date) | Action at that check |
|---|---|---|---|
| QuickTable stages and repeat cohort | Lead + growth audit agent | 2026-11-26 | Run aggregate SQL read-only; record window and sample; define first meaningful action before a retention verdict. |
| Social Event analytics reconciliation | Lead + analytics coding agent | 2026-11-26 | Verify current instrumentation and publication timestamp; reconcile only if real commits exist. |
| GSC coverage, 404s and CTR | Lead + SEO audit agent; account owner for unavailable GSC access/export | 2026-11-26 | Acquire current dated export; record blockers if access is unavailable; use existing 28-day data when valid. |
| Mobile Vietnam CWV | Lead + frontend/performance agent | 2026-11-26 | Read current field data and sample sizes; insufficient samples remain unresolved. |
| Native high-risk device scenarios | Lead + native agent; device operator for physical checks | 2026-11-26 | Check available signed build/device and log completed tests; unresolved scenarios remain open. |
| Shop V0 and pilot readiness | Lead + commerce agent; account owner for seller/buyer recruitment | 2026-11-26 | Verify current release and inventory state; set actual pilot start only when prerequisites pass. |
| Shop V1 demand / V2 repeat | Lead + growth audit agent | 2026-11-26 prerequisite review | Record cohort start; V1 verdict is start +14 days and V2 verdict V1 end +30 days, not an assumed calendar date. |
| DUPR configuration and token storage | Lead + platform/security agent | 2026-11-26 | Verify current production state read-only; replace stale readiness assertions with dated evidence. |

The automated aggregate artifact is generated Thursday at 08:31 ICT and
retained for 90 days, with a copy in the Actions run summary. It does not create
or update a report in the repository. Failures appear as failed Actions runs;
no Telegram alert is configured for this workflow.

If an item is closed earlier in an active implementation session, record that
date and evidence and use the next check for regression/observation instead.

### QuickTable observable-stage cohort (v1, 2026-11-20)

Use [quicktable-observable-stages.sql](../sql/quicktable-observable-stages.sql)
to classify every table in a creation cohort into exactly one current stage:
`created_no_roster`, `roster_no_matches`, `matches_no_scores`, `scored`, or
`completed`. Completion status takes precedence, then a non-null pair of
scores, then matches, then roster. Empty stages are returned with zero counts.

Schema anchors: `quick_tables` owns `created_at`, `creator_user_id`, and
`status`; `quick_table_players.table_id` and `quick_table_matches.table_id`
reference it in migration `20251223034604_88ebf84f-5dfa-4d32-8da7-d983f85bf487.sql`.
The current generated types confirm `is_bye`, both score columns, and
`quick_table_teams.table_id`. Roster means a non-BYE bracket player row;
team registration is reported separately because a registered team is not
necessarily in a generated bracket yet. A generated placeholder player may
still count as roster: this measures stored rows, not verified participation.

Limits: current data is a snapshot, not a timestamped transition history.
Tables may have been edited, reset, or deleted after creation. Fixing the
creation window does not freeze its later scores/status. Non-null scores may
be trial input or defaults; neither they nor no-score tables prove real play,
abandonment, or usability friction. There is no intent classifier in this SQL.
It does not exclude test/admin traffic without a verified explicit marker.
Creator counts exclude null IDs and must not be summed across stage rows.
Diagnostic columns expose completed tables without scores and matches without
roster instead of silently assuming monotonic progression. The query has been
checked against repo schema only; it has not been executed against production.

Run every Thursday, using the previous 30 complete Vietnam calendar days. Save
the date, query/report version, window, sample size, and result. Never overwrite
an earlier result.

1. **Product and retention:** run `docs/sql/quicktable-baseline.sql` and
   `docs/sql/quicktable-returning-creators.sql`. Add first meaningful action,
   first score, completed table, and repeat-creator counts once their events or
   server queries exist. For Social Events, run `docs/sql/social-event-baseline.sql`.
2. **Analytics integrity:** compare deduplicated GA4 journey IDs with committed
   database rows. Segment Vietnam/international, device class, and app surface;
   exclude explicit test/admin/E2E traffic. Record missing event properties or
   timestamp gaps as blockers rather than filling them with estimates.
3. **SEO:** refresh GSC coverage and performance exports. Re-run the URL
   inspection classifier only with a dated export and record a disposition for
   every inspected group. Check a sample of both VI and EN venue URLs with a
   Googlebot request and keep the 404/410 decision separate from redirects.
4. **CWV:** read Vietnam mobile field data for LCP, INP, and CLS. Keep lab
   Lighthouse results as diagnostics; they do not replace field data. A metric
   with too few samples remains `not enough data`.
5. **Native:** run only the scenarios changed since the last check plus all
   still-open P0/P1 cases in `docs/manual-test-backlog.md`. Attach a short
   result note; do not mark a check complete from a simulator run when the
   backlog requires an iPhone or push/device verification.
6. **Shop:** use the read-only validation query in
   `scripts/ops/shop-mvp-validation.sql`, remove team/smoke orders, and report
   checkout, legitimate orders, paid/delivered orders, seller cancellations,
   and repeat buyers. Keep `SHOP_PUBLIC_INDEXING` disabled until the cohort
   gate passes.
7. **Operations and security:** record SLO burn, client-error budget, Edge auth
   registry status, migration drift, and any open critical/high security item.
   A green CI run is evidence for the commit, not proof of 30-day production
   reliability.

## Decision gates for the 9/10 review

- **Activation gate:** the player and organizer funnels reconcile with server
  commits for a real sample; no PII is sent in analytics; duplicate retries do
  not inflate completion.
- **Retention gate:** at least one 30-day cohort is defined and measured. The
  QuickTable 1/34 observation is carried as exploratory until that cohort is
  complete.
- **SEO/performance gate:** current GSC coverage has dispositions, current
  Vietnam field data has all three CWV metrics or an explicit insufficient-data
  label, and no internal links intentionally point to unresolved 404s.
- **Native gate:** high-risk payment, authentication, push, deep-link, offline,
  and accessibility scenarios pass on the required physical device/build.
- **Shop gate:** V0 usability passes at least 4/5 without help; V1 reaches at
  least 8 checkout starts, 5 legitimate orders, 3 paid/delivered orders, and
  no more than 1 seller-caused cancellation; V2 records either 2 repeat buyers
  or 5 new legitimate orders with no serious unresolved dispute.
- **Security gate:** no durable plaintext partner credentials, production
  webhook/auth configuration is verified, and migration/RLS tests cover the
  release state.

## External dependencies and blockers

- GSC exports and URL Inspection access require the property owner and a current
  service-account permission.
- CWV needs enough real Vietnam mobile traffic; a missing metric cannot be
  made green by running more lab tests.
- Native checks require an iPhone, push credentials, a signed build, and an
  operator who can exercise real payment/push flows.
- Shop validation requires two operational sellers, twenty non-team buyers,
  real inventory, and a controlled payment/fulfilment process.
- DUPR production readiness requires partner keys, webhook access, and a
  deliberate decision about existing UAT rows before any cleanup mutation.

This tracker is evidence-only. It does not authorize production writes or
claim that a score has improved until the corresponding gate has a dated
result.

## Evidence delta after PR1074 — 20 November 2026

Snapshot UTC: 2026-11-20T15:52:45.695897+00:00; remote main `95de8c26`. This delta updates only the scoped observations below; it does not close roadmap categories or assign a new score. Pending PR states are point-in-time observations, not guarantees about later CI.

- **Recovery / SEC-4:** PR1076 merged as `6a060661`; deploy-guard44763225691 success deployed only request-recovery-link. Management API source hashes confirm uniform response, independently confirmed Auth-email matching and finite future expiry guard, with no token-return branch. Cloudflare production deployment10e7d24f (same commit) completed15:34:23UTC. At15:35UTC custom domain and production Pages alias served the new acknowledgement asset without the old captcha_solved/token navigation sink. [Recovery production verification](2026-11-20-recovery-production-verification.md) links exact scope and evidence; no synthetic recovery/provider delivery test was run. Broader registration-token consumer expiry and lifecycle remain unresolved.
- **Token lifecycle / SEC-4:** [PR1083 inventory and staged predicate](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1083) is OPEN, additive helper + pgTAP only. Existing consumers are not rewired; no rotation, production application or universal expiry guarantee is claimed. Historical source inventory is not current catalog parity. Existing aggregate validity observations do not prove expiry enforcement.
- **A11Y-2:** [PR1082](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1082) OPEN, head3ee0518d. Scoped QuickTable inline editor Escape/focus restoration has7passing component tests and actual-component browser evidence at390/1280 light/dark. Failed save keeps draft/focus. CI remains pending; this is not merged/deployed/full-dialog, authenticated-journey or screen-reader acceptance. Evidence is owned by that PR and deliberately not duplicated here.
- **IndexNow / SEC-4:** Migration-first PR1078 merged as1384fc1b; primary independently applied/read back ledger, RLS, definer/empty search path, service execute/browser denial and zero bucket rows. Read-only REST schema visibility also exposes the budget RPC. Handler activation [PR1081](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1081) remains OPEN: schema presence does not establish live handler enforcement. No budget RPC invocation or IndexNow submission was performed for this evidence.
- **Sanitizer / SEC-4:** HTML5 parser sanitization [PR1079](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1079) remains OPEN; local code/tests and pending CI are not deployed SSR sanitization proof.
- **Analytics / AN-1, UX-3:** [PR1080](https://github.com/cuongnguyen84/pickle-hub-pro/pull/1080) merged as95de8c26, allowlisting Social Event failure-code telemetry. Source commit ordering and local tests do not establish production delivery, matched-window DB/GA4 reconciliation, retention or conversion outcome.

All fifteen categories remain governed by the full roadmap. These scoped fixes and verified deployments do not establish135/150, a minimum8.5/category or an overall9/10.

## Scoped catalog and preview evidence — 20 November, later review

- DB-1 actual catalog comparison: successful disposable replay44768549751,
  merge checkout77e2efdd9e1460e7121d2902c131526f958f7965, versus production
 9,730 objects yielded2,546 differences, not parity. See
  [classification](2026-11-20-schema-equivalence.md). Ledger equality never
  establishes schema equivalence. Broader grants/FKs/functions remain open.
- PUBLIC schema CREATE: PR1087 mergedf52e0193 and primary applied exact
  migration240000+ledger. Independent effective privilege read-back denies
  anon/member CREATE, preserves their USAGE and service/owner CREATE. Fresh
  [schema-ACL delta](2026-11-20-public-schema-create-rollout.json) confirms
  only PUBLIC CREATE removal and explicit service CREATE addition in this
  scoped before/after. This is browser hardening, not trusted-service least
  privilege or whole-schema closure.
- OPS preview resolver: PR1089 mergedb98e1bd9 after required Actions and both
  Cloudflare checks passed; original-head36b345aa run44773469452 verified
  immutable14ad82bd preview for that exact commit and executed both visual
  projects after a real14minute CF queue. Later source heads require their
  own gates. Resolver success does not equal visual acceptance: raw suite
  recorded24 pixel mismatches and4 missing Shop baselines under existing
  advisory semantics. [Detailed cases](2026-11-20-visual-failure-classification.md)
  retain old-baseline/live-data/font fallback and missing-baseline distinctions.
- Missing auth FKs: [aggregate/source evidence](2026-11-20-missing-fk-classification.md)
  confirms23 columns have no FK replacement. Profiles958 unmatched auth refs
  include957 explicit ghosts; user_roles2 and view_events33 need provenance
  review, QuickTable creator refs0 unmatched. Do not install original profile
  auth FK against the explicit ghost model or perform blanket orphan cleanup.

- Visual determinism follow-up (21 November): PR1091 is source under review,
  not baseline acceptance. Guarded local34/34 contracts passed with32 telemetry
  requests blocked,16 explicitly allowlisted catalog/replay-matched STABLE read
  RPC calls, no unapproved writes forwarded. Earlier unguarded local proof and
  CI44784116210 have UNKNOWN tracking contamination; no cleanup was performed.
  Root reviewed all24 contact-sheet comparisons but approved no golden updates.
