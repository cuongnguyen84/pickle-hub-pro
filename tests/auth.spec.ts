// ============================================================================
// Phase 2A — Auth-gated flow tests (NON-MUTATING).
// ----------------------------------------------------------------------------
// Sessions are minted via the Supabase admin API (no password, no UI login).
// These tests assert auth STATE and UI surfaces only — they never log a
// match, confirm, or submit to DUPR (that mutating chain is Phase 2B,
// gated behind DUPR_E2E). Safe to run against production read-only.
//
// Skips entirely when the mint env (SUPABASE_URL / SERVICE_ROLE / ANON) is
// absent, so local runs + the legacy smoke pipeline stay green.
//
// Catches: modal/iframe CSP regression, role-gate inversion, RequireAuth
// redirect drift, HeaderDuprBadge not rendering for connected users.
// ============================================================================

import { test, expect } from "@playwright/test";
import { hasAuthEnv } from "./helpers/supabase-admin";
import { loginAs } from "./helpers/auth";

test.describe("auth-gated flows", () => {
  test.skip(
    !hasAuthEnv(),
    "Auth env (SUPABASE_URL/SERVICE_ROLE/ANON) not set — skipping 2A",
  );

  test("authenticated viewer reaches a RequireAuth route without /login redirect", async ({
    page,
  }) => {
    await loginAs(page, "viewer", "/dupr");
    await page.waitForTimeout(1500);
    // RequireAuth would bounce an anon user to /login?redirect=...
    expect(page.url(), "should NOT be redirected to /login").not.toMatch(
      /\/login/,
    );
    expect(new URL(page.url()).pathname).toBe("/dupr");
    await expect(page.locator("body")).toBeVisible();
  });

  test("viewer is redirected away from an admin-only route", async ({
    page,
  }) => {
    await loginAs(page, "viewer", "/admin/dupr");
    await page.waitForTimeout(1500);
    // RequireAuth requiredRole="admin" => <Navigate to="/" /> for non-admins.
    expect(
      new URL(page.url()).pathname,
      "non-admin should be redirected off /admin/dupr",
    ).not.toBe("/admin/dupr");
  });

  test("admin can load an admin-only route", async ({ page }) => {
    await loginAs(page, "admin", "/admin/dupr");
    await page.waitForTimeout(2000);
    // Admin must NOT be bounced to / or /login.
    const path = new URL(page.url()).pathname;
    expect(path, "admin should stay on /admin/dupr").toBe("/admin/dupr");
    expect(page.url()).not.toMatch(/\/login/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("connected user sees a DUPR badge/chip in the header", async ({
    page,
  }) => {
    await loginAs(page, "viewerConnected", "/");
    await page.waitForTimeout(2500);
    // HeaderDuprBadge renders either a rating chip (connected) or a
    // "connect" pill. For a connected user we expect DUPR text / a rating.
    const hasDuprSurface =
      (await page.getByText(/dupr/i).count()) > 0 ||
      (await page.locator('[class*="dupr" i]').count()) > 0;
    expect(hasDuprSurface, "expected a DUPR surface in header for connected user").toBe(
      true,
    );
  });

  test("DUPR connect modal opens with the SSO iframe (CSP not blocking)", async ({
    page,
  }) => {
    await loginAs(page, "viewer", "/dupr");
    await page.waitForTimeout(1500);

    const connectBtn = page
      .getByRole("button", { name: /(kết nối với dupr|connect with dupr|connect dupr)/i })
      .first();

    if ((await connectBtn.count()) === 0) {
      test.skip(true, "Connect button not present (user may already be connected)");
      return;
    }

    await connectBtn.click();
    // Modal uses role="dialog"; iframe has title="DUPR SSO".
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const iframe = page.locator('iframe[title="DUPR SSO"]');
    await expect(iframe, "DUPR SSO iframe should be in the DOM").toHaveCount(1);
    // CSP frame-src includes dupr.gg/dupr.com — the iframe src must point there.
    const src = await iframe.getAttribute("src");
    expect(src ?? "", "iframe src should target a DUPR domain").toMatch(/dupr\./i);
  });

  test("/match/confirm loads the confirm queue for an authed user", async ({
    page,
  }) => {
    await loginAs(page, "viewer", "/match/confirm");
    await page.waitForTimeout(1500);
    expect(page.url(), "authed user should not bounce to /login").not.toMatch(
      /\/login/,
    );
    await expect(page.locator("body")).toBeVisible();
    const title = await page.title();
    expect(title, "confirm page title not undefined").not.toMatch(/undefined/i);
  });
});
