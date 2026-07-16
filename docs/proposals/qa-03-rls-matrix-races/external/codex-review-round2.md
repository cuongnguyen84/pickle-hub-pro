## Invocation

Round 2, run by orchestrator after round-1 fixes (commit range: gate-lock barrier + guard + api_keys probes).

## Review output (verbatim)

[codex] Starting Codex review thread.
[codex] Thread ready (019f6b6c-241d-7321-b5f3-21c4dd562c34).
[codex] Reviewer started: changes against 'main'
[codex] Running command: /bin/zsh -lc 'git status --short && git diff --stat a13a8628e099ed601f2864ff17c71329724cd741 ...
[codex] Command completed: /bin/zsh -lc 'git status --short && git diff --stat a13a8628e099ed601f2864ff17c71329724cd741 ... (exit 0)
[codex] Running command: /bin/zsh -lc 'rg -n "social_event_guest_register|social_event_reactivate_registration|CREATE ...
[codex] Command completed: /bin/zsh -lc 'rg -n "social_event_guest_register|social_event_reactivate_registration|CREATE ... (exit 0)
[codex] Running command: /bin/zsh -lc "command -v psql || true; psql --version 2>/dev/null || true; command -v supabas...
[codex] Command completed: /bin/zsh -lc "command -v psql || true; psql --version 2>/dev/null || true; command -v supabas... (exit 0)
[codex] Running command: /bin/zsh -lc "nl -ba scripts/qa/db-race.mjs | sed -n '1,260p'; printf '\\n--- rls numbered --...
[codex] Command completed: /bin/zsh -lc "nl -ba scripts/qa/db-race.mjs | sed -n '1,260p'; printf '\\n--- rls numbered --... (exit 0)
[codex] Running command: /bin/zsh -lc "cat supabase/migrations/20260116084308_24bbbafc-9837-4e8f-9b45-ef979ff2fcbc.sql...
[codex] Command completed: /bin/zsh -lc "cat supabase/migrations/20260116084308_24bbbafc-9837-4e8f-9b45-ef979ff2fcbc.sql... (exit 0)
[codex] Running command: /bin/zsh -lc "rg -n -U \"CREATE (OR REPLACE )?TRIGGER[\\s\\S]{0,400}(ON public\\.)?event_regi...
[codex] Command completed: /bin/zsh -lc "rg -n -U \"CREATE (OR REPLACE )?TRIGGER[\\s\\S]{0,400}(ON public\\.)?event_regi... (exit 0)
[codex] Running command: /bin/zsh -lc "find docs/proposals/qa-03-rls-matrix-races -maxdepth 3 -type f -print -exec sh ...
[codex] Command completed: /bin/zsh -lc "find docs/proposals/qa-03-rls-matrix-races -maxdepth 3 -type f -print -exec sh ... (exit 0)
[codex] Running command: /bin/zsh -lc 'git diff --unified=5 a13a8628e099ed601f2864ff17c71329724cd741 -- docs/roadmap-8...
[codex] Command completed: /bin/zsh -lc 'git diff --unified=5 a13a8628e099ed601f2864ff17c71329724cd741 -- docs/roadmap-8... (exit 0)
[codex] Running command: /bin/zsh -lc "rg -n '"'^'"\\[db\\]|"'^port'"\\s*=|"'^major_version|''^password|''^project_id'...
[codex] Command completed: /bin/zsh -lc "rg -n '"'^'"\\[db\\]|"'^port'"\\s*=|"'^major_version|''^password|''^project_id'... (exit 0)
[codex] Running command: /bin/zsh -lc "sed -n '1,300p' supabase/tests/notification_insert_rls.test.sql; printf '\\n---...
[codex] Command completed: /bin/zsh -lc "sed -n '1,300p' supabase/tests/notification_insert_rls.test.sql; printf '\\n---... (exit 0)
[codex] Running command: /bin/zsh -lc "node -e \"for(const u of ['postgresql://x@[::1]:5432/db','postgresql://x@localh...
[codex] Command completed: /bin/zsh -lc "node -e \"for(const u of ['postgresql://x@[::1]:5432/db','postgresql://x@localh... (exit 0)
[codex] Running command: /bin/zsh -lc "ls supabase/migrations/*audit_role* 2>/dev/null || true; rg -n \"audit_role|trg...
[codex] Command completed: /bin/zsh -lc "ls supabase/migrations/*audit_role* 2>/dev/null || true; rg -n \"audit_role|trg... (exit 0)
[codex] Running command: /bin/zsh -lc 'for t in user_roles profiles event_registrations notifications chat_messages pa...
[codex] Command failed: /bin/zsh -lc 'for t in user_roles profiles event_registrations notifications chat_messages pa... (exit 1)
[codex] Running command: /bin/zsh -lc "for t in user_roles profiles event_registrations notifications chat_messages pa...
[codex] Command completed: /bin/zsh -lc "for t in user_roles profiles event_registrations notifications chat_messages pa... (exit 0)
[codex] Running command: /bin/zsh -lc "rg -n \"INSERT INTO public\\.api_keys|key_hash.*['\\\"]x|qa03\" supabase/migrat...
[codex] Command completed: /bin/zsh -lc "rg -n \"INSERT INTO public\\.api_keys|key_hash.*['\\\"]x|qa03\" supabase/migrat... (exit 0)
[codex] Running command: /bin/zsh -lc 'rg -n "REVOKE .*SCHEMA public|GRANT .*SCHEMA public|ALTER DEFAULT PRIVILEGES" s...
[codex] Command completed: /bin/zsh -lc 'rg -n "REVOKE .*SCHEMA public|GRANT .*SCHEMA public|ALTER DEFAULT PRIVILEGES" s... (exit 0)
[codex] Review output captured.
[codex] Reviewer finished.
[codex] Assistant message captured: The race barrier still does not guarantee that both RPCs overlap, undermining the primary reg...
[codex] Turn completed.
# Codex Review

Target: branch diff against main

The race barrier still does not guarantee that both RPCs overlap, undermining the primary regression test. The destructive-target guard also permits unsafe locally addressed databases and mishandles IPv6 loopback URLs.

Full review comments:

- [P1] Require opt-in for every non-default database target — /Users/cm10/pickle-hub-pro/scripts/qa/db-race.mjs:29-32
  When `DB_URL` points to a local developer database or a production database through an SSH tunnel such as `localhost:5432`, this hostname check treats it as disposable and proceeds with destructive deletes and globally disables registration triggers. Restrict the implicit path to the exact known test endpoint/database, or require the destructive opt-in whenever `DB_URL` overrides the default.

- [P2] Force overlap inside the RPC critical section — /Users/cm10/pickle-hub-pro/scripts/qa/db-race.mjs:82-85
  When one `psql` process is scheduled first after the gate is released, each racer has completed only its first `-c`; the second `-c` containing the RPC still needs to be sent separately by each client. The first RPC can therefore commit before the other is even dispatched, so removing the capacity advisory lock can still produce one winner and let this regression gate false-green; place the synchronization at the capacity read/write boundary using a server-side test hook or wrapper.

- [P3] Accept the bracketed IPv6 loopback hostname — /Users/cm10/pickle-hub-pro/scripts/qa/db-race.mjs:30-32
  When `DB_URL` uses the standard IPv6 loopback form `postgresql://...@[::1]:54322/...`, Node's `URL.hostname` returns `[::1]`, not `::1`, so this guard incorrectly rejects a local database as remote. Normalize the brackets or include `[::1]` in the allowlist.
