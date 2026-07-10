# DUPR token encryption — rollout plan

`dupr_user_tokens.access_token` / `refresh_token` are stored **plaintext**. This
scaffolds envelope encryption (`token-crypto.ts`, AES-256-GCM) and the staged
rollout to flip it on **without breaking DUPR in production**.

> Status: **code-ready, NOT yet deployed.** Requires a secret + a staged
> deploy + a backfill against prod that cannot be done from this repo alone.
> Do the steps below in order; do not skip the dual-read phase.

## Why staged

Seven edge functions read these columns:
`dupr-sso-callback`, `dupr-refresh-user-token`, `dupr-match-submit`,
`dupr-entitlements`, `dupr-clubs`, `dupr-org-link-club`, `dupr-partner-token`.

If the writer starts encrypting before every reader can decrypt, live DUPR
calls break. `decryptToken()` is therefore **dual-read**: any value not
prefixed `enc:` is returned unchanged, so readers work against a mixed
plaintext/ciphertext table throughout the migration.

## Steps

1. **Generate + store the key** (once, outside the DB):
   ```sh
   head -c 32 /dev/urandom | base64            # 32-byte key, base64
   supabase secrets set DUPR_TOKEN_ENC_KEY='<base64>' --project-ref ajvlcamxemgbxduhiqrl
   ```
   Keep an offline copy in the password manager for rotation/disaster recovery.

2. **Deploy READERS first** (all 7). Each loads the key and wraps its token
   read in `decryptToken(value, key, aad)`. Because of dual-read this is a
   no-op while the table is still plaintext — but it means every reader can
   handle ciphertext *before* any exists. **AAD is mandatory-bound** — build it
   with `buildTokenAAD({ environment, column, userId })`, never a bare column
   string. Binding `environment + column + userId` blocks column-replay,
   row-swap (A's ciphertext pasted onto B), and cross-env (preview → prod)
   attacks. `environment` = the project/DB context (e.g. `prod` / `preview`),
   derived from an env var or project ref; `userId` = the row's `user_id`.

3. **Deploy the WRITER** (`dupr-sso-callback` + `dupr-refresh-user-token`):
   replace the plaintext INSERT/UPSERT with
   `encryptToken(token, key, aad)`. New links + refreshes now write ciphertext;
   old rows stay plaintext (still readable via dual-read).

4. **Backfill** existing rows with a trusted one-off (service-role Edge Function
   or `supabase functions` script, never client-side): read each row, if
   `!isEncrypted(access_token)` re-write both columns encrypted. Idempotent —
   safe to re-run.

5. **Verify**: `select count(*) from dupr_user_tokens where access_token not like 'enc:%';`
   should reach 0. Smoke-test a real DUPR refresh + match submit.

6. **Drop dual-read** only after (5) is clean: change readers to reject a
   non-`enc:` value instead of passing it through, so a future plaintext write
   can't slip in silently.

## Rotation / revoke

- **Rotate**: bump `KEY_VERSION` to `v2`, add the new key, keep the old key for
  decrypt-only; re-encrypt rows lazily on next refresh or via a backfill, then
  retire `v1`. The `enc:v1:` / `enc:v2:` prefix disambiguates.
- **Revoke**: existing `revoked_at` column + DUPR's token revoke endpoint;
  encryption does not change that flow.

## Notes

- Supabase secrets are better than plaintext-in-DB but are **not** a managed KMS
  (no HSM, no per-use audit). If DUPR scales, move the key to a KMS/Vault and
  have the edge function fetch a data key.
- `token-crypto.ts` is pure + Deno-free; unit-tested in
  `__tests__/token-crypto.test.ts` (runs in the vitest gate).
