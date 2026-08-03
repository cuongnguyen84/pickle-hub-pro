# Edge Function auth and service-role registry

Status: SEC-04 complete, strict source/config/production enforcement enabled

Registry: `supabase/functions/auth-registry.json`

Validator: `npm run auth:registry`

## Goal and boundary

The registry gives every deployed Edge Function one version-controlled caller-auth classification and records service-role use separately. It prevents three different facts from drifting unnoticed:

1. the source directories under `supabase/functions`;
2. gateway behavior in `supabase/config.toml`;
3. the auth and service-role assumptions inside each handler.

BASE-06 created the inventory, schema, and validator. SEC-04 closed every recorded finding, changed `enforcement` to strict, added a blocking Quality gate, and added a scheduled production-parity guard.

## Verified baseline (2026-07-15; re-verified 2026-08-03 CLOSE-03: 80/80/80, validator 0 errors — the 76 numbers below are the historical snapshot)

| Surface | Count | Result |
|---|---:|---|
| Source functions with `index.ts` | 76 | All classified |
| `supabase/config.toml` function sections | 76 | All explicitly set `verify_jwt = false` |
| Active production functions | 76 | Matches source after the Zalo drift hotfix |
| Functions that instantiate a service-role client | 70 | Recorded as `uses_client` |
| Functions that accept service role as caller bearer | 14 | Recorded separately as `accepts_bearer` |
| Auth flows | 95 | 32 public, 21 user, 11 admin, 11 cron, 20 internal-service |
| Known hardening findings | 0 | Strict validator reports zero errors and zero warnings |

The distinction between the last two service-role rows is security-critical. A handler may use a service-role database client after authenticating a user, cron, or webhook caller; that does not make the service-role key a valid caller credential. `uses_client` and `accepts_bearer` must never be inferred from each other.

## Classification model

Every flow uses this compact format:

```text
actor.operation.credential.authorization
```

The five actors remain the roadmap's five policy classes:

| Actor | Meaning | Required SEC-04 control |
|---|---|---|
| `public` | Anonymous browser, crawler, or third-party callback | Method/input validation; rate limit, cache, or equivalent abuse control; mutations/callbacks also need proof of purpose |
| `user` | Signed-in end user | Verified user JWT; identity derived from JWT; resource scope checked server-side |
| `admin` | Admin or another explicitly privileged role | Verified user JWT plus server-side role check |
| `cron` | Scheduled machine caller | POST plus `requireCronRequest` using `x-cron-secret` |
| `internal_service` | Trusted backend or provider integration | Service-role bearer, scoped API key, dedicated shared secret, or verified webhook signature |

Actor alone is insufficient. The original SEC-04 wording called the public class “public read-only”, but the application intentionally has public mutations and callbacks: phone OTP, newsletter signup, guest magic-token actions, Mux/Auth webhooks, and anonymous telemetry. Encoding `operation` separately prevents those endpoints from being mislabeled as read-only while preserving the five actor classes.

Credentials and authorization are also separate. For example, a user JWT proves who the caller is, while `resource_scope` proves that caller can mutate the requested tournament or registration.

## Registry entry

```json
{
  "verify_jwt": false,
  "service_role": {
    "uses_client": true,
    "accepts_bearer": false
  },
  "flows": ["user.write.user_jwt.resource_scope"],
  "status": "classified"
}
```

Allowed statuses:

- `classified`: the current auth path has been reviewed;
- `hardening_required`: the current path is understood but has a linked security follow-up;
- `skeleton`: the endpoint is not implemented, but its intended boundary is recorded before future mutations are added.

`classified` means inventoried, not permanently exempt. Static policy, contract tests, and production metadata parity remain the enforcement sources.

## Validator behavior

`scripts/check-edge-auth-registry.mjs` is network-free and checks:

- one registry entry per source `index.ts` and no source-less registry entries;
- one explicit config section per source function;
- `verify_jwt` parity between registry and config;
- static `SUPABASE_SERVICE_ROLE_KEY` client-use parity;
- registry schema and flow enum validity;
- service-role bearer declarations in both the service-role flags and auth flows;
- JWT/role requirements for user and admin flows;
- cron flows that do not use `cron_secret` plus `requireCronRequest`;
- public callbacks without a shared secret or verified signature;
- known hardening and unauthenticated-internal findings;
- optional production name and `verify_jwt` parity from `supabase functions list --output json`.

Strict mode is the registry default and returns non-zero for any finding. `npm run auth:registry -- --strict` currently reports 76 source, 76 registry, 76 config, zero errors, and zero warnings.

Enforcement layers:

1. representative source-contract tests cover public, user, admin, cron, and internal-service policies;
2. the Quality workflow runs the network-free strict registry check on every push and pull request;
3. `edge-auth-parity.yml` runs on relevant main changes, on demand, and daily at 02:17 ICT;
4. the credentialed parity job compares deployed names and `verify_jwt` with the registry and alerts on drift.

The production-parity check stays separate from ordinary pull-request CI because it needs `SUPABASE_ACCESS_TOKEN`. It compares only names and `verify_jwt`; it never downloads or prints function secrets.

## SEC-04 controls delivered

| Function(s) | Closed finding | Enforced control |
|---|---|---|
| `auto-cancel-unpaid-registrations`, `dupr-sync` | Non-standard cron gates | POST plus shared `requireCronRequest`; service-role fallback removed from the cron-only DUPR sync |
| `feed-embeds-sync`, `feed-generate`, `news-translate` | Scheduled mutation used the generic scraper secret | Scheduled callers now read `cron_secret` from Vault and send `x-cron-secret`; service-role remains available only for deliberate internal runs |
| `dupr-webhook` | Callback proof, replay, secret retention, and body-size gaps | Fail-closed CLIENT_KEY shared-secret check, 32 KiB body bound, SHA-256 idempotency key, redacted ledger, and 30-day retention |
| `send-event-registration-email` | Shared-secret check failed open when configuration was missing | Missing secret returns 503; missing or wrong caller secret returns 401 |
| `notification-send` | Publicly reachable no-op skeleton intended for internal use | POST-only service-role bearer gate, including fail-closed missing configuration |

Migration `20260715180000_enforce_edge_auth_registry.sql` standardizes the four scheduled callers, removes the duplicate legacy news-translation job when present, adds the callback event key, redacts historical provider credentials, and schedules ledger retention.

## Production drift incident found during inventory

Production initially had 76 active functions while source had 75. `zalo-token-refresh` existed only in production, did not enforce the documented service-role bearer, and job `9` embedded an `sb_secret_…` credential in `cron.job.command`.

The caller was moved first to Vault-backed `x-cron-secret`, then the source was restored with `requireCronRequest` and deployed as version 21. Production verification returned GET 405, missing/wrong secret 401, and correct Vault secret 200. Migration `20260715150000_secure_zalo_token_refresh.sql` is recorded in the production ledger; the cron command no longer contains a plaintext secret.
