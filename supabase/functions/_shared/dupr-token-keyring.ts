// ============================================================================
// _shared/dupr-token-keyring.ts — edge-runtime glue for token-crypto.
// ----------------------------------------------------------------------------
// Thin Deno layer that reads the DUPR_TOKEN_ENC_KEY_* secrets, builds the
// keyring + AAD, and exposes encrypt/decrypt wrappers the DUPR functions call.
// All the crypto lives in the pure, unit-tested token-crypto.ts; this file is
// intentionally trivial (env access only) because it cannot run under vitest.
//
// SAFE ROLLOUT ORDERING — both wrappers no-op when NO key is configured:
//   • decryptUserToken: returns the value unchanged (plaintext era).
//   • encryptUserToken: returns plaintext unchanged (writer deployed before the
//     secret exists; setting the secret is what activates encryption).
// So this code can be deployed to every function BEFORE the secret is set
// without changing behavior, then flipped on by setting DUPR_TOKEN_ENC_KEY_V1.
//
// MIGRATION WINDOW: decryptUserToken passes { allowPlaintext: true } so a mixed
// plaintext/ciphertext table works, and logs a telemetry line each time a
// plaintext value is read (watch it fall to zero, then remove the flag in the
// "drop dual-read" step — search DROP_DUAL_READ below).
// ============================================================================

import {
  importTokenKeyFromBase64,
  projectRefFromSupabaseUrl,
  encryptToken,
  decryptToken,
  buildTokenAAD,
  isEncrypted,
  type TokenKeyring,
} from "./token-crypto.ts";

export type TokenColumn = "access_token" | "refresh_token";

let _keyringPromise: Promise<TokenKeyring | null> | null = null;

async function loadKeyring(): Promise<TokenKeyring | null> {
  const v1 = Deno.env.get("DUPR_TOKEN_ENC_KEY_V1");
  const v2 = Deno.env.get("DUPR_TOKEN_ENC_KEY_V2");
  if (!v1 && !v2) return null; // no key configured → plaintext era
  const keys = new Map<string, CryptoKey>();
  if (v1) keys.set("v1", await importTokenKeyFromBase64(v1));
  if (v2) keys.set("v2", await importTokenKeyFromBase64(v2));
  return { activeVersion: v2 ? "v2" : "v1", keys };
}

/** Cached per isolate — the keyring is immutable for the function's lifetime. */
function getKeyring(): Promise<TokenKeyring | null> {
  return (_keyringPromise ??= loadKeyring());
}

function projectRef(): string {
  return projectRefFromSupabaseUrl(Deno.env.get("SUPABASE_URL") ?? "");
}

/**
 * Decrypt a token read from dupr_user_tokens. No-op passthrough when no key is
 * configured. During the migration window plaintext is tolerated and logged.
 */
export async function decryptUserToken(
  stored: string,
  column: TokenColumn,
  userId: string,
): Promise<string> {
  const keyring = await getKeyring();
  if (!keyring) return stored;
  if (!isEncrypted(stored)) {
    // Telemetry: watch this reach zero before dropping dual-read.
    console.log(JSON.stringify({ evt: "dupr_token_plaintext_read", column }));
  }
  // DROP_DUAL_READ: after backfill verifies 0 plaintext rows, change
  // { allowPlaintext: true } → {} so a stray plaintext value throws.
  const aad = buildTokenAAD({ projectRef: projectRef(), column, userId });
  return decryptToken(stored, keyring, aad, { allowPlaintext: true });
}

/**
 * Encrypt a token before writing to dupr_user_tokens. No-op passthrough when no
 * key is configured (so the writer can ship before the secret is set).
 */
export async function encryptUserToken(
  plaintext: string,
  column: TokenColumn,
  userId: string,
): Promise<string> {
  const keyring = await getKeyring();
  if (!keyring) return plaintext;
  const aad = buildTokenAAD({ projectRef: projectRef(), column, userId });
  return encryptToken(plaintext, keyring, aad);
}
