// ============================================================================
// QA-04 — mint auth sessions ONCE per role, before any auth-gated project.
// ----------------------------------------------------------------------------
// Root cause of the old flake (proposal auto-milestone-run-2026-07, D4):
// every test minted its own magic-link for the SAME fixed role email, in
// parallel workers. Magic-link tokens are single-use and superseded by the
// next generateLink for that email, so concurrent mints invalidated each
// other → random "Email link is invalid or has expired" failures.
//
// This setup project runs in ONE worker, mints each role SEQUENTIALLY via the
// real generateLink → verifyOtp round-trip (so the SLO-2 auth detector still
// fires every CI run and fails HARD if auth is broken), and caches the exact
// localStorage key/value per role in playwright/.auth/. loginAs() then seeds
// from the cache instead of minting per test.
//
// The viewer session additionally does one setSession → refreshSession
// round-trip and stores the REFRESHED pair: proves refresh-from-seeded-
// session works (D4 must-verify: a shard outliving the access-token TTL
// must be able to renew, or the cache itself becomes a new flake class).
// ============================================================================

import { test as setup } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  authEnvOrFailInCI,
  mintSessionForEmail,
  refreshMintedSession,
  storageKeyForUrl,
} from "./helpers/supabase-admin";
import { AUTH_CACHE_DIR, TEST_USERS, type Role } from "./helpers/auth";

// opponent (testuser102) is only used by the DUPR_E2E-gated suite, which
// manages its own sessions — not minted here.
const ROLES: Role[] = ["viewer", "viewerConnected", "admin"];

setup("mint sessions once per role (real magic-link round-trip)", async () => {
  setup.skip(!authEnvOrFailInCI(), "Auth env not set — local run without secrets");
  setup.setTimeout(120_000);

  mkdirSync(AUTH_CACHE_DIR, { recursive: true });
  for (const role of ROLES) {
    const email = TEST_USERS[role];
    const minted = await mintSessionForEmail(email);
    // Viewer doubles as the refresh-path canary; store the refreshed pair
    // (refresh tokens rotate — the pre-refresh pair would be dead).
    const session =
      role === "viewer" ? await refreshMintedSession(minted.session) : minted.session;
    const storageKey = storageKeyForUrl(process.env.SUPABASE_URL!);
    writeFileSync(
      `${AUTH_CACHE_DIR}/${role}.json`,
      JSON.stringify({
        role,
        email,
        storageKey,
        storageValue: JSON.stringify(session),
        mintedAt: Date.now(),
      }),
    );
  }
});
