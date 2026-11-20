# DUPR token security — 20/11/2026

Status: source audit only. Production encryption activation, token formats,
database privileges and deployed function versions remain unverified. No secret
values were read or printed and no production mutation was performed.

## Verified implementation

- User token writes in dupr-sso-callback and dupr-refresh-user-token call
  encryptUserToken from supabase/functions/_shared/dupr-token-keyring.ts.
- AES-256-GCM envelope implementation in token-crypto.ts uses fresh 12-byte
  nonces and associated data binding the project, user and token column.
  Ciphertexts carry a key version, supporting V1/V2 rotation.
- Reader dupr-user-client.ts and entitlement fallback in dupr-match-submit
  decrypt stored values before use and reject revoked user rows.
- Keyring reads configuration each call rather than caching absent keys.
  Encryption is OPTIONAL: without a key, normal writers still store plaintext.
  Readers explicitly allow plaintext during migration. Therefore source code
  alone cannot prove encryption is active on production.
- dupr-token-backfill requires encryption keys and is intended for controlled
  backfill. Its existence does not prove it has run.
- dupr-disconnect soft-revokes the local user row and attempts webhook
  unsubscribe. It retains token values; this is local disconnection, not proof
  that upstream access/refresh credentials have been invalidated.
- Migration 20260516050000_dupr_security_hardening.sql revokes table-wide
  authenticated SELECT and grants metadata columns only. Actual remote grants
  must be inspected before calling this effective production protection.
- Partner token cache in _shared/dupr-client.ts stores access_token directly in
  dupr_partner_tokens. User-token envelope helpers do not protect this cache.
  Partner token expiry narrows persistence but does not encrypt the cache.

## Historical documents

docs/dupr-prod-readiness.md describes user tokens as plaintext and encryption
as an unimplemented TODO. That description is stale for source: encryption and
rotation helpers now exist. It may still describe deployment if keys are absent.
Do not classify production as encrypted or plaintext from either document alone.

## Verification and follow-up

1. Aggregate-only production inspection: counts of user access/refresh token
   envelopes by version/plaintext, revoked versus active; no token values or
   user IDs. Inspect role privileges, RLS policies and ledger versions.
2. Verify deployed writers/readers and configured encryption key names without
   retrieving values. Test key activation, wrong-AAD rejection, rotation and
   rollback on staging.
3. If plaintext remains, deploy a staged fail-closed writer transition after
   key validation and run reviewed backfill. Confirm zero plaintext counts
   before removing compatibility reads. Preserve old keys until old envelopes
   are gone; never rotate by deleting the only decrypt key.
4. Extend encryption protection to the partner token cache or document an
   explicitly bounded security exception with expiry and restricted privileges.
5. Verify upstream disconnect/revocation support and define a retention or
   scrubbing policy for locally revoked credentials. Do not silently destroy
   existing credentials in an audit step.

## Validation

npx vitest run supabase/functions/_shared/__tests__/token-crypto.test.ts:
26 tests passed on 20/11/2026. This verifies helper behavior, not deployment,
key configuration, backfill completion or remote privileges.

## Scoped production configuration preflight (20/11/2026)

Read-only Management API secret inventory was filtered in-process to booleans
for exactly two names; neither secret values nor digests were printed:
DUPR_TOKEN_ENC_KEY_V1 absent, DUPR_TOKEN_ENC_KEY_V2 absent.

A local, unmerged fail-closed writer patch now rejects missing encryption
configuration with HTTP 503 token_encryption_unavailable, preserves legacy
readers, and has 31 targeted passing tests. Two tests invoke the actual callback
and refresh handlers with mocked external dependencies and no encryption key,
asserting HTTP 503 and zero database upsert/update/insert calls.

**Do not deploy this patch before key activation is verified.** The inspected
production secret inventory currently lacks both keys, so deployment as-is
would block SSO connect and successful refresh. Key generation/activation,
staged rollout and reviewed backfill are separate operations; none occurred
during this audit.
