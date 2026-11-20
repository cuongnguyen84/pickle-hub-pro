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
import { prepareVisualPage, settleVisualFonts, assertNavigationUnmasked, VISUAL_MASK_SELECTORS, waitForVisualContent } from "./helpers/visual-stability";

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
    // Shop UI polish R1: the two anonymous-renderable shop surfaces. A PDP is
    // deliberately NOT pinned — the pilot catalogue has no slug stable enough
    // to freeze into a baseline yet.
    { name: "shop-home", path: "/shop" },
    { name: "shop-sell", path: "/shop/sell" },
  ];

  test('visual harness contract: fixtures, fonts and navigation', async ({ page }) => {
    await prepareVisualPage(page);
    await page.goto('/clubs', { waitUntil: 'load' });
    await expect(page.getByText('Riverside Pickleball Club', { exact: true })).toBeVisible();
    await expect(page.getByText('Câu lạc bộ Pickleball Thành Phố', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sign in to create a club/ })).toBeVisible();
    await expect(page.getByRole('textbox')).toBeVisible();
    await waitForVisualContent(page, '/clubs');
    await settleVisualFonts(page);
    await assertNavigationUnmasked(page);
    // Force paint before checking actual glyph fonts (font-family alone can lie).
    await page.screenshot();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const root = await cdp.send('DOM.getDocument');
    const heading = await cdp.send('DOM.querySelector', { nodeId: root.root.nodeId, selector: 'h1' });
    const fonts = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: heading.nodeId });
    expect(fonts.fonts.some(font => font.isCustomFont && font.familyName === 'Instrument Serif' && font.glyphCount > 0)).toBe(true);
    await cdp.detach();
  });

  for (const state of ['populated', 'empty'] as const) {
    test(`visual harness contract: live ${state} is explicit`, async ({ page }) => {
      await prepareVisualPage(page, state);
      await page.goto('/live', { waitUntil: 'load' });
      await page.getByRole('heading').first().waitFor({ state: 'visible' });
      if (state === 'populated') {
        await expect(page.getByText('Visual live doubles match', { exact: true })).toBeVisible();
      } else {
        await expect(page.getByRole('heading', { name: 'No matches in this view.' })).toBeVisible();
        await expect(page.getByText('Visual live doubles match', { exact: true })).toHaveCount(0);
      }
      await assertNavigationUnmasked(page);
    });
  }

  for (const target of PAGES) {
    test(`visual harness contract: ready ${target.name}`, async ({ page }) => {
      await prepareVisualPage(page);
      await page.goto(target.path, { waitUntil: 'load' });
      await waitForVisualContent(page, target.path);
      await assertNavigationUnmasked(page);
      await expect(page.getByRole('heading').first()).toBeVisible();
    });
  }

  for (const p of PAGES) {
    test(`${p.name} matches baseline`, async ({ page }) => {
      // Full-page shots of heavy pages can exceed the global 30s budget.
      test.setTimeout(60_000);
      // NOT networkidle: realtime channels + analytics beacons keep the
      // network busy forever on / — capture run 29692427270 timed out there.
      await prepareVisualPage(page);
      await page.goto(p.path, { waitUntil: "load" });
      await waitForVisualContent(page, p.path);
      await settleVisualFonts(page);

      // Mask volatile content so only structural changes trip the diff.
      await assertNavigationUnmasked(page);
      const masks = VISUAL_MASK_SELECTORS.map(selector => page.locator(selector));

      await expect(page).toHaveScreenshot(`${p.name}.png`, {
        ...SCREENSHOT_OPTS,
        mask: masks,
      });
    });
  }
});
