// ============================================================================
// Smoke tests — every key route renders cleanly without JS errors.
// ============================================================================
// Catches:
//   - Title undefined (the /dupr bug from 2026-05-29)
//   - Route 404 / blank page after deploy
//   - JS bundle crash
//   - CSP-blocked critical resource
// ============================================================================

import { test, expect, type Page } from "@playwright/test";

// Routes that should render fine for an anonymous visitor. Auth-gated
// routes (/admin/*, /account, /match/confirm) redirect to /login which
// still has a valid title — they're fine to include in the smoke.
//
// We intentionally DO NOT pattern-match the title to a per-route regex
// because:
//   - ThePickleHub is a SPA — initial HTML always carries the default
//     "ThePickleHub – Pickleball Asia: Live, Brackets & News" title and
//     React's DynamicMeta swaps it client-side after hydration. By the
//     time we query Playwright might catch either value, leading to
//     flaky pattern matches.
//   - The original /dupr bug was `<title>undefined</title>`. We still
//     catch that via the explicit `not.toMatch(/undefined/)` assertion.
const ROUTES = [
  "/",
  "/dupr",
  "/match/new",
  "/match/confirm",
  "/rankings",
  "/feed",
  "/tournaments",
  "/blog",
  "/clubs",
  "/live",
] as const;

/**
 * Capture errors that would otherwise be silent — page-level exceptions
 * + JS console errors. We allow specific known-benign errors through a
 * filter (e.g. extension noise that doesn't reflect a real bug).
 */
function captureErrors(page: Page): { errors: string[]; clearAllowed: () => void } {
  const errors: string[] = [];
  const ALLOW = [
    /ResizeObserver loop/i,
    /Failed to load resource.*chrome-extension/i,
    /OneTrustWrapperFn/i,
    /Promise rejection/i, // Surfaced elsewhere; reduces noise
  ];

  page.on("pageerror", (e) => {
    if (!ALLOW.some((r) => r.test(e.message))) errors.push(`pageerror: ${e.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const t = msg.text();
    if (!ALLOW.some((r) => r.test(t))) errors.push(`console.error: ${t}`);
  });

  return { errors, clearAllowed: () => errors.splice(0, errors.length) };
}

for (const route of ROUTES) {
  test(`${route} renders with valid title + no JS errors`, async ({ page }) => {
    const { errors } = captureErrors(page);

    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `HTTP status for ${route}`).toBeLessThan(400);

    // <body> rendered — catches white-screen-of-death.
    await expect(page.locator("body")).toBeVisible();

    // Let React hydrate + DynamicMeta swap the title (~1.5s is enough
    // for the SPA route to finalise).
    await page.waitForTimeout(1500);

    // Title regression — the original /dupr bug literally produced
    // <title>undefined</title>. We just need to confirm the value isn't
    // the string "undefined" (case-insensitive) and isn't empty.
    const title = await page.title();
    expect(title, `title for ${route}`).toBeTruthy();
    expect(title.trim(), `title not empty`).not.toBe("");
    expect(title, `title not literal "undefined"`).not.toMatch(/^undefined$/i);
    expect(title, `title doesn't contain "undefined"`).not.toMatch(/undefined/i);

    expect(errors, `JS errors on ${route}:\n${errors.join("\n")}`).toEqual([]);
  });
}

test("homepage has signed-out CTA (login / sign up)", async ({ page }) => {
  await page.goto("/");
  // Either the inline login button or the mobile pill should be visible.
  const hasLoginAffordance =
    (await page.getByRole("link", { name: /sign in|đăng nhập/i }).count()) > 0 ||
    (await page.getByRole("link", { name: /log in|đăng nhập/i }).count()) > 0;
  expect(hasLoginAffordance, "expected login affordance on /").toBe(true);
});
