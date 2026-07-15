# Edge Function auth and service-role registry

Status: BASE-06 design complete, validator in non-blocking report mode

Registry: `supabase/functions/auth-registry.json`

Validator: `npm run auth:registry`

## Goal and boundary

The registry gives every deployed Edge Function one version-controlled caller-auth classification and records service-role use separately. It prevents three different facts from drifting unnoticed:

1. the source directories under `supabase/functions`;
2. gateway behavior in `supabase/config.toml`;
3. the auth and service-role assumptions inside each handler.

BASE-06 creates the complete inventory, schema, validator, and CI design. It deliberately leaves enforcement non-blocking. SEC-04 owns resolving the recorded hardening gaps, changing `enforcement` to strict, and adding the blocking CI step.

## Verified baseline (2026-07-15)

| Surface | Count | Result |
|---|---:|---|
| Source functions with `index.ts` | 76 | All classified |
| `supabase/config.toml` function sections | 76 | All explicitly set `verify_jwt = false` |
| Active production functions | 76 | Matches source after the Zalo drift hotfix |
| Functions that instantiate a service-role client | 70 | Recorded as `uses_client` |
| Functions that accept service role as caller bearer | 14 | Recorded separately as `accepts_bearer` |
| Auth flows | 95 | 33 public, 19 user, 11 admin, 11 cron, 21 internal-service |
| Known hardening findings | 9 functions | Linked to SEC-02, SEC-03, or SEC-04 |

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

`classified` means inventoried, not permanently exempt. Static policy and tests remain the source of enforcement once SEC-04 turns strict mode on.

## Validator behavior

`scripts/check-edge-auth-registry.mjs` is network-free and checks:

- one registry entry per source `index.ts` and no source-less registry entries;
- one explicit config section per source function;
- `verify_jwt` parity between registry and config;
- static `SUPABASE_SERVICE_ROLE_KEY` client-use parity;
- registry schema and flow enum validity;
- service-role bearer declarations in both the service-role flags and auth flows;
- JWT/role requirements for user and admin flows;
- cron flows that do not yet use `cron_secret` plus `requireCronRequest`;
- known hardening and unauthenticated-internal findings.

Current report mode returns exit code 0 and prints 15 warnings: nine known hardening entries, two missing standard cron-helper calls, three scheduled flows using a generic shared secret, and one unauthenticated no-op skeleton. Schema or coverage drift is still visible as `ERROR`, but remains non-blocking until SEC-04.

SEC-04 activation sequence:

1. resolve or deliberately redesign every warning;
2. add code-level contract tests for each policy class;
3. change registry enforcement from `report` to `strict`;
4. add `npm run auth:registry -- --strict` to the Quality workflow;
5. add a credentialed scheduled production-parity job that compares `supabase functions list --output json` with registry/source and alerts on deployed orphans.

The production-parity check must be separate from ordinary pull-request CI because it needs `SUPABASE_ACCESS_TOKEN`. It must compare names and `verify_jwt`, never download or print function secrets.

## Current hardening queue

| Function(s) | Finding | Owner |
|---|---|---|
| `auto-cancel-unpaid-registrations`, `dupr-sync` | Cron gate is not the shared helper | SEC-04 |
| `feed-embeds-sync`, `feed-generate`, `news-translate` | Scheduled mutation uses the generic scraper secret | SEC-04 |
| `dupr-webhook` | Client identifier without an independent signature | SEC-04 |
| `send-event-registration-email` | Shared-secret check fails open when configuration is missing | SEC-04 |
| `notification-send` | Publicly reachable no-op skeleton intended for internal use | SEC-04 before implementation |

## Production drift incident found during inventory

Production initially had 76 active functions while source had 75. `zalo-token-refresh` existed only in production, did not enforce the documented service-role bearer, and job `9` embedded an `sb_secret_…` credential in `cron.job.command`.

The caller was moved first to Vault-backed `x-cron-secret`, then the source was restored with `requireCronRequest` and deployed as version 21. Production verification returned GET 405, missing/wrong secret 401, and correct Vault secret 200. Migration `20260715150000_secure_zalo_token_refresh.sql` is recorded in the production ledger; the cron command no longer contains a plaintext secret.
