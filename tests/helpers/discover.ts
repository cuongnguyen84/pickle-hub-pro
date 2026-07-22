// ============================================================================
// Live-content discovery helpers — shared by the a11y and journeys projects.
// ----------------------------------------------------------------------------
// Tests run against prod/preview with REAL data, so the concrete event under
// test must be discovered at runtime. Extracted from tests/a11y.spec.ts for
// QA-04 inc4. Both consuming projects are single-worker sequential, so the
// module-scope caches are safe (each project process walks at most once).
// ============================================================================

import type { Page } from "@playwright/test";

/** First detail link on a listing page, or null when the listing is empty. */
export async function discoverSlugHref(
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
 * detail-page scans still run when nothing upcoming exists (a real prod
 * state).
 */
let cachedEventHref: string | null | undefined;

export async function discoverEventHref(page: Page): Promise<string | null> {
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

/**
 * An event whose detail page currently shows an ENABLED register CTA
 * ("Register now →" / "Đăng ký ngay →"), i.e. registration is open right
 * now. Walks up to `maxToCheck` upcoming events from the /social listing.
 * Null when prod simply has no open event today — callers skip with a
 * reason instead of failing.
 */
export const OPEN_CTA = /register now|đăng ký ngay/i;

let cachedOpenEventHref: string | null | undefined;

export async function discoverOpenEventHref(
  page: Page,
  maxToCheck = 5,
): Promise<string | null> {
  if (cachedOpenEventHref !== undefined) return cachedOpenEventHref;
  cachedOpenEventHref = null;

  await page.goto("/social", { waitUntil: "domcontentloaded" });
  await page
    .locator('a[href^="/social/"]')
    .first()
    .waitFor({ state: "attached", timeout: 10_000 })
    .catch(() => undefined);
  const hrefs = [
    ...new Set(
      (await page
        .locator('a[href^="/social/"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute("href")))) as string[],
    ),
  ].slice(0, maxToCheck);

  for (const href of hrefs) {
    await page.goto(href, { waitUntil: "domcontentloaded" });
    const cta = page.getByRole("button", { name: OPEN_CTA }).first();
    try {
      await cta.waitFor({ state: "visible", timeout: 5_000 });
      if (await cta.isEnabled()) {
        cachedOpenEventHref = href;
        break;
      }
    } catch {
      // CTA absent or in a non-open state (ended/full/cancelled) — next.
    }
  }
  return cachedOpenEventHref;
}
