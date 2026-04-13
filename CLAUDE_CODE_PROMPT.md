# ThePickleHub Phase 4: Data Import from CSV

## Context
ThePickleHub is migrating from Lovable Supabase to a new self-hosted Supabase instance. Schema migration (Phase 2) is complete. OAuth providers are configured (Phase 3). Now we need to import data from 65 CSV files exported from Lovable.

## Pre-requisites (already done by user)
- New Supabase project created with schema migrated (63 tables, 22 enums, 232 policies, etc.)
- Google OAuth provider configured on new Supabase
- 65 CSV files exported from Lovable Supabase placed in `./migration_data/` folder
- psql installed locally
- DATABASE_URL connection string for new Supabase available

## Your task

### Step 1: Verify environment
Check that:
1. `psql --version` works and is version 15+ (preferably 17)
2. `migration_data/` folder exists and contains CSV files
3. List the CSV files and report counts (don't open them)
4. Ask user for `DATABASE_URL` if not set in environment

### Step 2: Test connection
Run:
```bash
psql "$DATABASE_URL" -c "SELECT version();"
psql "$DATABASE_URL" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

Verify:
- Connection works
- Tables count = 63 (schema migration was successful)

If either fails, STOP and report to user.

### Step 3: Dry run import
Run the import script in dry-run mode first:
```bash
bash import_data.sh --dry-run --skip-large
```

This will:
- Show how many rows would be imported per table
- NOT actually insert anything
- Detect missing CSV files

Report results to user. Ask user to confirm before proceeding to actual import.

### Step 4: Actual import
After user confirms, run:
```bash
bash import_data.sh --skip-large
```

This will:
- Disable triggers/FK checks temporarily
- Import auth.users + auth.identities first (so profiles FK works)
- Import 63 public tables in dependency order
- Re-enable triggers/FK checks
- Skip view_events + audit_logs (large analytics tables)

If user wants to include large tables, run without --skip-large.

### Step 5: Verify
Run verification script:
```bash
bash verify_import.sh
```

Report results to user. Critical checks:
- auth.users count matches Lovable (~1672)
- auth.identities count matches Lovable (~1701)
- profiles count matches auth.users (~1672)
- profiles ↔ auth.users link is valid (count of profiles WHERE EXISTS in users should equal profiles count)

### Step 6: Post-import tasks
If everything looks good, ask user if they want to:
1. Reset sequences (some tables may need sequence values updated)
2. Test a sample query (e.g., get top 5 livestreams with organization names)
3. Move on to Phase 5 (Switch Cloudflare Pages env vars)

## Important notes

- DO NOT run import without --dry-run first
- DO NOT skip the verification step
- If any table import fails, ask user before continuing
- If auth import fails, the whole migration is broken — STOP immediately
- Trigger errors during import are usually safe (they re-fire after re-enable)
- Foreign key violations during import indicate dependency order is wrong — REPORT this

## Files in this phase
- `import_data.sh` — main import script
- `verify_import.sh` — verification script  
- `EXPORT_CHECKLIST.md` — list of 65 tables (already done by user)
- `migration_data/` — folder with 65 CSV files (provided by user)

## Reporting
After each step, give user a clear summary of what happened. Use checkmarks/crosses for visual clarity. If something failed, give the exact error message and suggested next action.
