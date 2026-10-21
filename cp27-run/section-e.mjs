#!/usr/bin/env node
/**
 * CP27 section E — responsive and accessibility, on routes that have data.
 *
 * The earlier sweep was 24/24 clean on an empty catalogue, which proved the
 * shell and nothing else. This one runs after the fixture exists, so a product
 * grid, a multi-variant PDP, a shop page and the seller/admin editors are all
 * really rendered.
 *
 * The per-width checks are the ones the repo already has
 * (`scripts/qa/seller-qa-kit.mjs`): axe with nothing exempted, overflow past
 * the scroller, sub-44px touch targets, zoom/font-size, heading structure and
 * the first Tab. Reusing them rather than inventing a second, weaker set.
 */
import { readFileSync } from "node:fs";
import { launch, close, actor, assertIdentity } from "./browser.mjs";
import { record, summary } from "./lib.mjs";
import {
  axeFindings, keyboardFindings, overflowOf, smallTargets, structureFindings, zoomAndFontFindings,
} from "../scripts/qa/seller-qa-kit.mjs";
import { VIEWPORTS } from "../scripts/qa/p2b-routes.mjs";

const state = JSON.parse(readFileSync(process.env.CP27_STATE ?? "/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/state.json", "utf8"));

// Two controls, because a control that does not exercise the same shell is not
// a control: /tools carries TheLineLayout (with the back button that made the
// header too wide at 320px in P2b.4) and /admin/users carries AdminLayout.
// Anything they report too is the site's, not the Shop's — and the first run of
// this sweep, with no control at all, blamed the Shop for 20 sub-44px targets
// that are in the site header and footer.
const ROUTES = [
  { key: "/tools", who: "anon", control: true },
  { key: "/admin/users", who: "admin", aal2: true, control: true },
  { key: "/shop", who: "anon", data: /CP27/i },
  { key: "/shop/search?q=CP27", who: "anon", data: /CP27/i },
  { key: "/shop/category/vot", who: "anon", data: /CP27/i },
  { key: `/shop/product/${state.productSlug}`, who: "anon", data: /CP27/i },
  { key: `/shop/store/${state.shopSlug}`, who: "anon", data: /CP27/i },
  { key: "/seller/settings", who: "seller" },
  { key: `/seller/products/${state.productId}/edit`, who: "seller" },
  { key: "/seller/products", who: "seller" },
  { key: "/admin/shop/applications", who: "admin", aal2: true },
  { key: "/admin/shop/products", who: "admin", aal2: true },
  { key: "/admin/shop/contacts", who: "admin", aal2: true },
];

await launch();
const findings = [];
const dataSeen = [];

for (const route of ROUTES) {
  const a = await actor(route.who, { aal2: route.aal2 ?? false, viewport: { width: 1440, height: 900 } });
  await assertIdentity(a);
  await a.goto(route.key);
  await a.page.waitForTimeout(3500);
  // Fonts before geometry. Text in the fallback face measures differently from
  // the same text in the real one, and a control that reports "13px" cancels
  // nothing against a route that reports "14px".
  await a.page.evaluate(() => document.fonts.ready);

  const body = await a.page.locator("body").innerText();
  if (route.data) dataSeen.push({ route: route.key, real: route.data.test(body) });
  const note = (msg) => findings.push({ route: route.key, control: !!route.control, msg });

  // Seller and admin surfaces must not carry the buyer's bottom navigation,
  // and nothing may sit on top of a primary action.
  const chrome = await a.page.evaluate(() => {
    // The BUYER's bar, by the label its own component sets. Matching on
    // "Điều hướng" caught the seller channel's own nav ("Điều hướng Kênh người
    // bán") and reported three false defects.
    const bottomNav = document.querySelector('nav[aria-label="Primary mobile navigation"]');
    const fab = [...document.querySelectorAll("button, a")].find((e) => /chat|nhắn tin/i.test(e.getAttribute("aria-label") ?? ""));
    let covered = null;
    if (fab) {
      const f = fab.getBoundingClientRect();
      for (const el of document.querySelectorAll("button, a")) {
        if (el === fab) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 80 || r.height < 32) continue;
        const overlap = Math.max(0, Math.min(f.right, r.right) - Math.max(f.left, r.left))
          * Math.max(0, Math.min(f.bottom, r.bottom) - Math.max(f.top, r.top));
        if (overlap > 0.3 * r.width * r.height) covered = (el.innerText || el.getAttribute("aria-label") || el.tagName).slice(0, 40);
      }
    }
    return { bottomNav: !!bottomNav, fab: !!fab, covered };
  });
  if (/^\/(seller|admin)/.test(route.key) && !route.control && chrome.bottomNav) note("buyer BottomNav on a seller/admin surface");
  if (chrome.covered) note(`chat button covers "${chrome.covered}"`);

  for (const width of VIEWPORTS) {
    await a.page.setViewportSize({ width, height: 900 });
    await a.page.waitForTimeout(400);

    const innerWidth = await a.page.evaluate(() => window.innerWidth);
    if (innerWidth !== width) note(`@${width} window.innerWidth is ${innerWidth}`);

    const overflow = await overflowOf(a.page);
    if (overflow > 0) note(`@${width} overflows the scroller by ${overflow}px`);

    // Each offending control on its own line, so a header link the control also
    // reports cancels out instead of hiding inside a count.
    for (const t of await smallTargets(a.page)) note(`@${width} target under 44px: ${t}`);

    for (const f of await zoomAndFontFindings(a.page, width)) note(`@${width} ${f}`);
    for (const f of await axeFindings(a.page)) note(`@${width} ${f}`);
    if (width === 390) {
      for (const f of await structureFindings(a.page)) note(`@${width} ${f}`);
      for (const f of await keyboardFindings(a.page)) note(`@${width} ${f}`);
    }
  }
  await a.ctx.close();
  console.log(`  swept ${route.key}`);
}

await close();

const withoutData = dataSeen.filter((d) => !d.real);
record("E-data", "buyer surfaces really rendered fixture data, not an empty state",
  dataSeen.length > 0 && withoutData.length === 0 ? "PASS" : "FAIL",
  dataSeen.map((d) => `${d.route}${d.real ? "" : " ⚠no CP27 data"}`).join(" · "));

// Subtract the shell: anything a control reports at the same width is the
// site's, not the Shop's.
const controlMsgs = new Set(findings.filter((f) => f.control).map((f) => f.msg));
const shell = findings.filter((f) => !f.control && controlMsgs.has(f.msg));
const mine = findings.filter((f) => !f.control && !controlMsgs.has(f.msg));
const shopRoutes = ROUTES.filter((r) => !r.control).length;

record("E-sweep", `${shopRoutes} Shop routes × ${VIEWPORTS.length} widths against 2 shell controls`,
  mine.length === 0 ? "PASS" : "FAIL",
  mine.length
    ? `${new Set(mine.map((f) => `${f.route} ${f.msg}`)).size} Shop finding(s), ${new Set(shell.map((f) => f.msg)).size} shell type(s) subtracted:\n       - ${[...new Set(mine.map((f) => `${f.route} ${f.msg}`))].slice(0, 30).join("\n       - ")}`
    : `${shopRoutes * VIEWPORTS.length} combinations clean; ${new Set(shell.map((f) => f.msg)).size} finding type(s) also present on /tools or /admin/users and therefore site-wide`);

process.exit(summary() ? 1 : 0);
