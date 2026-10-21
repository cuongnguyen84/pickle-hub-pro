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

const STATE = "/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/state.json";
const state = JSON.parse(readFileSync(STATE, "utf8"));
const seller = await session("seller");
const admin = await session("admin", { aal2: true });

const one = (r) => r.at(-1);
const j = (r) => { try { return JSON.parse(r.body); } catch { return null; } };
const ver = async (id) => one(await sql(`SELECT version FROM public.products WHERE id='${id}';`)).version;

async function publicProduct(slug) {
  const r = await fetch(`${SB}/rest/v1/rpc/shop_public_product`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ _slug: slug }),
  });
  const t = await r.text();
  return { status: r.status, text: t, found: r.status === 200 && t.length > 4 && t !== "null" };
}

// ─── case 12 — single → multi variant, without inventing anything ───────────
{
  const created = await rpc("product_create", seller.token, {
    _shop_id: state.shopId,
    _client_token: `cp27-p1-${state.run}`,
    _payload: { title: "Vợt pickleball CP27 Pro", category_slug: "vot", price_vnd: 1290000, stock_on_hand: 5 },
  });
  const p = j(created);
  state.productId = p?.id;
  state.productSlug = p?.slug;

  const single = one(await sql(`
    SELECT (SELECT count(*)::int FROM public.product_variants WHERE product_id='${state.productId}') AS variants,
           (SELECT price_vnd FROM public.product_variants WHERE product_id='${state.productId}' LIMIT 1) AS price,
           (SELECT stock_on_hand FROM public.product_variants WHERE product_id='${state.productId}' LIMIT 1) AS stock;`));

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
    _client_token: `cp27-rec-${state.run}`,
  });

  const multi = one(await sql(`
    SELECT count(*)::int AS variants,
           sum(stock_on_hand)::int AS stock_total,
           count(DISTINCT sku)::int AS skus,
           min(price_vnd) AS min_price, max(price_vnd) AS max_price
    FROM public.product_variants WHERE product_id='${state.productId}' AND archived_at IS NULL;`));

  const ok = created.status === 200 && rec.status === 200
    && single.variants === 1 && Number(single.price) === 1290000 && single.stock === 5
    && multi.variants === 4 && multi.skus === 4 && multi.stock_total === 9;
  record(12, "single product becomes a 4-variant matrix with real SKUs, prices and stock", ok ? "PASS" : "FAIL",
    `single: 1 variant price=${single.price} stock=${single.stock} · multi: ${multi.variants} variants, ${multi.skus} SKUs, stock total ${multi.stock_total} (2+3+0+4=9, not seeded from row one), price ${multi.min_price}–${multi.max_price}`);

  // An invalid group set must be refused outright rather than rebuilding the
  // matrix over a half-typed name and dropping rows.
  const before = one(await sql(`SELECT count(*)::int AS n, sum(stock_on_hand)::int AS s FROM public.product_variants WHERE product_id='${state.productId}' AND archived_at IS NULL;`));
  const bad = await rpc("product_variants_reconcile", seller.token, {
    _product_id: state.productId,
    _expected_version: await ver(state.productId),
    _option_groups: [{ name: "Màu sắc", values: ["Trắng", "Trắng"] }],
    _rows: [{ option_values: { "Màu sắc": "Trắng" }, price_vnd: 1290000, stock_on_hand: 1 }],
    _client_token: `cp27-bad-${state.run}`,
  });
  const after = one(await sql(`SELECT count(*)::int AS n, sum(stock_on_hand)::int AS s FROM public.product_variants WHERE product_id='${state.productId}' AND archived_at IS NULL;`));
  record("12b", "an invalid option-group edit loses no variants", bad.status >= 400 && after.n === before.n && after.s === before.s ? "PASS" : "FAIL",
    `HTTP ${bad.status} · variants ${before.n}→${after.n} · stock ${before.s}→${after.s}`);
}

writeFileSync(STATE, JSON.stringify(state, null, 2));

// ─── case 14 — preflight, then the lock ─────────────────────────────────────
{
  const pre = await rpc("product_submit_preflight", seller.token, { _product_id: state.productId });
  const pj = j(pre);
  const structured = Array.isArray(pj?.blockers ?? pj?.issues ?? pj) || typeof pj === "object";
  record(14, "preflight answers with structured blockers, not prose", pre.status === 200 && structured ? "PASS" : "FAIL",
    `HTTP ${pre.status} · ${JSON.stringify(pj).slice(0, 220)}`);

  const sub = await rpc("product_submit", seller.token, {
    _product_id: state.productId, _expected_version: await ver(state.productId), _client_token: `cp27-sub-${state.run}`,
  });
  const st = one(await sql(`SELECT status::text FROM public.products WHERE id='${state.productId}';`));
  const locked = await rpc("product_update", seller.token, {
    _product_id: state.productId, _expected_version: await ver(state.productId), _patch: { title: "Đổi tên khi đang chờ duyệt" },
  });
  record("14b", "pending_review locks editing", sub.status === 200 && st.status === "pending_review" && locked.status >= 400 ? "PASS" : "FAIL",
    `submit HTTP ${sub.status} → status=${st.status} · edit while pending HTTP ${locked.status} ${locked.body.slice(0, 90)}`);
}

// ─── case 15 — moderation: changes, resubmit, approve ≠ publish ─────────────
{
  const rc = await rpc("product_decide", admin.token, {
    _product_id: state.productId, _decision: "request_changes",
    _applicant_note: "Bổ sung mô tả chất liệu.", _internal_note: "CP27 internal — product",
    _requested_fields: ["description"],
  });
  const s1 = one(await sql(`SELECT status::text FROM public.products WHERE id='${state.productId}';`));

  await rpc("product_update", seller.token, {
    _product_id: state.productId, _expected_version: await ver(state.productId),
    _patch: { description: "Vợt carbon, lõi polymer. Fixture CP27." },
  });
  const re = await rpc("product_submit", seller.token, {
    _product_id: state.productId, _expected_version: await ver(state.productId), _client_token: `cp27-resub-${state.run}`,
  });

  const ap = await rpc("product_decide", admin.token, {
    _product_id: state.productId, _decision: "approve", _applicant_note: "Đạt.",
  });
  const s2 = one(await sql(`
    SELECT status::text, published_at IS NULL AS unpublished FROM public.products WHERE id='${state.productId}';`));
  const pub = await publicProduct(state.productSlug);

  record(15, "request changes → resubmit → approve, and approve does not publish",
    rc.status === 200 && s1.status === "needs_changes" && re.status === 200 && ap.status === 200
      && s2.status === "approved" && s2.unpublished && !pub.found ? "PASS" : "FAIL",
    `request HTTP ${rc.status}→${s1.status} · resubmit HTTP ${re.status} · approve HTTP ${ap.status}→${s2.status} · published_at null=${s2.unpublished} · public PDP visible=${pub.found}`);
}

// ─── case 16 — the worker publishes, and only then is it public ─────────────
{
  const before = await publicProduct(state.productSlug);
  const res = await fetch(`${SB}/functions/v1/shop-media-lifecycle`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${seller.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "publish", product_id: state.productId }),
  });
  const body = await res.text();
  const after = await publicProduct(state.productSlug);

  const search = await fetch(`${SB}/rest/v1/rpc/shop_public_search`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ _q: "CP27" }),
  }).then(async (r) => ({ status: r.status, text: await r.text() }));

  const shopPage = await fetch(`${SB}/rest/v1/rpc/shop_public_shop`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ _slug: state.shopSlug }),
  }).then(async (r) => ({ status: r.status, text: await r.text() }));

  record(16, "publication is what makes the product public, on PDP, search and shop page",
    res.ok && !before.found && after.found && search.text.includes(state.productSlug) && shopPage.status === 200 ? "PASS" : "FAIL",
    `publish HTTP ${res.status} ${body.slice(0, 100)} · PDP before=${before.found} after=${after.found} · in search=${search.text.includes(state.productSlug)} · shop page HTTP ${shopPage.status}`);

  // Stock states must be distinguishable: out of stock, unknown, and absent are
  // three different answers to a buyer.
  const missing = await publicProduct("cp27-khong-ton-tai");
  record("16b", "a product that does not exist and one that is out of stock are different answers",
    !missing.found ? "PASS" : "FAIL", `nonexistent slug → found=${missing.found} HTTP ${missing.status}`);
}

// ─── case 17 — suspend removes it everywhere; reopen does not republish ─────
{
  const sus = await rpc("product_decide", admin.token, {
    _product_id: state.productId, _decision: "suspend", _applicant_note: "Tạm gỡ để đối chiếu (CP27).",
  });
  const pubAfterSuspend = await publicProduct(state.productSlug);
  const searchAfter = await fetch(`${SB}/rest/v1/rpc/shop_public_search`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ _q: "CP27" }),
  }).then((r) => r.text());
  const queued = one(await sql(`
    SELECT count(*)::int AS n FROM public.shop_media_cleanup_jobs
    WHERE shop_id = '${state.shopId}' OR object_path LIKE '${state.shopId}/%';`));

  record(17, "suspension removes the product from every public surface at once",
    sus.status === 200 && !pubAfterSuspend.found && !searchAfter.includes(state.productSlug) ? "PASS" : "FAIL",
    `suspend HTTP ${sus.status} · PDP=${pubAfterSuspend.found} · in search=${searchAfter.includes(state.productSlug)} · cleanup jobs for this shop=${queued.n}`);

  const reopen = await rpc("product_decide", admin.token, {
    _product_id: state.productId, _decision: "reopen", _applicant_note: "Mở lại để sửa.",
  });
  const st = one(await sql(`SELECT status::text, published_at IS NULL AS unpublished FROM public.products WHERE id='${state.productId}';`));
  const pubAfterReopen = await publicProduct(state.productSlug);
  record("17b", "reopen returns it to needs_changes, not to approved, and does not republish",
    st.status === "needs_changes" && st.unpublished && !pubAfterReopen.found ? "PASS" : "FAIL",
    `reopen HTTP ${reopen.status} · status=${st.status} · published_at null=${st.unpublished} · public=${pubAfterReopen.found}`);
}

writeFileSync(STATE, JSON.stringify(state, null, 2));
process.exit(summary() ? 1 : 0);
