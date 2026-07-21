// ============================================================================
// Auth fixtures for Phase 2A — loginAs(role) by injecting a minted session.
// ----------------------------------------------------------------------------
// We never type into the login form (that path is flaky + needs a password).
// Instead we mint a real session server-side (see supabase-admin.ts) and seed
// it into localStorage BEFORE the SPA boots via page.addInitScript, so the
// app's supabase-js client picks it up on init exactly as if the user had
// logged in normally.
// ============================================================================

import { existsSync, readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { mintSessionForEmail, storageKeyForUrl } from "./supabase-admin";

export type Role = "admin" | "viewer" | "viewerConnected" | "opponent";

/** Where tests/auth.setup.ts caches one minted session per role. */
export const AUTH_CACHE_DIR = "playwright/.auth";

// Cached sessions older than this are ignored (access token TTL is 1h; the
// setup project refreshes the pair, but a stale file from a previous local
// run must not leak into a new one).
const CACHE_MAX_AGE_MS = 50 * 60_000;

function cachedSession(
  role: Role,
): { storageKey: string; storageValue: string } | null {
  try {
    const path = `${AUTH_CACHE_DIR}/${role}.json`;
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed?.storageKey || !parsed?.storageValue) return null;
    if (Date.now() - (parsed.mintedAt ?? 0) > CACHE_MAX_AGE_MS) return null;
    return { storageKey: parsed.storageKey, storageValue: parsed.storageValue };
  } catch {
    return null;
  }
}

/**
 * Role -> test-user email map. Override via env so CI can point at whatever
 * accounts exist in the target environment.
 *
 *   admin           — only Cuong's account is admin in prod. Read-only tests.
 *   viewer          — plain viewer, no DUPR connection (testuser103).
 *   viewerConnected — viewer WITH a DUPR connection (testuser101, DUPR YGONMK).
 *   opponent        — second connected user for confirm flow (testuser102).
 */
export const TEST_USERS: Record<Role, string> = {
  admin: process.env.PLAYWRIGHT_ADMIN_EMAIL || "thecuong@gmail.com",
  viewer: process.env.PLAYWRIGHT_VIEWER_EMAIL || "testuser103@picklehub.test",
  viewerConnected:
    process.env.PLAYWRIGHT_VIEWER_CONNECTED_EMAIL ||
    "testuser101@picklehub.test",
  opponent:
    process.env.PLAYWRIGHT_OPPONENT_EMAIL || "testuser102@picklehub.test",
};

/**
 * Seed a minted session into the page's localStorage and reload so the SPA
 * boots already authenticated. Call BEFORE the first navigation to the route
 * under test, or pass `navigateTo` to land somewhere after auth.
 */
export async function loginAs(
  page: Page,
  role: Role,
  navigateTo?: string,
): Promise<void> {
  // Prefer the session minted once by tests/auth.setup.ts — per-test minting
  // for the same fixed email raced across parallel workers (magic-link tokens
  // are single-use + superseded) and was the root cause of the auth flake
  // (QA-04). Fallback mint keeps one-off local `--project=auth` runs working.
  const email = TEST_USERS[role];
  const { storageKey, storageValue } =
    cachedSession(role) ?? (await mintSessionForEmail(email));

  // Inject before any app JS runs so supabase-js reads it on first init.
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* localStorage may be unavailable on about:blank — ignored */
      }
    },
    [storageKey, storageValue] as const,
  );

  if (navigateTo) {
    await page.goto(navigateTo, { waitUntil: "domcontentloaded" });
  }
}

/** Clear the seeded session (sign-out simulation). */
export async function clearAuth(page: Page, baseURL?: string): Promise<void> {
  const url = baseURL ?? process.env.SUPABASE_URL;
  if (!url) return;
  const key = storageKeyForUrl(
    process.env.SUPABASE_URL ?? "https://ajvlcamxemgbxduhiqrl.supabase.co",
  );
  await page.evaluate((k) => window.localStorage.removeItem(k), key);
}
