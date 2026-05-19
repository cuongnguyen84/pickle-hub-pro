// ============================================================================
// payment / referenceCode — short opaque IDs for bank-transfer memos
// ----------------------------------------------------------------------------
// Format: `PHUB-XXXXXX` where each X is from a 31-char Crockford-like
// alphabet that drops the visually ambiguous characters (0/O, 1/I/L).
// That's important here because the player will read the code off the
// screen and type it into their banking app — a misread digit means
// the organizer can't match the transfer.
//
// Search space: 31^6 ≈ 887 million. A typical event has tens of orders
// at most, so collision probability is effectively zero. The DB still
// enforces uniqueness on the column; the caller can retry on conflict.
// ============================================================================

export const REFERENCE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const REFERENCE_CODE_LENGTH = 6;
const PREFIX = "PHUB-";

/**
 * Get a Uint8Array of `len` random bytes. Prefers crypto.getRandomValues
 * (browser + Deno + modern Node), falls back to Math.random for legacy
 * environments — the fallback is never reached in production but the
 * helper is fully isomorphic so tests don't need a polyfill.
 */
function randomBytes(len: number): Uint8Array {
  const out = new Uint8Array(len);
  const g = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (g?.getRandomValues) {
    g.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < len; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

export function generateReferenceCode(): string {
  // Sample one alphabet character per random byte, rejecting bytes that
  // land in the unfair top of the 256-range to keep the distribution
  // uniform (rejection sampling). For a 31-char alphabet 31×8 = 248, so
  // bytes ≥ 248 are rejected. We over-fetch a small buffer to avoid
  // re-calling randomBytes mid-loop in the unlikely rejection case.
  const out: string[] = [];
  const ALPHABET = REFERENCE_CODE_ALPHABET;
  const MAX = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let pool = randomBytes(REFERENCE_CODE_LENGTH * 2);
  let i = 0;
  while (out.length < REFERENCE_CODE_LENGTH) {
    if (i >= pool.length) {
      pool = randomBytes(REFERENCE_CODE_LENGTH * 2);
      i = 0;
    }
    const b = pool[i++];
    if (b < MAX) out.push(ALPHABET[b % ALPHABET.length]);
  }
  return `${PREFIX}${out.join("")}`;
}

/** True iff the string is shaped like a PHUB reference code. */
export function isReferenceCode(s: string): boolean {
  if (!s.startsWith(PREFIX)) return false;
  const body = s.slice(PREFIX.length);
  if (body.length !== REFERENCE_CODE_LENGTH) return false;
  for (const ch of body) {
    if (!REFERENCE_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}
