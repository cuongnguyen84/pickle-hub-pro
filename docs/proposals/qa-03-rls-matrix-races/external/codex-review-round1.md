## Invocation

Round 1, run by orchestrator: `codex-companion.mjs review --wait --scope branch --base main` on qa-03-rls-matrix-races.

## Review output (verbatim)

[codex] Starting Codex review thread.
[codex] Thread ready (019f6b62-bd8d-7ee2-903d-911ef4a72cda).
[codex] Reviewer started: changes against 'main'
[codex] Running command: /bin/zsh -lc 'git status --short && git diff --stat a13a8628e099ed601f2864ff17c71329724cd741 ...
[codex] Command completed: /bin/zsh -lc 'git status --short && git diff --stat a13a8628e099ed601f2864ff17c71329724cd741 ... (exit 0)
[codex] Running command: /bin/zsh -lc 'git diff --find-renames --find-copies --unified=80 a13a8628e099ed601f2864ff17c7...
[codex] Command completed: /bin/zsh -lc 'git diff --find-renames --find-copies --unified=80 a13a8628e099ed601f2864ff17c7... (exit 0)
[codex] Running command: /bin/zsh -lc 'rg -n "social_event_guest_register|social_event_reactivate_registration|CREATE....
[codex] Command completed: /bin/zsh -lc 'rg -n "social_event_guest_register|social_event_reactivate_registration|CREATE.... (exit 0)
[codex] Running command: /bin/zsh -lc "sed -n '1,280p' supabase/tests/event_capacity_rpc.test.sql && printf '\\n--- la...
[codex] Command completed: /bin/zsh -lc "sed -n '1,280p' supabase/tests/event_capacity_rpc.test.sql && printf '\\n--- la... (exit 0)
[codex] Running command: /bin/zsh -lc "sed -n '180,290p' supabase/migrations/20251221153808_1fd33e01-b473-4bd8-a664-cb...
[codex] Command completed: /bin/zsh -lc "sed -n '180,290p' supabase/migrations/20251221153808_1fd33e01-b473-4bd8-a664-cb... (exit 0)
[codex] Running command: /bin/zsh -lc "ls -la supabase/tests && sed -n '1,260p' supabase/tests/notification_insert_rls...
[codex] Command completed: /bin/zsh -lc "ls -la supabase/tests && sed -n '1,260p' supabase/tests/notification_insert_rls... (exit 0)
[codex] Running command: /bin/zsh -lc "git log --oneline --decorate --max-count=20 a13a8628e099ed601f2864ff17c71329724...
[codex] Command completed: /bin/zsh -lc "git log --oneline --decorate --max-count=20 a13a8628e099ed601f2864ff17c71329724... (exit 0)
[codex] Running command: /bin/zsh -lc "command -v psql || true; psql --version 2>/dev/null || true; command -v supabas...
[codex] Command completed: /bin/zsh -lc "command -v psql || true; psql --version 2>/dev/null || true; command -v supabas... (exit 0)
[codex] Running command: /bin/zsh -lc "cat supabase/migrations/20260116084308_24bbbafc-9837-4e8f-9b45-ef979ff2fcbc.sql...
[codex] Command completed: /bin/zsh -lc "cat supabase/migrations/20260116084308_24bbbafc-9837-4e8f-9b45-ef979ff2fcbc.sql... (exit 0)
[codex] Running command: /bin/zsh -lc 'rg -n "QA-03|RLS/auth matrix|concurrency race|auth matrix" docs .github scripts...
[codex] Command completed: /bin/zsh -lc 'rg -n "QA-03|RLS/auth matrix|concurrency race|auth matrix" docs .github scripts... (exit 0)
[codex] Running command: /bin/zsh -lc "sed -n '1,100p' docs/handoff-2026-07-16.md && git show a13a8628e099ed601f2864ff...
[codex] Command completed: /bin/zsh -lc "sed -n '1,100p' docs/handoff-2026-07-16.md && git show a13a8628e099ed601f2864ff... (exit 0)
[codex] Running command: /bin/zsh -lc 'rg -n "setup-cli|supabase (db )?start|psql|54322|test db" .github scripts | hea...
[codex] Command completed: /bin/zsh -lc 'rg -n "setup-cli|supabase (db )?start|psql|54322|test db" .github scripts | hea... (exit 0)
[codex] Running command: /bin/zsh -lc "rg -n '"'^'"\\[db\\]|"'^port'"\\s*=|major_version|password' supabase/config.tom...
[codex] Command completed: /bin/zsh -lc "rg -n '"'^'"\\[db\\]|"'^port'"\\s*=|major_version|password' supabase/config.tom... (exit 0)
[codex] Running command: /bin/zsh -lc 'find scripts -type f -maxdepth 4 -print0 | xargs -0 rg -n "DB_URL|DATABASE_URL|...
[codex] Command completed: /bin/zsh -lc 'find scripts -type f -maxdepth 4 -print0 | xargs -0 rg -n "DB_URL|DATABASE_URL|... (exit 0)
[codex] Running command: /bin/zsh -lc "rg -n -U \"CREATE TRIGGER[\\s\\S]{0,180}(INSERT|UPDATE|DELETE)[\\s\\S]{0,120}ev...
[codex] Command completed: /bin/zsh -lc "rg -n -U \"CREATE TRIGGER[\\s\\S]{0,180}(INSERT|UPDATE|DELETE)[\\s\\S]{0,120}ev... (exit 0)
[codex] Review output captured.
[codex] Reviewer finished.
[codex] Assistant message captured: The race harness can report success without forcing the race and can destructively target arb...
[codex] Turn completed.
# Codex Review

Target: branch diff against main

The race harness can report success without forcing the race and can destructively target arbitrary databases through `DB_URL`. The RLS suite also does not behaviorally enforce its claimed API-key read restriction.

Full review comments:

- [P1] Refuse non-disposable database targets — /Users/cm10/pickle-hub-pro/scripts/qa/db-race.mjs:18-19
  When `DB_URL` points to a shared, staging, or production database with sufficient privileges, this harness executes destructive `DELETE`/`INSERT` statements and globally disables registration triggers there. This can mutate data and suppress side effects indefinitely if execution is interrupted, so validate that the target is local/disposable or require an explicit destructive opt-in.

- [P2] Synchronize racers before asserting serialization — /Users/cm10/pickle-hub-pro/scripts/qa/db-race.mjs:79-79
  When the first `psql` process finishes the RPC before the second finishes connecting, these calls execute sequentially and still produce one winner even if the advisory lock is removed. `Promise.all` and repeated rounds do not guarantee overlap at the capacity read/write boundary, so this regression gate can false-green; add a database-side barrier or delay hook that forces both sessions into the vulnerable window, including for reactivation.

- [P2] Exercise api_keys reads instead of checking policy names — /Users/cm10/pickle-hub-pro/supabase/tests/rls_auth_matrix.test.sql:152-158
  When another permissive SELECT policy is added or the named policy's `USING` clause is broadened, this assertion still passes because it only checks that the policy name exists; PostgreSQL permissive policies are ORed. The suite would therefore greenlight non-admin API-key reads despite the asserted guarantee, so perform a viewer SELECT denial probe and an admin allow control instead.
