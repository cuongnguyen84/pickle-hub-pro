# IndexNow handler activation review — 20 November 2026

Migration-first PR1078 merged as1384fc1b2ec182f8207e57fa214164d3e3296c95.
Primary applied its exact SQL and ledger atomically and independently verified
ledger/RLS/definer/empty-search-path, service execute and browser denial, with
zero bucket rows. This handler stage does not repeat that migration.

Read-only REST schema visibility check: authenticated GET /rest/v1/ with
Accept application/openapi+json exposed /rpc/consume_indexnow_budget with POST
only. No RPC invocation, budget consumption or IndexNow submission was made.
Credentials were held in process memory only and neither printed nor persisted.

Handler switches authenticated GET/POST from optional fail-open KV to the
service-only atomic global ten-per-calendar-minute RPC. Denial returns429;
missing configuration/RPC, nonboolean result, timeout or backend failure returns
generic503 before querying content or submitting URLs. Auth is checked first;
unsupported methods return405. Existing secret-authorized cron/manual callers
share the same budget. Invalid authorized bodies consume budget intentionally.
No raw IP/secret is stored. Fixed-minute boundary bursts remain documented in
the migration-stage audit; this is not a sliding-window claim.

Local validation on the existing dirty working tree:14/14 focused Vitest cases,
scoped ESLint, tsc -b --noEmit, Vite build and bundle gate passed. Initial228.4KB
of280KB; code1893.4KB of1910KB. These local checks are scoped evidence, not
exact-current-main full CI proof; PR gates remain required. Handler deployment
and a normal scheduled invocation still need observation after reviewed merge.
No production mutation or deployment was performed by this agent.
