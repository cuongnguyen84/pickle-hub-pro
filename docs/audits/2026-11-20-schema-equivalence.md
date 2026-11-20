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

Current status: local comparator tests5/5 pass. Actual production read-only
collection succeeded with9,730 catalog objects saved locally mode0600. Actual
CI replay/compare results remain pending; the snapshot alone cannot show drift.
No equivalence or 9/10 closure is claimed from a tool implementation or ledger.

## Executed replay comparison

CI run44768549751 succeeded; its artifact records actual merge checkout
77e2efdd9e1460e7121d2902c131526f958f7965, PostgreSQL17.12. Production snapshot
uses PostgreSQL17.6 and9,730 public-catalog objects. Comparator returned exit1:
**2,546 differences**, detailed in [object diff](2026-11-20-schema-equivalence-diff.json).
This contradicts public schema parity despite ledger equality.

| Category | Replay-only | Production-only | Changed |
|---|---:|---:|---:|
| Relation ACL |1741|129|0|
| Function ACL |401|23|0|
| Default ACL |80|0|0|
| Columns |0|61|1|
| Constraints |23|18|1|
| Indexes |0|18|0|
| Policies |0|10|0|
| Functions |2|9|4|
| Relations |0|7|1|
| Column ACL |0|6|0|
| Schema ACL |2|2|5|
| Triggers |0|2|0|

Priority1: public schema permits PUBLIC CREATE in production but not replay.
Review scoped revoke with role-effective tests; do not mirror all ACLs. Replay
has991 extra anon and745 extra authenticated relation grant records, so copying
its defaults could broaden access rather than harden production. Grantor/owner
variation (pg_database_owner vs postgres) also requires classification, not
silent normalization. Version formatting may explain hashes but not missing
objects/grants or relation security_invoker options.

Priority2 compatibility review: public_profiles has security_invoker=true in
replay, production reloptions=NULL. Changing it blindly may break a public view
whose base PII column grants were intentionally revoked. Inspect role-effective
view/base permissions and intended public projection before changing either.

Integrity review:23 replay-only foreign-key constraints include profiles_id_fkey,
user_roles_user_id_fkey and quick_tables_creator_user_id_fkey. Do not add them
without aggregate orphan checks and production-safe validation planning. Existing
production-only conversation/messages/play_requests/telegram/zalo objects and
functions require recovering reviewed source, not dropping live features.

Four differing function definitions: get_trending_feed,
mark_match_ready_for_dupr, ops_admin_probe_edge_functions and
publish_rewritten_news. Definition hashes identify investigation targets; retrieve
only reviewed routine bodies for a private diff, check hardcoded literal secrets
before artifact inclusion, and reconcile deliberately. Two replay-only signatures
(create_quick_table_with_quota and log_audit_event overloads) likewise need caller
compatibility review. No schema/security change was applied during this audit.
