# DUPR token encryption — rollout plan

`dupr_user_tokens.access_token` / `refresh_token` are stored **plaintext**. This
scaffolds envelope encryption (`token-crypto.ts`, AES-256-GCM) and the staged
rollout to flip it on **without breaking DUPR in production**.

> Status: **code-ready, NOT yet deployed.** Requires a secret + a staged
> deploy + a backfill against prod that cannot be done from this repo alone.
> Do the steps below in order; do not skip the dual-read phase.

## Function inventory (which functions touch `dupr_user_tokens`)

Not every DUPR function reads the user token — get this right or you deploy
decrypt logic where it isn't needed and miss it where it is.

- **Writers** (encrypt on write): `dupr-sso-callback` (INSERT on link),
  `dupr-refresh-user-token` (UPDATE new pair). These also read the old
  `refresh_token` first, so they are readers too.
- **Readers** (decrypt on read): the shared-client consumers
  `dupr-entitlements`, `dupr-clubs`, `dupr-org-link-club` (via `dupr-user-client`),
  plus `dupr-match-submit` and `dupr-refresh-user-token`.
- **Not a user-token consumer**: `dupr-partner-token` operates on
  `dupr_partner_tokens` (a different table) — **no decrypt needed**. Any other
  function that only touches metadata columns (`dupr_id`, `connected_at`,
  `revoked_at`) needs no key.

The safest unit of change is the shared `dupr-user-client` helper: wire
decrypt there once and every consumer inherits it.

## Why staged

If a writer starts encrypting before every reader can decrypt, live DUPR calls
break. During migration, readers pass **`{ allowPlaintext: true }`** to
`decryptToken` so a mixed plaintext/ciphertext table still works. That flag is
removed at the end so plaintext is rejected loudly (see step 6).

## Steps

1. **Generate + store the key** (once, outside the DB):
   ```sh
   head -c 32 /dev/urandom | base64            # 32-byte key, base64
   supabase secrets set DUPR_TOKEN_ENC_KEY_V1='<base64>' --project-ref ajvlcamxemgbxduhiqrl
   ```
   Keep an offline copy in the password manager for rotation/disaster recovery.
   Each function builds its keyring from the secret(s) and its AAD from the
   **immutable project ref**:
   ```ts
   const key = await importTokenKeyFromBase64(Deno.env.get("DUPR_TOKEN_ENC_KEY_V1")!);
   const keyring = makeKeyring("v1", key);
   const projectRef = projectRefFromSupabaseUrl(Deno.env.get("SUPABASE_URL")!);
   const aad = buildTokenAAD({ projectRef, column: "access_token", userId });
   ```

2. **Deploy READERS first** with `decryptToken(value, keyring, aad, { allowPlaintext: true })`.
   Dual-read makes this a no-op while the table is still plaintext, but every
   reader can now handle ciphertext *before* any exists. Log a metric each time
   the plaintext branch is taken so you can watch it fall to zero.

3. **Deploy the WRITERS** (`dupr-sso-callback`, `dupr-refresh-user-token`):
   replace the plaintext INSERT/UPSERT with `encryptToken(token, keyring, aad)`.
   New links + refreshes write ciphertext; old rows stay plaintext (readable via
   dual-read).

4. **Backfill** via the service-role `dupr-token-backfill` function. It brings
   every value to the **active** key version (plaintext → encrypt; older
   `enc:v1` → decrypt+re-encrypt for rotation; `enc:<active>` → skip), is
   **fail-closed** (refuses to run without a key; uses required-encryption that
   asserts ciphertext before writing), and returns
   `{ scanned, rows_updated, tokens_encrypted, remaining_plaintext }` where
   `remaining_plaintext` comes from a fresh count — so "done" means the DB is
   clean, not just that the loop ran. Idempotent; safe to re-run.

5. **Verify**: `select count(*) from dupr_user_tokens where access_token not like 'enc:%';`
   should reach 0. Smoke-test a real DUPR refresh + match submit.

6. **Drop dual-read** only after (5) is clean: remove `{ allowPlaintext: true }`
   from the readers. `decryptToken` then throws on any non-`enc:` value, so a
   stray plaintext write fails loudly instead of silently.

## Rotation (supported by the keyring)

`decryptToken` selects the key by the version embedded in each value, so
rotation does **not** break old ciphertext:

1. Add the new key as `DUPR_TOKEN_ENC_KEY_V2`; build the keyring with **both**:
   `{ activeVersion: "v2", keys: Map([["v1", k1], ["v2", k2]]) }`.
2. New writes use `v2` (`enc:v2:…`); `v1` values still decrypt via the retained
   `v1` key.
3. Re-encrypt lazily (on next refresh) or via a backfill, then drop `v1` from
   the keyring once `select count(*) … where access_token like 'enc:v1:%'` = 0.

**Revoke**: existing `revoked_at` + DUPR's revoke endpoint; encryption does not
change that flow.

## Notes

- Supabase secrets beat plaintext-in-DB but are **not** a managed KMS (no HSM,
  no per-use audit). If DUPR scales, move to KMS/Vault and fetch a data key.
- `token-crypto.ts` is pure + Deno-free; unit-tested in
  `__tests__/token-crypto.test.ts` (keyring rotation, explicit dual-read, AAD
  row/env binding) — runs in the vitest gate.
