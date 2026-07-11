// ============================================================================
// _shared/dupr-token-keyring.ts — edge-runtime glue for token-crypto.
// ----------------------------------------------------------------------------
// Thin Deno layer: reads the DUPR_TOKEN_ENC_KEY_* secrets, builds the AAD, and
// delegates every security decision to the pure, unit-tested field helpers in
// token-crypto.ts (buildKeyring / decryptField / encryptField*).
//
// The keyring is rebuilt from env on EVERY call — Supabase secrets take effect
// without redeploy, so we must NOT cache the "no key" state or a stale key set,
// or setting V1 (activation) / V2 (rotation) wouldn't be picked up by a warm
// isolate. Only the expensive key *import* is cached, keyed by the secret's
// value, so a changed secret imports fresh.
//
// Behavior:
//   • decryptUserToken — no key + plaintext → passthrough; no key + ciphertext
//     → THROW (never send `enc:…` to DUPR); key present → decrypt (dual-read
//     allowPlaintext during migration, with telemetry).
//   • encryptUserToken — no key → plaintext no-op (writer shipped before secret).
//   • encryptUserTokenRequired — fail-closed (throws without a key); for backfill.
// ============================================================================

import {
  importTokenKeyFromBase64,
  projectRefFromSupabaseUrl,
  buildKeyring,
  decryptField,
  encryptFieldOptional,
  encryptFieldRequired,
  isEncrypted,
  buildTokenAAD,
  type TokenKeyring,
} from "./token-crypto.ts";

export type TokenColumn = "access_token" | "refresh_token";

// Cache imported CryptoKeys by their base64 value ONLY. Never cache the keyring
// or the null state — those are recomputed from env each call.
const _importCache = new Map<string, CryptoKey>();
async function cachedImport(b64: string): Promise<CryptoKey> {
  let k = _importCache.get(b64);
  if (!k) {
    k = await importTokenKeyFromBase64(b64);
    _importCache.set(b64, k);
  }
  return k;
}

/** Build the current keyring from live env. Null when no key is configured. */
export function loadKeyring(): Promise<TokenKeyring | null> {
  return buildKeyring(
    Deno.env.get("DUPR_TOKEN_ENC_KEY_V1"),
    Deno.env.get("DUPR_TOKEN_ENC_KEY_V2"),
    cachedImport,
  );
}

function aadFor(column: TokenColumn, userId: string): string {
  const projectRef = projectRefFromSupabaseUrl(Deno.env.get("SUPABASE_URL") ?? "");
  return buildTokenAAD({ projectRef, column, userId });
}

/** Active key version, or null if no key configured (backfill precondition). */
export async function activeKeyVersion(): Promise<string | null> {
  return (await loadKeyring())?.activeVersion ?? null;
}

export async function decryptUserToken(
  stored: string,
  column: TokenColumn,
  userId: string,
): Promise<string> {
  const keyring = await loadKeyring();
  if (keyring && !isEncrypted(stored)) {
    // Migration-window telemetry: watch this reach zero before dropping
    // dual-read. DROP_DUAL_READ: then pass {} instead of { allowPlaintext }.
    console.log(JSON.stringify({ evt: "dupr_token_plaintext_read", column }));
  }
  return decryptField(stored, keyring, aadFor(column, userId), { allowPlaintext: true });
}

export async function encryptUserToken(
  plaintext: string,
  column: TokenColumn,
  userId: string,
): Promise<string> {
  return encryptFieldOptional(plaintext, await loadKeyring(), aadFor(column, userId));
}

/** Fail-closed: throws if no key is configured. Used by the backfill. */
export async function encryptUserTokenRequired(
  plaintext: string,
  column: TokenColumn,
  userId: string,
): Promise<string> {
  return encryptFieldRequired(plaintext, await loadKeyring(), aadFor(column, userId));
}
