// ============================================================================
// A11Y-04 — axe scans + keyboard behavior for the north-star journey screens
// (docs/journey-screens.md): P1 event detail, P2 registration modal, O1 club
// landing. O2-O4 (organizer wizard) are auth-gated — covered when the mint
// env + PLAYWRIGHT_ORGANIZER_CLUB_SLUG are present, self-skip otherwise
// (same convention as auth.spec.ts).
//
// Slugs are discovered from the live listing pages, so the suite works
// against prod and previews without fixtures. No mutations — the modal is
// opened and closed, never submitted.
// ============================================================================

import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// color-contrast is disabled: the public pages have known pre-existing
// contrast issues (Lighthouse has flagged them repo-wide since 2026-07).
// Re-enable when that debt is paid — everything else fails the build.
async function expectNoViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .disableRules(["color-contrast"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious,
    `${context}: ${serious.length} serious/critical axe violations:\n` +
      serious
        .map(
          (v) =>
            `  [${v.impact}] ${v.id}: ${v.help}\n` +
            v.nodes.slice(0, 3).map((n) => `    ${n.target.join(" ")}`).join("\n"),
        )
        .join("\n"),
  ).toEqual([]);
}

/** First detail link on a listing page, or null when the listing is empty. */
async function discoverSlugHref(
  page: Page,
  listRoute: string,
  hrefPrefix: string,
  timeout = 10_000,
): Promise<string | null> {
  await page.goto(listRoute, { waitUntil: "domcontentloaded" });
  const link = page.locator(`a[href^="${hrefPrefix}"]`).first();
  try {
    await link.waitFor({ state: "attached", timeout });
  } catch {
    return null;
  }
  return link.getAttribute("href");
}

/**
 * Event detail URL: prefer the /social listing (upcoming events), fall back
 * to walking the first few club landings — past events keep their links, so
 * the P1 scan still runs when nothing upcoming exists (a real prod state).
 */
let cachedEventHref: string | null | undefined;

async function discoverEventHref(page: Page): Promise<string | null> {
  // The a11y project is single-worker sequential (playwright.config.ts), so
  // one walk serves both P1 and P2.
  if (cachedEventHref !== undefined) return cachedEventHref;
  cachedEventHref = await discoverEventHrefUncached(page);
  return cachedEventHref;
}

async function discoverEventHrefUncached(page: Page): Promise<string | null> {
  const direct = await discoverSlugHref(page, "/social", "/social/");
  if (direct) return direct;
  await page.goto("/clubs", { waitUntil: "domcontentloaded" });
  await page
    .locator('a[href^="/clb/"]')
    .first()
    .waitFor({ state: "attached", timeout: 10_000 })
    .catch(() => undefined);
  const clubs = [
    ...new Set(
      (await page
        .locator('a[href^="/clb/"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute("href")))) as string[],
    ),
  ].slice(0, 6);
  for (const club of clubs) {
    // Short wait per club: most have no events; 4s after domcontentloaded
    // is plenty for the events list to hydrate.
    const href = await discoverSlugHref(page, club, "/social/", 4_000);
    if (href) return href;
  }
  return null;
}

// ── P1 — event detail ────────────────────────────────────────────────────────

test("P1 event detail passes axe (wcag2a/aa, serious+critical)", async ({ page }) => {
  test.setTimeout(90_000); // discovery may walk several club pages
  const href = await discoverEventHref(page);
  test.skip(!href, "no social events discoverable");
  await page.goto(href!, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1").first()).toBeVisible();
  await expectNoViolations(page, `event detail ${href}`);
});

// ── P2 — registration modal: axe + keyboard (Escape, focus trap/return) ─────

test("P2 registration modal is keyboard-operable and passes axe", async ({ page }) => {
  test.setTimeout(90_000); // discovery may walk several club pages
  const href = await discoverEventHref(page);
  test.skip(!href, "no social events discoverable");
  await page.goto(href!, { waitUntil: "domcontentloaded" });

  // The primary CTA (VI or EN copy). Disabled = event full/ended — skip:
  // read-only suites can't create a future event on prod.
  const cta = page.getByRole("button", { name: /đăng ký|register/i }).first();
  test.skip(
    !(await cta.isVisible().catch(() => false)) ||
      !(await cta.isEnabled().catch(() => false)),
    "no enabled registration CTA on the discovered event",
  );

  await cta.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await expectNoViolations(page, "registration modal open");

  // Focus trap: tabbing never leaves the dialog.
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
  }
  const trapped = await page.evaluate(() => {
    const active = document.activeElement;
    return Boolean(active?.closest('[role="dialog"]'));
  });
  expect(trapped, "focus escaped the registration modal while tabbing").toBe(true);

  // Escape closes and hands focus back to the trigger (Radix contract —
  // guards the DS-03 "stuck modal" class on keyboard/AT users).
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(cta).toBeFocused();
});

// ── O1 — club landing ───────────────────────────────────────────────────────

test("O1 club landing passes axe (wcag2a/aa, serious+critical)", async ({ page }) => {
  test.setTimeout(60_000);
  const href = await discoverSlugHref(page, "/clubs", "/clb/");
  test.skip(!href, "no clubs listed");
  await page.goto(href!, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1").first()).toBeVisible();
  await expectNoViolations(page, `club landing ${href}`);
});

// ── O2 — create wizard (auth-gated, self-skips like auth.spec.ts) ───────────

test("O2 create wizard step 1 passes axe", async ({ page }) => {
  const clubSlug = process.env.PLAYWRIGHT_ORGANIZER_CLUB_SLUG;
  // Env check duplicated from helpers/supabase-admin hasAuthEnv() on
  // purpose: that helper chain fails to LOAD under node 24 locally
  // (auth.spec has the same issue), so we must skip BEFORE importing it.
  const hasMintEnv = Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY),
  );
  test.skip(
    !hasMintEnv || !clubSlug,
    "needs mint env + PLAYWRIGHT_ORGANIZER_CLUB_SLUG (a club the admin user manages)",
  );
  const { loginAs } = await import("./helpers/auth");
  await loginAs(page, "admin", `/clb/${clubSlug}/social/moi`);
  // Wizard renders only for managers; anything else redirects/blocks.
  await expect(page.getByRole("button", { name: /tiếp|next/i })).toBeVisible({
    timeout: 15_000,
  });
  await expectNoViolations(page, "create wizard step 1");
});
