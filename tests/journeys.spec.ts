// ============================================================================
// QA-04 inc4 — E2E coverage for the ten critical user journeys.
// ----------------------------------------------------------------------------
// Runs against prod (main) or the PR preview — both share the PRODUCTION
// database, so every journey here is NON-MUTATING: registration journeys stop
// at the last screen BEFORE the write (the OTP-submit / member-confirm click),
// and the organizer journey exercises the UX-04 draft autosave, which is
// localStorage-only by design. The one deliberate localStorage write is
// cleaned up via the wizard's own "Start over" affordance.
//
// Journey map (J5/J6 need PLAYWRIGHT_ORGANIZER_CLUB_SLUG, see skip reasons):
//   J1  player: discover event → detail (EN + VI twin)
//   J2  player: open registration modal → identity step (anon, phone/OTP)
//   J3  player: authed viewer sees identity OR member-confirm step
//   J4  auth: header sign-in preserves ?redirect (postLoginRedirect surface)
//   J5  organizer: wizard draft autosave + restore-on-reload (UX-04)
//   J6  organizer: pre-publish validation panel jumps to the missing field
//   J7  tournaments: Community default tab → deep-link into a bracket
//   J8  rankings: URL-backed scope state → player public profile
//   J9  feed: Trending → news article
//   J10 connected player: home log-match CTA → /match/new form
//
// Single-worker sequential (playwright.config.ts): discovery walks live pages
// and caches at module scope, exactly like the a11y project.
// ============================================================================

import { test, expect, type Page } from "@playwright/test";
import {
  discoverEventHref,
  discoverOpenEventHref,
  OPEN_CTA,
} from "./helpers/discover";

// Mint-env check duplicated from helpers/supabase-admin on purpose: that
// helper chain fails to LOAD under node 24 locally, so we must decide skips
// BEFORE importing it (same convention as a11y.spec.ts O2). On CI the
// auth-setup dependency already fails HARD when the env is missing, so a
// soft check here cannot silently disable the suite there.
const hasMintEnv = Boolean(
  process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY),
);

const MODAL_TITLE = /register for event|đăng ký sự kiện/i;

/** Open the registration modal on an open event and wait for the dialog. */
async function openRegistrationModal(page: Page): Promise<void> {
  const cta = page.getByRole("button", { name: OPEN_CTA }).first();
  await expect(cta).toBeEnabled();
  await cta.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("dialog")).toContainText(MODAL_TITLE);
}

// ── J1 — player discovers an event and lands on its detail page ─────────────

test("J1 player: event discovery lands on a rendering detail page (EN + VI)", async ({
  page,
}) => {
  test.setTimeout(90_000); // discovery may walk several club pages
  const href = await discoverEventHref(page);
  test.skip(!href, "No social event reachable from /social or club landings");

  await page.goto(href!, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
  // Some register surface must exist in EVERY event state: the CTA button
  // (open/full/ended/cancelled all render as a button) or, for a device that
  // already registered, the "view your registration" link.
  const ctaButton = page.getByRole("button", {
    name: /register now|đăng ký ngay|sold out|hết chỗ|ended|đã kết thúc|in progress|đang diễn ra|cancelled|đã hủy/i,
  });
  const registeredLink = page.locator('a[href^="/dang-ky/"]');
  expect(
    (await ctaButton.count()) + (await registeredLink.count()),
    "expected a register CTA or registration link on event detail",
  ).toBeGreaterThan(0);
  expect(await page.title()).not.toMatch(/undefined/i);

  // VI twin of the same event must render localized (ARCH-05 mirror).
  await page.goto(`/vi${href}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
  expect(new URL(page.url()).pathname).toBe(`/vi${href}`);
});

// ── J2 — anonymous registration: identity step, stop before OTP ─────────────

test("J2 player: registration modal opens to the identity step (no submit)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const href = await discoverOpenEventHref(page);
  test.skip(!href, "No event with open registration right now (prod state)");

  await page.goto(href!, { waitUntil: "domcontentloaded" });
  await openRegistrationModal(page);

  // Anonymous path = phone + display name, then "Send OTP". We assert the
  // step is fully interactive and STOP — sending an OTP costs a real SMS/Zalo
  // message and submitting would create a real registration.
  await expect(page.locator("#ev-phone")).toBeVisible();
  await expect(page.locator("#ev-name")).toBeVisible();
  const sendOtp = page.getByRole("button", { name: /send otp|gửi mã otp/i });
  await expect(sendOtp).toBeVisible();
  await expect(sendOtp, "empty form must not allow OTP send").toBeDisabled();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

// ── J3 — authed viewer registration path ────────────────────────────────────

test("J3 player: authed viewer gets identity or member-confirm step", async ({
  page,
}) => {
  test.skip(!hasMintEnv, "Auth env not set — local run without secrets");
  test.setTimeout(90_000);
  const href = await discoverOpenEventHref(page);
  test.skip(!href, "No event with open registration right now (prod state)");

  const { loginAs } = await import("./helpers/auth");
  await loginAs(page, "viewer", href!);
  await openRegistrationModal(page);

  // A logged-in club member gets the skip-OTP confirm step; everyone else
  // gets the phone step. Either is a correct journey — a crash/blank modal
  // is not. DO NOT click the member confirm: it registers immediately.
  const phoneInput = page.locator("#ev-phone");
  const memberConfirm = page.getByRole("button", {
    name: /confirm registration|xác nhận đăng ký/i,
  });
  await expect(phoneInput.or(memberConfirm).first()).toBeVisible({
    timeout: 5_000,
  });

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

// ── J4 — header sign-in preserves the return path ────────────────────────────

test("J4 auth: header sign-in link carries ?redirect back to the page", async ({
  page,
}) => {
  await page.goto("/tournaments", { waitUntil: "domcontentloaded" });
  const signIn = page
    .getByRole("link", { name: /sign in|log in|đăng nhập/i })
    .first();
  await expect(signIn).toBeVisible({ timeout: 10_000 });
  await signIn.click();
  await page.waitForURL(/\/login\?/, { timeout: 10_000 });
  const redirect = new URL(page.url()).searchParams.get("redirect");
  expect(redirect, "login URL must carry the origin page").toBe("/tournaments");
});

// ── J5/J6 — organizer wizard (needs a club the admin test user manages) ─────

const clubSlug = process.env.PLAYWRIGHT_ORGANIZER_CLUB_SLUG;
const organizerSkip = !hasMintEnv || !clubSlug;
const ORGANIZER_SKIP_REASON =
  "needs mint env + PLAYWRIGHT_ORGANIZER_CLUB_SLUG (a club the admin user manages)";

test("J5 organizer: wizard drafts autosave locally and restore on reload", async ({
  page,
}) => {
  test.skip(organizerSkip, ORGANIZER_SKIP_REASON);
  test.setTimeout(60_000);

  const { loginAs } = await import("./helpers/auth");
  await loginAs(page, "admin", `/clb/${clubSlug}/social/moi`);
  const nameInput = page.locator("#ev-name");
  await expect(nameInput).toBeVisible({ timeout: 15_000 });

  await nameInput.fill("E2E draft — do not publish");
  // useAutosaveDraft debounces 750ms, then DraftSaveStatus renders
  // "Saved on this device at HH:MM" / "Đã lưu trên thiết bị lúc HH:MM".
  await expect(
    page.getByText(/saved on this device at|đã lưu trên thiết bị lúc/i),
  ).toBeVisible({ timeout: 10_000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByText(/draft restored on this device|đã khôi phục bản nháp/i),
    "reload must offer the restored draft",
  ).toBeVisible({ timeout: 15_000 });
  await expect(nameInput).toHaveValue("E2E draft — do not publish");

  // Cleanup: the wizard's own "Start over" clears the localStorage draft.
  await page.getByRole("button", { name: /start over|bắt đầu lại/i }).click();
  await expect(nameInput).toHaveValue("");
});

test("J6 organizer: validation panel lists missing fields and jumps to one", async ({
  page,
}) => {
  test.skip(organizerSkip, ORGANIZER_SKIP_REASON);
  test.setTimeout(60_000);

  const { loginAs } = await import("./helpers/auth");
  await loginAs(page, "admin", `/clb/${clubSlug}/social/moi`);
  await expect(page.locator("#ev-name")).toBeVisible({ timeout: 15_000 });

  // Empty form → the UX-05 panel explains WHY "Next" is greyed out:
  // role=alert + one button per missing field that focuses it on click.
  const panel = page.getByRole("alert").filter({
    hasText: /before publishing|trước khi đăng/i,
  });
  await expect(panel).toBeVisible({ timeout: 10_000 });

  const jump = panel.getByRole("button").first();
  await expect(jump).toBeVisible();
  await jump.click();
  // jumpToField moves real focus to the named field (an input or textarea).
  await expect(
    page.locator("input:focus, textarea:focus, select:focus, [contenteditable]:focus"),
    "jump-to-field must move focus into the form",
  ).toHaveCount(1);
});

// ── J7 — tournament discovery ────────────────────────────────────────────────

test("J7 tournaments: Community is the default tab and brackets deep-link", async ({
  page,
}) => {
  await page.goto("/tournaments", { waitUntil: "domcontentloaded" });

  // UX-07 regression: the default tab is Community, never the dead
  // hasWatchContent branch. Community cards link into /tools/*.
  const communityCard = page.locator('a[href^="/tools/"]').first();
  await expect(communityCard).toBeVisible({ timeout: 15_000 });

  // Tab state is URL-backed (?tab=) — switching must write the URL.
  await page.getByRole("button", { name: /watch|xem pro/i }).first().click();
  await expect(page).toHaveURL(/tab=watch/);
  await page.getByRole("button", { name: /community|cộng đồng/i }).first().click();
  await expect(page).toHaveURL(/tab=community/);

  const bracketHref = await page
    .locator('a[href^="/tools/"]')
    .first()
    .getAttribute("href");
  await page.goto(bracketHref!, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible();
  expect(await page.title()).not.toMatch(/undefined/i);
  expect(new URL(page.url()).pathname).toContain("/tools/");
});

// ── J8 — rankings URL state → player profile ─────────────────────────────────

test("J8 rankings: deep-linked scope holds, switching writes URL, row opens profile", async ({
  page,
}) => {
  await page.goto("/rankings?scope=asia&format=mens-doubles", {
    waitUntil: "domcontentloaded",
  });
  // UX-08: scope/format live in the URL; a deep link must land selected.
  await expect(page.locator(".tl-rank-scope.active").first()).toContainText(
    /asia|châu á/i,
    { timeout: 15_000 },
  );

  await page
    .locator(".tl-rank-scope", { hasText: /vietnam|việt nam/i })
    .first()
    .click();
  await expect(page).toHaveURL(/scope=vietnam/);

  const playerLink = page.locator('a[href^="/nguoi-choi/"]').first();
  await playerLink.waitFor({ state: "visible", timeout: 15_000 });
  await playerLink.click();
  await page.waitForURL(/\/nguoi-choi\//, { timeout: 10_000 });
  expect(page.url()).not.toMatch(/\/login/);
  await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  expect(await page.title()).not.toMatch(/undefined/i);
});

// ── J9 — feed trending → news article ───────────────────────────────────────

test("J9 feed: anonymous Trending surfaces news and the article renders", async ({
  page,
}) => {
  await page.goto("/feed", { waitUntil: "domcontentloaded" });
  // Anonymous default is Trending (feed-tab-logic) — the real tablist.
  await expect(
    page.getByRole("tab", { name: /trending|thịnh hành/i }),
  ).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });

  const newsCard = page.locator('a[role="article"][href^="/news/"]').first();
  try {
    await newsCard.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    test.skip(true, "No news card in Trending right now (prod state)");
  }
  const href = await newsCard.getAttribute("href");
  // Navigate by href instead of clicking: feed cards animate/shift while
  // media loads, so the card is rarely "stable" for Playwright's click —
  // the journey under test is feed-surfaces-news → article-renders, not
  // pointer mechanics on a moving card. One retry: prod intermittently
  // aborts the first navigation (net::ERR_ABORTED) when the feed still has
  // requests in flight.
  await page
    .goto(href!, { waitUntil: "domcontentloaded" })
    .catch(() => page.goto(href!, { waitUntil: "domcontentloaded" }));
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
  expect(await page.title()).not.toMatch(/undefined/i);
});

// ── J10 — connected player logs a match from the home CTA ───────────────────

test("J10 connected player: home log-match CTA reaches the /match/new form", async ({
  page,
}) => {
  test.skip(!hasMintEnv, "Auth env not set — local run without secrets");
  const { loginAs } = await import("./helpers/auth");
  await loginAs(page, "viewerConnected", "/");

  // Home renders the log-match affordance in one of two surfaces (the DUPR
  // partnership banner's "Log match" link, or HomeLogMatchCTA's
  // "+ Log a match" once useDuprConnection resolves). The journey is about
  // the DESTINATION, not which variant won the layout — anchor on the href.
  const logMatch = page.locator('a[href="/match/new"]').first();
  await expect(logMatch).toBeVisible({ timeout: 15_000 });
  await logMatch.click();
  await page.waitForURL(/\/match\/new/, { timeout: 10_000 });
  expect(page.url(), "RequireAuth must not bounce a connected user").not.toMatch(
    /\/login/,
  );
  // The form shell is interactive: at least one input/button in the routed
  // content. The public shell has no <main> element — the landmark is the
  // #main-content div (App.tsx).
  await expect(
    page
      .locator("#main-content input, #main-content button, #main-content form")
      .first(),
  ).toBeVisible({ timeout: 15_000 });
  expect(await page.title()).not.toMatch(/undefined/i);
});
