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
// sane, can the page still be zoomed, does axe find a violation.
//
// The checks themselves live in scripts/qa/seller-qa-kit.mjs, shared with
// seller-products-qa.mjs. The `meta-viewport` exemption that used to sit here
// is gone: index.html no longer caps zoom, so a cap coming back must red the
// gate rather than print a warning.
//
// It seeds its own pilot seller and shop, and deletes them afterwards.
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
const email = `qa-seller-${run}@thepicklehub.test`;
const password = `Pw-${randomUUID()}`;

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
      slug: `qa-shop-${run}`,
      name: `Shop Kiểm Thử ${run}`,
      state: "active",
      owner_user_id: userId,
      intro: "Shop bán vợt và phụ kiện pickleball ở TP. Hồ Chí Minh.",
      city: "TP. Hồ Chí Minh",
    })
    .select()
    .single();
  if (shopError) throw shopError;

  await admin.from("shop_members").insert({ shop_id: shop.id, user_id: userId, role: "owner" });

  const user = anonClient();
  const { data: session, error: signInError } = await user.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  // Give the shop one contact channel so the list state is exercised, not just
  // the empty state.
  await user.rpc("shop_contact_upsert", {
    _shop_id: shop.id,
    _type: "zalo",
    _value: "0901234567",
    _label: "Zalo shop",
    _is_public: true,
    _id: null,
  });

  return { userId, shopId: shop.id, session: session.session };
}

async function cleanup(userId, shopId) {
  // Checked, not fired and forgotten. A teardown that reports success while
  // leaving its shop behind is how six of them accumulated during step 5.
  const { error: shopError } = await admin.from("shops").delete().eq("id", shopId);
  if (shopError) note(`TEARDOWN không xoá được shop ${shopId}: ${shopError.message}`);
  const { error: userError } = await admin.auth.admin.deleteUser(userId);
  if (userError) note(`TEARDOWN không xoá được tài khoản ${userId}: ${userError.message}`);
}

const main = async () => {
  const { userId, shopId, session } = await seed();
  const browser = await chromium.launch();

  try {
    const context = await signedInContext(browser, APP, session);
    const page = await context.newPage();
    page.on("pageerror", (e) => note(`JS  lỗi: ${e.message}`));

    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(`${APP}/seller/settings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    const h1 = await page.locator("h1").first().textContent();
    if (!h1 || !h1.includes("Cài đặt shop")) {
      note(`AUTH không vào được /seller/settings — thấy "${(h1 ?? "").trim()}". Session key: ${STORAGE_KEY} (API ${API}, anon ${ANON.slice(0, 12)}…)`);
      throw new Error("not signed in");
    }

    for (const f of await structureFindings(page)) note(f);
    for (const f of await sweepWidths(page)) note(f);

    await page.setViewportSize({ width: 375, height: 900 });
    await page.waitForTimeout(250);
    for (const f of await axeFindings(page)) note(f);
    for (const f of await keyboardFindings(page)) note(f);
  } finally {
    await browser.close();
    await cleanup(userId, shopId);
  }

  if (findings.length) {
    console.error(`\n✖ ${findings.length} phát hiện trên /seller/settings\n`);
    for (const f of findings) console.error("  " + f);
    process.exit(1);
  }
  console.log("\n✅ /seller/settings — không có phát hiện nào (320/375/414/768/1440 + zoom + axe).\n");
};

await main();
