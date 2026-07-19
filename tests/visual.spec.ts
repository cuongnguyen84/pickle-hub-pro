// ============================================================================
// Phase 2C — Visual regression (free, Playwright toHaveScreenshot).
// ----------------------------------------------------------------------------
// Pixel-diff baselines stored in-repo under tests/visual.spec.ts-snapshots/.
// Catches regressions a boundingBox() check misses: iframe collapse, header
// pill overflow, accent-color drift, spacing breakage.
//
// GATED behind VISUAL=1 so it never runs in the default pipeline (baselines
// are environment-specific and would false-fail on fresh checkouts).
//
// First-time baseline capture (run against the stable target you want to
// freeze, usually production):
//   VISUAL=1 npm run e2e:visual:update
// Then commit the generated *-snapshots/ PNGs. Subsequent runs:
//   VISUAL=1 npm run e2e:visual
//
// Dynamic regions (live scores, avatars, timestamps, news cards) are masked
// so they don't cause flaky diffs.
// ============================================================================

import { test, expect } from "@playwright/test";

test.describe("visual regression", () => {
  test.skip(process.env.VISUAL !== "1", "VISUAL not set — skipping pixel diff");

  // Tolerances: allow tiny anti-aliasing noise but catch real layout shifts.
  const SCREENSHOT_OPTS = {
    maxDiffPixelRatio: 0.02,
    animations: "disabled" as const,
    fullPage: true,
  };

  // Public, anonymous-renderable pages (auth-gated routes redirect to /login
  // and aren't stable to snapshot). Add to this list as new public surfaces
  // ship; re-run the "Visual baseline (capture)" workflow after.
  const PAGES = [
    { name: "home", path: "/" },
    { name: "rankings", path: "/rankings" },
    { name: "blog-index", path: "/blog" },
    { name: "tournaments", path: "/tournaments" },
    { name: "live", path: "/live" },
    { name: "clubs", path: "/clubs" },
    { name: "news", path: "/news" },
    { name: "tools", path: "/tools" },
    { name: "feed", path: "/feed" },
    { name: "home-vi", path: "/vi" },
    // QA-05 locales: VI mirrors of the two most content-distinct routes.
    { name: "rankings-vi", path: "/vi/rankings" },
    { name: "news-vi", path: "/vi/news" },
  ];

  for (const p of PAGES) {
    test(`${p.name} matches baseline`, async ({ page }) => {
      // Full-page shots of heavy pages can exceed the global 30s budget.
      test.setTimeout(60_000);
      // NOT networkidle: realtime channels + analytics beacons keep the
      // network busy forever on / — capture run 29692427270 timed out there.
      await page.goto(p.path, { waitUntil: "load" });
      // Settle fonts + lazy images.
      await page.waitForTimeout(1200);
      await page.evaluate(() => document.fonts?.ready);

      // Mask volatile content so only structural changes trip the diff.
      const masks = [
        page.locator("img"),
        page.locator("[data-testid='live-score']"),
        page.locator("time"),
        page.locator("[class*='avatar' i]"),
        page.locator("[class*='news' i]"),
      ];

      await expect(page).toHaveScreenshot(`${p.name}.png`, {
        ...SCREENSHOT_OPTS,
        mask: masks,
      });
    });
  }
});
