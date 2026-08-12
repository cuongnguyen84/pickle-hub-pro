// ============================================================================
// Buyer catalogue — route QA (P2b.4)
// ----------------------------------------------------------------------------
//   supabase start && supabase db reset
//   VITE_SUPABASE_URL=http://127.0.0.1:54321 \
//   VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key> npm run dev            # :8080
//   node scripts/buyer-shop-qa.mjs
//
// Anonymous, because that is who a buyer is. The viewport is set on the
// CONTEXT and window.innerWidth is asserted at every size.
//
// The lesson from the admin gate is baked in: a route only passes if its OWN
// heading AND a content marker from its body are on the page. A gate that
// checks a heading passes on a screen that rendered its title and then failed,
// and one that checks nothing passes on an error page.
// ============================================================================

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  WIDTHS,
  adminClient,
  axeFindings,
  keyboardFindings,
  overflowOf,
  smallTargets,
  structureFindings,
  zoomAndFontFindings,
} from "./qa/seller-qa-kit.mjs";

const APP = process.env.BUYER_QA_BASE_URL ?? "http://localhost:8080";
const SHOT_DIR = process.env.BUYER_SHOT_DIR ?? mkdtempSync(join(tmpdir(), "tph-p2b-buyer-"));
const admin = adminClient();

// Filled in AS the seed runs, not returned at the end: a seed that throws
// halfway used to leave its shop and six products behind, because `seeded` was
// only assigned on success. The leftovers then broke a pgTAP file that counts
// publishable products globally.
const created = { userId: null, shopId: null };
const run = Date.now().toString(36);

const findings = [];
const note = (where, msg) => findings.push(`${where}: ${msg}`);

// Each route's own heading plus a marker that only exists once its body
// rendered. Both, because either alone has already let a false PASS through.
const EXPECT = {
  // The CONTROL is /tools, not /clubs. Both use TheLineLayout, but only
  // /tools renders a BACK BUTTON — and the back button is what makes the
  // header too wide for a 320px phone. Controlling against /clubs said the
  // overflow was ours; controlling against /tools shows it on a route that
  // shipped long before the Shop. Pick a control that exercises the same
  // shell configuration, or it is not a control.
  control:  { h1: /.+/,                 marker: /.+/ },
  home:     { h1: /Chợ đồ pickleball/,  marker: /Ngành hàng|Mới đăng/ },
  search:   { h1: /Tìm sản phẩm/,       marker: /sản phẩm|Không tìm thấy/ },
  category: { h1: /Vợt|Ngành hàng/,     marker: /sản phẩm|chưa có sản phẩm/ },
  // The CTA as it is actually labelled, or its honest fallback. An earlier
  // marker looked for "Liên hệ" and failed on a page that renders "Nhắn Zalo"
  // — the marker was wrong, not the screen.
  pdp:      { h1: /Vợt QA/,             marker: /Nhắn Zalo|Nhắn Messenger|Gọi điện|chưa cung cấp kênh liên hệ/ },
  store:    { h1: /Shop QA Người Mua/,  marker: /Sản phẩm của shop/ },
};

async function seed() {
  const { data: u, error } = await admin.auth.admin.createUser({
    email: `buyer-qa-${run}@thepicklehub.test`, password: "QaBuyer!2026", email_confirm: true,
  });
  if (error) throw error;
  created.userId = u.user.id;
  const { data: shop } = await admin.from("shops").insert({
    slug: `buyer-qa-${run}`, name: "Shop QA Người Mua", state: "active",
    owner_user_id: u.user.id, region: "Hà Nội", verified_at: new Date().toISOString(),
    verified_method: "giay-phep-kinh-doanh",
  }).select().single();
  created.shopId = shop.id;

  // Products written through the privileged path: the point of this gate is
  // the buyer surface, not the seller flow, and `products` pins status and
  // submitted_at against client writes.
  const rows = [];
  for (let i = 1; i <= 6; i++) {
    rows.push({
      shop_id: shop.id,
      slug: `buyer-qa-${run}-${i}`,
      title: `Vợt QA Người Mua ${i}`,
      description: "Vợt carbon T700, lõi tổ ong 16mm, cán 4.25 inch, hàng mới nguyên hộp.",
      category_slug: "vot",
    });
  }
  const { data: made, error: pe } = await admin.from("products").insert(rows).select();
  if (pe) throw pe;

  // Promote them the way the moderator + worker would, via service_role.
  const ids = made.map((p) => p.id);
  await admin.from("product_variants").insert(
    ids.map((id, i) => ({
      product_id: id, shop_id: shop.id, price_vnd: 900000 + i * 100000,
      stock_on_hand: i === 0 ? 0 : 5, position: 0,
    })),
  );
  await admin.from("product_media").insert(
    ids.map((id) => ({
      product_id: id, shop_id: shop.id,
      draft_path: `${shop.id}/${id}/o.jpg`,
      rendition_source_path: `${shop.id}/${id}/r.webp`,
      public_path: `${shop.id}/${id}/p-v1.webp`,
      state: "approved", verified_at: new Date().toISOString(), position: 0,
    })),
  );
  // An approved, public contact channel, so the PDP renders the real CTA
  // rather than only its honest "no channel yet" fallback.
  await admin.from("shop_contact_channels").insert({
    shop_id: shop.id, type: "zalo",
    value_raw: "0912345678", value_normalized: "https://zalo.me/912345678",
    display_label: "Nhắn Zalo", is_public: true,
  });

  // `products` pins status and is_published against ANY client write — that
  // is the P2a privileged-column guard, and PostgREST is a client. An
  // `.update({status:'approved'})` here is silently neutralised, which is
  // exactly how this gate spent its first run measuring an EMPTY catalogue and
  // passing: every category read 0 and no ProductCard was ever rendered.
  //
  // So the promotion runs as SQL with the privileged flag set, the way the
  // moderator's RPC and the media worker's commit do in production.
  const sql = `
    SELECT set_config('shop.privileged_write', 'on', true);
    UPDATE public.products SET status='approved', is_published=true
    WHERE shop_id='${shop.id}';
    -- product_media pins state and public_path the same way, so the worker's
    -- commit has to be replayed here too. Without it every product is
    -- approved AND published AND invisible, because shop_product_is_publishable
    -- also requires bytes in the public bucket.
    UPDATE public.product_media
    SET state='approved',
        public_path = shop_id::text || '/' || product_id::text || '/p-v1.webp'
    WHERE shop_id='${shop.id}';
    -- shop_contact_channels pins state to 'draft' on any client INSERT, the
    -- same guard again. Without this the PDP renders only its honest "no
    -- approved channel" fallback and the CTA is never exercised.
    UPDATE public.shop_contact_channels
    SET state='approved', approved_at=now()
    WHERE shop_id='${shop.id}';
    SELECT set_config('shop.privileged_write', 'off', true);
  `;
  execFileSync("docker", [
    "exec", "supabase_db_ajvlcamxemgbxduhiqrl",
    "psql", "-U", "postgres", "-d", "postgres", "-q", "-c", sql,
  ], { stdio: "pipe" });

  const { count: live } = await admin
    .from("products").select("id", { count: "exact", head: true })
    .eq("shop_id", shop.id).eq("status", "approved").eq("is_published", true);
  if (!live) throw new Error("seed produced no publishable products — the gate would measure an empty catalogue");
  const { count: withBytes } = await admin
    .from("product_media").select("id", { count: "exact", head: true })
    .eq("shop_id", shop.id).not("public_path", "is", null);
  if (!withBytes) throw new Error("seed produced no public renditions — products would be invisible");
  const { count: liveContacts } = await admin
    .from("shop_contact_channels").select("id", { count: "exact", head: true })
    .eq("shop_id", shop.id).eq("state", "approved").eq("is_public", true);
  if (!liveContacts) throw new Error("seed produced no public contact — the CTA would never render");

  return { userId: u.user.id, shopId: shop.id };
}

async function checkRoute(ctx, path, label, width) {
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("response", async (r) => {
    if (r.status() >= 400 && !r.url().includes("/storage/")) {
      consoleErrors.push(`${r.status()} ${r.url().split("/").slice(-1)[0]}`);
    }
  });
  await page.goto(`${APP}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const measured = await page.evaluate(() => window.innerWidth);
  if (measured !== width) note(`${label}@${width}`, `innerWidth is ${measured}, not ${width}`);

  const h1 = (await page.locator("h1").first().textContent().catch(() => "")) ?? "";
  const body = await page.locator("body").innerText().catch(() => "");
  const want = EXPECT[label];
  if (!want.h1.test(h1)) note(`${label}@${width}`, `heading is "${h1.trim() || "(none)"}"`);
  if (!want.marker.test(body)) note(`${label}@${width}`, "no body marker — shell or error state");
  if (!(await page.locator("main").count())) note(`${label}@${width}`, "no <main> landmark");

  const overflow = await overflowOf(page);
  if (overflow > 0) note(`${label}@${width}`, `${overflow}px past the scroller's right edge`);
  // The left edge too: a control pulled off-canvas is unreachable, and
  // overflowOf only looks right.
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
  if (offLeft > 0) note(`${label}@${width}`, `a control starts ${offLeft}px off the left edge`);
  for (const f of await smallTargets(page)) note(`${label}@${width}`, f);
  for (const f of await zoomAndFontFindings(page, width)) note(`${label}@${width}`, f);
  if (width === 1440) {
    for (const f of await structureFindings(page)) note(label, f);
    for (const f of await axeFindings(page)) note(label, f);
    for (const f of await keyboardFindings(page)) note(label, f);
  }

  // Nothing private may reach a buyer surface. P2b.3 made the draft path
  // seller-only in the projection; this is the check at the other end.
  const html = await page.content();
  for (const bad of ["/r.webp", "shop-product-media-draft", "token=", "/object/sign/", "stock_on_hand"]) {
    if (html.includes(bad)) note(label, `DOM contains ${bad}`);
  }
  // P2b has no cart and no saved list. A button for either would be a
  // dead end, which is worse than its absence.
  for (const bad of ["Thêm vào giỏ", "Lưu sản phẩm", "Yêu thích"]) {
    if (html.includes(bad)) note(label, `DOM offers "${bad}" — P2b has no such behaviour`);
  }

  // A populated catalogue, asserted. Empty states are a legitimate SCREEN, but
  // a gate that only ever sees them has not tested a product card, a price, an
  // availability label or a lazy image — which is what this gate exists for.
  if (!["control", "pdp"].includes(label)) {
    const cards = await page.locator("a.tl-pcard").count();
    if (cards === 0) note(`${label}@${width}`, "0 product cards — the gate is measuring an empty catalogue");
  }

  if (label === "pdp") {
    // The CTA is the only thing a buyer can DO in P2b, and the only handoff to
    // an outside app. Both halves are checked: the link exists and is safe,
    // and it carries nothing about the buyer.
    const cta = page.locator('a[href^="https://zalo.me/"]').first();
    if ((await cta.count()) === 0) note(`${label}@${width}`, "no contact CTA rendered");
    else {
      const href = (await cta.getAttribute("href")) ?? "";
      const rel = (await cta.getAttribute("rel")) ?? "";
      if (/[?#]/.test(href)) note(label, `CTA href carries a query or fragment: ${href}`);
      if (!rel.includes("noopener")) note(label, `CTA rel is "${rel}", missing noopener`);
      const b = await cta.boundingBox();
      if (b && (b.width < 44 || b.height < 44)) {
        note(`${label}@${width}`, `CTA is ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
    }
    // It must not read as an internal inbox — messaging is not built.
    if (html.includes("Nhắn tin nội bộ") || html.includes("Chat với shop")) {
      note(label, "CTA implies internal messaging, which does not exist");
    }
  }

  if (consoleErrors.length) note(label, `console: ${consoleErrors.slice(0, 3).join(" | ")}`);
  console.log(`  ✓ ${String(width).padEnd(5)} ${label.padEnd(10)} innerWidth ${measured}`);
  return page;
}

const browser = await chromium.launch();
let seeded = null;
try {
  seeded = await seed();
  const ROUTES = [
    ["/tools", "control"],
    ["/shop", "home"],
    ["/shop/search?q=vot", "search"],
    ["/shop/category/vot", "category"],
    [`/shop/product/buyer-qa-${run}-1`, "pdp"],
    [`/shop/store/buyer-qa-${run}`, "store"],
  ];

  for (const width of [...WIDTHS, 390].sort((a, b) => a - b)) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      storageState: {
        cookies: [],
        origins: [{ origin: APP, localStorage: [{ name: "pickleball-hub-language", value: "vi" }] }],
      },
    });
    for (const [path, label] of ROUTES) {
      const page = await checkRoute(ctx, path, label, width);
      if (width === 375) await page.screenshot({ path: join(SHOT_DIR, `375-buyer-${label}.png`), fullPage: true });
      if (width === 320 && ["pdp", "store"].includes(label)) {
        await page.screenshot({ path: join(SHOT_DIR, `320-buyer-${label}.png`), fullPage: true });
      }
      if (width === 1440 && label === "search") {
        await page.screenshot({ path: join(SHOT_DIR, `1440-buyer-search.png`), fullPage: true });
      }
      await page.close();
    }
    await ctx.close();
  }

  // A 44px box is only worth having if a thumb landing on its EDGE actually
  // follows the link. Clicking the centre would pass even with a 26px anchor,
  // which is the state this replaced.
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${APP}/shop/category/vot`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const crumb = page.locator("nav[aria-label='Đường dẫn'] a.tl-crumb").first();
    const box = await crumb.boundingBox();
    if (!box) note("breadcrumb@320", "no breadcrumb link found");
    else {
      if (box.width < 44 || box.height < 44) {
        note("breadcrumb@320", `hit box is ${Math.round(box.width)}x${Math.round(box.height)}, not 44x44`);
      }
      // 3px inside the left edge and 3px above the bottom — a corner, not the
      // middle of the word.
      await page.mouse.click(box.x + 3, box.y + box.height - 3);
      await page.waitForTimeout(700);
      const url = page.url();
      if (!/\/shop$/.test(new URL(url).pathname)) {
        note("breadcrumb@320", `edge click went to ${new URL(url).pathname}, not /shop`);
      } else {
        console.log("  ✓ 320   breadcrumb edge click → /shop");
      }
    }
    await page.close();
    await ctx.close();
  }
} catch (e) {
  note("harness", (e.stack ?? String(e)).split("\n").slice(0, 3).join(" | "));
} finally {
  // Always, from `created` — not from the value seed() returns.
  if (created.shopId) {
    await admin.from("products").delete().eq("shop_id", created.shopId);
    await admin.from("shops").delete().eq("id", created.shopId);
    const { count } = await admin
      .from("products").select("id", { count: "exact", head: true }).eq("shop_id", created.shopId);
    if (count) note("teardown", `${count} products left behind`);
  }
  if (created.userId) await admin.auth.admin.deleteUser(created.userId);
  await browser.close();
}

// Anything the control route reports too is site shell, not P2b.4.
// /tools carries the same header, footer and ChatFAB, and a back button.
const msgOf = (l) => l.replace(/^[a-z]+@?\d*: /, "");
const controlMsgs = new Set(findings.filter((f) => f.startsWith("control")).map(msgOf));
const shell = findings.filter((f) => !f.startsWith("control") && controlMsgs.has(msgOf(f)));
const mine = findings.filter((f) => !f.startsWith("control") && !controlMsgs.has(msgOf(f)));

console.log(`\nscreenshots: ${SHOT_DIR}`);
if (shell.length) {
  console.log(`\n${new Set(shell.map(msgOf)).size} shell finding type(s), each also on /tools.`);
}
findings.length = 0;
findings.push(...mine);
if (findings.length) {
  console.error(`\n✖ ${findings.length} finding(s):`);
  for (const f of [...new Set(findings)]) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nPASS — buyer catalogue clean at 320/375/390/414/768/1440");
