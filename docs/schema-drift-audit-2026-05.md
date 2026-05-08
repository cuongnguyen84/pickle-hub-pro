# Schema drift audit — May 2026

## Background

Sprint 4 surfaced two cases where the prod schema diverged from the
migrations folder because Lovable Cloud schema-editor changes were applied
to prod directly without a corresponding migration commit. Symptom: the
Supabase preview branch, which replays migrations from scratch, would
fail on a freshly-introduced migration that referenced an object the
preview branch never received.

Confirmed Sprint 4:

1. `livestreams.streaming_provider` + `hls_url` columns existed in prod
   but not in any migration. Backfilled by
   [`20260216155524_backfill_livestreams_provider_columns.sql`](../supabase/migrations/20260216155524_backfill_livestreams_provider_columns.sql)
   so the public_livestreams view migration could replay against a
   preview branch.
2. `og_images_bucket` policies were originally created with the invalid
   `CREATE POLICY IF NOT EXISTS` syntax (Postgres rejects). Replaced with
   `DROP POLICY IF EXISTS` + `CREATE POLICY` in
   [`20260415000001_create_og_images_bucket.sql`](../supabase/migrations/20260415000001_create_og_images_bucket.sql).

## Static analysis (offline)

Ran against the migrations folder. Findings:

| Pattern | Count | Status |
|---|---|---|
| `CREATE POLICY IF NOT EXISTS` | 0 (only inside an explanatory comment) | clean |
| `CREATE TRIGGER IF NOT EXISTS` | 0 | clean (Postgres also rejects this — would be a latent bug) |
| Total migration files | 129 | — |

Conclusion: the migrations folder itself is internally clean for the
two patterns that bit Sprint 4. No new static-detectable drift.

## What this audit does NOT cover

This audit cannot diff the live prod schema against the migrations
replay output without prod credentials. Lovable Cloud edits applied
directly to prod still won't show up here. The remediation strategy
below requires Cuong to run a small set of queries against prod and
compare against what the migrations folder produces.

## Live diff — queries to run

Run each query against the prod Supabase project
(`ajvlcamxemgbxduhiqrl`) via the SQL Editor or `psql`. Save the output
side-by-side with the same query run against a fresh
`supabase db reset` replay, then diff.

```sql
-- 1. Tables + columns
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 2. RLS policies
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Triggers
SELECT trigger_schema, trigger_name, event_manipulation,
       event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 4. Functions (just signatures — bodies are too verbose for diff)
SELECT n.nspname AS schema,
       p.proname AS name,
       pg_get_function_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname, args;

-- 5. Indexes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

For the migrations-replay side, the easiest comparison is the Supabase
preview branch that auto-deploys per PR (see the bot comment on PRs
#16, #17, #18). When a PR's preview deploy succeeds, that preview's
schema is the migrations-folder truth. Capture the same queries against
the preview branch's database URL.

## Remediation pattern (for future drift discoveries)

When prod has an object missing from migrations:

1. **Don't** edit the missing migration in place — that breaks idempotent
   replay for anyone who already migrated.
2. Write a new migration file with a stable timestamp BEFORE the first
   migration that references the missing object. Use idempotent guards:
   `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` + `CREATE POLICY`,
   `CREATE OR REPLACE FUNCTION`, `CREATE INDEX IF NOT EXISTS`, etc.
3. Reference the cause in the migration header — e.g.:
   ```
   -- Backfill: <object> existed in prod but not in any migration; preview
   -- branch deploy fails on <subsequent migration> when the object isn't
   -- there. Idempotent ADD/DROP guards so replay against prod is a no-op.
   ```
4. Commit the backfill migration in the same PR as the change that
   exposed the drift, so the preview branch deploy goes green.

## Ongoing process

- Before any PR that introduces a new migration touching shared tables
  (livestreams, profiles, matches, kudos, social_comments, organizations),
  run the queries above against the latest preview branch and confirm
  the targeted objects are present.
- If a Lovable Cloud schema edit is unavoidable in an emergency, log
  the change in a follow-up PR within 1 sprint as a backfill migration.
- Codex P2 review on each PR catches the surface symptom (preview branch
  red) but not the root cause (drift) — keep this audit doc fresh and
  re-run the static analysis when migrations folder grows past 150 files
  (currently 129).

## TL;DR

- Static migrations-folder audit: clean.
- 2 historical drift cases (livestreams provider columns, og_images
  policies) already remediated.
- Live prod diff requires Cuong to run the SQL queries above against
  prod and the latest preview branch; this PR doesn't ship speculative
  backfills.
- This PR's other items (#2–#5) are application-level fixes independent
  of any DB drift.
