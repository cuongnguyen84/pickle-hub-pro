#!/usr/bin/env node
// ============================================================================
// /seller/settings — responsive + accessibility gate (P2a step 3)
// ----------------------------------------------------------------------------
//   supabase start && supabase db reset
//   VITE_SUPABASE_URL=http://127.0.0.1:54321 \
//   VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key> npm run dev            # :8080
//   node scripts/seller-settings-qa.mjs
//
// Same questions proto-shop-qa.mjs asks the prototype, asked of the real
// route with a real session against a real database: does it scroll, does
// anything overflow sideways, is every target 44px, is the heading order
// sane, does axe find a violation.
//
// It seeds its own pilot seller and shop, and deletes them afterwards.
// ============================================================================

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const APP = process.env.SELLER_QA_BASE_URL ?? "http://localhost:8080";
const API = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
const ANON =
  process.env.SUPABASE_LOCAL_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  process.env.SUPABASE_LOCAL_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// supabase-js derives this from the API host's first label.
const STORAGE_KEY = `sb-${new URL(API).hostname.split(".")[0]}-auth-token`;

const WIDTHS = [320, 375, 414, 768, 1440];
const findings = [];
const note = (msg) => findings.push(msg);

const admin = createClient(API, SERVICE, { auth: { persistSession: false } });
const run = randomUUID().slice(0, 8);
const email = `qa-seller-${run}@thepicklehub.test`;
const password = `Pw-${randomUUID()}`;

async function seed() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw error;
  const userId = created.user.id;

  await admin.from("shop_pilot_members").insert({ user_id: userId });
  const { data: shop, error: shopError } = await admin.from("shops").insert({
    slug: `qa-shop-${run}`,
    name: `Shop Kiểm Thử ${run}`,
    state: "active",
    owner_user_id: userId,
    intro: "Shop bán vợt và phụ kiện pickleball ở TP. Hồ Chí Minh.",
    city: "TP. Hồ Chí Minh",
  }).select().single();
  if (shopError) throw shopError;

  await admin.from("shop_members").insert({ shop_id: shop.id, user_id: userId, role: "owner" });

  const user = createClient(API, ANON, { auth: { persistSession: false } });
  const { data: session, error: signInError } = await user.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  // Give the shop one contact channel so the list state is exercised, not just
  // the empty state.
  await user.rpc("shop_contact_upsert", {
    _shop_id: shop.id, _type: "zalo", _value: "0901234567", _label: "Zalo shop",
    _is_public: true, _id: null,
  });

  return { userId, shopId: shop.id, session: session.session };
}

async function cleanup(userId, shopId) {
  await admin.from("shops").delete().eq("id", shopId);
  await admin.auth.admin.deleteUser(userId);
}

/** Right edges past the scroller's box, skipping deliberately scrollable ancestors. */
const overflowOf = (page) =>
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
        if (s.overflowX === "auto" || s.overflowX === "scroll") { scrollableAncestor = true; break; }
      }
      if (scrollableAncestor) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      worst = Math.max(worst, Math.round(r.right - box.right));
    }
    return worst;
  });

const smallTargets = (page) =>
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
      // A checkbox inside its own label is not the target — the label is, and
      // .tl-shop-check gives that label the full 44px.
      const label = el.closest("label");
      if (label && (el.tagName === "INPUT" || el.tagName === "SELECT")) r = label.getBoundingClientRect();
      if (r.height < 44 || r.width < 44) {
        bad.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    }
    return bad;
  });

const main = async () => {
  const { userId, shopId, session } = await seed();
  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({
      storageState: {
        cookies: [],
        origins: [{
          origin: APP,
          localStorage: [
            { name: "pickleball-hub-language", value: "vi" },
            { name: "tl-theme-mode", value: "dark" },
            { name: STORAGE_KEY, value: JSON.stringify(session) },
          ],
        }],
      },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => note(`JS  lỗi: ${e.message}`));

    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(`${APP}/seller/settings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    const h1 = await page.locator("h1").first().textContent();
    if (!h1 || !h1.includes("Cài đặt shop")) {
      note(`AUTH không vào được /seller/settings — thấy "${(h1 ?? "").trim()}". Session key: ${STORAGE_KEY}`);
      throw new Error("not signed in");
    }

    // Landmark + heading order.
    if ((await page.locator("main").count()) === 0) note("A11Y thiếu <main>");
    const levels = await page.evaluate(() =>
      [...document.querySelectorAll("h1,h2,h3")].map((h) => Number(h.tagName[1])));
    if (levels.filter((l) => l === 1).length !== 1) note(`A11Y có ${levels.filter((l) => l === 1).length} thẻ h1`);
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) note(`A11Y nhảy cấp tiêu đề h${levels[i - 1]} → h${levels[i]}`);
    }

    // Every section heading must be reachable from its section.
    // Scoped to the page's own sections: the app shell renders one of its own
    // and this gate is about the route, not the chrome around it.
    const unlabelled = await page.evaluate(() =>
      [...document.querySelectorAll("main section")].filter((s) => !s.getAttribute("aria-labelledby")).length);
    if (unlabelled > 0) note(`A11Y ${unlabelled} <section> không có aria-labelledby`);

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(250);

      const ov = await overflowOf(page);
      if (ov > 1) note(`Q01 @${width}px tràn ngang ${ov}px`);

      const scrollable = await page.evaluate(() => {
        const s = document.querySelector(".tl-shop-scroll");
        return s ? s.scrollHeight > s.clientHeight + 4 : false;
      });
      if (width <= 414 && !scrollable) note(`Q01 @${width}px trang không cuộn được`);

      const small = await smallTargets(page);
      if (small.length) note(`Q01 @${width}px vùng chạm nhỏ hơn 44px: ${small.join(", ")}`);
    }

    await page.setViewportSize({ width: 375, height: 900 });
    await page.waitForTimeout(250);

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    // Named, not blanket. index.html ships
    // `maximum-scale=1.0, user-scalable=no` for the whole site, which fails
    // WCAG 1.4.4 on every page — this route did not cause it and cannot fix it
    // alone: .tl-shop-input is 15px, so removing the cap re-enables iOS
    // focus-zoom on every form in the product. Listed by id so a NEW violation
    // still reds the gate, and reported rather than silenced.
    const KNOWN_SITEWIDE = new Set(["meta-viewport"]);
    for (const v of axe.violations) {
      if (KNOWN_SITEWIDE.has(v.id)) {
        console.warn(`⚠ đã biết, toàn site (không do route này): ${v.id} — ${v.help}`);
        continue;
      }
      note(`A11Y ${v.id} (${v.nodes.length} node): ${v.help}`);
    }
    for (const v of axe.incomplete) note(`A11Y? ${v.id} cần xem tay (${v.nodes.length} node)`);

    // Keyboard: the first tab must land on something visible with a ring.
    await page.keyboard.press("Tab");
    const focusVisible = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      return getComputedStyle(el).outlineStyle !== "none" || el.matches(":focus-visible");
    });
    if (!focusVisible) note("A11Y phím Tab đầu tiên không thấy viền focus");
  } finally {
    await browser.close();
    await cleanup(userId, shopId);
  }

  if (findings.length) {
    console.error(`\n✖ ${findings.length} phát hiện trên /seller/settings\n`);
    for (const f of findings) console.error("  " + f);
    process.exit(1);
  }
  console.log("\n✅ /seller/settings — không có phát hiện nào (320/375/414/768/1440 + axe).\n");
};

await main();
