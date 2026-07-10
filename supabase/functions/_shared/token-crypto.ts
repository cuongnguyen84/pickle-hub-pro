// ============================================================================
// DUPR token envelope encryption (AES-256-GCM).
// ----------------------------------------------------------------------------
// dupr_user_tokens.{access_token,refresh_token} are stored plaintext today. A
// DB backup or service-role leak would hand over live DUPR access. This module
// encrypts them at rest with a key held OUTSIDE the database (Supabase secret
// `DUPR_TOKEN_ENC_KEY`, base64 of 32 random bytes), so the ciphertext in the
// table is useless without the separately-held key.
//
// Design:
//   • AES-256-GCM, fresh random 12-byte nonce per encryption.
//   • key_version prefix ("v1") so keys can be rotated without ambiguity.
//   • Associated Authenticated Data (AAD) binds each ciphertext to its column
//     context (e.g. "dupr_user_tokens.access_token"), so a value cannot be
//     lifted from one field and replayed into another.
//   • Stored format:  enc:v1:<base64url nonce>:<base64url ciphertext+tag>
//   • DUAL-READ: decryptToken() returns any non-"enc:" value unchanged, so
//     readers keep working while the table still holds plaintext during the
//     migration. Deploy readers first, then the writer, then backfill, then
//     drop dual-read.
//
// Pure + Deno-free (Web Crypto only) so it runs under both the Deno edge
// runtime and the Node/vitest test gate. The caller supplies the CryptoKey;
// env access stays in the edge function.
// ============================================================================

export const KEY_VERSION = "v1";
const ENC_PREFIX = "enc:";
const NONCE_BYTES = 12;

/**
 * Build the canonical Associated Authenticated Data (AAD) for a stored token.
 *
 * AES-GCM authenticates but does not encrypt the AAD; decryption FAILS unless
 * the exact same AAD is supplied. Binding it to `environment + column +
 * userId` means a ciphertext cannot be:
 *   • replayed from one column into another (column binding), or
 *   • lifted from row A and pasted into row B (userId binding), or
 *   • copied from a preview/staging DB into prod (environment binding).
 *
 * Field-binding alone (column only) does not stop the row-swap attack, so all
 * three parts are REQUIRED — pass them explicitly at every call site.
 */
export function buildTokenAAD(params: {
  environment: string; // e.g. "prod" | "preview" — the DB/project context
  column: "access_token" | "refresh_token";
  userId: string; // dupr_user_tokens.user_id (the row owner)
}): string {
  const { environment, column, userId } = params;
  if (!environment || !userId) {
    throw new Error("buildTokenAAD requires non-empty environment and userId");
  }
  return `v1:${environment}:dupr_user_tokens.${column}:${userId}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Import a raw 32-byte AES-256 key (base64-encoded) as an AES-GCM CryptoKey. */
export async function importTokenKeyFromBase64(base64Key: string): Promise<CryptoKey> {
  const bin = atob(base64Key);
  if (bin.length !== 32) {
    throw new Error(`DUPR_TOKEN_ENC_KEY must decode to 32 bytes, got ${bin.length}`);
  }
  const raw = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export function isEncrypted(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(ENC_PREFIX);
}

/** Encrypt a token → `enc:v1:<nonce>:<ciphertext>`. `aad` binds it to context. */
export async function encryptToken(
  plaintext: string,
  key: CryptoKey,
  aad: string,
): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const enc = new TextEncoder();
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: enc.encode(aad) },
      key,
      enc.encode(plaintext),
    ),
  );
  return `${ENC_PREFIX}${KEY_VERSION}:${toBase64Url(nonce)}:${toBase64Url(ct)}`;
}

/**
 * Decrypt a stored token. DUAL-READ: a value that is not `enc:`-prefixed is
 * assumed plaintext and returned unchanged (migration compatibility).
 * Throws on a malformed `enc:` value or unknown key version.
 */
export async function decryptToken(
  stored: string,
  key: CryptoKey,
  aad: string,
): Promise<string> {
  if (!isEncrypted(stored)) return stored; // plaintext passthrough

  const parts = stored.slice(ENC_PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted token: expected v:nonce:ciphertext");
  }
  const [version, nonceB64, ctB64] = parts;
  if (version !== KEY_VERSION) {
    throw new Error(`Unknown token key version: ${version}`);
  }
  const nonce = fromBase64Url(nonceB64);
  const ct = fromBase64Url(ctB64);
  const dec = new TextDecoder();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode(aad) },
    key,
    ct,
  );
  return dec.decode(pt);
}
