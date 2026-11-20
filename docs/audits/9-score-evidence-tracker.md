# 9/10 score evidence tracker

Purpose: keep the quality score tied to current evidence instead of treating a
merged PR, an old report, or a lab check as proof that a product outcome is
working. This file tracks the time-dependent evidence needed to move the
15-category review from 7.6/10 toward 9/10.

## Current evidence snapshot (2026-11-20)

| Area | Last known evidence | Status | What is still missing |
|---|---|---|---|
| QuickTable activation | Historical 20/10–19/11 snapshot: 49 created, 10 with scored matches, 5 completed, 34 creators, 1/34 had any earlier table. Reconciled current 21/10–20/11 cohort: 45 created, stages 14/0/21/5/5, 32 creators; stage observed 2026-11-20T01:31:53Z. Verified calendar-window reconciliation: 49 - 5 tables on Oct 20 + 1 on Nov 19 = 45. Source: [baseline](2026-11-19-event-baseline.md). | **Measured, exploratory** | No deletion inference. Snapshots are mutable; stage is not intent or abandonment. Current score/complete counts are not retention. |
| Social Event activation | 0 new registrations and 0 events past their scheduled end in the 20/10–18/11 window; all-time snapshot in the report: 27 events and 107 registrations. | **No current funnel sample** | Verify GA4 journey events against committed rows when a real event is available. The event contract also calls out the missing canonical publication timestamp. |
| Retention | Historical 1/34 returning-creator signal; current cohort has 32 creators and requires a fresh prior-activity comparison. | **Insufficient cohort** | Define first meaningful action, exclude test/admin traffic through a verified explicit marker, and observe a full 30 days. |
| GSC / indexing | The SEO follow-up uses a 2026-08-01 export and still lists coverage inspection and the 61-URL 404 export as unchecked. | **Stale** | New GSC export, URL dispositions, and production verification. |
| Organic CTR | A 28-day clean post-change window is required by the SEO follow-up. No current result is recorded here. | **Not measured** | Record VI/EN CTR by query group and position after the new baseline window. |
| CWV field data | The historical scorecard records LCP p75 2423 ms and CLS about 0.67, with INP lacking enough CrUX samples. | **Historical / partial** | Read current Vietnam mobile RUM/CrUX after at least 28 days and report LCP, INP, and CLS separately. |
| Native device quality | The manual backlog still contains unchecked iPhone payment, VoiceOver, push, offline scoring, deep-link, locale, and draft-recovery checks. | **Not verified on device** | Record device, OS, app build, date, scenario, result, and evidence for each high-risk path. |
| Shop demand | The release packet (dated 2026-08-28) says the MVP was not released; historical evidence was 2 products and 1 real order. | **Stale / owner-gated** | Run the 5-person usability check, then the 20-buyer/2-seller 14-day cohort and the 30-day repeat check. Do not treat code readiness as demand validation. |
| DUPR production readiness | The readiness report (dated 2026-05-24) says UAT was verified and user tokens were plaintext, with production secret/webhook/migration work listed. | **Must re-verify** | Confirm current environment and whether real users are connected. If production SSO is live, encrypt durable access and refresh tokens and verify rotation/revocation. |

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
