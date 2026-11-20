# Restore drill readiness — 20 November 2026

Status: **NOT EXECUTED / OPS-1 OPEN**. No production mutation, backup
download, restore, key access, or database content access by this task.

## Evidence inspected

The runbook §6 records a 22 July physical-backup restore into a new disposable
Supabase project (deleted after verification): roughly four minutes until live.
It compared profiles/social_events/event_registrations/base-table counts.
That historic result is not evidence of recovery under today's schema.

Local preflight on 20 November:
- Docker CLI exists but daemon socket cannot connect.
- libpq psql 18.6 exists at /opt/homebrew/opt/libpq/bin/psql.
- pg_isready against 127.0.0.1:54322 reports no response.
- No current disposable restored database or dated backup artifact was supplied.

Therefore neither actual restore duration nor recoverability was measured.
Do not label a migration replay or unit-test pass as a backup restore.

## Repeatable procedure

1. Select an existing backup without altering production. Record provider backup
   ID, completion/recovery timestamp and backup type in restricted operator notes.
   Keep connection details, dump data and keys outside the repository.
2. Provision a disposable isolated target with network egress disabled where
   possible. Restored cron/jobs/webhooks must not send messages or charge users.
   Prefer the provider's restore-to-new-project path used by the historic drill.
   Confirm destination project identity is distinct from production before restore.
3. Start clock immediately before restore request; record target usable time,
   then independently verified usable time. Report service readiness and verified
   recovery as separate durations; do not call dashboard-live time full RTO.
4. Compare to a manifest collected at the backup recovery point, not present-day
   production. Validate counts, schemas, migration versions, constraints, grants,
   RLS and representative registration/score/payment read invariants. Counts
   alone do not prove data integrity. No real OTP/push/payment side effects.
5. RPO is incident/reference time minus the latest validated recoverable backup
   timestamp; record both timestamps. It is not the count delta between current
   production and backup. Without these timestamps RPO remains unknown.
6. Storage objects and durable encryption-key recovery are separate gates.
   Database-only recovery cannot establish either. Verify a test ciphertext with
   independently recovered key custody; never put keys/token values in reports.
7. Tear down only the identified disposable target once evidence is reviewed.

## Local smoke helper

scripts/ops/restore-drill-check.mjs reads aggregate counts from an already
restored loopback PostgreSQL target. It does not create or restore a database,
and refuses non-loopback URLs. Set RESTORE_DRILL_DATABASE_URL through a secure
environment, optionally PSQL_BIN. Never put credentials in a command argument,
repository, screenshot or log. It forces read-only transactions, excludes URL
options and suppresses raw libpq failures.

The helper's counts are preliminary consistency evidence, not an automatic
restore verdict. A loopback endpoint can itself be a tunnel; the operator still
must confirm it is a disposable isolated destination. No application-row output.

Validation: three Node contract tests pass (remote refusal, read-only SQL and
credential-free argv). Runtime snapshot/restore validation remains blocked on
a running disposable database + authorized backup and matching manifest.

## Read-only backup inventory — 20 November 2026, 13:24 UTC

Management API GET /v1/projects/ajvlcamxemgbxduhiqrl/database/backups
returned WAL-G enabled, PITR disabled, region ap-northeast-1, and seven
COMPLETED physical backups. Only inventory metadata was read; no backup was
downloaded, no restore initiated and no target project created.

| Inventory timestamp (UTC) | Status | Type |
|---|---|---|
| 2026-11-19 15:45:59.741 | COMPLETED | physical |
| 2026-11-18 15:45:51.635 | COMPLETED | physical |
| 2026-11-17 15:45:52.602 | COMPLETED | physical |
| 2026-11-16 15:45:57.021 | COMPLETED | physical |
| 2026-11-15 15:45:48.428 | COMPLETED | physical |
| 2026-11-14 15:45:54.226 | COMPLETED | physical |
| 2026-11-13 15:45:53.620 | COMPLETED | physical |

The API calls this field inserted_at. It is not evidence of the exact
recoverable transaction cutoff or backup completion time, so no numeric RPO
is inferred. COMPLETED is provider inventory state, not a tested restore.

### Concrete isolated drill target

Current official Restore to a New Project documentation was fetched read-only
on 20 November 2026:
https://supabase.com/docs/guides/platform/clone-project

It describes restoring a selected physical backup into a newly created
project in the same region; paid-plan access and physical backups are required.
The clone copies compute instance size, disk attributes, SSL enforcement and
network restrictions. Therefore the old July note saying a free-tier clone
was used must not be assumed to describe current billing/eligibility. Current
organization eligibility, available project quota and incremental compute/disk
charges must be checked in the account before creating the disposable target.
This task did not create any paid resource and establishes no price quote.

Use the newest listed completed physical backup as the candidate, after the
operator confirms its recovery point and the corresponding integrity manifest.
Select Restore to a New Project, never in-place restore of the production
project. Before initiating, prove how restored cron/network jobs will be
contained so they cannot send OTP, push, email, webhooks or payments. Source
network restrictions alone do not establish egress containment. Record target
identity distinct from production and arrange deletion after evidence capture;
deletion requires checking identity again. Do not assume Edge Functions,
Storage objects or external secrets are covered by a database backup.

### Still required to execute OPS-1

- Account owner verifies paid-plan feature eligibility, project quota and
  incremental compute/disk charge acceptance.
- Safe egress/cron containment for the restored target, before it can execute
  copied jobs; source production cron must not be changed for this drill.
- Backup recovery timestamp and recovery-point integrity manifest.
- Restore-to-new-project run, timestamped readiness checks, aggregate and
  invariant comparison, plus explicit target cleanup.

Backup inventory now establishes a concrete provider restore source/strategy;
OPS-1 remains OPEN because no actual recovery, RTO or RPO was measured.
