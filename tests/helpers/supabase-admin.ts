// ============================================================================
// Supabase admin helpers — mint a real user session WITHOUT a password.
// ----------------------------------------------------------------------------
// Used by Phase 2A auth-gated Playwright tests. Instead of storing a test
// user password in CI, we mint a one-time magic-link token with the service
// role, then exchange it for a real session with the anon client. This gives
// us a genuine access_token / refresh_token pair identical to what the app
// would store after a normal login — no UI login flow, no flaky password.
//
// Required env (set as GitHub Actions secrets for CI):
//   SUPABASE_URL                e.g. https://ajvlcamxemgbxduhiqrl.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   service_role JWT (admin API)
//   SUPABASE_ANON_KEY           anon/publishable key (verifyOtp client)
//
// If any are missing the auth specs call hasAuthEnv() and test.skip() so the
// existing green pipeline (and local runs without secrets) never break.
// ============================================================================

import { createClient, type Session } from "@supabase/supabase-js";

export interface MintedSession {
  session: Session;
  storageKey: string;
  storageValue: string;
}

/** True when all env vars required to mint a session are present. */
export function hasAuthEnv(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY),
  );
}

function requireEnv(): { url: string; service: string; anon: string } {
  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon =
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !service || !anon) {
    throw new Error(
      "Missing Supabase env: need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY",
    );
  }
  return { url, service, anon };
}

/** supabase-js localStorage key for this project: sb-<ref>-auth-token */
export function storageKeyForUrl(url: string): string {
  const ref = new URL(url).hostname.split(".")[0];
  return `sb-${ref}-auth-token`;
}

/**
 * Mint a session for `email` with no password.
 *
 * 1. service-role generateLink(magiclink) -> hashed_token (OTP token_hash)
 * 2. anon verifyOtp({ token_hash, type: 'magiclink' }) -> real Session
 *
 * Returns the session plus the exact localStorage key/value the app's
 * supabase-js client expects, so a test can inject it via addInitScript.
 */
export async function mintSessionForEmail(
  email: string,
): Promise<MintedSession> {
  const { url, service, anon } = requireEnv();

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink(
    { type: "magiclink", email },
  );
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(
      `generateLink failed for ${email}: ${linkErr?.message ?? "no hashed_token"}`,
    );
  }

  const tokenHash = linkData.properties.hashed_token;

  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: otpData, error: otpErr } = await anonClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (otpErr || !otpData?.session) {
    throw new Error(
      `verifyOtp failed for ${email}: ${otpErr?.message ?? "no session"}`,
    );
  }

  const session = otpData.session;
  const storageKey = storageKeyForUrl(url);
  // supabase-js v2 stores the raw session object as the localStorage value.
  const storageValue = JSON.stringify(session);

  return { session, storageKey, storageValue };
}

/**
 * Reset a test user's password via the admin API. Only needed if a test
 * specifically exercises the password login form (we default to mint instead).
 */
export async function setUserPassword(
  userId: string,
  password: string,
): Promise<void> {
  const { url, service } = requireEnv();
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(`updateUserById failed: ${error.message}`);
}
