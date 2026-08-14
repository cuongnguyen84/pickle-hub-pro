// RFC 6238 TOTP, ~20 lines of node:crypto.
//
// This exists so the admin can enrol a factor and answer a challenge the way a
// phone would. It is NOT a bypass: the code goes to Supabase's real
// /auth/v1/factors/{id}/verify, which is what mints the aal2 token. Nothing
// here touches AdminMFAGate, is_admin() or has_role().
//
// The shared secret lives in memory for the length of the run and is never
// written to the registry, the repo, or any report.
import { createHmac } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(s) {
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const i = B32.indexOf(c);
    if (i < 0) continue;
    bits += i.toString(2).padStart(5, "0");
  }
  const out = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}

export function totp(secret, atMs = Date.now(), step = 30, digits = 6) {
  const counter = Math.floor(atMs / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).toString();
  return code.padStart(digits, "0");
}
