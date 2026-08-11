#!/usr/bin/env node
// ============================================================================
// /seller/products, /new and /:id/edit — responsive + accessibility gate
// ----------------------------------------------------------------------------
//   supabase start && supabase db reset
//   VITE_SUPABASE_URL=http://127.0.0.1:54321 \
//   VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key> npm run dev            # :8080
//   node scripts/seller-products-qa.mjs
//
// The same questions seller-settings-qa.mjs asks, asked of the three catalog
// routes with a real session against a real database — plus the ones only this
// screen can get wrong: does the empty state differ from the no-results state,
// does the total come from the database, is the filter chip's number the
// catalog's number rather than the page's.
//
// It seeds its own pilot seller, shop and products through the real RPCs — no
// direct INSERT into products, because an INSERT that skips product_create
// would test a shape the product cannot actually reach — and deletes them
// afterwards, including on failure.
// ============================================================================

import { chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  ANON,
  API,
  STORAGE_KEY,
  adminClient,
  anonClient,
  axeFindings,
  keyboardFindings,
  signedInContext,
  structureFindings,
  sweepWidths,
} from "./qa/seller-qa-kit.mjs";

const APP = process.env.SELLER_QA_BASE_URL ?? "http://localhost:8080";

const findings = [];
const note = (msg) => findings.push(msg);

const admin = adminClient();
const run = randomUUID().slice(0, 8);
const email = `qa-catalog-${run}@thepicklehub.test`;
const password = `Pw-${randomUUID()}`;

const PRODUCTS = [
  { title: `Vợt carbon T700 16mm ${run}`, category: "vot", price: 2450000, stock: 4 },
  { title: `Giày pickleball nam ${run}`, category: "giay", price: 1290000, stock: null },
  { title: `Bóng thi đấu hộp 6 quả ${run}`, category: "bong", price: 210000, stock: 40 },
];

async function seed() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const userId = created.user.id;

  await admin.from("shop_pilot_members").insert({ user_id: userId });
  const { data: shop, error: shopError } = await admin
    .from("shops")
    .insert({
      slug: `qa-catalog-${run}`,
      name: `Shop Danh Mục ${run}`,
      state: "active",
      owner_user_id: userId,
      city: "TP. Hồ Chí Minh",
    })
    .select()
    .single();
  if (shopError) throw shopError;
  await admin.from("shop_members").insert({ shop_id: shop.id, user_id: userId, role: "owner" });

  const user = anonClient();
  const { data: session, error: signInError } = await user.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  const ids = [];
  for (const [i, p] of PRODUCTS.entries()) {
    const { data, error: rpcError } = await user.rpc("product_create", {
      _shop_id: shop.id,
      _client_token: `qa-${run}-${i}`,
      _payload: {
        title: p.title,
        category_slug: p.category,
        price_vnd: p.price,
        stock: p.stock,
        description: "Hàng có sẵn, giao trong ngày ở nội thành.",
      },
    });
    if (rpcError) throw rpcError;
    ids.push(data.id);
  }

  return { userId, shopId: shop.id, session: session.session, productId: ids[0] };
}

async function cleanup(userId, shopId) {
  // Products cascade from the shop; the shop cascades from nothing, so it goes
  // explicitly. Both run even when the browser half failed.
  if (shopId) await admin.from("shops").delete().eq("id", shopId);
  if (userId) await admin.auth.admin.deleteUser(userId);
}

/** Every check a Seller Center route gets, at every width, plus axe. */
async function auditRoute(page, path, expectHeading) {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${APP}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const h1 = (await page.locator("h1").first().textContent()) ?? "";
  if (!h1.includes(expectHeading)) {
    note(`AUTH/ROUTE ${path} — mong "${expectHeading}", thấy "${h1.trim()}". Session key: ${STORAGE_KEY} (API ${API}, anon ${ANON.slice(0, 12)}…)`);
    return false;
  }

  for (const f of await structureFindings(page)) note(`${path} ${f}`);
  for (const f of await sweepWidths(page)) note(`${path} ${f}`);

  await page.setViewportSize({ width: 375, height: 900 });
  await page.waitForTimeout(250);
  for (const f of await axeFindings(page)) note(`${path} ${f}`);
  for (const f of await keyboardFindings(page)) note(`${path} ${f}`);
  return true;
}

const main = async () => {
  let seeded = { userId: null, shopId: null };
  const browser = await chromium.launch();

  try {
    seeded = await seed();
    const context = await signedInContext(browser, APP, seeded.session);
    const page = await context.newPage();
    page.on("pageerror", (e) => note(`JS lỗi: ${e.message}`));

    const listed = await auditRoute(page, "/seller/products", "Sản phẩm");
    if (listed) {
      // The three numbers that are only correct if they came from the database.
      const total = await page.locator('[role="status"]').first().textContent();
      if (!total || !total.includes(String(PRODUCTS.length))) {
        note(`LIST tổng số không khớp dữ liệu thật — thấy "${(total ?? "").trim()}", mong ${PRODUCTS.length}`);
      }

      const draftChip = await page
        .getByRole("button", { name: new RegExp(`Nháp \\(${PRODUCTS.length}\\)`) })
        .count();
      if (draftChip === 0) note(`LIST chip "Nháp" không hiện số thật (${PRODUCTS.length})`);

      // No results is not the same screen as no catalog.
      await page.fill("#prod-q", "khong-co-san-pham-nao-ten-nhu-vay");
      await page.waitForTimeout(900);
      const emptyTitle = (await page.locator(".tl-shop-empty-title").first().textContent()) ?? "";
      if (!emptyTitle.includes("khớp")) {
        note(`LIST tìm không ra lại hiện trạng thái "chưa có sản phẩm": "${emptyTitle.trim()}"`);
      }
      await page.fill("#prod-q", "");
      await page.waitForTimeout(700);
    }

    await auditRoute(page, "/seller/products/new", "Thêm sản phẩm");
    await auditRoute(page, `/seller/products/${seeded.productId}/edit`, PRODUCTS[0].title);
  } finally {
    await browser.close();
    await cleanup(seeded.userId, seeded.shopId);
  }

  if (findings.length) {
    console.error(`\n✖ ${findings.length} phát hiện trên các màn hình sản phẩm\n`);
    for (const f of findings) console.error("  " + f);
    process.exit(1);
  }
  console.log("\n✅ /seller/products + /new + /:id/edit — không có phát hiện nào (320/375/414/768/1440 + zoom + axe).\n");
};

await main();
