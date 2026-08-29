# Security review (documentation only)

This is a source review, not a penetration test or statement about deployed configuration. Existing audits include `docs/security-audit-2026-07-06.md` and `EDGE_FUNCTIONS_ASSESSMENT.md`; verify current code before acting.

## Critical risks

No verified, immediately exploitable critical issue is asserted here. The highest-impact boundary is systemic: most Edge Functions use `verify_jwt=false` and some instantiate service-role clients. A missing/late internal authorization check in any handler would expose an RLS-bypassing operation. The strict registry/check script mitigates classification drift but cannot prove handler correctness (`supabase/config.toml`, `auth-registry.json`).

## High risks

| Risk | Evidence | Review action (do not treat as a fix applied) |
|---|---|---|
| Frontend admin/creator gates are not authorization | direct admin routes in `App.tsx`; `RequireAuth`, `useAdminAuth`, `useCreatorAuth` are client code | ensure every underlying table/RPC/function repeats server authorization |
| Service-role blast radius | registry marks most functions `uses_client:true` | audit authentication before first privileged query and resource scoping after identity |
| Capability-token leakage | registration magic tokens, invitation codes, referee PINs are bearer capabilities | review URLs/logs/analytics/referrers, expiry, rotation, rate limiting |
| Livestream ingest secret exposure | creator form receives/displays `mux_stream_key` | confirm it is excluded from public view, logs, cache and analytics |
| Parallel web/native authorization drift | React/Capacitor and SwiftUI share backend but separate navigation/contracts | server must remain authoritative; add parity checks for new RPCs |
| Product enrichment limiter references no included table | `product-import-enrich` queries/inserts `rate_limits`, but no migration/generated table exists and both errors are ignored | intended 30/user/min limit is not verifiable and can be ineffective; deployment schema must be audited |
| Public livestream view relies on a definer-view allowlist | latest `public_livestreams` recreation intentionally omits `security_invoker`, bypasses base-table RLS and grants anon/authenticated SELECT | current projection excludes the ingest secret, but any future projected privileged/unpublished column becomes globally readable |
| Shop clients depend on absent canonical contracts | React/Swift callers reference products/media/cart/orders/public RPCs absent from migrations | security properties, RLS and privileged-column controls for those paths cannot be reviewed from this repo |

## Medium risks

| Risk/observation | Evidence |
|---|---|
| Public anonymous ingestion can be abused within limits | `batch-view-events`, `log-client-event`, newsletter/OTP/recovery flows |
| Numerous external callback schemes | Mux signature, auth-email hook, DUPR payload secret, Mailchimp/internal webhook secrets each use different verification |
| Public OG renderers use privileged reads | OG functions and Cloudflare proxies must explicitly restrict to public entities/columns |
| Mixed form-validation styles | controlled legacy forms can omit shared schemas; server validation remains required |
| Client environment naming could invite mistakes | only `VITE_*` is safe to expose; repo also contains many server-only secret names |
| Generated/bundled native web assets may retain stale behavior | `ios/App/App/public/assets` duplicates old compiled JS; rebuild/sync discipline matters |
| Geo lookup transmits IP over plaintext HTTP and fails open | `geo-check` calls `http://ip-api.com` and returns `blocked:false` on internal failure | privacy/integrity and policy-bypass risk if geo blocking is relied upon |
| Mux live activation is manual | webhook handles idle/asset-ready only | stale or incorrectly set status can expose wrong gate/player behavior; do not assume provider events enforce state |

## RLS and unsafe assumptions to avoid

- A successful client `.select()` does not prove intended policy scope; inspect current policies and grants.
- A hidden route/button does not prevent direct API invocation.
- Request-body user/org/resource IDs are claims, not identity.
- `SECURITY DEFINER` functions require controlled `search_path`, explicit grants, and internal authorization.
- Public views must not accidentally project secrets or unpublished rows.
- Service-role comparisons and webhook secrets should be constant-time where practical and must fail closed when configuration is absent.
- The repository's strict Edge auth registry classifies entry authentication but does not validate downstream table existence, RLS, payload bounds or authorization order.

## Secret management

Expected secrets are Supabase/Worker deployment secrets; `.env.example` should contain names/placeholders only. Local `.env` and `.claude/secrets.local.gsc-ga4-sa.json` exist in the working tree context and must never be copied into documentation, commits, client bundles, logs, or test snapshots. DUPR token encryption uses versioned keys; rotation/backfill code must preserve decryptability.
