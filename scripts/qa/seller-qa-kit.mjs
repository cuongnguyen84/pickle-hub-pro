// ============================================================================
// Shared browser checks for the Seller Center route QA scripts.
// ----------------------------------------------------------------------------
// seller-settings-qa.mjs asked these questions first. seller-products-qa.mjs
// asks the same ones of three more routes, so they live here once instead of
// being copied and drifting — the copy that drifts is always the one that stops
// catching things.
//
// Every check returns findings; nothing here exits the process. The caller
// decides what a finding means for its own route.
// ============================================================================

import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";

export const API = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
export const ANON =
  process.env.SUPABASE_LOCAL_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const SERVICE =
  process.env.SUPABASE_LOCAL_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/** supabase-js derives this from the API host's first label. */
export const STORAGE_KEY = `sb-${new URL(API).hostname.split(".")[0]}-auth-token`;

export const WIDTHS = [320, 375, 414, 768, 1440];

export const adminClient = () => createClient(API, SERVICE, { auth: { persistSession: false } });

const MEDIA_BUCKETS = ["shop-product-media-draft", "shop-product-media"];

/**
 * Delete every object a shop owns, in both buckets.
 *
 * Deleting the shop row cascades the media ROWS. It does not delete BYTES —
 * only the worker does that, and the worker is not running in a QA run. So a
 * teardown that only removes rows leaves the objects behind, which is exactly
 * what happened: ten of them, after the run reported success.
 *
 * Recursive because the paths are `<shop>/<product>/<media>/original` for
 * product media and `<shop>/profile/<purpose>/<id>/v<n>/original` for logo and
 * cover, and Storage `list` is one level at a time.
 */
export async function removeShopObjects(admin, shopId) {
  const removed = [];
  for (const bucket of MEDIA_BUCKETS) {
    const walk = async (prefix) => {
      const { data } = await admin.storage.from(bucket).list(prefix, { limit: 100 });
      for (const entry of data ?? []) {
        const path = `${prefix}/${entry.name}`;
        // A folder has no id in the Storage listing; a real object does.
        if (entry.id === null) await walk(path);
        else {
          await admin.storage.from(bucket).remove([path]);
          removed.push(`${bucket}/${path}`);
        }
      }
    };
    await walk(shopId);
  }
  return removed;
}

/** What is still there afterwards. The teardown asserts on this rather than
 *  trusting the deletes it just issued. */
export async function remainingShopObjects(admin, shopId) {
  const left = [];
  for (const bucket of MEDIA_BUCKETS) {
    const walk = async (prefix) => {
      const { data } = await admin.storage.from(bucket).list(prefix, { limit: 100 });
      for (const entry of data ?? []) {
        const path = `${prefix}/${entry.name}`;
        if (entry.id === null) await walk(path);
        else left.push(`${bucket}/${path}`);
      }
    };
    await walk(shopId);
  }
  return left;
}
export const anonClient = () => createClient(API, ANON, { auth: { persistSession: false } });

/** A signed-in browser context, with the app's own language/theme keys set. */
export const signedInContext = async (browser, appOrigin, session) =>
  browser.newContext({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: appOrigin,
          localStorage: [
            { name: "pickleball-hub-language", value: "vi" },
            { name: "tl-theme-mode", value: "dark" },
            { name: STORAGE_KEY, value: JSON.stringify(session) },
          ],
        },
      ],
    },
  });

/** Right edges past the scroller's box, skipping deliberately scrollable ancestors. */
export const overflowOf = (page) =>
  page.evaluate(() => {
    const scroller = document.querySelector(".tl-shop-scroll") ?? document.scrollingElement;
    const box = scroller.getBoundingClientRect();
    let worst = 0;
    for (const el of document.querySelectorAll("body *")) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      let scrollableAncestor = false;
      for (let p = el.parentElement; p && p !== scroller; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowX === "auto" || s.overflowX === "scroll") {
          scrollableAncestor = true;
          break;
        }
      }
      if (scrollableAncestor) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      worst = Math.max(worst, Math.round(r.right - box.right));
    }
    return worst;
  });

export const smallTargets = (page) =>
  page.evaluate(() => {
    const bad = [];
    // tabindex="-1" is a programmatic focus target (route announcer, skip-link
    // landing), not something a thumb ever hits.
    for (const el of document.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )) {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || el.hasAttribute("disabled")) continue;
      let r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // A skip link is 1×1 until it is focused, by design.
      if (String(el.className).includes("sr-only") || (s.position === "absolute" && r.width <= 2)) continue;
      // A checkbox inside its own label is not the target — the label is.
      const label = el.closest("label");
      if (label && (el.tagName === "INPUT" || el.tagName === "SELECT")) r = label.getBoundingClientRect();
      if (r.height < 44 || r.width < 44) {
        bad.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    }
    return bad;
  });

/**
 * WCAG 1.4.4, measured rather than assumed.
 *
 * Two halves, and both have to hold: the page must not forbid zoom, and no
 * text-entry control may render below 16px — because a sub-16px control is what
 * makes iOS zoom on focus, which is the reason the cap was there in the first
 * place. Passing one and failing the other is how this regresses quietly.
 *
 * Only meaningful below 1024px: the floor in index.css is scoped to touch-sized
 * viewports on purpose, and desktop never focus-zooms.
 */
export const zoomAndFontFindings = async (page, width) => {
  const found = [];

  const viewport = await page.evaluate(
    () => document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "",
  );
  if (/maximum-scale/i.test(viewport)) found.push(`ZOOM viewport vẫn có maximum-scale: "${viewport}"`);
  if (/user-scalable\s*=\s*(no|0)/i.test(viewport)) found.push(`ZOOM viewport vẫn có user-scalable=no`);

  if (width > 1024) return found;

  const small = await page.evaluate(() => {
    const out = [];
    const exempt = new Set(["checkbox", "radio", "range", "color", "file", "hidden", "submit", "button", "image", "reset"]);
    for (const el of document.querySelectorAll("input, select, textarea")) {
      if (el.tagName === "INPUT" && exempt.has((el.getAttribute("type") ?? "text").toLowerCase())) continue;
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") continue;
      const px = parseFloat(s.fontSize);
      if (px < 16) {
        out.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} ${px}px`);
      }
    }
    return out;
  });
  if (small.length) found.push(`ZOOM ô nhập dưới 16px (iOS sẽ tự phóng khi focus): ${small.join(", ")}`);

  return found;
};

/** <main>, exactly one h1, no skipped heading level, every section labelled. */
export const structureFindings = async (page) => {
  const found = [];
  if ((await page.locator("main").count()) === 0) found.push("A11Y thiếu <main>");

  const levels = await page.evaluate(() =>
    [...document.querySelectorAll("h1,h2,h3")].map((h) => Number(h.tagName[1])),
  );
  const h1s = levels.filter((l) => l === 1).length;
  if (h1s !== 1) found.push(`A11Y có ${h1s} thẻ h1`);
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) found.push(`A11Y nhảy cấp tiêu đề h${levels[i - 1]} → h${levels[i]}`);
  }

  const unlabelled = await page.evaluate(
    () => [...document.querySelectorAll("main section")].filter((s) => !s.getAttribute("aria-labelledby")).length,
  );
  if (unlabelled > 0) found.push(`A11Y ${unlabelled} <section> không có aria-labelledby`);

  return found;
};

/**
 * axe, with nothing exempted.
 *
 * There used to be a KNOWN_SITEWIDE allowance here for `meta-viewport`, because
 * index.html capped zoom for the whole product and no single route could fix
 * it. It is fixed, so the allowance is gone — a re-introduced cap now reds the
 * gate instead of printing a warning nobody reads.
 */
export const axeFindings = async (page) => {
  const found = [];
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  for (const v of axe.violations) found.push(`A11Y ${v.id} (${v.nodes.length} node): ${v.help}`);
  for (const v of axe.incomplete) found.push(`A11Y? ${v.id} cần xem tay (${v.nodes.length} node)`);
  return found;
};

/** The first Tab must land somewhere visible, with a ring. */
export const keyboardFindings = async (page) => {
  await page.keyboard.press("Tab");
  const ok = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    return getComputedStyle(el).outlineStyle !== "none" || el.matches(":focus-visible");
  });
  return ok ? [] : ["A11Y phím Tab đầu tiên không thấy viền focus"];
};

/** Every width, all the per-width checks, one array of findings. */
export const sweepWidths = async (page, label = "Q01") => {
  const found = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(250);

    const ov = await overflowOf(page);
    if (ov > 1) found.push(`${label} @${width}px tràn ngang ${ov}px`);

    const scrollable = await page.evaluate(() => {
      const s = document.querySelector(".tl-shop-scroll");
      return s ? s.scrollHeight > s.clientHeight + 4 : false;
    });
    if (width <= 414 && !scrollable) found.push(`${label} @${width}px trang không cuộn được`);

    const small = await smallTargets(page);
    if (small.length) found.push(`${label} @${width}px vùng chạm nhỏ hơn 44px: ${small.join(", ")}`);

    found.push(...(await zoomAndFontFindings(page, width)));
  }
  return found;
};
