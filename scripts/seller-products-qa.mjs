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
        stock_on_hand: p.stock,
        description: "Hàng có sẵn, giao trong ngày ở nội thành.",
      },
    });
    if (rpcError) throw rpcError;
    ids.push(data.id);
  }

  // One product gets a real matrix, through the real reconcile RPC — an
  // INSERT would produce a shape product_variants_reconcile cannot reach.
  const { data: product, error: readError } = await user
    .from("products")
    .select("id,version")
    .eq("id", ids[1])
    .single();
  if (readError) throw readError;

  const { error: matrixError } = await user.rpc("product_variants_reconcile", {
    _product_id: product.id,
    _expected_version: product.version,
    _option_groups: [
      { name: "Màu sắc", values: ["Trắng", "Đen"] },
      { name: "Kích cỡ", values: ["39", "40", "41"] },
    ],
    _rows: ["Trắng", "Đen"].flatMap((color) =>
      ["39", "40", "41"].map((size, i) => ({
        option_values: { "Màu sắc": color, "Kích cỡ": size },
        price_vnd: color === "Trắng" ? 1290000 : 1350000,
        stock_on_hand: i,
        sku: `QA-${run}-${color === "Trắng" ? "W" : "B"}${size}`,
      })),
    ),
    _client_token: `qa-matrix-${run}`,
    _keep_variant_id: null,
  });
  if (matrixError) throw matrixError;

  return {
    userId,
    shopId: shop.id,
    session: session.session,
    productId: ids[0],
    matrixProductId: ids[1],
  };
}

async function cleanup(userId, shopId) {
  // Products cascade from the shop; the shop cascades from nothing, so it goes
  // explicitly. Both run even when the browser half failed.
  //
  // The result is CHECKED. This used to swallow the error, and the error was
  // real: the append-only ledger trigger refused the cascade, so every run left
  // its shop behind and the teardown reported success. Six of them accumulated
  // before an unrelated pgTAP noticed.
  if (shopId) {
    const { error } = await admin.from("shops").delete().eq("id", shopId);
    if (error) note(`TEARDOWN không xoá được shop ${shopId}: ${error.message}`);
  }
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) note(`TEARDOWN không xoá được tài khoản ${userId}: ${error.message}`);
  }
  if (shopId) {
    const { data } = await admin.from("shops").select("id").eq("id", shopId);
    if ((data ?? []).length > 0) note(`TEARDOWN shop ${shopId} vẫn còn sau khi dọn`);
  }
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
  let seeded = { userId: null, shopId: null, productId: null, matrixProductId: null };
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

    // The matrix product: same questions, plus the ones only this screen has.
    const matrixOk = await auditRoute(
      page,
      `/seller/products/${seeded.matrixProductId}/edit`,
      PRODUCTS[1].title,
    );
    if (matrixOk) {
      await page.setViewportSize({ width: 375, height: 900 });
      await page.waitForTimeout(400);

      // A 6-row matrix must be six cards on a phone, not a shrunken table.
      const cards = await page.locator(".tl-shop-varcard").count();
      if (cards !== 6) note(`MATRIX @375px mong 6 thẻ phiên bản, thấy ${cards}`);
      const tableVisible = await page.locator(".tl-shop-tablewrap").first().isVisible();
      if (tableVisible) note("MATRIX @375px vẫn hiện bảng ngang thay vì thẻ");

      // The bulk panel names the count it is about to change.
      const bulk = await page.getByText(/Đặt giá cho 6 phiên bản cùng lúc/).count();
      if (bulk === 0) note("MATRIX thiếu bảng đặt giá hàng loạt, hoặc không nói đúng số phiên bản");

      // A duplicate SKU must mark the LATER row only. Type one row's code into
      // another and check exactly one error appears, naming a row number.
      const skuInputs = page.locator('.tl-shop-varcard input[aria-label^="Mã hàng"]');
      const firstSku = await skuInputs.first().inputValue();
      await skuInputs.nth(1).fill(firstSku);
      await page.waitForTimeout(300);
      const alerts = page.locator('.tl-shop-varcard [role="alert"]');
      const dupErrors = await alerts.count();
      if (dupErrors !== 1) {
        note(`MATRIX trùng mã hàng phải báo đúng 1 dòng, thấy ${dupErrors}`);
      } else {
        const dupText = (await alerts.first().textContent()) ?? "";
        if (!/dòng \d+/.test(dupText)) note(`MATRIX lỗi trùng mã không chỉ ra dòng nào: "${dupText.trim()}"`);
      }

      // And the save is blocked while it stands, rather than failing at the DB.
      const saveDisabled = await page
        .getByRole("button", { name: "Lưu bảng phiên bản" })
        .isDisabled();
      if (!saveDisabled) note("MATRIX vẫn cho lưu khi còn mã hàng trùng");

      for (const f of await sweepWidths(page, "MATRIX")) note(f);
    }
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
