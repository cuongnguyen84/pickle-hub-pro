# First observed qualifying score write — 20 November 2026

Migration 20261120140000 implements a minimal durable database evidence row,
not the full proposed lifecycle analytics receipt contract. No frontend event
is emitted and no RPC response shape is changed.

A trigger on quick_table_matches captures a qualifying committed write:
completed status, two existing participants and two nonnegative, non-tied
scores. Updates with identical score/status do not create evidence. The
internal table has one row per tournament, with server-generated receipt UUID
and database observation clock. No player/user/match IDs or names are copied.
The tournament foreign key remains internal and is not exposed to browser roles.

The evidence insert participates in the score transaction: rollback removes
both. The table primary key plus INSERT ON CONFLICT DO NOTHING means retries,
corrections and different match writers cannot create more than one receipt
for a tournament. The atomic score RPC already serializes by parent tournament.
Concurrent first writes contend on the same unique key; only the committed
winner's receipt survives. The existing CI concurrency harness scripts/qa/db-race.mjs now includes
Race 7: two distinct matches, one parent tournament, the existing forced
advisory-lock start barrier, 15 rounds, and lock/statement timeouts. Both RPC
transactions must commit, both scores must persist and exactly one receipt
must exist. A separate score transaction rolls back and must leave neither
score nor evidence. Runtime execution remains required in CI; these are not
single-session pgTAP concurrency claims.

Semantics and limits:

- This is the first qualifying score WRITE OBSERVED after rollout, not proof
  of the first-ever score, real-event intent or retention. A correction to a
  historical completed match may create the first observed row.
- No rows are backfilled from historical timestamps or current scores.
- Exact no-op retry of a historical completed match creates no row because the
  RPC returns without a write. A newly committed score creates evidence.
- Reset/reseed does not remove the tournament receipt. Deleting the tournament
  cascades its evidence; historical cohorts must account for deletion.
- Authenticated/anonymous roles have neither read nor write privileges.
  Service-role SELECT supports aggregate reports. No new public RPC is added.
- Trigger failure rolls the score transaction back. Keep this operation small;
  do not add external analytics network calls or arbitrary JSON payloads.
- The proposed quickTableLifecycleEvidence helper cannot yet consume this row:
  do not label it first_score_committed/firstScore=true or expose it through
  analytics without a reviewed observed-stage vocabulary and delivery contract.

Validation: duplicate migration guard and diff check passed. Twelve pgTAP
assertions prepared: pending state, RPC commit, server time, exact/stale retries,
receipt stability, browser denial failed score and transaction rollback. JavaScript syntax check for the integrated race harness also passes.
Runtime clean replay and multi-session race checks have not run locally:
Docker CLI exists but the Docker daemon/socket is unavailable.
No production changes were made.
