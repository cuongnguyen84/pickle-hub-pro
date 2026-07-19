## Verdict: reject the cluster as proposed

The immediate production blocker is QuickTable autosave. Its current schema/RLS makes a private resumable draft impossible without backend changes: drafts either become public or become unreadable by their creator.

### Ranked findings

| Rank | Sub-task / flow | Mechanism and trigger | User-visible symptom |
|---|---|---|---|
| **1 — Critical, near-certain** | **UX-04 — QuickTable** | Autosave inserts a `quick_tables` row. If the insert omits `is_public`, Postgres applies `DEFAULT true`; the only SELECT policy is `USING (is_public = true)`. There is no status gate. | An unfinished QuickTable becomes publicly readable while the organizer is still typing. Empty teams, placeholder names, incomplete format, and template defaults can appear as a real public table. The sitemap whitelist does not protect this table or direct API reads. |
| **2 — Critical, near-certain alternative** | **UX-04 — QuickTable** | The obvious leak fix is inserting the row with `is_public=false`. Under the stated SELECT policy, that row is then unreadable through normal RLS, including by its creator. | Autosave appears to work, but “resume draft” returns no row or a 403. The organizer loses the draft after leaving the screen. A service-role workaround would bypass tenant isolation and is not an acceptable client architecture. |
| **3 — Critical** | **UX-04/UX-05 — all five flows; highest consequence for TeamMatch and Doubles-Elimination** | Autosave and publish are concurrent writes unless publishing introduces a version/lock and disables or drains pending autosaves. Trigger: a delayed autosave request is in flight when the user presses Publish; publish succeeds first, then the stale autosave lands. | A just-published tournament can revert to draft/setup or have newer bracket/payment settings overwritten. For paid tournaments, registration can open with stale entry-fee or VietQR data. This is a plausible lost-slot/payment incident, not cosmetic damage. |
| **4 — Critical** | **UX-03/UX-05 — TeamMatch and Doubles-Elimination** | Payment fields become hidden while their state remains in the form/draft, or validation treats hidden fields as irrelevant without clearing/revalidating them. Trigger: enable fees, enter VietQR details, disable/collapse payment, apply a template or resume a draft, then publish. | The published tournament can charge the wrong fee, display a stale QR/account, or advertise paid registration with no usable payment destination. Conversely, hidden stale fee data can make a supposedly free tournament paid. Validation must be server-side and based on the final persisted payment mode, not field visibility. |
| **5 — High** | **UX-04 — QuickTable** | Adding `draft` to the real Postgres ENUM via `ALTER TYPE ... ADD VALUE` is irreversible. It also does not fix RLS: a draft remains public if `is_public=true`, and unreadable if false under the current policy. | Rollback cannot restore the previous schema. During mixed web/iOS versions, old clients may receive a status value they do not decode if drafts are exposed by queries. Depending on native decoding, rows disappear from lists or the response/screen fails to decode. |
| **6 — High** | **UX-04 — QuickTable, TeamMatch, Doubles-Elimination; Flex requires schema audit** | Reusing existing `setup` or `registration*` statuses as “draft” conflates abandoned editor state with product lifecycle state. Trigger: autosave creates the row before publish and the user abandons the wizard. | Existing queries, dashboards, notifications, registration logic, or organizer lists that interpret `setup`/`registration` as real tournaments receive phantom tournaments. QuickTable is definitely public under its default; exposure for the other flows depends on their unprovided RLS/query policies. |
| **7 — High** | **UX-04 — all five flows, both platforms** | Draft writes need optimistic concurrency. Trigger: the same draft is open in web and iOS, or in two tabs; an older client autosaves after a newer client. Plain last-write-wins overwrites the newer document. | Fields visibly revert or disappear. For tournament flows this can restore old team limits, bracket settings, fee amounts, or payment details. Use a revision number/ETag and reject stale writes rather than silently accepting them. |
| **8 — High, broad blast radius** | **UX-04/UX-05 — all five flows** | Backend, web, and reviewed iOS releases cannot be atomic. Trigger: the backend/status/API change ships while the new iOS binary is still in review, or the iOS binary ships against an already-rolled-back web/backend implementation. | Existing iOS users fail to save/publish, fail to decode new statuses, or bypass new client-only validation. Because native has no instant revert, the failure persists until another App Store release. All backend changes must remain compatible with both old and new native clients. |
| **9 — Medium, conditional but must be audited** | **UX-04 — four tournament flows** | Autosave creates durable rows on wizard entry/first edit, but those schemas have no draft lifecycle today. Every abandonment therefore leaves an orphan unless there is explicit expiry/deletion. If any cleanup job currently treats old `setup` rows as disposable, it can also delete legitimate resumable drafts. | Without cleanup, organizers may see duplicate/abandoned tournaments and operators accumulate unbounded junk. With an existing status-based cleanup job, a user returns and finds the saved draft gone. No cleanup cron was established in the supplied facts, so deletion by cron is not proven; it must be audited rather than assumed. |
| **10 — Medium, release-detection failure** | **UX-01..05 — QuickTable, TeamMatch, Doubles-Elimination, Flex** | These flows have no completion-funnel instrumentation. Trigger: release the cluster and compare the existing metric. | Regressions or “improvements” in four of five flows are invisible. This is not itself a user outage, but it prevents detecting abandonment or publish failure and makes the claimed goal unverifiable. |

## Specific status-model problem

Do **not** solve QuickTable drafts merely by adding an ENUM value.

A viable QuickTable implementation needs, at minimum:

1. Drafts inserted non-publicly.
2. An ownership column and an owner SELECT/UPDATE/DELETE RLS policy.
3. Public SELECT gated by both publication state and `is_public`.
4. Atomic publish validation.
5. Revision-based autosave conflict detection.
6. Published rows protected from later draft autosaves.

Given the heterogeneous status models, a separate private `creation_drafts` model may be safer than forcing `draft` into every tournament lifecycle. It must have owner-only RLS, flow/schema versioning, expiry semantics, and an atomic conversion to the final tournament row.

## Cluster-size failure

Shipping five flows across web and native together turns one shared autosave/status defect into a platform-wide creation outage. The 19 unmerged native commits make the Swift files especially unsuitable for a single release train: merge resolution can silently discard either the draft logic or the existing creation work, and the result cannot be rapidly reverted after App Store release.

Split delivery in this order:

1. Instrument each flow.
2. Ship backend draft/RLS/versioning changes additively.
3. Ship social-event autosave first.
4. Ship one non-payment tournament flow.
5. Ship paid flows only after payment-state and publish-race testing.
6. Ship native after old/new API compatibility is demonstrated.

## Genuinely safe portions

- **UX-04 for social events** is structurally safe regarding privacy: the existing draft status and owner/admin RLS keep drafts private.
- **UX-01 checklist/status UI** is low risk if it is presentation-only and does not alter persisted lifecycle state.
- **UX-02 templates** are low risk if they are merely editable initial values and never silently enable fees/publication.
- **UX-05 validation** is beneficial if it is authoritative on the server and executed atomically with publish.
- The existing sitemap whitelist is safe, but it is **not** a defense against QuickTable’s public RLS leak.