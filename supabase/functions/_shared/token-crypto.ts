// ============================================================================
// DUPR token envelope encryption (AES-256-GCM).
// ----------------------------------------------------------------------------
// dupr_user_tokens.{access_token,refresh_token} are stored plaintext today. A
// DB backup or service-role leak would hand over live DUPR access. This module
// encrypts them at rest with keys held OUTSIDE the database (Supabase secrets),
// so the ciphertext in the table is useless without the separately-held key.
//
// Design:
//   • AES-256-GCM, fresh random 12-byte nonce per encryption.
//   • KEYRING (not a single key) so a v2 key can be introduced while v1
//     ciphertext is still decryptable — decryptToken parses the version from
//     the stored value and selects the matching key. Rotation = add v2 to the
//     keyring, set activeVersion="v2"; v1 stays for decrypt until re-encrypted.
//   • Associated Authenticated Data (AAD) binds each ciphertext to
//     projectRef + column + userId, so a value cannot be replayed into another
//     column, swapped between rows, or copied from preview into prod.
//   • Stored format:  enc:<version>:<base64url nonce>:<base64url ciphertext+tag>
//   • DUAL-READ is EXPLICIT: decryptToken rejects a plaintext (non-"enc:")
//     value unless { allowPlaintext: true } is passed. During migration the
//     readers pass the flag (with telemetry); after backfill the flag is
//     dropped so a stray plaintext write fails loudly instead of silently.
//
// Pure + Deno-free (Web Crypto only) so it runs under both the Deno edge
// runtime and the Node/vitest test gate. Callers supply the keyring; env
// access stays in the edge function.
// ============================================================================

export const KEY_VERSION = "v1"; // default active version for NEW encryptions
const ENC_PREFIX = "enc:";
const NONCE_BYTES = 12;

/** version -> CryptoKey, plus which version new writes use. */
export interface TokenKeyring {
  activeVersion: string;
  keys: Map<string, CryptoKey>;
}

// ─── AAD (context binding) ──────────────────────────────────────────────────

/**
 * Derive the immutable Supabase project ref from SUPABASE_URL
 * (`https://<ref>.supabase.co`). Using the project ref — not a per-function
 * "prod"/"preview" literal — as the environment binding means a preview DB and
 * prod DB get distinct AADs automatically, with no chance of a mislabeled
 * constant.
 */
export function projectRefFromSupabaseUrl(supabaseUrl: string): string {
  const m = /^https:\/\/([a-z0-9-]+)\.supabase\.(co|in|red)/i.exec(supabaseUrl ?? "");
  if (!m) throw new Error("Cannot derive project ref from SUPABASE_URL");
  return m[1];
}

/**
 * Build the canonical AAD for a stored token. AES-GCM authenticates (but does
 * not encrypt) the AAD; decryption FAILS unless the exact same AAD is given.
 * Binding projectRef + column + userId blocks column-replay, row-swap (A→B),
 * and cross-env (preview→prod) attacks. All three are REQUIRED.
 */
export function buildTokenAAD(params: {
  projectRef: string; // immutable DB identity, from projectRefFromSupabaseUrl()
  column: "access_token" | "refresh_token";
  userId: string; // dupr_user_tokens.user_id (the row owner)
}): string {
  const { projectRef, column, userId } = params;
  if (!projectRef || !userId) {
    throw new Error("buildTokenAAD requires non-empty projectRef and userId");
  }
  return `v1:${projectRef}:dupr_user_tokens.${column}:${userId}`;
}

// ─── base64url ──────────────────────────────────────────────────────────────

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

// A Uint8Array is a valid BufferSource at runtime; the cast placates stricter
// TS lib versions (typed-array generic ArrayBufferLike vs ArrayBuffer) without
// changing behavior.
function buf(u8: Uint8Array): BufferSource {
  return u8 as unknown as BufferSource;
}

// ─── key import / keyring ───────────────────────────────────────────────────

/** Import a raw 32-byte AES-256 key (base64-encoded) as an AES-GCM CryptoKey. */
export async function importTokenKeyFromBase64(base64Key: string): Promise<CryptoKey> {
  const bin = atob(base64Key);
  if (bin.length !== 32) {
    throw new Error(`token key must decode to 32 bytes, got ${bin.length}`);
  }
  const raw = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Convenience: single-version keyring (the common non-rotation case). */
export function makeKeyring(version: string, key: CryptoKey): TokenKeyring {
  return { activeVersion: version, keys: new Map([[version, key]]) };
}

export function isEncrypted(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(ENC_PREFIX);
}

// ─── encrypt / decrypt ──────────────────────────────────────────────────────

/** Encrypt with the keyring's active version → `enc:<ver>:<nonce>:<ct>`. */
export async function encryptToken(
  plaintext: string,
  keyring: TokenKeyring,
  aad: string,
): Promise<string> {
  const key = keyring.keys.get(keyring.activeVersion);
  if (!key) {
    throw new Error(`keyring has no key for active version ${keyring.activeVersion}`);
  }
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const enc = new TextEncoder();
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: buf(nonce), additionalData: buf(enc.encode(aad)) },
      key,
      buf(enc.encode(plaintext)),
    ),
  );
  return `${ENC_PREFIX}${keyring.activeVersion}:${toBase64Url(nonce)}:${toBase64Url(ct)}`;
}

/**
 * Decrypt a stored token, selecting the key by the version embedded in the
 * value (rotation-safe). Plaintext handling is EXPLICIT: a non-"enc:" value
 * throws unless { allowPlaintext: true } — used only during the migration
 * window, never after backfill.
 */
export async function decryptToken(
  stored: string,
  keyring: TokenKeyring,
  aad: string,
  opts: { allowPlaintext?: boolean } = {},
): Promise<string> {
  if (!isEncrypted(stored)) {
    if (opts.allowPlaintext) return stored; // migration-window passthrough
    throw new Error("plaintext token rejected (allowPlaintext not set)");
  }

  const parts = stored.slice(ENC_PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted token: expected version:nonce:ciphertext");
  }
  const [version, nonceB64, ctB64] = parts;
  const key = keyring.keys.get(version);
  if (!key) {
    throw new Error(`no key in keyring for token version: ${version}`);
  }
  const nonce = fromBase64Url(nonceB64);
  const ct = fromBase64Url(ctB64);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: buf(nonce), additionalData: buf(new TextEncoder().encode(aad)) },
    key,
    buf(ct),
  );
  return new TextDecoder().decode(pt);
}

// ─── keyring construction + field-level policy (pure, unit-tested) ──────────
// These carry the security-critical decisions that used to live untested in
// the Deno wrapper: build-from-secrets, no-key handling, and fail-closed
// encryption. The wrapper only reads env + builds the AAD, then delegates here.

/**
 * Build a keyring from raw base64 secrets. Returns null only when NEITHER
 * version is present. `importKey` is injectable so the edge wrapper can supply
 * a value-keyed cache; the default imports fresh.
 */
export async function buildKeyring(
  v1?: string,
  v2?: string,
  importKey: (b64: string) => Promise<CryptoKey> = importTokenKeyFromBase64,
): Promise<TokenKeyring | null> {
  if (!v1 && !v2) return null;
  const keys = new Map<string, CryptoKey>();
  if (v1) keys.set("v1", await importKey(v1));
  if (v2) keys.set("v2", await importKey(v2));
  return { activeVersion: v2 ? "v2" : "v1", keys };
}

/** The key version embedded in a stored value, or null if it's plaintext. */
export function tokenVersion(stored: string): string | null {
  if (!isEncrypted(stored)) return null;
  return stored.slice(ENC_PREFIX.length).split(":")[0] || null;
}

/**
 * Decrypt a stored field. When NO key is configured, a plaintext value passes
 * through (pre-rollout) but a CIPHERTEXT value THROWS — never hand `enc:…` to a
 * downstream API as if it were the real token.
 */
export async function decryptField(
  stored: string,
  keyring: TokenKeyring | null,
  aad: string,
  opts: { allowPlaintext?: boolean } = {},
): Promise<string> {
  if (!keyring) {
    if (isEncrypted(stored)) throw new Error("token_key_not_configured");
    return stored;
  }
  return decryptToken(stored, keyring, aad, opts);
}

/** Encrypt for storage; no-op passthrough when no key (pre-rollout writer). */
export async function encryptFieldOptional(
  plaintext: string,
  keyring: TokenKeyring | null,
  aad: string,
): Promise<string> {
  if (!keyring) return plaintext;
  return encryptToken(plaintext, keyring, aad);
}

/**
 * Fail-closed encryption for the backfill: throws if no key, and asserts the
 * output is actually ciphertext so a bug can never "encrypt" a row into
 * plaintext and be counted as done.
 */
export async function encryptFieldRequired(
  plaintext: string,
  keyring: TokenKeyring | null,
  aad: string,
): Promise<string> {
  if (!keyring) throw new Error("token_key_not_configured");
  const out = await encryptToken(plaintext, keyring, aad);
  if (!isEncrypted(out)) throw new Error("encryption produced non-ciphertext");
  return out;
}
