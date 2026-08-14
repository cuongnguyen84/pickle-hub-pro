// ============================================================================
// P2b.7 — unified Shop acceptance QA.
// ----------------------------------------------------------------------------
//   npx supabase start && npx supabase db reset
//   VITE_SUPABASE_URL=http://127.0.0.1:54321 \
//   VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key> npm run dev          # :8080
//   node scripts/shop-p2b-acceptance-qa.mjs
//
// One seed, one browser, one teardown, one exit code. Everything the four
// checkpoint gates checked separately, plus the thing none of them could:
// whether the pieces are actually WIRED to each other.
//
// Three properties this file is built around, each of them a bug this branch
// shipped and then caught:
//
//   · A route is not covered by rendering its shell. It needs its own heading,
//     a marker from its body, AND — where the fixture provides data — proof
//     that the data arrived. The admin gate once passed on an MFA error page.
//
//   · The control route must exercise the same shell. /clubs has no back
//     button; /tools does, and the back button was the header overflow. A
//     mismatched control blamed the Shop for a site-wide bug.
//
//   · Teardown is asserted by COUNTING, not by having issued the deletes. Two
//     green runs in a row deleted nothing.
//
// Exit code is 1 on any finding, including a dirty teardown.
// ============================================================================

import { chromium } from "playwright";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  ANON, API, STORAGE_KEY, adminClient,
  axeFindings, keyboardFindings, overflowOf, smallTargets,
  structureFindings, zoomAndFontFindings,
} from "./qa/seller-qa-kit.mjs";
import { SHOP_ROUTES, VIEWPORTS } from "./qa/p2b-routes.mjs";
import { newRegistry, seedP2bAcceptance, teardownP2bAcceptance, PASSWORD } from "./qa/p2b-seed.mjs";

const APP = process.env.SHOP_QA_BASE_URL ?? "http://localhost:8080";
const SHOT_DIR = process.env.SHOP_QA_SHOT_DIR ?? mkdtempSync(join(tmpdir(), "tph-p2b7-"));
const JOURNEY_WIDTH = 390;
/** Set to skip the 6-viewport sweep while iterating on the journeys. */
const ONLY = process.env.SHOP_QA_ONLY ?? "";

const findings = [];
const note = (where, msg) => findings.push(`${where}: ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);

// ── Things that must never reach a buyer, in the DOM or on the wire ─────────
// Every entry is a real column, path shape or secret that P2b.3 made
// seller-only or that moderation keeps private.
const BUYER_FORBIDDEN = [
  "rendition_source_path",
  "draft_path",
  "shop-product-media-draft",
  "/original",
  "token=",
  "/object/sign/",
  "internal_note",
  "client_token",
  "cleanup_job",
  "NOTE-NOI-BO-KHONG-DUOC-LO",   // the rejected contact's internal note
  "0987654321",                   // the PENDING contact's number
  "https://m.me/shopqa",          // the REJECTED contact's destination
  "@thepicklehub.test",           // any seller account address
];

/**
 * Value-aware, for the fields whose NAME is allowed to reach a buyer and whose
 * VALUE is not.
 *
 * `product_public_projection` emits `"stock_on_hand": null` on the buyer path —
 * the wrapper hardcodes `_as_seller = false`, so the key is a shape and the
 * quantity is withheld. Forbidding the string caught that null and read as a
 * leak; forbidding a NUMBER catches the leak and not the shape. If the flag
 * were ever flipped on a public wrapper, this is what goes red.
 */
const BUYER_FORBIDDEN_VALUES = [
  [/"stock_on_hand"\s*:\s*-?\d/, "a real stock quantity"],
  [/"internal_note"\s*:\s*"[^"]/, "a moderator's internal note"],
  [/"value_raw"\s*:\s*"[^"]/, "a contact's raw, unnormalised value"],
];

// P2b has no cart and no saved list. A button for either is a dead end.
const BUYER_ABSENT = ["Thêm vào giỏ", "Lưu sản phẩm", "Yêu thích", "Nhắn tin nội bộ", "Chat với shop"];

const anonClient = () => createClient(API, ANON, { auth: { persistSession: false } });

// ── Contexts ────────────────────────────────────────────────────────────────

const contextFor = (browser, width, session) =>
  browser.newContext({
    viewport: { width, height: 900 },
    storageState: {
      cookies: [],
      origins: [{
        origin: APP,
        localStorage: [
          { name: "pickleball-hub-language", value: "vi" },
          ...(session ? [{ name: STORAGE_KEY, value: JSON.stringify(session) }] : []),
        ],
      }],
    },
  });

/** Console errors and failed requests, plus every RPC response body. */
function instrument(page, sink) {
  page.on("console", (m) => { if (m.type() === "error") sink.console.push(m.text()); });
  page.on("pageerror", (e) => sink.console.push(`pageerror: ${e.message}`));
  page.on("response", async (r) => {
    const url = r.url();
    if (r.status() >= 400 && !url.includes("/storage/")) {
      sink.failed.push(`${r.status()} ${url.split("/").slice(-1)[0]}`);
    }
    if (url.includes("/rest/v1/")) {
      const body = await r.text().catch(() => "");
      if (body) sink.payloads.push({ url, body });
    }
  });
}

// ── The route sweep (P2b.7.3) ───────────────────────────────────────────────

async function checkRoute(ctx, route, seeded, width) {
  const path = route.path(seeded);
  const page = await ctx.newPage();
  const sink = { console: [], failed: [], payloads: [] };
  instrument(page, sink);
  const at = `${route.key}@${width}`;

  await page.goto(`${APP}${path}`, { waitUntil: "networkidle" });
  // Fonts BEFORE geometry. Text laid out in the fallback face is a different
  // height from the same text in the real one — a footer link measured at 13px
  // on the control and 14px here produces two different finding strings, the
  // control cancels neither, and three shell links are reported as ours. That
  // is what a run of this gate did once and only once, which is the signature
  // of a race rather than a defect.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);

  // Route identity, four ways.
  const landed = new URL(page.url()).pathname;
  const expectedPath = path.split("?")[0];
  if (landed !== expectedPath) {
    note(at, `landed on ${landed}, not ${expectedPath} — redirect or auth gate`);
  }
  const measured = await page.evaluate(() => window.innerWidth);
  if (measured !== width) note(at, `innerWidth is ${measured}, not ${width}`);

  const h1 = (await page.locator("h1").first().textContent().catch(() => "")) ?? "";
  const body = await page.locator("body").innerText().catch(() => "");
  // Form screens put their data in `value`, not in text: the settings page
  // shows the shop's name inside an input, and innerText alone read it as an
  // empty state on a fully seeded run.
  const values = await page.evaluate(() =>
    [...document.querySelectorAll("input, textarea, select")]
      .map((el) => el.value ?? "").filter(Boolean).join(" · "),
  );
  const visible = `${body}\n${values}`;
  if (!route.h1.test(h1)) note(at, `heading is "${h1.trim() || "(none)"}"`);
  if (!route.marker.test(visible)) note(at, "no body marker — shell or error state");
  if (route.data && !route.data.test(visible)) {
    note(at, "no fixture data on screen — empty state on a seeded run");
  }
  if (!(await page.locator("main").count())) note(at, "no <main> landmark");

  // Never an error shell, never a spinner that never resolved, never the MFA
  // wall. Each of these has been mistaken for a passing screen before.
  for (const [re, why] of [
    [/Lỗi xác thực/, "the MFA error screen, not the console"],
    [/mfa_totp_enroll_not_enabled/, "AdminMFAGate blocked"],
    [/Đã có lỗi xảy ra|Không tải được/, "an error state"],
  ]) {
    if (re.test(body)) note(at, `${why}`);
  }
  const spinners = await page.locator('[role="status"][aria-busy="true"], .tl-shop-skeleton').count();
  if (spinners > 0) note(at, `${spinners} loading placeholder(s) still on screen after networkidle`);

  // Geometry.
  const overflow = await overflowOf(page);
  if (overflow > 0) note(at, `${overflow}px past the scroller's right edge`);
  const offLeft = await page.evaluate(() => {
    let worst = 0;
    for (const el of document.querySelectorAll("a[href], button, input, select, textarea")) {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") continue;
      if (String(el.className || "").includes("sr-only")) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      worst = Math.max(worst, Math.round(-r.left));
    }
    return worst;
  });
  if (offLeft > 0) note(at, `a control starts ${offLeft}px off the left edge`);
  for (const f of await smallTargets(page)) note(at, f);
  for (const f of await zoomAndFontFindings(page, width)) note(at, f);

  // Ancestor clipping: a control inside an overflow:hidden box wider than it
  // is has been cut off, and neither overflowOf nor smallTargets sees it —
  // both measure the element's own rect.
  //
  // A deliberately scrollable strip is NOT clipping. The category chips and
  // the application's step rail both live in an `overflow-x: auto` row, so
  // their later items sit outside the viewport by design and the first
  // version of this check reported all of them. The walk stops at the first
  // scrollable ancestor, exactly as overflowOf does.
  const clipped = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll("a[href], button")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowX === "auto" || s.overflowX === "scroll" ||
            s.overflowY === "auto" || s.overflowY === "scroll") break;
        if (s.overflow === "hidden" || s.overflowX === "hidden") {
          const pr = p.getBoundingClientRect();
          if (r.right > pr.right + 1 || r.left < pr.left - 1) {
            bad.push(`${el.tagName.toLowerCase()} clipped by ${p.tagName.toLowerCase()}.${String(p.className).split(" ")[0]}`);
          }
          break;
        }
      }
    }
    return [...new Set(bad)];
  });
  for (const f of clipped) note(at, f);

  if (width === 1440) {
    for (const f of await structureFindings(page)) note(route.key, f);
    for (const f of await axeFindings(page)) note(route.key, f);
    for (const f of await keyboardFindings(page)) note(route.key, f);
  }

  // Global chrome, per audience.
  const chrome = await page.evaluate(() => ({
    bottomNav: !!document.querySelector("[data-bottom-nav], nav[aria-label*='ưới']"),
    chatFab: !!document.querySelector("[data-chat-fab]"),
  }));
  if (!route.audience.startsWith("control")) {
    if (chrome.chatFab) note(at, "ChatFAB is present on a Shop surface");
    if (chrome.bottomNav && route.audience !== "buyer") {
      note(at, `global BottomNav is present on a ${route.audience} route`);
    }
  }

  // Responsive images: every photo must RESERVE its box, or the grid jumps
  // when the photos arrive. The attributes are one way to do that and CSS
  // `aspect-ratio` or a fixed height is another — asserting the attributes
  // alone reported every thumbnail in the media editor, all of which already
  // reserve their box with `aspect-ratio: 1`.
  const unsized = await page.evaluate(() =>
    [...document.querySelectorAll("img")]
      .filter((i) => {
        if (i.closest("svg")) return false;
        if (i.hasAttribute("width") && i.hasAttribute("height")) return false;
        const s = getComputedStyle(i);
        if (s.aspectRatio && s.aspectRatio !== "auto") return false;
        if (s.height && s.height !== "auto" && parseFloat(s.height) > 0) return false;
        return true;
      })
      .map((i) => i.getAttribute("src")?.slice(-40) ?? "(no src)"),
  );
  if (unsized.length) note(at, `${unsized.length} img with no reserved box: ${unsized[0]}`);

  // Leakage, in the DOM and in every REST payload the page received.
  if (route.audience === "buyer") {
    const html = await page.content();
    for (const bad of BUYER_FORBIDDEN) {
      if (html.includes(bad)) note(route.key, `DOM contains "${bad}"`);
    }
    for (const bad of BUYER_ABSENT) {
      if (html.includes(bad)) note(route.key, `DOM offers "${bad}" — P2b has no such behaviour`);
    }
    for (const { url, body } of sink.payloads) {
      const from = url.split("/").slice(-1)[0];
      for (const bad of BUYER_FORBIDDEN) {
        if (body.includes(bad)) note(route.key, `network payload from ${from} contains "${bad}"`);
      }
      for (const [re, why] of BUYER_FORBIDDEN_VALUES) {
        if (re.test(body)) note(route.key, `network payload from ${from} carries ${why}`);
      }
    }
  }

  if (sink.console.length) note(route.key, `console: ${sink.console.slice(0, 2).join(" | ")}`);
  if (sink.failed.length) note(route.key, `failed request: ${sink.failed.slice(0, 2).join(" | ")}`);

  return page;
}

async function routeSweep(browser, seeded) {
  const sessions = {
    control: null,
    "control-admin": seeded.adminSession,
    buyer: null,
    seller: seeded.users.seller.session,
    admin: seeded.adminSession,
  };

  for (const width of VIEWPORTS) {
    const ctxs = {};
    for (const [aud, session] of Object.entries(sessions)) {
      ctxs[aud] = await contextFor(browser, width, session);
    }
    for (const route of SHOP_ROUTES) {
      if (ONLY && !route.key.includes(ONLY)) continue;
      const page = await checkRoute(ctxs[route.audience], route, seeded, width);
      if (width === 375) {
        await page.screenshot({ path: join(SHOT_DIR, `375-${route.key}.png`), fullPage: true }).catch(() => {});
      }
      await page.close();
    }
    for (const c of Object.values(ctxs)) await c.close();
    ok(`${width}px — ${SHOP_ROUTES.length} routes`);
  }
}

/** The /vi twins, once, at one width: the same screen must render there too. */
async function mirroredSweep(browser, seeded) {
  const ctx = await contextFor(browser, JOURNEY_WIDTH, null);
  for (const route of SHOP_ROUTES.filter((r) => r.mirrored)) {
    const page = await ctx.newPage();
    const sink = { console: [], failed: [], payloads: [] };
    instrument(page, sink);
    const path = `/vi${route.path(seeded)}`;
    await page.goto(`${APP}${path}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(700);
    const h1 = (await page.locator("h1").first().textContent().catch(() => "")) ?? "";
    const body = await page.locator("body").innerText().catch(() => "");
    if (!route.h1.test(h1)) note(`vi-${route.key}`, `heading is "${h1.trim() || "(none)"}"`);
    if (!route.marker.test(body)) note(`vi-${route.key}`, "no body marker on the /vi twin");
    if (sink.failed.length) note(`vi-${route.key}`, `failed request: ${sink.failed[0]}`);
    await page.close();
  }
  await ctx.close();
  ok("/vi twins render");
}

// ── Journeys (P2b.7.4) ──────────────────────────────────────────────────────

const gotoAs = async (browser, session, path) => {
  const ctx = await contextFor(browser, JOURNEY_WIDTH, session);
  const page = await ctx.newPage();
  const sink = { console: [], failed: [], payloads: [] };
  instrument(page, sink);
  await page.goto(`${APP}${path}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  return { ctx, page, sink };
};

/** J1 — the application door, and what is behind it. */
async function journeyApplication(browser, seeded) {
  const admin = adminClient();

  // The non-pilot user must be told, not shown a form.
  {
    const { ctx, page } = await gotoAs(browser, seeded.users.nonPilot.session, "/seller/application");
    const body = await page.locator("body").innerText();
    if (!/thử nghiệm kín|chưa mở/i.test(body)) {
      note("J1", `a non-pilot user was not refused: "${body.slice(0, 120).replace(/\n/g, " ")}"`);
    }
    if (await page.locator("input#shop_name, input[name='shop_name']").count()) {
      note("J1", "a non-pilot user was shown the application form");
    }
    await ctx.close();
  }
  ok("J1 non-pilot is refused at the door");

  // Server-side, not just on screen: the RPC itself must refuse.
  {
    const c = anonClient();
    await c.auth.signInWithPassword({ email: seeded.users.nonPilot.email, password: PASSWORD });
    const { error } = await c.rpc("shop_application_submit");
    if (!error) note("J1", "shop_application_submit succeeded for a non-pilot user");
    else if (!/pilot|42501/i.test(`${error.message}${error.code}`)) {
      note("J1", `non-pilot submit failed for the wrong reason: ${error.message}`);
    }
  }

  // Request changes → the applicant gets the field, not a shrug.
  const appId = seeded.application.id;
  const { error: rcErr } = await seeded.users.adminAal2.client.rpc("shop_application_decide", {
    _application_id: appId,
    // Phase 1 spells this decision with a hyphen; P2b's product equivalent
    // uses an underscore. Left as they are — renaming one is a migration, and
    // a QA script is not the place to discover that opinion.
    _decision: "request-changes",
    _applicant_note: "Nhờ anh/chị ghi rõ địa chỉ lấy hàng.",
    _internal_note: "NOTE-NOI-BO-KHONG-DUOC-LO",
    _requested_fields: ["pickup_address"],
  });
  if (rcErr) note("J1", `admin request_changes failed: ${rcErr.message}`);

  {
    const { ctx, page } = await gotoAs(browser, seeded.users.applicant.session, "/seller/application/status");
    const body = await page.locator("body").innerText();
    if (!/Cần sửa|địa chỉ lấy hàng/i.test(body)) note("J1", "the applicant is not told what to fix");
    if (body.includes("NOTE-NOI-BO-KHONG-DUOC-LO")) note("J1", "the moderator's internal note is shown to the applicant");
    await ctx.close();
  }
  ok("J1 request-changes reaches the applicant, internal note does not");

  // Resubmit, approve, and replay the approval: a second approve must not
  // mint a second shop.
  const { error: reErr } = await seeded.users.applicant.client.rpc("shop_application_submit");
  if (reErr) note("J1", `resubmit failed: ${reErr.message}`);

  const { error: apErr } = await seeded.users.adminAal2.client.rpc("shop_application_decide", {
    _application_id: appId, _decision: "approve",
  });
  if (apErr) note("J1", `approve failed: ${apErr.message}`);

  const { data: shopsAfter } = await admin
    .from("shops").select("id").eq("owner_user_id", seeded.users.applicant.id);
  if ((shopsAfter ?? []).length !== 1) {
    note("J1", `approval produced ${(shopsAfter ?? []).length} shops, expected 1`);
  } else {
    // Anything the approval created belongs to this run.
    if (!global.__p2b7reg.shopIds.includes(shopsAfter[0].id)) {
      global.__p2b7reg.shopIds.push(shopsAfter[0].id);
    }
  }

  await seeded.users.adminAal2.client.rpc("shop_application_decide", {
    _application_id: appId, _decision: "approve",
  });
  const { data: shopsReplay } = await admin
    .from("shops").select("id").eq("owner_user_id", seeded.users.applicant.id);
  if ((shopsReplay ?? []).length !== 1) {
    note("J1", `replaying approve produced ${(shopsReplay ?? []).length} shops`);
  }
  ok("J1 approve is idempotent — one shop, not two");
}

/** J2 — a product's whole road, and what the buyer sees at each stop. */
async function journeyModeration(browser, seeded) {
  const admin = adminClient();
  const pub = anonClient();
  const product = seeded.products.pending;

  const publicSees = async (slug) => {
    const { data } = await pub.rpc("shop_public_product", { _slug: slug });
    return !!data?.found;
  };
  const inSearch = async (slug) => {
    const { data } = await pub.rpc("shop_public_search", { _limit: 50 });
    return (data?.rows ?? []).some((r) => r.slug === slug);
  };

  // Pending is not public.
  if (await publicSees(product.slug)) note("J2", "a pending_review product is on the public PDP");
  if (await inSearch(product.slug)) note("J2", "a pending_review product is in public search");

  // The moderator can see it, with the seller's own preview.
  {
    const { ctx, page } = await gotoAs(browser, seeded.adminSession, `/admin/shop/products/${product.id}`);
    const body = await page.locator("body").innerText();
    if (!/Người mua sẽ thấy gì/.test(body)) note("J2", "the review screen has no buyer preview");
    if (!body.includes("Vợt QA Chờ Duyệt")) note("J2", "the review screen does not show the product");
    await ctx.close();
  }

  // Request changes with a target, then the seller's deep link.
  const { error: rcErr } = await seeded.users.adminAal2.client.rpc("product_decide", {
    _product_id: product.id, _decision: "request_changes",
    _applicant_note: "Nhờ anh/chị mô tả rõ tình trạng cán vợt.",
    _requested_targets: [{ section: "basics", field: "description" }],
    _client_token: `j2-rc-${seeded.run}`,
  });
  if (rcErr) note("J2", `request_changes failed: ${rcErr.message}`);

  {
    const { ctx, page } = await gotoAs(
      browser, seeded.users.seller.session, `/seller/products/${product.id}/edit`,
    );
    const body = await page.locator("body").innerText();
    if (!/cán vợt/i.test(body)) note("J2", "the seller is not shown what the moderator asked for");
    await ctx.close();
  }
  ok("J2 request-changes reaches the seller with its target");

  // Resubmit → approve → the bytes are NOT yet public.
  const bump = async () => (await admin.from("products").select("version").eq("id", product.id).single()).data.version;
  const { error: reErr } = await seeded.users.seller.client.rpc("product_submit", {
    _product_id: product.id, _expected_version: await bump(), _client_token: `j2-re-${seeded.run}`,
  });
  if (reErr) note("J2", `resubmit failed: ${reErr.message}`);

  const { error: apErr } = await seeded.users.adminAal2.client.rpc("product_decide", {
    _product_id: product.id, _decision: "approve", _client_token: `j2-ap-${seeded.run}`,
  });
  if (apErr) note("J2", `approve failed: ${apErr.message}`);

  if (await publicSees(product.slug)) {
    note("J2", "approved-but-not-published is already public — publication is supposed to be the gate");
  }
  ok("J2 approval alone does not publish");

  // The worker's half.
  const { data: plan } = await seeded.users.seller.client.rpc("product_publish_prepare", { _product_id: product.id });
  for (const copy of plan.copies) {
    const { data: blob } = await admin.storage.from("shop-product-media-draft").download(copy.source);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await admin.storage.from("shop-product-media").upload(copy.target, bytes, {
      contentType: "image/webp", upsert: true,
    });
    global.__p2b7reg.objects.push({ bucket: "shop-product-media", path: copy.target });
  }
  await admin.rpc("product_publish_commit", { _product_id: product.id, _copied: plan.copies });

  if (!(await publicSees(product.slug))) note("J2", "the product is still invisible after publication committed");
  if (!(await inSearch(product.slug))) note("J2", "the published product is missing from search");
  ok("J2 publication commit is what makes it public");

  // Suspend → gone from every public surface at once.
  const { error: susErr } = await seeded.users.adminAal2.client.rpc("product_decide", {
    _product_id: product.id, _decision: "suspend",
    _applicant_note: "Tạm gỡ để đối chiếu.", _client_token: `j2-sus-${seeded.run}`,
  });
  if (susErr) note("J2", `suspend failed: ${susErr.message}`);

  if (await publicSees(product.slug)) note("J2", "a suspended product still answers on its PDP");
  if (await inSearch(product.slug)) note("J2", "a suspended product is still in search");
  {
    const { data: store } = await pub.rpc("shop_public_shop", { _slug: seeded.shops.a.slug });
    const listed = (store?.products ?? store?.rows ?? []).some?.((r) => r.slug === product.slug);
    if (listed) note("J2", "a suspended product is still on its shop page");
  }
  // And in a browser, not only in the read model.
  {
    const { ctx, page } = await gotoAs(browser, null, `/shop/product/${product.slug}`);
    const body = await page.locator("body").innerText();
    if (!/Không tìm thấy sản phẩm/.test(body)) note("J2", "the PDP of a suspended product is not a not-found page");
    await ctx.close();
  }
  ok("J2 suspend removes it from every public surface");

  // Reopen → back to the seller, not straight back on sale (Q5). The decision
  // is called `reopen` and not `restore` precisely because it does not restore
  // anything: `suspended → approved` is forbidden, and the only road back runs
  // through the seller. `request_changes` is refused from `suspended` by name.
  const { error: reopenErr } = await seeded.users.adminAal2.client.rpc("product_decide", {
    _product_id: product.id, _decision: "reopen",
    _applicant_note: "Đã đối chiếu xong, nhờ anh/chị bổ sung ảnh hoá đơn.",
    _requested_targets: [{ section: "media", field: null }],
    _client_token: `j2-reopen-${seeded.run}`,
  });
  if (reopenErr) note("J2", `reopen failed: ${reopenErr.message}`);
  const { data: after } = await admin
    .from("products").select("status,is_published").eq("id", product.id).single();
  if (after.status !== "needs_changes") note("J2", `reopen left status ${after.status}`);
  if (after.is_published) note("J2", "a reopened product went back on sale by itself — Q5 says it must not");
  if (await publicSees(product.slug)) note("J2", "a reopened product is public again without a new decision");
  ok("J2 reopen returns it to the seller, still off sale (Q5)");
}

/** J3 — contact moderation, and what the CTA is allowed to carry. */
async function journeyContacts(browser, seeded) {
  const admin = adminClient();
  const pub = anonClient();
  const shopSlug = seeded.shops.a.slug;

  const publicContacts = async () => {
    const { data } = await pub.rpc("shop_public_shop", { _slug: shopSlug });
    return JSON.stringify(data?.contacts ?? []);
  };

  const live = await publicContacts();
  if (!live.includes("zalo")) note("J3", "the approved Zalo channel is not public");
  if (live.includes("0987654321")) note("J3", "a PENDING contact's number is public");
  if (live.includes("m.me/shopqa")) note("J3", "a REJECTED contact's destination is public");
  if (live.includes("NOTE-NOI-BO")) note("J3", "an internal note is on a public payload");
  ok("J3 only the approved channel is public");

  // The CTA, in a browser: right destination, no buyer identity in it.
  {
    const { ctx, page } = await gotoAs(browser, null, `/shop/product/${seeded.products.single.slug}`);
    const cta = page.locator('a[href^="https://zalo.me/"]').first();
    if (!(await cta.count())) note("J3", "no contact CTA on the PDP");
    else {
      const href = (await cta.getAttribute("href")) ?? "";
      const rel = (await cta.getAttribute("rel")) ?? "";
      if (/[?#]/.test(href)) note("J3", `CTA href carries a query or fragment: ${href}`);
      if (!rel.includes("noopener")) note("J3", `CTA rel is "${rel}"`);
      const box = await cta.boundingBox();
      if (box && (box.width < 44 || box.height < 44)) {
        note("J3", `CTA is ${Math.round(box.width)}×${Math.round(box.height)}`);
      }
    }
    await ctx.close();
  }

  // Editing a live value must take it back off the shelf.
  const { error: editErr } = await seeded.users.seller.client.rpc("shop_contact_upsert", {
    _shop_id: seeded.shops.a.id, _type: "zalo", _value: "0911222333",
    _label: "Nhắn Zalo", _is_public: true, _id: seeded.contacts.approved.id,
  });
  if (editErr) note("J3", `editing a contact failed: ${editErr.message}`);

  const { data: row } = await admin
    .from("shop_contact_channels").select("state").eq("id", seeded.contacts.approved.id).single();
  if (row.state !== "pending_review") note("J3", `an edited contact is ${row.state}, not pending_review`);
  const afterEdit = await publicContacts();
  if (afterEdit.includes("911222333") || afterEdit.includes("912345678")) {
    note("J3", "the edited contact is still public while it waits for review");
  }
  ok("J3 editing a live contact pulls it back to review");

  // History: every decision, in order, and the internal note stays internal.
  const { data: history, error: hErr } = await seeded.users.adminAal2.client.rpc(
    "shop_contact_moderation_history", { _channel_id: seeded.contacts.rejected.id },
  );
  if (hErr) note("J3", `history failed: ${hErr.message}`);
  else if (!(history ?? []).some((e) => e.action === "reject" || e.to_state === "rejected")) {
    note("J3", `the rejection is missing from the channel's history: ${JSON.stringify(history).slice(0, 200)}`);
  }
  const { data: sellerHistory } = await seeded.users.seller.client.rpc(
    "shop_contact_moderation_history", { _channel_id: seeded.contacts.rejected.id },
  );
  if (JSON.stringify(sellerHistory ?? []).includes("NOTE-NOI-BO-KHONG-DUOC-LO")) {
    note("J3", "the seller can read the moderator's internal note");
  }
  ok("J3 history is complete and the internal note is not in it");

  // Analytics may name the channel, never the destination.
  const { ctx, page } = await gotoAs(browser, null, `/shop/product/${seeded.products.used.slug}`);
  const payloads = [];
  page.on("request", (r) => {
    if (/gtag|analytics|collect|ahrefs/.test(r.url())) payloads.push(r.url() + (r.postData() ?? ""));
  });
  const cta = page.locator('a[href^="https://zalo.me/"], a[href^="tel:"], a[href^="https://m.me/"]').first();
  if (await cta.count()) await cta.click({ trial: true }).catch(() => {});
  await page.waitForTimeout(500);
  for (const p of payloads) {
    if (/09\d{8}|zalo\.me\/\d|m\.me\//.test(p)) note("J3", "an analytics payload carries the contact destination");
  }
  await ctx.close();
}

/** J4 — forwarding addresses, and the oracle they must not become. */
async function journeySlugs(browser, seeded) {
  const pub = anonClient();

  // A retired PRODUCT slug forwards to the live one.
  const { data: retired } = await pub.rpc("shop_public_product", { _slug: seeded.renamedOldSlug });
  if (retired?.found) note("J4", "the retired product slug still resolves as itself");
  if (retired?.redirect_to !== seeded.products.renamed.slug) {
    note("J4", `retired product slug points at ${retired?.redirect_to}, not ${seeded.products.renamed.slug}`);
  }
  {
    const { ctx, page } = await gotoAs(browser, null, `/shop/product/${seeded.renamedOldSlug}`);
    const landed = new URL(page.url()).pathname;
    if (landed !== `/shop/product/${seeded.products.renamed.slug}`) {
      note("J4", `the browser stayed on ${landed}`);
    }
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
    if (canonical && canonical.includes(seeded.renamedOldSlug)) {
      note("J4", "canonical still points at the retired slug");
    }
    await ctx.close();
  }
  ok("J4 a retired product slug forwards, canonical follows");

  // A retired SHOP slug forwards only while the shop is active.
  const { data: retiredShop } = await pub.rpc("shop_public_shop", { _slug: seeded.shops.a.oldSlug });
  if (retiredShop?.redirect_to !== seeded.shops.a.slug) {
    note("J4", `retired shop slug points at ${retiredShop?.redirect_to}`);
  }

  // A suspended shop, a never-existent shop and a shop that is merely private
  // must all answer identically — otherwise the answer is an oracle.
  const answers = [];
  for (const slug of [seeded.shops.suspended.slug, `khong-ton-tai-${seeded.run}`]) {
    const { data } = await pub.rpc("shop_public_shop", { _slug: slug });
    answers.push(JSON.stringify(data));
  }
  if (answers[0] !== answers[1]) {
    note("J4", `a suspended shop answers differently from one that never existed: ${answers[0]} vs ${answers[1]}`);
  }
  ok("J4 suspended and never-existed are the same answer");

  // A suspended shop's product is gone too, and so is its old URL.
  const { data: inSusp } = await pub.rpc("shop_public_product", { _slug: seeded.products.inSuspendedShop.slug });
  if (inSusp?.found) note("J4", "a product inside a suspended shop is still public");

  // No redirect loop, and no open redirect.
  {
    const { ctx, page } = await gotoAs(browser, null, `/shop/store/${seeded.shops.a.oldSlug}`);
    await page.waitForTimeout(900);
    const landed = new URL(page.url());
    if (landed.pathname !== `/shop/store/${seeded.shops.a.slug}`) {
      note("J4", `shop redirect landed on ${landed.pathname}`);
    }
    if (landed.host !== new URL(APP).host) note("J4", `redirect left the origin: ${landed.host}`);
    await ctx.close();
  }
  ok("J4 shop redirect resolves once, on the same origin");
}

/** J5 — discovery: search, filters, history, and the cursor. */
async function journeyDiscovery(browser, seeded) {
  const pub = anonClient();
  const { ctx, page } = await gotoAs(browser, null, "/shop");

  const cards = await page.locator("a.tl-pcard").count();
  if (cards === 0) note("J5", "the home grid has no product cards");

  // Accent-insensitive search, both ways round.
  for (const [q, why] of [["vợt", "with diacritics"], ["vot", "without diacritics"]]) {
    const { data } = await pub.rpc("shop_public_search", { _q: q, _limit: 24 });
    if ((data?.rows ?? []).length === 0) note("J5", `search "${q}" (${why}) returns nothing`);
  }
  ok("J5 search matches with and without diacritics");

  // The typing race: keys are the argument list, so a slow "vo" cannot land in
  // "vot". Typed fast, then asserted on what is on screen.
  await page.goto(`${APP}/shop/search`, { waitUntil: "networkidle" });
  const box = page.locator("input[type='search'], #shop-q, input[name='q']").first();
  if (!(await box.count())) note("J5", "the search screen has no input");
  else {
    await box.type("vo", { delay: 20 });
    await box.type("t", { delay: 20 });
    await page.waitForTimeout(1600);
    const url = new URL(page.url());
    if ((url.searchParams.get("q") ?? "") !== "vot") {
      note("J5", `after typing "vot" the URL says q=${url.searchParams.get("q")}`);
    }
  }

  // Back/forward must restore the query, not a blank screen.
  await page.goto(`${APP}/shop/search?q=vot`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.goto(`${APP}/shop/category/vot`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const backUrl = new URL(page.url());
  if (backUrl.searchParams.get("q") !== "vot") note("J5", "going back lost the query");
  const backBody = await page.locator("body").innerText();
  if (!/Vợt QA/.test(backBody)) note("J5", "going back showed an empty result list");
  ok("J5 back restores the query and its results");

  // The cursor: page 2 must not repeat or skip page 1.
  const { data: p1 } = await pub.rpc("shop_public_search", { _limit: 3 });
  if ((p1?.rows ?? []).length === 3 && p1.has_more) {
    const last = p1.rows[2];
    const { data: p2 } = await pub.rpc("shop_public_search", {
      _limit: 3, _cursor_at: last.created_at, _cursor_id: last.id,
    });
    const ids1 = new Set(p1.rows.map((r) => r.id));
    const dupes = (p2?.rows ?? []).filter((r) => ids1.has(r.id));
    if (dupes.length) note("J5", `the cursor repeated ${dupes.length} row(s) on page 2`);
  } else {
    note("J5", "not enough rows to exercise the cursor — the fixture is too small");
  }

  // A category with nothing publishable must not be offered.
  const { data: cats } = await pub.rpc("shop_public_categories", { _only_stocked: true });
  const empty = (cats ?? []).filter((c) => (c.product_count ?? c.count ?? 0) === 0);
  if (empty.length) note("J5", `${empty.length} category with 0 products is still offered`);

  // Filters commit on Áp dụng, not on tap.
  await page.goto(`${APP}/shop/search?q=vot`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  // Scoped to the sheet, deliberately: the desktop rail renders the same
  // fieldset with the same labels, and a page-wide locator at 390px can pick
  // the hidden one and prove nothing.
  const filterBtn = page.locator("button.tl-filter-open").first();
  if (!(await filterBtn.count())) note("J5", "no filter button at 390px");
  else {
    await filterBtn.click();
    await page.waitForTimeout(400);
    const sheet = page.locator("dialog.tl-sheet");
    if (!(await sheet.evaluate((d) => d.open).catch(() => false))) {
      note("J5", "the filter sheet did not open");
    }
    const used = sheet.locator("label", { hasText: "Đã qua sử dụng" }).locator("input");
    await used.click();
    await page.waitForTimeout(250);

    // The buyer has to SEE the choice. It committed correctly and looked
    // ignored — the draft lived in a ref, so the controlled radio snapped back.
    if (!(await used.isChecked())) {
      note("J5", "tapping a filter option does not show as selected");
    }
    if (new URL(page.url()).searchParams.get("condition")) {
      note("J5", "a filter committed on tap, before Áp dụng");
    }

    await sheet.getByRole("button", { name: "Áp dụng" }).click();
    await page.waitForTimeout(1000);
    if (new URL(page.url()).searchParams.get("condition") !== "used") {
      note("J5", "Áp dụng did not commit the filter");
    }
    const filtered = await page.locator("body").innerText();
    if (!/Đã Dùng/.test(filtered)) note("J5", "the used-condition filter returned no used product");
    ok("J5 the filter sheet shows the choice and commits it on Áp dụng");
  }
  await ctx.close();
}

/** J6 — cross-tenant. A seller's console must not reach another shop. */
async function journeyTenancy(seeded) {
  const rival = seeded.users.rival.client;
  const support = seeded.users.support.client;

  // Not "can they read our products" — approved+published rows are public by
  // design and a rival reading those is the product working. The boundary is
  // the rows that are NOT public: a draft, a pending review, a suspended
  // listing and the internal note attached to it.
  const privateIds = [
    seeded.products.needsChanges.id,
    seeded.products.suspended.id,
  ];
  const { data: stolen } = await rival
    .from("products").select("id,internal_note").in("id", privateIds);
  if ((stolen ?? []).length) {
    note("J6", `another shop's owner read ${stolen.length} of our non-public products`);
  }
  const { data: stolenVariants } = await rival
    .from("product_variants").select("id,stock_on_hand").in("product_id", privateIds);
  if ((stolenVariants ?? []).length) {
    note("J6", `another shop's owner read ${stolenVariants.length} variant rows of our non-public products`);
  }

  const { error: writeErr } = await rival.rpc("product_decide", {
    _product_id: seeded.products.single.id, _decision: "suspend", _client_token: `j6-${seeded.run}`,
  });
  if (!writeErr) note("J6", "a seller could moderate a product");

  // Support may look at the shop but not change it.
  const { error: supportWrite } = await support.rpc("shop_contact_upsert", {
    _shop_id: seeded.shops.a.id, _type: "phone", _value: "0900000000",
    _label: "support", _is_public: true, _id: null,
  });
  if (!supportWrite) note("J6", "a support member could add a public contact channel");

  // An AAL1 admin has the role and not the session.
  const { error: aal1 } = await seeded.users.adminAal1.client.rpc("product_decide", {
    _product_id: seeded.products.single.id, _decision: "suspend", _client_token: `j6b-${seeded.run}`,
  });
  if (!aal1) note("J6", "an aal1 admin could take a moderation decision");
  ok("J6 tenancy and AAL boundaries hold");
}

// ── Main ────────────────────────────────────────────────────────────────────

const reg = newRegistry();
// The journeys create rows the seed never saw — a shop minted by an approval,
// a rendition minted by a republish. They push those into the same registry
// the teardown reads, so a global is the honest way to say "there is exactly
// one of these per process". Threading it through six journey signatures
// would say the same thing at more length.
global.__p2b7reg = reg;
const run = Date.now().toString(36);
const browser = await chromium.launch();
let remaining = null;

try {
  const seeded = await seedP2bAcceptance(reg, run);
  console.log(`seeded run ${run} — shop ${seeded.shops.a.slug}\n`);

  // A green teardown after a green run proves very little: the interesting
  // question is whether a run that dies HALFWAY still cleans up. P2b.5 shipped
  // a seed that threw at that point and left a shop and six products behind,
  // and the checkpoint after it shipped a teardown that ran and deleted
  // nothing while reporting PASS.
  //
  //   SHOP_QA_CHAOS=1 node scripts/shop-p2b-acceptance-qa.mjs
  //
  // Expected: exit 1 with the harness finding, AND every teardown count zero.
  if (process.env.SHOP_QA_CHAOS === "1") {
    throw new Error("SHOP_QA_CHAOS — deliberate failure between seed and QA");
  }

  if (process.env.SHOP_QA_SKIP_SWEEP !== "1") {
    await routeSweep(browser, seeded);
    await mirroredSweep(browser, seeded);
  }
  await journeyApplication(browser, seeded);
  await journeyModeration(browser, seeded);
  await journeyContacts(browser, seeded);
  await journeySlugs(browser, seeded);
  await journeyDiscovery(browser, seeded);
  await journeyTenancy(seeded);
} catch (e) {
  note("harness", (e.stack ?? String(e)).split("\n").slice(0, 4).join(" | "));
} finally {
  // Always, and from the registry — not from whatever the seed returned.
  remaining = await teardownP2bAcceptance(reg);
  await browser.close();
}

// `errorDetail` is an array of strings, not a count — list it rather than
// comparing it to a number.
for (const detail of remaining?.errorDetail ?? []) note("teardown", detail);
const dirty = Object.entries(remaining ?? {})
  .filter(([what, n]) => what !== "errorDetail" && typeof n === "number" && n !== 0);
for (const [what, n] of dirty) {
  note("teardown", n < 0 ? `${what} could not be counted` : `${n} ${what} left behind`);
}

// The control routes carry the site shells; anything they report too is not
// P2b's. Two of them — /tools for TheLineLayout and /admin/users for
// AdminLayout — because a control that does not exercise the same shell is
// not a control. Compared on the message alone, with the route label stripped.
const msgOf = (l) => l.replace(/^[a-z-]+@?\d*: /, "");
const isControl = (f) => f.startsWith("control:") || f.startsWith("control@") ||
  f.startsWith("control-admin");
const controlMsgs = new Set(findings.filter(isControl).map(msgOf));
const shell = findings.filter((f) => !isControl(f) && controlMsgs.has(msgOf(f)));
const mine = findings.filter((f) => !isControl(f) && !controlMsgs.has(msgOf(f)));

console.log(`\nscreenshots: ${SHOT_DIR}`);
console.log(`teardown: ${JSON.stringify(remaining)}`);
if (shell.length) {
  console.log(`\n${new Set(shell.map(msgOf)).size} shell finding type(s), each also on /tools.`);
}
if (mine.length) {
  console.error(`\n✖ ${new Set(mine).size} finding(s):`);
  for (const f of [...new Set(mine)]) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nPASS — P2b acceptance clean: routes, journeys, leakage, teardown");
