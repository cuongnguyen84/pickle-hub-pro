# QuickTable lifecycle measurement contract — 20 November 2026

Status: proposed server receipt contract + pure payload builder; not emitting
new production events. Existing organizer_tournament telemetry is preserved.

## Current delta — 20 November 2026

PR #1065 now rejects failed score saves and retains editable drafts. The older
Promise<void> failure behavior described below is the historical proposal
baseline, not current main. PR #1067 applied an atomic server-observed score
receipt, with trigger/RLS/grants independently verified; it is first qualifying
observed write after rollout, not proven first-ever score. No historical backfill
or production emission of the proposed lifecycle events is claimed. Receipt
review-pending language below describes the original proposal only.

## Historical facts and wiring limits at proposal

QuickTableSetup starts organizer_tournament_creation_started when a pre-created
table loads and roster input becomes usable, not when a DB table is first
inserted. Both setup completion branches emit organizer_tournament_created
after setupRosterAtomic returns success. These must not be renamed or counted
as raw table INSERT totals.

useQuickTableMutations.updateMatchScore calls score_quick_table_match_atomic
with expected score_version, but returns Promise<void> on both success and
handled failure. QuickTableView.handleScoreUpdate awaits it and then refreshes.
Neither fulfilled Promise nor refreshed rows establish a successful score
commit, and a first-score refetch must never emit activation.

QuickTableView's explicit end action checks updateTableStatus success. Other
completion paths, automated archival and format changes must be inventoried
before this becomes a canonical completion series.

## Implemented observed-score increment (review pending)

Migration 20261120140000 and the integrated seventh race in
scripts/qa/db-race.mjs implement internal first-observed qualifying score-write
evidence. This is a separate vocabulary from the proposal below. It is not
wired to the payload helper or GA4. A historical score correction can create
an observed evidence row, so it MUST NOT be mapped to firstScore=true or
first_score_committed. Historical intent/first-ever publication cannot be
recovered. Exact no-op retries of historical scores do not create evidence.

The receipt ID remains service-role-only. Further analytics wiring must either
define an honest observed_score_write stage or first establish a fully covered
post-rollout cohort. See quicktable-observed-score-evidence.md.

## Proposed first-ever lifecycle contract (not implemented)

One event: quicktable_lifecycle_committed; lifecycle_schema_version=1;
tool=quicktable; lifecycle_stage one of roster_committed,
first_score_committed, completion_committed. intent_classification remains
unknown until a separately reviewed, explicit intent signal exists. A name,
zero score, test-like title, or stage is not evidence of intent.

The RPC must return success=true and an opaque receiptId tied to one durable
transition. Retries return the same receipt ID. first_score_committed also
requires firstScore=true established atomically in the DB: first ever accepted
score for that tournament, across tabs, referees, AI and other writers.
Do not derive this from match counts fetched before/after the RPC. Completion
requires a real transition receipt, not repeated updates to completed status.

The pure quickTableLifecycleEvidence builder validates and allow-lists this
contract. Its deduplicationKey is LOCAL transport state; never spread the full
object into GA4. Only properties are public analytics payload. No table/user/
match IDs, names, title, score, URL query or registration token is emitted.

## Implementation sequence

1. Inventory all roster, score and completion writers; extend atomic server
   operations with immutable receipts/outbox under a reviewed migration.
2. Add retry/concurrency/rollback tests proving one transition receipt. Ensure
   reset/reseed and explicit trial markers have defined semantics.
3. Return typed commit results from mutations; handled failures remain failures.
4. Emit after confirmed receipt only; use bounded best-effort client dedup and
   downstream/server receipt dedup. Client storage alone is not exactly-once.
5. Reconcile server receipt counts against telemetry in a dated cohort.
   Missing analytics delivery/blocked storage must not affect business writes.

No abandonment or 30-day retention claim is valid from existing 10/49 or
45-table snapshots. Meaningful use and intent are separate dimensions.
