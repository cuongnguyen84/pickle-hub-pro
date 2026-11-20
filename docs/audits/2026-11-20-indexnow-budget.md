# IndexNow atomic budget proposal — 20 November 2026

Migration-first stage only: the Pages handler remains unchanged in this PR.
The separately prepared handler patch replaces optional fail-open KV read/modify/write with an existing Postgres
service-only RPC. Auth rejects missing/incorrect secret before any RPC. A global
fixed calendar-minute bucket permits ten authenticated GET/POST requests per
minute; unsupported methods consume none. IP rotation cannot evade this shared
budget. Boundary bursts can reach twenty across two adjacent minutes, as expected
for fixed windows. One singleton row bounds storage, retains no IP/secret, and
needs no cleanup schedule. Row-conflicting upsert serializes parallel callers.

RPC error, missing configuration/migration, timeout, nonboolean response and HTTP
failure return generic JSON503 with retry-after60, without submission. Budget
denial returns429. Existing secret-authorized cron/manual calls use the same
budget; no secret bypass defeats the shared cap. Authorized malformed POSTs
consume budget deliberately before JSON parsing. Existing query-key auth is
preserved; this is not a complete secret-transport audit.

Cloudflare's Rate Limiting binding is explicitly approximate/eventually
consistent per location, so it is not substituted for strict serialization:
https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
No new binding, paid Worker, Durable Object or resource is required. Existing
SUPABASE_URL/service credential must point to the project receiving migration.

## Rollout order

1. Review/apply migration20261120210000 and ledger atomically; run pgTAP and
   synchronized race against disposable replay first, never production.
2. Verify production RPC grants/security-definer search_path, one-row/RLS
   structure and schema cache visibility read-only. Do not exercise budget on prod.
3. Only then deploy Pages handler. Deploying handler first deliberately returns
   503 for authorized calls; this is a rollout prerequisite, not acceptable proof.
4. Verify normal scheduled invocation without triggering extra search submissions.

No production mutation/deployment performed by this patch. Local handler tests
passed14/14 across budget, upstream guards and slug parity. SQL pgTAP20 and
15-round synchronized two-session race scripts are supplied, and the pgTAP
workflow executes both against its disposable migration replay. They were not executed locally
in this environment (local database unavailable). Database acceptance remains
unverified until replay/race passes; mocks do not prove SQL atomicity.

Review correction: an older queued statement is denied when a strictly newer
bucket exists; it cannot rewind window_start or count. pgTAP seeds a future
bucket to prove both fields stay unchanged and tests actual service-role
execution plus anon/member permission errors. Races also execute as service_role;
coordinator/racers are killed and settled in finally on failure or timeout.
