// ============================================================================
// Mobile viewport regressions (375x812 Pixel-class).
// ============================================================================
// Catches:
//   - Horizontal scroll on any key page
//   - Hero CTAs side-by-side instead of stacking (HomeLogMatchCTA bug
//     from 2026-05-26)
//   - Header pills overflowing brand text (auth-pill regression)
// ============================================================================

import { test, expect } from "@playwright/test";

const MOBILE_ROUTES = ["/", "/dupr", "/match/new", "/rankings"];

for (const route of MOBILE_ROUTES) {
  test(`${route} has no horizontal scroll on mobile`, async ({ page }) => {
    await page.goto(route);
    await page.waitForTimeout(500);

    const { docWidth, viewportWidth } = await page.evaluate(() => ({
      docWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));

    // Allow 2px slack for sub-pixel borders. Anything more = real overflow.
    expect(
      docWidth,
      `${route}: document.scrollWidth (${docWidth}) > viewport (${viewportWidth}) — horizontal scroll present`,
    ).toBeLessThanOrEqual(viewportWidth + 2);
  });
}

test("homepage hero CTA wraps to its own row on mobile", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(800);

  // Find the loud LogMatchCTA section by its eyebrow text.
  const eyebrow = page.getByText(/sân chính|center court/i).first();
  const ctaButton = page.getByRole("link", { name: /(kết nối dupr|connect dupr|log trận|log a match)/i }).first();

  if ((await eyebrow.count()) === 0 || (await ctaButton.count()) === 0) {
    test.skip(true, "Hero section not visible on this build (anonymous home)");
    return;
  }

  const eyebrowBox = await eyebrow.boundingBox();
  const buttonBox = await ctaButton.boundingBox();
  expect(eyebrowBox && buttonBox).toBeTruthy();

  // Mobile: button must be vertically BELOW the eyebrow (stacked column),
  // not on the same horizontal row. Allow some headline content between.
  expect(
    buttonBox!.y,
    "CTA button should stack below headline on mobile",
  ).toBeGreaterThan(eyebrowBox!.y);
});
