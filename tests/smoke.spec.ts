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
const ROUTES = [
  { path: "/", titlePattern: /pickle/i },
  { path: "/dupr", titlePattern: /(dupr|connect|kết nối)/i },
  { path: "/match/new", titlePattern: /(match|trận|log)/i },
  { path: "/match/confirm", titlePattern: /(confirm|xác nhận)/i },
  { path: "/rankings", titlePattern: /(ranking|xếp hạng)/i },
  { path: "/feed", titlePattern: /(feed|bảng tin)/i },
  { path: "/tournaments", titlePattern: /tournament/i },
  { path: "/blog", titlePattern: /(blog|stor)/i },
  { path: "/clubs", titlePattern: /(clb|club)/i },
  { path: "/live", titlePattern: /(live|trực tiếp|stream)/i },
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
  test(`${route.path} renders with valid title + no JS errors`, async ({ page }) => {
    const { errors } = captureErrors(page);

    const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `HTTP status for ${route.path}`).toBeLessThan(400);

    // Title regression: the bug that made us add Phase 1.
    const title = await page.title();
    expect(title, `title for ${route.path}`).toBeTruthy();
    expect(title, `title not undefined`).not.toMatch(/^undefined$/i);
    expect(title, `title matches expected pattern`).toMatch(route.titlePattern);

    // <body> rendered — catches white-screen-of-death.
    await expect(page.locator("body")).toBeVisible();

    // Give the SPA a moment to wire up React + async work before we
    // declare "no errors". Anything past this point is a real regression.
    await page.waitForTimeout(800);

    expect(errors, `JS errors on ${route.path}:\n${errors.join("\n")}`).toEqual([]);
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
