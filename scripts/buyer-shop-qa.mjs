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
const run = Date.now().toString(36);

const findings = [];
const note = (where, msg) => findings.push(`${where}: ${msg}`);

// Each route's own heading plus a marker that only exists once its body
// rendered. Both, because either alone has already let a false PASS through.
const EXPECT = {
  // An existing public page as a CONTROL. Everything here uses TheLineLayout,
  // so anything this gate reports on BOTH a P2b.4 route and the control comes
  // from the shared site shell, not from this checkpoint. The comparison
  // replaces a hand-written allowlist — which is the mechanism that let the
  // admin gate report a false PASS.
  control:  { h1: /.+/,                 marker: /.+/ },
  home:     { h1: /Chợ đồ pickleball/,  marker: /Ngành hàng|Mới đăng/ },
  search:   { h1: /Tìm sản phẩm/,       marker: /sản phẩm|Không tìm thấy/ },
  category: { h1: /Vợt|Ngành hàng/,     marker: /sản phẩm|chưa có sản phẩm/ },
};

async function seed() {
  const { data: u, error } = await admin.auth.admin.createUser({
    email: `buyer-qa-${run}@thepicklehub.test`, password: "QaBuyer!2026", email_confirm: true,
  });
  if (error) throw error;
  const { data: shop } = await admin.from("shops").insert({
    slug: `buyer-qa-${run}`, name: "Shop QA Người Mua", state: "active",
    owner_user_id: u.user.id, region: "Hà Nội", verified_at: new Date().toISOString(),
    verified_method: "giay-phep-kinh-doanh",
  }).select().single();

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
  const { error: ue } = await admin
    .from("products").update({ status: "approved", is_published: true }).in("id", ids);
  if (ue) throw ue;

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

  if (consoleErrors.length) note(label, `console: ${consoleErrors.slice(0, 3).join(" | ")}`);
  console.log(`  ✓ ${String(width).padEnd(5)} ${label.padEnd(10)} innerWidth ${measured}`);
  return page;
}

const browser = await chromium.launch();
let seeded = null;
try {
  seeded = await seed();
  const ROUTES = [
    ["/clubs", "control"],
    ["/shop", "home"],
    ["/shop/search?q=vot", "search"],
    ["/shop/category/vot", "category"],
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
      if (width === 1440 && label === "search") {
        await page.screenshot({ path: join(SHOT_DIR, `1440-buyer-search.png`), fullPage: true });
      }
      await page.close();
    }
    await ctx.close();
  }
} catch (e) {
  note("harness", (e.stack ?? String(e)).split("\n").slice(0, 3).join(" | "));
} finally {
  if (seeded) {
    await admin.from("products").delete().eq("shop_id", seeded.shopId);
    await admin.from("shops").delete().eq("id", seeded.shopId);
    await admin.auth.admin.deleteUser(seeded.userId);
    const { count } = await admin
      .from("products").select("id", { count: "exact", head: true }).eq("shop_id", seeded.shopId);
    if (count) note("teardown", `${count} products left behind`);
  }
  await browser.close();
}

// Anything the control route reports too is site shell, not P2b.4.
const msgOf = (l) => l.replace(/^[a-z]+@?\d*: /, "");
const controlMsgs = new Set(findings.filter((f) => f.startsWith("control")).map(msgOf));
const shell = findings.filter((f) => !f.startsWith("control") && controlMsgs.has(msgOf(f)));
const mine = findings.filter((f) => !f.startsWith("control") && !controlMsgs.has(msgOf(f)));

console.log(`\nscreenshots: ${SHOT_DIR}`);
if (shell.length) {
  console.log(`\n${new Set(shell.map(msgOf)).size} shell finding type(s), each also on /clubs.`);
}
findings.length = 0;
findings.push(...mine);
if (findings.length) {
  console.error(`\n✖ ${findings.length} finding(s):`);
  for (const f of [...new Set(findings)]) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nPASS — buyer catalogue clean at 320/375/390/414/768/1440");
