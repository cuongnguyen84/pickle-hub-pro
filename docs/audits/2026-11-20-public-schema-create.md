# Public schema CREATE — scoped reconciliation proposal

Source provenance: clean migration replay artifact from successful pgTAP run
44768549751, actual checkout77e2efdd9e1460e7121d2902c131526f958f7965,
PostgreSQL17.12, has no PUBLIC CREATE on schema public. Production PostgreSQL17.6
catalog differs: PUBLIC CREATE exists. The repository has no reviewed requirement
for browser roles to issue DDL; migrations execute as owner. This is a managed
legacy-schema default difference, not an assertion that an old migration failed.

Independent read-only production preflight confirmed schema owner postgres,
PUBLIC CREATE=true, and effective anon/authenticated/service_role/postgres CREATE
and USAGE all true. This is an effective SQL capability; it does not by itself
prove the public HTTP interface accepts arbitrary SQL. Removing it narrows the
trusted schema search-path surface and aligns the reviewed replay baseline.

Catalog inspection of public function source for CREATE TABLE/INDEX/VIEW/SCHEMA
patterns found five routines: setup_quick_table_roster_atomic,
generate_team_match_round_robin_atomic, generate_team_match_brackets_atomic,
create_quick_table_playoff_atomic and score_team_match_games_atomic. All are
SECURITY DEFINER owned by postgres and use TEMP TABLE. No matching non-temp
routine was observed. This static pattern check cannot exclude dynamic string
assembly or external privileged SQL clients; no such runtime dependency is
established by the current source. Temporary objects use temporary namespace,
and owner execution is preserved.

Migration preserves the existing effective service CREATE capability via an
explicit GRANT CREATE TO service_role before REVOKE CREATE FROM PUBLIC. Browser
roles lose inherited DDL; schema USAGE, table/routine privileges, other explicit
grants and owner rights are preserved. This is not a capability expansion for
service_role; production preflight confirms it already has effective CREATE.
No blanket
ACL mirroring and no public_profiles invoker change are included.

pgTAP13 checks catalog/effective privileges, actual anon/member CREATE denial,
preserved usage, actual service create/drop and migration-owner create/drop. They run transactionally
on disposable CI only. Production reconciliation requires reviewed CI pass,
exact SQL+ledger atomic application and independent privilege read-back. No
production DDL or application mutation was performed by this agent.

Migration version20261120240000 is reserved for this scoped change;220000 is
already assigned to registration-token validity and230000 to its SQL consumers.
The explicit service CREATE preserves compatibility, not least-privilege closure
for the trusted service role. Browser CREATE removal and USAGE preservation are
the narrowly tested objective.
