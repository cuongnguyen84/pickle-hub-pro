#!/usr/bin/env node
/**
 * CP27 cases 12, 14–17: catalogue, moderation, publication, suspension.
 *
 * Case 13 (media through the real browser pipeline) is a separate file — it
 * needs a browser to strip EXIF, which is where that code lives.
 *
 * Publication goes through the deployed `shop-media-lifecycle` Edge Function
 * with the seller's own JWT, not through a hand-rolled copy: the function is
 * the only holder of the service role over those buckets, and that boundary is
 * part of what is being accepted.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { URL as SB, ANON, sql } from "./env.mjs";
import { session, rpc, rest, uid, record, summary } from "./lib.mjs";

const STATE = process.env.CP27_STATE ?? "/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/state.json";
const state = JSON.parse(readFileSync(STATE, "utf8"));
const seller = await session("seller");
const admin = await session("admin", { aal2: true });

const one = (r) => r.at(-1);
const j = (r) => { try { return JSON.parse(r.body); } catch { return null; } };
/** Idempotency token. Stable within a run so a replay is testable; distinct
 * between runs so a rehearsal does not measure the previous one's product. */
const TOKEN = process.env.CP27_TOKEN ?? `cp27-p1-${JSON.parse(readFileSync(STATE, "utf8")).run}`;
const ver = async (id) => one(await sql(`SELECT version FROM public.products WHERE id='${id}';`)).version;

async function publicProduct(slug) {
  const r = await fetch(`${SB}/rest/v1/rpc/shop_public_product`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ _slug: slug }),
  });
  const t = await r.text();
  // The RPC answers with an explicit `found` flag. Guessing from the body
  // length said "found" for a slug that does not exist.
  let found = false;
  try { found = JSON.parse(t)?.found === true; } catch { /* not json */ }
  return { status: r.status, text: t, found };
}

// ─── case 12 — single → multi variant, without inventing anything ───────────
{
  const created = await rpc("product_create", seller.token, {
    _shop_id: state.shopId,
    _client_token: TOKEN,
    _payload: { title: "Vợt pickleball CP27 Pro", category_slug: "vot", price_vnd: 1290000, stock_on_hand: 5 },
  });
  const p = j(created);
  state.productId = p?.id;
  state.productSlug = p?.slug;

  const single = one(await sql(`
    SELECT (SELECT count(*)::int FROM public.product_variants WHERE product_id='${state.productId}' AND retired_at IS NULL) AS variants,
           (SELECT price_vnd FROM public.product_variants WHERE product_id='${state.productId}' AND retired_at IS NULL LIMIT 1) AS price,
           (SELECT stock_on_hand FROM public.product_variants WHERE product_id='${state.productId}' AND retired_at IS NULL LIMIT 1) AS stock;`));

  // Single → multi. The price must carry across; the stock must NOT be copied
  // onto new combinations — inventing inventory is one of the two bugs CP24
  // found here.
  const rec = await rpc("product_variants_reconcile", seller.token, {
    _product_id: state.productId,
    _expected_version: await ver(state.productId),
    _option_groups: [{ name: "Màu sắc", values: ["Trắng", "Đen"] }, { name: "Trọng lượng", values: ["Nhẹ", "Nặng"] }],
    _rows: [
      { option_values: { "Màu sắc": "Trắng", "Trọng lượng": "Nhẹ" }, price_vnd: 1290000, stock_on_hand: 2, sku: "CP27-TN" },
      { option_values: { "Màu sắc": "Trắng", "Trọng lượng": "Nặng" }, price_vnd: 1290000, stock_on_hand: 3, sku: "CP27-TNG" },
      { option_values: { "Màu sắc": "Đen", "Trọng lượng": "Nhẹ" }, price_vnd: 1350000, stock_on_hand: 0, sku: "CP27-DN" },
      { option_values: { "Màu sắc": "Đen", "Trọng lượng": "Nặng" }, price_vnd: 1350000, stock_on_hand: 4, sku: "CP27-DNG" },
    ],
    _client_token: `${TOKEN}-rec`,
  });

  const multi = one(await sql(`
    SELECT count(*)::int AS variants,
           sum(stock_on_hand)::int AS stock_total,
           count(DISTINCT sku)::int AS skus,
           min(price_vnd) AS min_price, max(price_vnd) AS max_price
    FROM public.product_variants WHERE product_id='${state.productId}' AND retired_at IS NULL;`));

  const ok = created.status === 200 && rec.status === 200
    && single.variants === 1 && Number(single.price) === 1290000 && single.stock === 5
    && multi.variants === 4 && multi.skus === 4 && multi.stock_total === 9;
  record(12, "single product becomes a 4-variant matrix with real SKUs, prices and stock", ok ? "PASS" : "FAIL",
    `create HTTP ${created.status} · reconcile HTTP ${rec.status} ${rec.status >= 400 ? rec.body.slice(0, 120) : ""} · single: ${single.variants} variant price=${single.price} stock=${single.stock} · multi: ${multi.variants} variants, ${multi.skus} SKUs, stock total ${multi.stock_total} (2+3+0+4=9, not seeded from row one), price ${multi.min_price}–${multi.max_price}`);

  // An invalid group set must be refused outright rather than rebuilding the
  // matrix over a half-typed name and dropping rows.
  const before = one(await sql(`SELECT count(*)::int AS n, sum(stock_on_hand)::int AS s FROM public.product_variants WHERE product_id='${state.productId}' AND retired_at IS NULL;`));
  const bad = await rpc("product_variants_reconcile", seller.token, {
    _product_id: state.productId,
    _expected_version: await ver(state.productId),
    _option_groups: [{ name: "Màu sắc", values: ["Trắng", "Trắng"] }],
    _rows: [{ option_values: { "Màu sắc": "Trắng" }, price_vnd: 1290000, stock_on_hand: 1 }],
    _client_token: `${TOKEN}-bad`,
  });
  const after = one(await sql(`SELECT count(*)::int AS n, sum(stock_on_hand)::int AS s FROM public.product_variants WHERE product_id='${state.productId}' AND retired_at IS NULL;`));
  record("12b", "an invalid option-group edit loses no variants", bad.status >= 400 && after.n === before.n && after.s === before.s ? "PASS" : "FAIL",
    `HTTP ${bad.status} · variants ${before.n}→${after.n} · stock ${before.s}→${after.s}`);
}

writeFileSync(STATE, JSON.stringify(state, null, 2));


process.exit(summary() ? 1 : 0);
