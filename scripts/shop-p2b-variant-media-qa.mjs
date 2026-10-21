// ============================================================================
// Supplemental A — the photo follows the variant, on the real PDP.
// ----------------------------------------------------------------------------
//   npx supabase start && npx supabase db reset
//   VITE_SUPABASE_URL=http://127.0.0.1:54321 \
//   VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key> npm run dev            # :8080
//   node scripts/shop-p2b-variant-media-qa.mjs
//
// P2b.5 recorded this gap in its own completion log, honestly and in advance:
//
//   "breaking the PDP's USE of `activeMediaId` left the unit tests green,
//    because they cover the function and not the wiring. The red proof was
//    done at the function. The page-level guard is the browser gate."
//
// The browser gate it referred to never asserted the swap: `buyer-shop-qa.mjs`
// checks that a PDP renders, not that changing the colour changes the photo.
// This file closes that, and it asserts on the two things a buyer actually
// gets — the `src` of the main <img> and which thumbnail carries
// aria-current — never on alt text and never on the word printed in the
// option button. Alt text and labels are what a broken mapping would still
// get right.
//
// Red proof: make ProductDetail ignore activeMediaId (e.g.
// `const shownMediaId = product ? product.primary_media_id : null`) and the
// swap assertions go red while every unit test in variantSelection.test.ts
// stays green.
//
// Exit code 1 on any finding, including a dirty teardown.
// ============================================================================

import { chromium } from "playwright";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { ANON, API, adminClient, grantAdminLocally } from "./qa/seller-qa-kit.mjs";
import { newRegistry, teardownP2bAcceptance, webpBytes, PASSWORD, DRAFT_BUCKET, PUBLIC_BUCKET } from "./qa/p2b-seed.mjs";

const APP = process.env.SHOP_QA_BASE_URL ?? "http://localhost:8080";
const SHOT_DIR = process.env.SHOP_QA_SHOT_DIR ?? mkdtempSync(join(tmpdir(), "tph-p2b7-variant-"));

const findings = [];
const note = (where, msg) => findings.push(`${where}: ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);

const anon = () => createClient(API, ANON, { auth: { persistSession: false } });
const reg = newRegistry();
const run = Date.now().toString(36);

// Màu Trắng/Đen and Size 39/40 are the brief's. Size 41 is added, and here is
// why it has to be:
//
// `initialSelection` opens the PDP on the first BUYABLE combination, so a size
// is ALWAYS already chosen on arrival. The only way to reach "a colour is
// chosen and a size is not" — the state the swap is really about — is
// `pickOption` releasing the other group because the new combination does not
// exist. That needs a size the buyer can first SELECT (so not the sold-out
// one) and which the other colour does not have.
//
// With only 39 and 40, making Trắng/40 sold out blocks that path, and making
// it available leaves nowhere to put the sold-out state. 41 gives all four
// states room to coexist without weakening any of them.
const GROUPS = [
  { name: "Màu", values: ["Trắng", "Đen"] },
  { name: "Size", values: ["39", "40", "41"] },
];

// Trắng/41 is SOLD OUT. Đen/40 was NEVER MADE. Two different states that must
// read as two different sentences — a PDP that collapses them tells a buyer
// the seller ran out of something the seller never sold.
const ROWS = [
  { option_values: { "Màu": "Trắng", Size: "39" }, price_vnd: "1500000", stock_on_hand: "5", sku: null, position: 0 },
  { option_values: { "Màu": "Trắng", Size: "40" }, price_vnd: "1600000", stock_on_hand: "3", sku: null, position: 1 },
  { option_values: { "Màu": "Trắng", Size: "41" }, price_vnd: "1650000", stock_on_hand: "0", sku: null, position: 2 },
  { option_values: { "Màu": "Đen", Size: "39" }, price_vnd: "1700000", stock_on_hand: "4", sku: null, position: 3 },
  { option_values: { "Màu": "Đen", Size: "41" }, price_vnd: "1750000", stock_on_hand: "2", sku: null, position: 4 },
];

async function seed() {
  const admin = adminClient();

  const email = `p2b7-vm-${run}@thepicklehub.test`;
  const { data: u, error: ue } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (ue) throw new Error(`createUser: ${ue.message}`);
  reg.userIds.push(u.user.id);
  const seller = anon();
  await seller.auth.signInWithPassword({ email, password: PASSWORD });

  const adminEmail = `p2b7-vm-admin-${run}@thepicklehub.test`;
  const { data: au, error: ae } = await admin.auth.admin.createUser({
    email: adminEmail, password: PASSWORD, email_confirm: true,
  });
  if (ae) throw new Error(`createUser admin: ${ae.message}`);
  reg.userIds.push(au.user.id);
  grantAdminLocally(au.user.id);
  const mod = anon();
  await mod.auth.signInWithPassword({ email: adminEmail, password: PASSWORD });

  await admin.from("shop_pilot_members").insert({ user_id: u.user.id });
  const { data: shop, error: se } = await admin.from("shops").insert({
    slug: `p2b7-vm-${run}`, name: `Shop Ảnh Phiên Bản ${run}`, state: "active",
    owner_user_id: u.user.id, region: "Hà Nội",
    verified_at: new Date().toISOString(), verified_method: "giay-phep-kinh-doanh",
  }).select().single();
  if (se) throw new Error(`shops: ${se.message}`);
  reg.shopIds.push(shop.id);
  await admin.from("shop_members").insert({ shop_id: shop.id, user_id: u.user.id, role: "owner" });

  const { data: created, error: ce } = await seller.rpc("product_create", {
    _shop_id: shop.id,
    _client_token: `p2b7vm-${run}`,
    _payload: {
      title: `Giày QA Ảnh Theo Màu ${run}`,
      description: "Giày pickleball đế gum, upper lưới thoáng, dùng cho phép thử ảnh theo phiên bản.",
      category_slug: "giay", condition: "new", price_vnd: "1500000", stock_on_hand: "5",
    },
  });
  if (ce) throw new Error(`product_create: ${ce.message}`);
  reg.productIds.push(created.id);
  const productId = created.id;

  // Two DIFFERENT photos. Different pixel dimensions so the stored bytes
  // differ too — identical bytes would let a mapping bug pass by coincidence.
  const mediaIds = [];
  for (const [w, h] of [[1200, 900], [800, 1000]]) {
    const { data: init, error: me } = await seller.rpc("product_media_upload_init", {
      _product_id: productId, _content_type: "image/jpeg", _byte_size: 4000,
      _original_filename: `anh-${w}x${h}.jpg`, _client_token: `p2b7vm-${run}-${w}`,
    });
    if (me) throw new Error(`upload_init: ${me.message}`);
    for (const [path, bytes] of [[init.draft_path, webpBytes(64, 48)], [init.rendition_path, webpBytes(w, h)]]) {
      const { error } = await seller.storage.from(DRAFT_BUCKET)
        .upload(path, new Blob([bytes], { type: "image/webp" }), { contentType: "image/webp", upsert: true });
      if (error) throw new Error(`upload ${path}: ${error.message}`);
      reg.objects.push({ bucket: DRAFT_BUCKET, path });
    }
    const { error: fe } = await seller.rpc("product_media_finalize", {
      _media_id: init.media_id, _width: w, _height: h,
    });
    if (fe) throw new Error(`finalize: ${fe.message}`);
    mediaIds.push(init.media_id);
  }
  const [mediaA, mediaB] = mediaIds;

  const { data: v0 } = await admin.from("products").select("version").eq("id", productId).single();
  const { error: re } = await seller.rpc("product_variants_reconcile", {
    _product_id: productId, _expected_version: v0.version,
    _option_groups: GROUPS, _rows: ROWS,
    _client_token: `p2b7vm-${run}-matrix`, _keep_variant_id: null,
  });
  if (re) throw new Error(`variants_reconcile: ${re.message}`);

  const { data: variants } = await admin
    .from("product_variants").select("id,option_values,option_key,stock_on_hand,price_vnd,position")
    .eq("product_id", productId).is("retired_at", null).order("position");
  const byOpts = (mau, size) =>
    (variants ?? []).find((v) => v.option_values?.["Màu"] === mau && v.option_values?.Size === size);

  // Trắng → A on BOTH its sizes, Đen → B. Mapping the colour rather than the
  // exact combination is what makes "the photo changes before a size is
  // picked" true at all.
  for (const [variant, media] of [
    [byOpts("Trắng", "39"), mediaA],
    [byOpts("Trắng", "40"), mediaA],
    [byOpts("Trắng", "41"), mediaA],
    [byOpts("Đen", "39"), mediaB],
    [byOpts("Đen", "41"), mediaB],
  ]) {
    if (!variant) throw new Error("reconcile did not produce the expected combination");
    const { error } = await seller.rpc("product_variant_set_media", {
      _variant_id: variant.id, _media_id: media,
    });
    if (error) throw new Error(`variant_set_media: ${error.message}`);
  }

  const { data: v1 } = await admin.from("products").select("version").eq("id", productId).single();
  const { error: sube } = await seller.rpc("product_submit", {
    _product_id: productId, _expected_version: v1.version, _client_token: `p2b7vm-${run}-sub`,
  });
  if (sube) throw new Error(`product_submit: ${sube.message}`);
  const { error: de } = await mod.rpc("product_decide", {
    _product_id: productId, _decision: "approve", _client_token: `p2b7vm-${run}-ap`,
  });
  if (de) throw new Error(`product_decide: ${de.message}`);

  const { data: plan, error: pe } = await seller.rpc("product_publish_prepare", { _product_id: productId });
  if (pe) throw new Error(`publish_prepare: ${pe.message}`);
  for (const copy of plan.copies) {
    const { data: blob } = await admin.storage.from(DRAFT_BUCKET).download(copy.source);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { error } = await admin.storage.from(PUBLIC_BUCKET).upload(copy.target, bytes, {
      contentType: "image/webp", upsert: true,
    });
    if (error) throw new Error(`copy public: ${error.message}`);
    reg.objects.push({ bucket: PUBLIC_BUCKET, path: copy.target });
  }
  const { error: cce } = await admin.rpc("product_publish_commit", {
    _product_id: productId, _copied: plan.copies,
  });
  if (cce) throw new Error(`publish_commit: ${cce.message}`);

  // ── Assert the fixture is what it claims, before the browser opens ───────
  const { data: prod } = await admin
    .from("products").select("slug,status,is_published").eq("id", productId).single();
  if (prod.status !== "approved" || !prod.is_published) {
    throw new Error(`product is ${prod.status}/published=${prod.is_published}, not publishable`);
  }
  const { data: media } = await admin
    .from("product_media").select("id,public_path").eq("product_id", productId);
  const publicPaths = Object.fromEntries((media ?? []).map((m) => [m.id, m.public_path]));
  if ((media ?? []).filter((m) => m.public_path).length !== 2) {
    throw new Error(`expected 2 public renditions, got ${(media ?? []).filter((m) => m.public_path).length}`);
  }
  if (publicPaths[mediaA] === publicPaths[mediaB]) {
    throw new Error("both variants point at the same public object — the swap would be untestable");
  }

  const { data: mapped } = await admin
    .from("product_variants").select("option_values,media_id").eq("product_id", productId).is("retired_at", null);
  const mediaOf = (mau, size) =>
    (mapped ?? []).find((v) => v.option_values?.["Màu"] === mau && v.option_values?.Size === size)?.media_id;
  if (mediaOf("Trắng", "39") !== mediaA) throw new Error("Trắng/39 is not mapped to media A");
  if (mediaOf("Trắng", "40") !== mediaA) throw new Error("Trắng/40 is not mapped to media A");
  if (mediaOf("Đen", "39") !== mediaB) throw new Error("Đen/39 is not mapped to media B");
  if (mediaOf("Đen", "41") !== mediaB) throw new Error("Đen/41 is not mapped to media B");
  if (mediaOf("Đen", "40")) throw new Error("Đen/40 exists — it must not");
  const soldOut = (mapped ?? []).find(
    (v) => v.option_values?.["Màu"] === "Trắng" && v.option_values?.Size === "41",
  );
  if (!soldOut) throw new Error("the sold-out combination Trắng/41 was not created");

  // And the same mapping through the PUBLIC read model, which is what the page
  // will actually receive.
  const { data: dto, error: dtoErr } = await anon().rpc("shop_public_product", { _slug: prod.slug });
  if (dtoErr) throw new Error(`shop_public_product: ${dtoErr.message}`);
  const pv = dto.product.variants ?? [];
  const pubMediaOf = (mau, size) =>
    pv.find((v) => v.option_values?.["Màu"] === mau && v.option_values?.Size === size)?.media_id;
  if (pubMediaOf("Trắng", "39") !== mediaA) throw new Error("public projection lost the Trắng→A mapping");
  if (pubMediaOf("Đen", "39") !== mediaB) throw new Error("public projection lost the Đen→B mapping");
  if (pubMediaOf("Đen", "40")) throw new Error("public projection invented Đen/40");
  if (pv.length !== ROWS.length) {
    throw new Error(`public projection returns ${pv.length} variants, expected ${ROWS.length}`);
  }

  console.log(`fixture ${run}`);
  console.log(`  product   ${productId}  slug ${prod.slug}`);
  console.log(`  media A   ${mediaA}  → ${publicPaths[mediaA]}`);
  console.log(`  media B   ${mediaB}  → ${publicPaths[mediaB]}`);
  console.log(`  Trắng 39/40 in stock · Trắng/41 SOLD OUT · Đen 39/41 in stock · Đen/40 NEVER MADE\n`);

  return { productId, slug: prod.slug, mediaA, mediaB, publicPaths, shopId: shop.id };
}

// ── Browser assertions ──────────────────────────────────────────────────────

/** The public object the main <img> is actually pointing at. */
const mainImageKey = async (page) => {
  const src = await page.locator(".tl-pdp-media img").first().getAttribute("src");
  if (!src) return null;
  const marker = "/storage/v1/object/public/shop-product-media/";
  const at = src.indexOf(marker);
  return at === -1 ? src : src.slice(at + marker.length);
};

/** Which thumbnail is marked current, as a public object key. */
const activeThumbKey = async (page) => {
  const src = await page
    .locator('.tl-pdp-thumbs button[aria-current="true"] img')
    .first().getAttribute("src").catch(() => null);
  if (!src) return null;
  const marker = "/storage/v1/object/public/shop-product-media/";
  const at = src.indexOf(marker);
  return at === -1 ? src : src.slice(at + marker.length);
};

const optionButton = (page, group, value) =>
  page.locator("fieldset", { has: page.locator("legend", { hasText: group }) })
    .locator("button.tl-pdp-opt", { hasText: new RegExp(`^${value}`) }).first();

async function main() {
  const browser = await chromium.launch();
  let seeded = null;
  try {
    seeded = await seed();
    const wantA = seeded.publicPaths[seeded.mediaA];
    const wantB = seeded.publicPaths[seeded.mediaB];

    const ctx = await browser.newContext({
      viewport: { width: 375, height: 900 },
      storageState: {
        cookies: [],
        origins: [{ origin: APP, localStorage: [{ name: "pickleball-hub-language", value: "vi" }] }],
      },
    });
    const page = await ctx.newPage();
    const payloads = [];
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("response", async (r) => {
      if (r.url().includes("/rest/v1/")) {
        const body = await r.text().catch(() => "");
        if (body) payloads.push(body);
      }
    });

    // ── 1. initial state ────────────────────────────────────────────────────
    await page.goto(`${APP}/shop/product/${seeded.slug}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);

    const h1 = (await page.locator("h1").first().textContent()) ?? "";
    if (!h1.includes("Giày QA Ảnh Theo Màu")) {
      note("pdp", `heading is "${h1.trim()}" — the page did not render the fixture`);
      throw new Error("PDP did not render; the rest of this run would be meaningless");
    }
    const thumbCount = await page.locator(".tl-pdp-thumbs button.tl-pdp-thumb").count();
    if (thumbCount !== 2) note("step1", `${thumbCount} thumbnails, expected 2`);
    const initialKey = await mainImageKey(page);
    if (![wantA, wantB].includes(initialKey)) {
      note("step1", `main image is ${initialKey}, which is neither A nor B`);
    }
    ok(`1. initial main image ${initialKey === wantA ? "= A" : initialKey === wantB ? "= B" : "?"}`);

    // ── 2. the state the brief asked for does not exist on this screen ──────
    // The brief says "choose Đen BEFORE choosing a size". That state cannot be
    // reached, and this asserts WHY rather than quietly testing something
    // else:
    //
    //   · `initialSelection` opens the PDP on the first buyable combination,
    //     so a size is already chosen on arrival; and
    //   · `optionState` disables any option that has no combination with the
    //     rest of the current selection, so the one click that would make
    //     `pickOption` release a group is never clickable.
    //
    // With Size 40 selected, Đen must therefore be DISABLED — Đen/40 was never
    // made. That guard is what makes a partial selection unreachable, so it is
    // pinned here: if it is ever relaxed, the assumption behind steps 3–5
    // changes and this goes red first.
    await optionButton(page, "Size", "40").click();
    await page.waitForTimeout(300);
    const denWith40 = optionButton(page, "Màu", "Đen");
    if (!(await denWith40.isDisabled())) {
      note("step2", "Đen is clickable while Size 40 is selected, but Đen/40 does not exist");
    } else {
      ok("2. a colour with no combination for the chosen size is disabled, not offered");
    }
    // Back to a complete, buyable combination for the swap itself.
    await optionButton(page, "Size", "39").click();
    await page.waitForTimeout(300);

    // ── 3–4. the swap: one click on the colour ──────────────────────────────
    const beforeSwap = await mainImageKey(page);
    if (beforeSwap !== wantA) note("step3", `starting image is ${beforeSwap}, expected media A`);
    await optionButton(page, "Màu", "Đen").click();
    await page.waitForTimeout(350);

    const afterDen = await mainImageKey(page);
    if (afterDen !== wantB) note("step3", `main image is ${afterDen}, expected media B (${wantB})`);
    else ok("3. one click on Đen → main image swapped from A to media B");

    const thumbDen = await activeThumbKey(page);
    if (thumbDen !== wantB) note("step4", `active thumbnail is ${thumbDen}, expected B`);
    else ok("4. thumbnail B carries aria-current");

    // ── 5–6. the size came with it, and reads correctly ─────────────────────
    const sizeAfterSwap = await optionButton(page, "Size", "39").getAttribute("aria-pressed");
    if (sizeAfterSwap !== "true") note("step5", `size 39 was released although Đen/39 exists`);
    const price = (await page.locator(".tl-pdp-price").first().textContent()) ?? "";
    if (!price.includes("1.700.000")) note("step6", `price is "${price.trim()}", expected 1.700.000₫ for Đen/39`);
    const meta = (await page.locator(".tl-pdp-meta").first().textContent()) ?? "";
    if (!/Còn hàng/.test(meta)) note("step6", `availability reads "${meta.trim()}", expected Còn hàng`);
    else ok("6. Đen/39 keeps media B, price 1.700.000₫, Còn hàng");

    // ── 6b. the photo drives the selection, not only the other way round ────
    // Clicking thumbnail A must select a Trắng combination, so price and SKU
    // cannot drift away from the picture the buyer is looking at.
    const thumbA = page.locator(".tl-pdp-thumbs button.tl-pdp-thumb").filter({
      has: page.locator(`img[src*="${wantA.split("/").pop()}"]`),
    }).first();
    if (await thumbA.count()) {
      await thumbA.click();
      await page.waitForTimeout(350);
      const afterThumb = await mainImageKey(page);
      if (afterThumb !== wantA) note("step6b", `clicking thumbnail A left the main image at ${afterThumb}`);
      const colourAfterThumb = await optionButton(page, "Màu", "Trắng").getAttribute("aria-pressed");
      if (colourAfterThumb !== "true") note("step6b", "clicking thumbnail A did not select its colour");
      else ok("6b. clicking a thumbnail selects the variant that photo belongs to");
      // Back to Đen for the steps below.
      await optionButton(page, "Màu", "Đen").click();
      await page.waitForTimeout(300);
    } else {
      note("step6b", "could not locate thumbnail A by its public object key");
    }

    // ── 7–10. back to Trắng ─────────────────────────────────────────────────
    const beforeBack = await mainImageKey(page);
    if (beforeBack !== wantB) note("step7", `expected media B before switching back, got ${beforeBack}`);
    await optionButton(page, "Màu", "Trắng").click();
    await page.waitForTimeout(350);
    const afterTrang = await mainImageKey(page);
    if (afterTrang !== wantA) note("step8", `main image is ${afterTrang}, expected media A (${wantA})`);
    else ok("8. Trắng → main image swapped to media A");

    const thumbTrang = await activeThumbKey(page);
    if (thumbTrang !== wantA) note("step9", `active thumbnail is ${thumbTrang}, expected A`);
    else ok("9. thumbnail A carries aria-current");

    const size39Pressed = await optionButton(page, "Size", "39").getAttribute("aria-pressed");
    if (size39Pressed !== "true") {
      note("step10", `size 39 was released although Trắng/39 exists (aria-pressed=${size39Pressed})`);
    } else ok("10. size 39 kept — the combination exists");

    const priceTrang = (await page.locator(".tl-pdp-price").first().textContent()) ?? "";
    if (!priceTrang.includes("1.500.000")) {
      note("step10", `price is "${priceTrang.trim()}", expected 1.500.000₫ for Trắng/39`);
    }

    // ── 11–12. sold out vs never made ───────────────────────────────────────
    // Trắng is selected, so Size 41 is the SOLD OUT combination.
    const size41 = optionButton(page, "Size", "41");
    const soldOutDisabled = await size41.isDisabled();
    const soldOutLabel = (await size41.textContent()) ?? "";
    if (!soldOutDisabled) note("step11", "the sold-out combination Trắng/41 is not disabled");
    if (!/hết hàng/i.test(soldOutLabel)) {
      note("step11", `Trắng/41 reads "${soldOutLabel.trim()}" — it does not say hết hàng`);
    } else ok("11. Trắng/41 is disabled and says hết hàng");

    // Switch to Đen, where 40 was NEVER MADE.
    await optionButton(page, "Màu", "Đen").click();
    await page.waitForTimeout(350);
    const missing40 = optionButton(page, "Size", "40");
    const missingDisabled = await missing40.isDisabled();
    const missingLabel = (await missing40.textContent()) ?? "";
    if (!missingDisabled) note("step12", "the non-existent combination Đen/40 is not disabled");
    if (!/không có lựa chọn này/i.test(missingLabel)) {
      note("step12", `Đen/40 reads "${missingLabel.trim()}" — it does not say the combination does not exist`);
    }
    if (soldOutLabel.trim() === missingLabel.trim()) {
      note("step12", "sold out and never-made say exactly the same thing");
    } else {
      ok("12. sold out and never-made are two different sentences");
    }

    // ── 13. nothing private reached the buyer ───────────────────────────────
    const html = await page.content();
    for (const bad of ["rendition_source_path", "draft_path", "shop-product-media-draft", "/original", "token=", "/object/sign/"]) {
      if (html.includes(bad)) note("step13", `DOM contains "${bad}"`);
    }
    for (const body of payloads) {
      for (const bad of ["rendition_source_path", "shop-product-media-draft", "/object/sign/"]) {
        if (body.includes(bad)) note("step13", `a REST payload contains "${bad}"`);
      }
      if (/"stock_on_hand"\s*:\s*-?\d/.test(body)) note("step13", "a REST payload carries a real stock quantity");
    }
    // Both public objects must be reachable anonymously, and nothing else.
    for (const key of [wantA, wantB]) {
      const res = await fetch(`${API}/storage/v1/object/public/shop-product-media/${key}`);
      if (res.status !== 200) note("step13", `public rendition ${key} answers ${res.status}`);
    }
    if (!findings.some((f) => f.startsWith("step13"))) ok("13. no draft or signed path on the buyer surface");

    if (consoleErrors.length) note("pdp", `console: ${consoleErrors.slice(0, 2).join(" | ")}`);

    // ── screenshots ─────────────────────────────────────────────────────────
    await page.screenshot({ path: join(SHOT_DIR, "375-pdp-den-media-b.png"), fullPage: true });
    await optionButton(page, "Màu", "Trắng").click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOT_DIR, "375-pdp-trang-media-a.png"), fullPage: true });

    await page.close();
    await ctx.close();
  } catch (e) {
    note("harness", (e.stack ?? String(e)).split("\n").slice(0, 3).join(" | "));
  } finally {
    await browser.close();
  }

  const remaining = await teardownP2bAcceptance(reg);
  for (const detail of remaining.errorDetail ?? []) note("teardown", detail);
  for (const [what, n] of Object.entries(remaining)) {
    if (what === "errorDetail" || typeof n !== "number" || n === 0) continue;
    note("teardown", n < 0 ? `${what} could not be counted` : `${n} ${what} left behind`);
  }

  console.log(`\nscreenshots: ${SHOT_DIR}`);
  console.log(`teardown: ${JSON.stringify(remaining)}`);
  if (findings.length) {
    console.error(`\n✖ ${findings.length} finding(s):`);
    for (const f of [...new Set(findings)]) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nPASS — the photo follows the variant, asserted on public object keys");
}

await main();
