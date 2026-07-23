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
  // Codex review 2026-07-16: the old blanket /Promise rejection/i allow could
  // swallow exactly the asset-mismatch/lazy-chunk outage class. DENY is
  // checked FIRST and always fails the run; ALLOW only silences the named
  // benign noise. Add new allows by exact message, never by broad category.
  const DENY = [
    /ChunkLoadError/i,
    /Loading chunk .* failed/i,
    /Failed to fetch dynamically imported module/i,
    /Importing a module script failed/i,
    /error loading dynamically imported module/i,
  ];
  const ALLOW = [
    /ResizeObserver loop/i,
    /Failed to load resource.*chrome-extension/i,
    /OneTrustWrapperFn/i,
    // Google's own REPORT-ONLY frame-ancestors policy logs a console error
    // when /dupr embeds its sign-in iframe — "no further action has been
    // taken" per the message itself; pure third-party noise (2026-07-17).
    /Framing 'https:\/\/www\.google\.com\/' violates the following report-only Content Security Policy/,
  ];
  const record = (kind: string, text: string) => {
    if (DENY.some((r) => r.test(text))) {
      errors.push(`${kind} [chunk-load class]: ${text}`);
      return;
    }
    if (!ALLOW.some((r) => r.test(text))) errors.push(`${kind}: ${text}`);
  };

  page.on("pageerror", (e) => record("pageerror", e.message));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    // Append the source URL so a "Failed to load resource: 404" names the
    // exact asset — 2026-07-17's alert storm was undiagnosable without it.
    const url = msg.location()?.url;
    record("console.error", url ? `${msg.text()} [${url}]` : msg.text());
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

    // QA-04: wait for the title to SETTLE to a valid value instead of
    // sampling at a fixed 1.5s — /feed's DynamicMeta can swap later than
    // that on slow CI runners, and the old sleep read the intermediate
    // state. A title that never becomes valid within the window still
    // fails, so the original /dupr <title>undefined</title> regression is
    // still caught.
    await expect
      .poll(
        async () => {
          const t = (await page.title()).trim();
          return t !== "" && !/undefined/i.test(t);
        },
        {
          message: `title for ${route} should settle to non-empty without "undefined"`,
          timeout: 15_000,
        },
      )
      .toBe(true);

    expect(errors, `JS errors on ${route}:\n${errors.join("\n")}`).toEqual([]);
  });
}

test("homepage has signed-out CTA (login / sign up)", async ({ page }) => {
  await page.goto("/");
  // Flake fix 2026-07-19: count() snapshots one instant — khi có luồng live
  // homepage mount nặng hơn và link login chưa kịp render → false negative.
  // toBeVisible() auto-retries đến khi React vẽ xong.
  await expect(
    page.getByRole("link", { name: /sign in|log in|đăng nhập/i }).first(),
    "expected login affordance on /",
  ).toBeVisible();
});

// ── A11Y-01 foundations — skip link + route focus management ──────────────

test("skip link is the first tab stop and moves focus to content", async ({ page }) => {
  await page.goto("/");

  // Flake fix 2026-07-17: pressing Tab before React hydrates sends focus
  // somewhere else entirely, and no expect-retry can undo a wrong Tab.
  // The skip link is React-rendered — its attachment proves the app
  // mounted; only then is Tab meaningful.
  const skipLink = page.locator('a[href="#main-content"]');
  await skipLink.waitFor({ state: "attached" });
  // Flake fix 2026-07-22: on CI chromium the first Tab intermittently landed
  // "inactive" — something (embedded player/iframe, late autofocus) already
  // held focus when the test began, so Tab continued from THERE, not from
  // the top. Reset focus to <body> first: the assertion stays "skip link is
  // the first tab stop from the top of the document", which is what the
  // skip-link contract actually promises.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.focus();
  });
  await page.keyboard.press("Tab");

  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("client-side navigation hands focus to the new page content", async ({ page }) => {
  await page.goto("/");
  // Flake fix 2026-07-17: clicking a not-yet-hydrated anchor triggers a
  // FULL page navigation — the route-focus effect only runs on client-side
  // transitions, so the assertion could never pass. Wait for React mount
  // (skip link attached) before clicking.
  await page.locator('a[href="#main-content"]').waitFor({ state: "attached" });
  const link = page.locator('a[href="/tournaments"]').first();
  await link.click();
  await page.waitForURL("**/tournaments");
  await expect(page.locator("#main-content")).toBeFocused();
});

// ── Scroll regression guard (2026-07-16 incident: #main-content wrapper
// broke the #root flex/height chain and killed scrolling site-wide while
// every render/console assertion stayed green). html/body/#root are
// overflow:hidden — content scrolls in nested containers, so we find the
// real scroller and drive it.
const SCROLL_ROUTES = ["/", "/tournaments", "/vi"];

for (const route of SCROLL_ROUTES) {
  test(`page actually scrolls: ${route}`, async ({ page }) => {
    await page.goto(route);
    // Flake fix 2026-07-19: BOUNDED networkidle. Khi có livestream đang phát,
    // realtime websocket + HLS/poll làm network KHÔNG BAO GIỜ idle — không có
    // timeout riêng (actionTimeout=0) thì chờ tới chết test 30s. 5s là đủ để
    // trang tĩnh settle; trang "ồn" thì evaluate bên dưới vẫn chạy được
    // (verified against prod mid-livestream: scroll OK, evaluate <5ms).
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    const result = await page.evaluate(() => {
      const scroller = [...document.querySelectorAll("*")].find((el) => {
        const cs = getComputedStyle(el);
        return (
          (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight + 50
        );
      });
      if (!scroller) {
        // The 2026-07-16 incident signature is TALL content with no way to
        // scroll it (broken flex/height chain). A page whose content simply
        // fits the viewport (e.g. /tournaments on a quiet week) has nothing
        // to scroll and is healthy — don't fail on it (main went red on
        // exactly this 2026-07-23).
        const tallest = Math.max(
          0,
          ...[...document.querySelectorAll("*")].map((el) => el.scrollHeight),
        );
        if (tallest <= window.innerHeight + 50) {
          return { ok: true, detail: "content fits viewport; nothing to scroll" };
        }
        return {
          ok: false,
          detail: `no scrollable container; tallest=${tallest} body=${document.body.scrollHeight} root=${document.getElementById("root")?.scrollHeight ?? 0} viewport=${window.innerHeight}`,
        };
      }
      scroller.scrollTop = 200;
      return scroller.scrollTop > 0
        ? { ok: true, detail: "" }
        : { ok: false, detail: "scroller found but scrollTop stuck at 0" };
    });
    expect(result.ok, result.detail).toBe(true);
  });
}
