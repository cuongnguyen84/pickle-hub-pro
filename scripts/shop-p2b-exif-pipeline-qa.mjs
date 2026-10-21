// ============================================================================
// Supplemental B1 — a real photo's metadata, followed all the way to the CDN.
// ----------------------------------------------------------------------------
//   npx supabase start && npx supabase db reset
//   VITE_SUPABASE_URL=http://127.0.0.1:54321 \
//   VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key> npm run dev            # :8080
//   node scripts/shop-p2b-exif-pipeline-qa.mjs
//
// Every step is the production one:
//
//   1. a JPEG with real pixels, EXIF, an Orientation tag, a GPS IFD and an
//      XMP packet — built at run time, so no binary fixture lives in the repo;
//   2. the seller's own screen, `#pick-product-media`, which runs the client
//      pipeline in a real browser canvas;
//   3. the two Storage uploads the page performs with the seller's JWT;
//   4. `product_media_finalize`, which verifies the stored object;
//   5. the REAL edge function — `shop-media-lifecycle?action=publish`, served
//      by the local Supabase stack, holding the service role and running
//      `inspectWebp` on the bytes;
//   6. an anonymous GET of the resulting public object;
//   7. inspection of the bytes that came back.
//
// The seller's original is checked too, and it must STILL carry its EXIF and
// XMP. Without that, "the rendition is clean" could just mean the fixture was
// never dirty — which is how a metadata test quietly stops testing anything.
//
// Red proof: make the worker copy `item.source` from the DRAFT path (the
// untouched original) instead of the rendition, or make `inspectWebp` return
// ok unconditionally. Either way the public object is a JPEG carrying GPS and
// this goes red — six findings, starting with "the served object is not a
// WebP (first bytes ffd8ffe1)".
//
// ⚠ THE LOCAL EDGE RUNTIME CACHES ITS ISOLATE.
// Editing supabase/functions/** does NOT take effect on the next request: the
// first run after a change still executes the previous code, and so does the
// run after that. This cuts both ways and both of them lie —
//
//   · a red proof that "passes" may simply not have been applied yet;
//   · a restored file may keep failing long after it is correct.
//
// Both happened while writing this file. After ANY edit under
// supabase/functions/, run:
//
//     docker restart supabase_edge_runtime_ajvlcamxemgbxduhiqrl
//
// and only then believe the result. Everything this script asserts is read
// from Storage and Postgres rather than from the worker's own reply, so a
// stale isolate can never produce a false PASS on unmodified code — but it can
// certainly waste an afternoon.
// ============================================================================

import { chromium } from "playwright";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { ANON, API, adminClient, grantAdminLocally, signedInContext } from "./qa/seller-qa-kit.mjs";
import { newRegistry, teardownP2bAcceptance, PASSWORD, DRAFT_BUCKET, PUBLIC_BUCKET } from "./qa/p2b-seed.mjs";
import {
  assertPhotoFixtureIsReal, hasExif, hasFixtureGps, hasXmp, isWebp, jpegWithExifGpsXmp,
} from "./qa/media-fixtures.mjs";

const APP = process.env.SHOP_QA_BASE_URL ?? "http://localhost:8080";
const SHOT_DIR = process.env.SHOP_QA_SHOT_DIR ?? mkdtempSync(join(tmpdir(), "tph-p2b7-exif-"));
const MAX_RENDITION_BYTES = 1024 * 1024;

// Landscape on disk. With Orientation 6 a correct decoder turns it upright, so
// the STORED rendition must come out portrait — 2:1 in, 1:2 out. An
// orientation that is ignored is invisible in every other assertion.
const SRC_W = 400;
const SRC_H = 200;

const findings = [];
const note = (where, msg) => findings.push(`${where}: ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);

const anon = () => createClient(API, ANON, { auth: { persistSession: false } });
const reg = newRegistry();
const run = Date.now().toString(36);

/** A JPEG with real pixels, encoded by the browser under test. */
async function buildBaseJpeg(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${APP}/`, { waitUntil: "domcontentloaded" });
  const b64 = await page.evaluate(async ([w, h]) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d");
    // Asymmetric on both axes, so a rotation is visible in the pixels as well
    // as in the dimensions.
    g.fillStyle = "#123456";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#f0a020";
    g.fillRect(0, 0, w / 4, h);
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h / 8);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (const byte of buf) s += String.fromCharCode(byte);
    return btoa(s);
  }, [SRC_W, SRC_H]);
  await ctx.close();
  return Buffer.from(b64, "base64");
}

async function seed() {
  const admin = adminClient();
  const email = `p2b7-exif-${run}@thepicklehub.test`;
  const { data: u, error: ue } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (ue) throw new Error(`createUser: ${ue.message}`);
  reg.userIds.push(u.user.id);
  const seller = anon();
  await seller.auth.signInWithPassword({ email, password: PASSWORD });
  const { data: sess } = await seller.auth.getSession();

  const adminEmail = `p2b7-exif-admin-${run}@thepicklehub.test`;
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
    slug: `p2b7-exif-${run}`, name: `Shop Ảnh Thật ${run}`, state: "active",
    owner_user_id: u.user.id, region: "Hà Nội",
  }).select().single();
  if (se) throw new Error(`shops: ${se.message}`);
  reg.shopIds.push(shop.id);
  await admin.from("shop_members").insert({ shop_id: shop.id, user_id: u.user.id, role: "owner" });

  const { data: created, error: ce } = await seller.rpc("product_create", {
    _shop_id: shop.id, _client_token: `p2b7exif-${run}`,
    _payload: {
      title: `Vợt QA Ảnh Có Toạ Độ ${run}`,
      description: "Vợt carbon dùng cho phép thử xoá siêu dữ liệu ảnh, mô tả đủ dài để qua preflight.",
      category_slug: "vot", condition: "new", price_vnd: "1500000", stock_on_hand: "3",
    },
  });
  if (ce) throw new Error(`product_create: ${ce.message}`);
  reg.productIds.push(created.id);

  return { seller, sellerSession: sess.session, mod, shopId: shop.id, productId: created.id };
}

async function main() {
  const browser = await chromium.launch();
  let ctx = null;
  try {
    const s = await seed();
    const admin = adminClient();

    // ── the input ───────────────────────────────────────────────────────────
    const base = await buildBaseJpeg(browser);
    const photo = jpegWithExifGpsXmp(base, 6);
    for (const problem of assertPhotoFixtureIsReal(photo)) note("FIXTURE", problem);
    if (findings.length) throw new Error("the input photo is not what the test needs it to be");
    console.log(`input JPEG ${SRC_W}×${SRC_H}, ${photo.length} bytes · EXIF+GPS+XMP+Orientation=6`);
    ok("0. the input carries EXIF, a GPS IFD, an XMP packet and Orientation 6");

    // ── the seller's screen ─────────────────────────────────────────────────
    ctx = await signedInContext(browser, APP, s.sellerSession);
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    await page.goto(`${APP}/seller/products/${s.productId}/edit`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);

    const h1 = (await page.locator("h1").first().textContent()) ?? "";
    if (!h1.includes("Vợt QA Ảnh Có Toạ Độ")) {
      throw new Error(`the editor did not render the product (heading "${h1.trim()}")`);
    }

    await page.setInputFiles("#pick-product-media", [
      { name: "anh-dien-thoai.jpg", mimeType: "image/jpeg", buffer: photo },
    ]);
    await page.waitForTimeout(7000);
    await page.screenshot({ path: join(SHOT_DIR, "375-seller-media-uploaded.png"), fullPage: true }).catch(() => {});

    const { data: rows } = await admin
      .from("product_media")
      .select("id,draft_path,rendition_source_path,public_path,verified_at,width,height,byte_size")
      .eq("product_id", s.productId);
    if ((rows ?? []).length !== 1) {
      throw new Error(`expected 1 media row after the upload, got ${(rows ?? []).length}`);
    }
    const media = rows[0];
    if (!media.verified_at) throw new Error("finalize did not run — the server never verified the object");
    ok(`1. the page uploaded and the server finalized media ${media.id}`);

    // ── the seller's ORIGINAL is untouched ─────────────────────────────────
    const { data: origBlob } = await admin.storage.from(DRAFT_BUCKET).download(media.draft_path);
    const original = Buffer.from(await origBlob.arrayBuffer());
    if (!hasExif(original)) note("original", "the stored original lost its EXIF — the fixture proves nothing");
    if (!hasXmp(original)) note("original", "the stored original lost its XMP — the fixture proves nothing");
    if (!hasFixtureGps(original)) note("original", "the stored original lost its GPS");
    if (!findings.length) ok("2. the seller's original still carries EXIF, GPS and XMP — as it should");

    // ── the rendition, before anything is published ────────────────────────
    const { data: rendBlob } = await admin.storage.from(DRAFT_BUCKET).download(media.rendition_source_path);
    const rendition = Buffer.from(await rendBlob.arrayBuffer());
    if (!isWebp(rendition)) note("rendition", "the processed object is not a WebP");
    if (rendition.length > MAX_RENDITION_BYTES) {
      note("rendition", `${rendition.length} bytes, over the 1 MB cap`);
    }
    if (hasExif(rendition)) note("rendition", "still carries EXIF");
    if (hasXmp(rendition)) note("rendition", "still carries XMP");
    if (hasFixtureGps(rendition)) note("rendition", "still carries the GPS coordinates");

    // Orientation: 400×200 in, Orientation 6, so upright is 200×400.
    if (media.width !== SRC_H || media.height !== SRC_W) {
      note("orientation",
        `stored ${media.width}×${media.height}; with Orientation 6 a ${SRC_W}×${SRC_H} photo must become ${SRC_H}×${SRC_W}`);
    } else {
      ok(`3. Orientation 6 applied — ${SRC_W}×${SRC_H} stored upright as ${media.width}×${media.height}`);
    }
    if (!findings.some((f) => f.startsWith("rendition"))) {
      ok(`4. the rendition is a ${rendition.length}-byte WebP with no EXIF, GPS or XMP`);
    }

    // ── submit, approve, then the REAL worker ───────────────────────────────
    const { data: v } = await admin.from("products").select("version").eq("id", s.productId).single();
    const { error: sube } = await s.seller.rpc("product_submit", {
      _product_id: s.productId, _expected_version: v.version, _client_token: `p2b7exif-${run}-sub`,
    });
    if (sube) throw new Error(`product_submit: ${sube.message}`);
    const { error: de } = await s.mod.rpc("product_decide", {
      _product_id: s.productId, _decision: "approve", _client_token: `p2b7exif-${run}-ap`,
    });
    if (de) throw new Error(`product_decide: ${de.message}`);

    // Not a stand-in: the edge function the local stack serves, holding the
    // service role, running inspectWebp on the bytes before they are copied.
    const workerRes = await fetch(`${API}/functions/v1/shop-media-lifecycle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON,
        Authorization: `Bearer ${s.sellerSession.access_token}`,
      },
      body: JSON.stringify({ action: "publish", product_id: s.productId }),
    });
    const workerBody = await workerRes.json().catch(() => ({}));
    if (!workerRes.ok || !workerBody.ok) {
      throw new Error(`worker publish failed: ${workerRes.status} ${JSON.stringify(workerBody)}`);
    }
    ok(`5. shop-media-lifecycle?action=publish returned ok (${workerBody.renditions} rendition)`);

    const { data: after } = await admin
      .from("product_media").select("public_path").eq("id", media.id).single();
    if (!after.public_path) throw new Error("the worker did not move the pointer");
    reg.objects.push({ bucket: PUBLIC_BUCKET, path: after.public_path });

    // ── the bytes a stranger actually receives ──────────────────────────────
    const res = await fetch(`${API}/storage/v1/object/public/${PUBLIC_BUCKET}/${after.public_path}`);
    if (res.status !== 200) throw new Error(`the public object answers ${res.status}`);
    const served = Buffer.from(await res.arrayBuffer());

    if (!isWebp(served)) note("public", `the served object is not a WebP (first bytes ${served.subarray(0, 4).toString("hex")})`);
    if (served.length > MAX_RENDITION_BYTES) note("public", `${served.length} bytes, over the cap`);
    if (hasExif(served)) note("public", "the PUBLIC object carries EXIF");
    if (hasXmp(served)) note("public", "the PUBLIC object carries XMP");
    if (hasFixtureGps(served)) note("public", "the PUBLIC object carries the seller's GPS coordinates");
    if (served.equals(original)) note("public", "the public object IS the untouched original");
    if (!served.equals(rendition)) {
      note("public", "the public object is not byte-identical to the verified rendition");
    }
    if (!findings.some((f) => f.startsWith("public"))) {
      ok(`6. the served object is the rendition — ${served.length} bytes, WebP, no EXIF/GPS/XMP`);
    }

    // ── and the buyer's payload names no private path ───────────────────────
    const { data: prod } = await admin.from("products").select("slug").eq("id", s.productId).single();
    const { data: dto } = await anon().rpc("shop_public_product", { _slug: prod.slug });
    const json = JSON.stringify(dto);
    for (const bad of ["rendition_source_path", "draft_path", "/original", DRAFT_BUCKET, "token=", "/object/sign/"]) {
      if (json.includes(bad)) note("dto", `the public DTO contains "${bad}"`);
    }
    if (!json.includes(after.public_path)) note("dto", "the public DTO does not name the published object");
    if (!findings.some((f) => f.startsWith("dto"))) {
      ok("7. the buyer's payload carries the public key and no private path");
    }

    if (consoleErrors.length) note("browser", `console: ${consoleErrors.slice(0, 2).join(" | ")}`);
    await page.close();
  } catch (e) {
    note("harness", (e.stack ?? String(e)).split("\n").slice(0, 3).join(" | "));
  } finally {
    if (ctx) await ctx.close();
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
  console.log("\nPASS — EXIF, GPS and XMP do not survive the pipeline, and the public object is the rendition");
}

await main();
