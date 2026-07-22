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

/**
 * QA-04 fail-hard rule: on CI the auth env is wired as repo secrets (#431),
 * so "env missing" is an infra failure — the suite must FAIL, not silently
 * skip. Silent skip already burned us once: a secret rename would turn the
 * whole auth suite into skipped-green and nobody would notice the guard was
 * off (proposal auto-milestone-run-2026-07, pre-mortem incident 1).
 * Local runs without secrets still skip. Emergency escape hatch (visible,
 * greppable): PLAYWRIGHT_ALLOW_NO_AUTH=1.
 */
export function authEnvOrFailInCI(): boolean {
  if (hasAuthEnv()) return true;
  if (process.env.CI && process.env.PLAYWRIGHT_ALLOW_NO_AUTH !== "1") {
    throw new Error(
      "Auth env (SUPABASE_URL/SERVICE_ROLE/ANON) missing in CI — auth suite must not skip-to-green on CI. " +
        "Check GitHub Actions secrets wiring in playwright.yml. Escape hatch: PLAYWRIGHT_ALLOW_NO_AUTH=1.",
    );
  }
  return false;
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
  // @supabase/auth-js v2 stores the RAW session object as the localStorage
  // value (verified against node_modules: GoTrueClient._isValidSession reads
  // top-level access_token/refresh_token/expires_at and __loadSession uses it
  // directly). Do NOT wrap it in a v1-style { currentSession, expiresAt }
  // envelope — that format is rejected by v2 and the SPA boots anonymous.
  const storageValue = JSON.stringify(session);

  return { session, storageKey, storageValue };
}

/**
 * Refresh a minted session once via the anon client (setSession +
 * refreshSession) and return the NEW session. Proves the seeded
 * access/refresh pair can actually renew itself — the storageState cache
 * (tests/auth.setup.ts) would otherwise hide a broken refresh path until a
 * CI shard ran longer than the access-token TTL (D4 must-verify, proposal
 * auto-milestone-run-2026-07). Refresh tokens rotate on use, so callers must
 * persist the RETURNED session, not the input.
 */
export async function refreshMintedSession(session: Session): Promise<Session> {
  const { url, anon } = requireEnv();
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: setData, error: setErr } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (setErr || !setData?.session) {
    throw new Error(`setSession on minted session failed: ${setErr?.message ?? "no session"}`);
  }
  const { data: refData, error: refErr } = await client.auth.refreshSession();
  if (refErr || !refData?.session) {
    throw new Error(`refreshSession on minted session failed: ${refErr?.message ?? "no session"}`);
  }
  return refData.session;
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
