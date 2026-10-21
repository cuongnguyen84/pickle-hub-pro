#!/usr/bin/env node
// ============================================================================
// Seller Center — real mobile viewport gate (P2a acceptance step 12)
// ----------------------------------------------------------------------------
//   supabase start && supabase db reset
//   VITE_SUPABASE_URL=http://127.0.0.1:54321 \
//   VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key> npm run dev            # :8080
//   node scripts/seller-mobile-gate.mjs
//
// Playwright sets the viewport on the CONTEXT, so `window.innerWidth` really is
// 375 — it is not a desktop window resized, and nothing here calls
// window.resizeTo(). The measured width is printed for every viewport and is
// itself an assertion: a gate that reports "375px clean" from a 1280px window
// is worse than no gate.
//
// Screenshots of the four screens that carry the acceptance decision are
// written to the path given by SELLER_SHOT_DIR (default: a temp dir), never
// into the repository.
// ============================================================================

import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { jpegWithGps } from "./qa/media-fixtures.mjs";
import {
  adminClient,
  anonClient,
  axeFindings,
  grantAdminLocally,
  overflowOf,
  remainingShopObjects,
  removeShopObjects,
  signedInContext,
  smallTargets,
  zoomAndFontFindings,
} from "./qa/seller-qa-kit.mjs";

const APP = process.env.SELLER_QA_BASE_URL ?? "http://localhost:8080";
const SHOT_DIR = process.env.SELLER_SHOT_DIR ?? "/tmp/thepicklehub-p2a-shots";

/** The viewports the acceptance asks for. iPhone descriptors where one exists,
 *  so the touch flags and the device pixel ratio are real too. */
const VIEWPORTS = [
  { name: "320x800", width: 320, height: 800 },
  { name: "375x812", width: 375, height: 812, device: "iPhone X" },
  { name: "390x844", width: 390, height: 844, device: "iPhone 12" },
  { name: "414x896", width: 414, height: 896, device: "iPhone 11" },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
];

const findings = [];
const note = (msg) => findings.push(msg);
const measured = [];

const admin = adminClient();
const run = randomUUID().slice(0, 8);
const email = `mob-${run}@thepicklehub.test`;
const password = `Pw-${randomUUID()}`;

async function seed() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw error;
  const userId = created.user.id;
  await admin.from("shop_pilot_members").insert({ user_id: userId });
  const { data: shop } = await admin.from("shops").insert({
    slug: `mob-${run}`, name: `Shop Di Động ${run}`, state: "active",
    owner_user_id: userId, region: "TP. Hồ Chí Minh",
    shipping_note: "Giao trong 2 ngày ở nội thành.", return_note: "Đổi trong 7 ngày.",
  }).select().single();
  await admin.from("shop_members").insert({ shop_id: shop.id, user_id: userId, role: "owner" });

  const user = anonClient();
  const { data: session } = await user.auth.signInWithPassword({ email, password });

  const { data: product } = await user.rpc("product_create", {
    _shop_id: shop.id, _client_token: `mob-${run}`,
    _payload: {
      title: `Giày pickleball Court Pro ${run}`,
      category_slug: "giay", price_vnd: 1290000, stock_on_hand: 4,
      description: "Giày sân cứng, đế bám tốt, size chuẩn. Hàng mới nguyên hộp.",
    },
  });

  // A real matrix, through the real reconcile.
  const { data: v1 } = await user.from("products").select("version").eq("id", product.id).single();
  await user.rpc("product_variants_reconcile", {
    _product_id: product.id, _expected_version: v1.version,
    _option_groups: [
      { name: "Màu sắc", values: ["Trắng", "Đen"] },
      { name: "Kích cỡ", values: ["39", "40"] },
    ],
    _rows: ["Trắng", "Đen"].flatMap((c) => ["39", "40"].map((s) => ({
      option_values: { "Màu sắc": c, "Kích cỡ": s },
      price_vnd: c === "Trắng" ? 1290000 : 1350000, stock_on_hand: 2,
      sku: `MOB-${run}-${c === "Trắng" ? "W" : "B"}${s}`,
    }))),
    _client_token: `mob-matrix-${run}`, _keep_variant_id: null,
  });

  const adminEmail = `mob-admin-${run}@thepicklehub.test`;
  const { data: adminUser } = await admin.auth.admin.createUser({
    email: adminEmail, password, email_confirm: true,
  });
  grantAdminLocally(adminUser.user.id);
  const adminAs = anonClient();
  await adminAs.auth.signInWithPassword({ email: adminEmail, password });

  return {
    userId, adminUserId: adminUser.user.id, adminClient: adminAs,
    shopId: shop.id, productId: product.id, session: session.session, user,
  };
}

/** Everything measured at one viewport, on whatever page is open. */
async function measure(page, label, expectWidth) {
  const inner = await page.evaluate(() => window.innerWidth);
  measured.push({ label, expected: expectWidth, innerWidth: inner });
  if (inner !== expectWidth) {
    note(`VIEWPORT ${label}: window.innerWidth = ${inner}, mong ${expectWidth} — phép đo không đáng tin`);
    return;
  }

  const overflow = await overflowOf(page);
  if (overflow > 1) note(`${label} tràn ngang ${overflow}px`);

  // Horizontal scroll measured on the app's own scroller, which is where the
  // page actually scrolls — the document never does.
  const scroll = await page.evaluate(() => {
    const el = document.querySelector(".tl-shop-scroll") ?? document.scrollingElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  if (scroll.scrollWidth > scroll.clientWidth + 1) {
    note(`${label} scrollWidth ${scroll.scrollWidth} > clientWidth ${scroll.clientWidth}`);
  }

  for (const f of await zoomAndFontFindings(page, expectWidth)) note(`${label} ${f}`);
  const small = await smallTargets(page);
  if (small.length) note(`${label} vùng chạm nhỏ hơn 44px: ${small.join(", ")}`);

  // The Seller Center carries its own navigation; the app's global chrome must
  // not appear on top of it.
  const chrome = await page.evaluate(() => ({
    chatFab: !!document.querySelector('[data-testid="chat-fab"], .tl-chat-fab'),
    bottomNav: !!document.querySelector("nav.tl-bottom-nav, [data-testid='bottom-nav']"),
  }));
  if (chrome.chatFab) note(`${label} ChatFAB hiện trên Seller Center`);
  if (chrome.bottomNav) note(`${label} BottomNav toàn cục hiện trên Seller Center`);
}

/** Is the sticky action bar covering anything it should not? */
async function stickyCheck(page, label) {
  const covered = await page.evaluate(() => {
    const bar = document.querySelector(".tl-shop-decision-actions");
    if (!bar) return null;
    const rect = bar.getBoundingClientRect();
    // The point just above the bar must belong to the bar or to content that
    // is scrollable into view — not to a control the bar is sitting on.
    const under = document.elementFromPoint(rect.left + rect.width / 2, rect.top - 4);
    return under ? under.closest(".tl-shop-decision-actions") !== null : false;
  });
  if (covered) note(`${label} thanh hành động dính đang che nội dung ngay phía trên`);
}

const main = async () => {
  let seeded = { userId: null, adminUserId: null, shopId: null, productId: null };
  mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const shots = [];

  try {
    seeded = await seed();

    for (const vp of VIEWPORTS) {
      const base = vp.device ? devices[vp.device] : {};
      const context = await browser.newContext({
        ...base,
        // The viewport is set on the CONTEXT, so window.innerWidth is really
        // this. No window.resizeTo, no desktop window pretending.
        viewport: { width: vp.width, height: vp.height },
        storageState: {
          cookies: [],
          origins: [{
            origin: APP,
            localStorage: [
              { name: "pickleball-hub-language", value: "vi" },
              { name: "tl-theme-mode", value: "dark" },
              { name: `sb-127-auth-token`, value: JSON.stringify(seeded.session) },
            ],
          }],
        },
      });
      const page = await context.newPage();
      page.on("console", (m) => {
        if (m.type() === "error") note(`${vp.name} console error: ${m.text().slice(0, 120)}`);
      });
      page.on("pageerror", (e) => note(`${vp.name} JS lỗi: ${e.message}`));

      // 1 — the editor, with the variant matrix.
      await page.goto(`${APP}/seller/products/${seeded.productId}/edit`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2500);
      await measure(page, `${vp.name} edit+matrix`, vp.width);
      await stickyCheck(page, `${vp.name} edit`);

      if (vp.width === 375) {
        // The matrix must be cards on a phone, not a shrunken table.
        const cards = await page.locator(".tl-shop-varcard").count();
        if (cards !== 4) note(`375 ma trận phải là ${4} thẻ, thấy ${cards}`);
        if (await page.locator(".tl-shop-tablewrap").first().isVisible()) {
          note("375 ma trận vẫn hiện bảng ngang");
        }
        for (const f of await axeFindings(page)) note(`375 edit ${f}`);

        const shot = `${SHOT_DIR}/375-product-edit-matrix.png`;
        await page.screenshot({ path: shot, fullPage: true });
        shots.push(shot);

        // 2 — the media editor, with a real upload.
        await page.setInputFiles("#pick-product-media", {
          name: "anh-san.jpg", mimeType: "image/jpeg", buffer: jpegWithGps(),
        });
        await page.waitForTimeout(6000);
        await measure(page, "375 media", 375);
        const mediaShot = `${SHOT_DIR}/375-media-editor.png`;
        await page.screenshot({ path: mediaShot, fullPage: true });
        shots.push(mediaShot);

        // 3 — the preview.
        const previewButton = page.getByRole("button", { name: "Xem trước như người mua" });
        if ((await previewButton.count()) > 0) {
          await previewButton.click();
          await page.waitForTimeout(2500);
          await measure(page, "375 preview", 375);
          for (const f of await axeFindings(page)) note(`375 preview ${f}`);
          const previewShot = `${SHOT_DIR}/375-preview.png`;
          await page.screenshot({ path: previewShot, fullPage: true });
          shots.push(previewShot);
        } else {
          note("375 không thấy nút xem trước");
        }

        // 4 — pending review, read-only.
        // Ask the server what is still blocking, so a disabled button is a
        // reported finding rather than a 30-second Playwright timeout.
        const { data: blocking } = await seeded.user.rpc("product_submit_preflight", {
          _product_id: seeded.productId,
        });
        if ((blocking ?? []).length > 0) {
          note(`375 vẫn còn ${blocking.length} việc chặn gửi duyệt: ${blocking.map((b) => b.code).join(", ")}`);
        }

        const submitButton = page.getByRole("button", { name: "Gửi duyệt" });
        if ((await submitButton.count()) > 0 && !(await submitButton.isDisabled())) {
          await submitButton.click();
          await page.waitForTimeout(3500);
          await page.reload({ waitUntil: "networkidle" });
          await page.waitForTimeout(2500);
          await measure(page, "375 pending", 375);
          const body = (await page.locator("body").textContent()) ?? "";
          if (!/Đang chờ quản trị viên xem/i.test(body)) {
            note("375 sau khi gửi duyệt không thấy trạng thái chờ duyệt");
          }
          for (const f of await axeFindings(page)) note(`375 pending ${f}`);
          const pendingShot = `${SHOT_DIR}/375-pending-review.png`;
          await page.screenshot({ path: pendingShot, fullPage: true });
          shots.push(pendingShot);
        } else {
          note("375 nút gửi duyệt không bấm được dù preflight đã sạch");
        }
      }

      await context.close();
    }
  } finally {
    await browser.close();
    if (seeded.shopId) {
      await removeShopObjects(admin, seeded.shopId);
      await admin.from("shops").delete().eq("id", seeded.shopId);
      await admin.from("shop_media_cleanup_jobs").delete().eq("shop_id", seeded.shopId);
      const left = await remainingShopObjects(admin, seeded.shopId);
      if (left.length) note(`TEARDOWN còn ${left.length} tệp trong storage`);
    }
    if (seeded.userId) await admin.auth.admin.deleteUser(seeded.userId);
    if (seeded.adminUserId) await admin.auth.admin.deleteUser(seeded.adminUserId);
  }

  console.log("\nwindow.innerWidth đo được:");
  for (const m of measured) {
    console.log(`  ${m.innerWidth === m.expected ? "✓" : "✗"} ${m.label}: ${m.innerWidth}px (mong ${m.expected})`);
  }
  console.log("\nẢnh chụp:");
  for (const s of shots) console.log("  " + s);

  if (findings.length) {
    console.error(`\n✖ ${findings.length} phát hiện\n`);
    for (const f of findings) console.error("  " + f);
    process.exit(1);
  }
  console.log("\n✅ Mobile viewport gate — không có phát hiện nào.\n");
};

await main();
