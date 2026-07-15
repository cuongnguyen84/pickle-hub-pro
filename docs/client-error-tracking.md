# Client-error tracking contract

Status: SEC-03 hardened on 2026-07-15

## Measurement purpose

`client_errors` is an operational diagnostic stream for production JS failures, unhandled promise rejections, and Content Security Policy violations. It powers the admin error inspector and the 10-minute Telegram spike detector; it is not a product analytics or conversion event stream.

## Event contract

| Event | Trigger | Stored fields |
|---|---|---|
| `js_error` | Uncaught browser error | Bounded message/stack, sanitized page URL, server-observed user agent, optional server-derived user, filename/line/column |
| `unhandled_rejection` | Unhandled browser promise rejection | Bounded message/stack, sanitized page URL, server-observed user agent, optional server-derived user |
| `csp_violation` | Legacy CSP `report-uri` or Reporting API report | Normalized directive/resource fields, sanitized document/source/referrer URLs, bounded policy/sample text, optional server-derived user |

The browser cannot set `user_id` or `user_agent`. A valid optional JWT is resolved through Supabase Auth; otherwise `user_id` is `null`. Query strings, URL fragments, embedded credentials, data-URI bodies, blob identifiers, arbitrary JS `details`, and unknown CSP fields are discarded before insert.

## Abuse and retention controls

- POST only; valid JSON; 32 KiB body limit.
- At most 20 CSP reports per Reporting API request.
- Atomic fixed-window rate limit: 60 submitted events per authenticated user or 120 per anonymous IP every 10 minutes.
- Limiter identities are endpoint-scoped SHA-256 hashes, retained for at most two days; no raw user id or IP is stored in the limiter table.
- `anon` and `authenticated` cannot call the limiter RPC. Direct anonymous table access is revoked; authenticated SELECT remains subject to the admin-only RLS policy.
- `client_errors` rows are retained for 90 days. The `client-errors-retention-daily` database cron runs at 03:17 UTC and calls a private `SECURITY DEFINER` pruning function.

## Baseline and validation

Pre-change production had 898 rows total and 423 in the preceding 30 days: 387 CSP violations, 34 JS errors, and 2 unhandled rejections. The p95 reconstructed payload was 2,984 bytes, the maximum was 3,048 bytes, and the highest system-wide 10-minute bucket was 30 events. No existing row had a user id. The 32 KiB body limit and per-identity rates leave substantial headroom above observed legitimate traffic while bounding public write abuse.

Migration: `20260715170000_client_error_ingestion_controls.sql`. Regression tests: `src/lib/__tests__/client-errors.test.ts` and `supabase/tests/client_error_ingestion_controls.test.sql`.

Production verification against `log-client-event` v12:

- GET returned 405; an unknown type and malformed JSON returned 400;
- a 21-report batch and a 33 KiB body returned 413;
- valid JS-error and legacy CSP payloads returned 204 and inserted one row each;
- caller-supplied user/user-agent values, query credentials, arbitrary details, and unknown CSP fields were absent from the stored rows; the request user agent and normalized fields were present;
- a saturated anonymous limiter returned 429, and the atomic limiter had already passed allow/deny transaction checks;
- both inserted rows and the temporary limiter state were removed after verification; `client_errors` returned to its 898-row baseline.

The migration is recorded in the production ledger. Retention cron job `28` is active at `17 3 * * *` as `postgres`; production has no rows older than 90 days at rollout.
