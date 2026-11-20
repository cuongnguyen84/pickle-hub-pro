# DB-1 public catalog equivalence — 20 November 2026

Ledger equality does not prove deployed schema equivalence. The reusable
scripts/schema-catalog.mjs collects catalog metadata only and compares a pinned
clean migration replay with a contemporaneous production snapshot. There are
no application-row reads or mutations. Routine/default/view/policy expressions
are retained as hashes rather than raw bodies, avoiding accidental disclosure
of literal credentials embedded in definitions. Object names and changed
metadata/hashes identify targeted follow-up work without dumping definitions.

Scope public-catalog-v1: relations/RLS/owner/options, columns/type/nullability/
identity/default hashes, constraints, policies/roles/commands/expression hashes,
indexes, function definitions/definer/config/owner/ACL, noninternal triggers,
view definitions, relation/column/schema grants, default grants and enum labels.
This is public-schema catalog equivalence, not all database security semantics:
auth/storage schemas, publications, extensions/versions, cron, roles/memberships,
FDW servers, large objects, sequence current values and application data are
outside scope. Differing PostgreSQL versions require explicit review of catalog
formatting differences. No blanket hash normalization or exception allowlist
hides changed function or policy definitions. Role-effective behavior still
requires the existing security tests and authorized staging task checks.

CLI (credentials in environment/libpq only, never command-line URLs):

    SCHEMA_SOURCE_SHA=<actual-checked-out-40-character-sha> node scripts/schema-catalog.mjs replay /tmp/replay.json
    node scripts/schema-catalog.mjs production /tmp/production.json
    node scripts/schema-catalog.mjs compare /tmp/replay.json /tmp/production.json /tmp/diff.json

Production requires SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in environment.
The collector uses the Management API read-only endpoint. curl reads auth headers
from stdin configuration rather than process argv. HTTP/error response bodies
are suppressed; credentials are neither serialized nor printed. Replay psql uses
libpq environment rather than credential-bearing argv. Snapshots are mode0600.
Comparator exits1 on differences,2 on invalid input,0 on scoped equality.
Changed/replay-only/production-only objects need individually reviewed schema
inspection and a deliberate migration; never repair ledger to conceal them.

The pgTAP workflow captures replay immediately after migration startup, before
tests/races mutate their disposable fixtures, and uploads a seven-day artifact
pinned to github.sha (actual checkout merge SHA for pull requests). CI must pass
SQL capture and comparator tests. Production comparison is a separate read-only
operation so ordinary pull requests never receive production credentials.

Current status: local comparator tests4/4 pass. Production read-only snapshot
collection and actual CI replay/compare results will be recorded after execution.
No equivalence or 9/10 closure is claimed from a tool implementation or ledger.
