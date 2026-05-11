// ============================================================================
// _shared/otp.ts — OTP code generation + SHA-256 hashing helpers
// ----------------------------------------------------------------------------
// We store only the hash of the OTP in otp_codes.code_hash, never the
// plaintext. The hash is salted with the phone number itself so two
// users who happen to receive the same 6-digit code in the same window
// don't share a hash (it also blocks a stolen-DB rainbow-table walk).
//
// SHA-256 via the standard Web Crypto API — available in Deno + browsers,
// no bcrypt dependency required. For a 6-digit OTP that lives 5 minutes
// with a max-3-attempts cap, this is sufficient.
// ============================================================================

/**
 * Generate a cryptographically random 6-digit OTP. Uses crypto.getRandomValues
 * to avoid the Math.random bias on small ranges.
 *
 * Returns a zero-padded string ("000000" .. "999999").
 */
export function generateOtpCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = buf[0] % 1_000_000;
  return n.toString().padStart(6, "0");
}

/**
 * Hash an OTP code with the user's phone as salt. Returns the lowercase
 * hex SHA-256 digest. Constant-time compare is handled by callers via
 * a simple string === check (acceptable for hex output where the only
 * sensitive comparison is the hash, not the code itself).
 */
export async function hashOtp(code: string, phoneSalt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${phoneSalt}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}
