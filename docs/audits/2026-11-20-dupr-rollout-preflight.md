# DUPR encryption activation preflight — 20/11/2026

Decision: **NO-GO for activation/backfill today** until deployed reader source
and recoverable key custody are verified. No keys generated, no secrets changed,
no deployments or backfills performed by this preflight.

## Known current state

The scoped secret-name audit recorded both user-token key names absent. Source
contains dual-read decryptors, a fail-closed backfill and local fail-closed writer
changes. Secret presence is not evidence that the key is valid or recoverable.
Function deployment metadata/version numbers alone do not prove source parity.

## Mandatory sequence (corrects the old key-first rollout order)

1. Inventory every deployed consumer of user tokens. Required source paths:
   - dupr-entitlements, dupr-clubs, dupr-org-link-club: shared
     dupr-user-client.ts must call decryptUserToken.
   - dupr-match-submit: shared client and direct entitlement fallback decrypt.
   - dupr-refresh-user-token: decrypt old refresh token, then encrypt replacement.
   Include any additional consumer discovered by table/token searches.
2. Retrieve each deployed bundle or redeploy reviewed dual-read reader code,
   retaining a deployment/version/source-hash manifest. Compare reachable helper
   modules, not just entrypoint text. Test plaintext compatibility and encrypted
   canary with correct/wrong AAD in staging. Record build/commit/date.
3. BEFORE activating a key, establish custody: store the generated 32-byte key
   in an approved password manager or equivalent encrypted recoverable store;
   record only vault item reference, owner and restore-test date in evidence.
   Independently retrieve the saved key in memory and verify it decrypts a
   staging ciphertext. No secret, digest or token in repository/logs/chat.
   A local unencrypted credential file alone is not a recovery plan.
4. Only after 1–3 PASS, generate/store key through a non-logging process,
   activate V1, then verify configuration without printing the value.
   Activation immediately affects existing optional-encryption writers, so
   reader compatibility must already be established before adding the secret.
5. Verify one controlled new connection/refresh writes an enc:v1 envelope,
   and every relevant read path works. Then deploy fail-closed writer patch.
   Error responses must not leak key/token. Stop on any failed read/decrypt.
6. Record aggregate token-state counts, run reviewed backfill in bounded batches
   using service-role auth, and independently recount. Include revoked rows and
   both columns. A failed batch must not erase or overwrite unreadable tokens.
7. Remove plaintext dual-read only after both columns have zero remaining
   plaintext, staging tests pass and production canary is successful. Partner
   cache encryption is a separate work item and is not closed by this rollout.

## Rollback invariants

- Never delete the only key that can decrypt any stored envelope.
- Preserve dual-read reader code and the active V1 secret while reverting a
  writer release; reverting code to plaintext-only readers is unsafe.
- Stop the rollout/backfill on mismatch; retain original ciphertext and keys.
  Key loss requires incident recovery, not replacing the key with a fresh one.
- Keep V1 until aggregate v1 counts reach zero during a later V2 rotation and
  historical backup restoration has a documented decrypt strategy.

## Evidence to close SEC-3

Deployed reader manifest, staging canary/AAD/rotation tests, custody restore
proof, aggregate before/after token-state counts, writer handler no-write tests,
successful production canary, and explicit partner-cache exception/remediation.
The existing local 31 helper/writer/handler tests do not prove these production
conditions. Missing external evidence remains WAITING, not PASS.

## Live metadata observation (20/11/2026)

Read-only function inventory succeeded via TLS-validated Management API:
all seven scoped functions ACTIVE. Versions: entitlements 1411, clubs 1410,
org-link-club 1409, match-submit 1411, refresh-user-token 1411, sso-callback
1410, token-backfill 1409. These version numbers are inventory evidence only:
the deployed module contents/hashes were not verified. No source-parity PASS
is inferred. Durable encrypted custody/restore evidence is also absent.

## Deployed source inspection (read-only GET function body)

Retrieved all seven bodies from the Management API body endpoint, decoded
ESZIP2.3 module sections in temporary storage and hashed each scoped helper.
[Manifest](2026-11-20-dupr-deployed-source-manifest.json) records bundle/module
SHA-256; these are source hashes, not credential hashes. No raw bundle is
committed.

All seven bundles contain identical deployed token-keyring and token-crypto
module bytes. The four shared-client consumers contain identical deployed
dupr-user-client module bytes. Inspected deployed shared-client code decrypts
both token fields and checks revoked_at. Deployed match-submit direct fallback
calls decryptUserToken. Deployed refresh decrypts old refresh token. Deployed
keyring invokes decryptField with allowPlaintext:true; crypto helper includes
AES-GCM decrypt and additionalData binding. This concretely verifies deployed
dual-read implementation presence, beyond ACTIVE metadata.

The local fail-closed writer intentionally differs from deployed optional
encryptFieldOptional. Bundler formatting/type stripping means raw deployed JS
hashes cannot be compared to local TS hashes as proof of full semantic parity;
full runtime canary/rotation tests remain required. No claim of byte parity
with the entire local tree is made. No minimal reader deploy is shown necessary
from this source inspection alone, but canary and key custody recovery remain
NO-GO blockers for activation.
