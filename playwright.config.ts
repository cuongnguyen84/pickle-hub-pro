// ============================================================================
// Playwright config — ThePickleHub Phase 1 smoke + SEO + mobile
// ----------------------------------------------------------------------------
// Target URL is controlled by PLAYWRIGHT_BASE_URL. CI runs against
// https://www.thepicklehub.net by default (read-only smoke is safe to
// run against prod); set PLAYWRIGHT_BASE_URL to a preview URL when
// testing PR builds.
//
// User-Agent is suffixed with "ThePickleHub-Playwright-CI" so the
// requests are easy to filter out of GA4 + don't pollute real analytics.
// ============================================================================

import { defineConfig, devices } from "@playwright/test";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "https://www.thepicklehub.net";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    extraHTTPHeaders: {
      // Tag CI traffic so it's filterable in analytics / web logs.
      "X-PlayWright-CI": "thepicklehub-phase1",
    },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 ThePickleHub-Playwright-CI",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: "ssr-bot",
      // SSR/SEO tests are fetch-only (no browser), but Playwright
      // requires a "browser" — we still spawn Chromium per project.
      use: { ...devices["Desktop Chrome"] },
      testMatch: /seo\.spec\.ts/,
    },
  ],
});
