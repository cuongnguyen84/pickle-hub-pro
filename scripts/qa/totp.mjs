// ============================================================================
// RFC 6238 TOTP, for QA only.
// ----------------------------------------------------------------------------
// The admin console sits behind AdminMFAGate and is_admin() requires aal2, so
// a browser gate that wants to see the console has to actually pass 2FA. The
// alternatives were all worse: mocking getAuthenticatorAssuranceLevel, editing
// a JWT, rendering with a service-role key, or disabling the gate — every one
// of which tests something other than the product.
//
// So the harness enrols a real factor through the Auth API, reads the secret
// Supabase hands back IN MEMORY, computes a code the way any authenticator
// app would, and verifies. Nothing is persisted, nothing is committed, and no
// secret is hard-coded: the secret is different on every run and dies with the
// process.
//
// 30 lines of standard algorithm, using node:crypto. A dependency for this
// would be a dependency shipped to production for a test helper.
// ============================================================================

import { createHmac } from "node:crypto";

/** RFC 4648 base32 → bytes. Supabase returns the TOTP secret in base32. */
export function base32Decode(input) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = A.indexOf(ch);
    if (idx === -1) throw new Error(`not base32: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/**
 * The 6-digit code for a moment in time. `atSeconds` exists so a caller can
 * ask for the PREVIOUS window when a code is rejected on a step boundary —
 * the one real flake in this flow.
 */
export function totp(secretBase32, atSeconds = Math.floor(Date.now() / 1000), step = 30, digits = 6) {
  const counter = Math.floor(atSeconds / step);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const hmac = createHmac("sha1", base32Decode(secretBase32)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, "0");
}

/**
 * Enrol a TOTP factor, verify it with a real code, and return a session whose
 * AAL is aal2 — asserted from the JWT itself, not assumed from a 200.
 *
 * Throws with the server's own response body when anything fails, because the
 * failure this replaces ("422") cost an entire checkpoint's QA to diagnose.
 */
export async function elevateToAal2(client, { friendlyName = "qa-totp" } = {}) {
  const enrol = await client.auth.mfa.enroll({ factorType: "totp", friendlyName });
  if (enrol.error) {
    throw new Error(
      `MFA enroll failed: ${enrol.error.message} (${enrol.error.code ?? "no code"}). ` +
        `If this is mfa_totp_enroll_not_enabled, supabase/config.toml is missing ` +
        `[auth.mfa.totp] enroll_enabled/verify_enabled, or the stack was not restarted.`,
    );
  }
  const factorId = enrol.data.id;
  const secret = enrol.data.totp.secret;

  const challenge = await client.auth.mfa.challenge({ factorId });
  if (challenge.error) throw new Error(`MFA challenge failed: ${challenge.error.message}`);

  // Try this window, then the previous one. A code computed microseconds
  // before a 30s boundary is the only nondeterminism in the whole flow.
  const now = Math.floor(Date.now() / 1000);
  let verified = null;
  for (const at of [now, now - 30]) {
    const res = await client.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: totp(secret, at),
    });
    if (!res.error) {
      verified = res.data;
      break;
    }
    verified = res.error;
  }
  if (!verified || verified.message) {
    throw new Error(`MFA verify failed: ${verified?.message ?? "unknown"}`);
  }

  const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    throw new Error(`expected aal2 after verify, got ${aal?.currentLevel ?? "null"}`);
  }

  const { data: sess } = await client.auth.getSession();
  const claims = JSON.parse(
    Buffer.from(sess.session.access_token.split(".")[1], "base64url").toString("utf8"),
  );
  if (claims.aal !== "aal2") {
    throw new Error(`JWT says aal=${claims.aal}, not aal2 — the session was not elevated`);
  }

  return { session: sess.session, factorId, aal: claims.aal };
}
