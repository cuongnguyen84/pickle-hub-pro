#!/usr/bin/env node
/**
 * CP27 cases 14–17: preview/submit, moderation, publication, suspension.
 *
 * Runs after case 13 has put real image bytes on the product — publishing a
 * product with no rendition would exercise a path no seller reaches.
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
const ver = async (id) => one(await sql(`SELECT version FROM public.products WHERE id='${id}';`)).version;

/** What an anonymous buyer gets for a product slug. */
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
// ─── case 14 — preflight, then the lock ─────────────────────────────────────
{
  const pre = await rpc("product_submit_preflight", seller.token, { _product_id: state.productId });
  const pj = j(pre);
  const structured = Array.isArray(pj?.blockers ?? pj?.issues ?? pj) || typeof pj === "object";
  record(14, "preflight answers with structured blockers, not prose", pre.status === 200 && structured ? "PASS" : "FAIL",
    `HTTP ${pre.status} · ${JSON.stringify(pj).slice(0, 220)}`);

  // Clear what preflight named. Submitting into a known blocker would only
  // re-measure the blocker; the case is about the lock that follows a real
  // submit.
  await rpc("product_update", seller.token, {
    _product_id: state.productId, _expected_version: await ver(state.productId),
    _patch: { description: "Vợt carbon, lõi polymer, cán 5 inch. Fixture CP27." },
  });
  const pre2 = await rpc("product_submit_preflight", seller.token, { _product_id: state.productId });

  const sub = await rpc("product_submit", seller.token, {
    _product_id: state.productId, _expected_version: await ver(state.productId), _client_token: `cp27-sub-${state.run}`,
  });
  const st = one(await sql(`SELECT status::text FROM public.products WHERE id='${state.productId}';`));
  const locked = await rpc("product_update", seller.token, {
    _product_id: state.productId, _expected_version: await ver(state.productId), _patch: { title: "Đổi tên khi đang chờ duyệt" },
  });
  record("14b", "pending_review locks editing", sub.status === 200 && st.status === "pending_review" && locked.status >= 400 ? "PASS" : "FAIL",
    `preflight after fixing: ${pre2.body.slice(0, 80)} · submit HTTP ${sub.status} → status=${st.status} · edit while pending HTTP ${locked.status} ${locked.body.slice(0, 90)}`);
}

// ─── case 15 — moderation: changes, resubmit, approve ≠ publish ─────────────
{
  const rc = await rpc("product_decide", admin.token, {
    _product_id: state.productId, _decision: "request_changes",
    _expected_version: await ver(state.productId),
    _applicant_note: "Bổ sung mô tả chất liệu.", _internal_note: "CP27 internal — product",
    _requested_targets: [{ section: "description", field: "description" }],
    _client_token: `${state.run}-rc`,
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
    _product_id: state.productId, _decision: "approve",
    _expected_version: await ver(state.productId), _applicant_note: "Đạt.",
    _client_token: `${state.run}-ap`,
  });
  const s2 = one(await sql(`
    SELECT status::text, is_published FROM public.products WHERE id='${state.productId}';`));
  const pub = await publicProduct(state.productSlug);

  record(15, "request changes → resubmit → approve, and approve does not publish",
    rc.status === 200 && s1.status === "needs_changes" && re.status === 200 && ap.status === 200
      && s2.status === "approved" && s2.is_published === false && !pub.found ? "PASS" : "FAIL",
    `request HTTP ${rc.status}→${s1.status} · resubmit HTTP ${re.status} · approve HTTP ${ap.status}→${s2.status} · published_at null=${s2.is_published === false} · public PDP visible=${pub.found}`);
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

// ─── case 17 — suspend removes it everywhere; reopen restarts the cycle ─────
// CP27_SKIP_SUSPEND leaves a published product behind for the rehearsal of
// sections E and F. It is never set in the real run.
if (process.env.CP27_SKIP_SUSPEND) {
  record(17, "suspension", "SKIP", "CP27_SKIP_SUSPEND set — leaving the product published for a section E/F rehearsal");
} else {
  const sus = await rpc("product_decide", admin.token, {
    _product_id: state.productId, _decision: "suspend",
    _expected_version: await ver(state.productId), _applicant_note: "Tạm gỡ để đối chiếu (CP27).",
    _client_token: `${state.run}-sus`,
  });
  const pubAfterSuspend = await publicProduct(state.productSlug);
  const searchAfter = await fetch(`${SB}/rest/v1/rpc/shop_public_search`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ _q: "CP27" }),
  }).then((r) => r.text());
  const queued = one(await sql(`
    SELECT count(*)::int AS n FROM public.shop_media_cleanup_jobs
    WHERE shop_id = '${state.shopId}' OR object_path LIKE '${state.shopId}/%';`));

  record(17, "suspension removes the product from every public surface at once, and queues the byte cleanup",
    sus.status === 200 && !pubAfterSuspend.found && !searchAfter.includes(state.productSlug) && queued.n > 0 ? "PASS" : "FAIL",
    `suspend HTTP ${sus.status} · PDP=${pubAfterSuspend.found} · in search=${searchAfter.includes(state.productSlug)} · cleanup jobs enqueued for this shop=${queued.n}`);

  // Reopen exists: migration 20260812120000 (Q5) implements the decision the
  // roadmap records in §7.J — the only exit from 'suspended' is needs_changes,
  // it carries the same note+targets burden as request_changes, and nothing
  // republishes on its own. An earlier revision of this file predates Q5 and
  // read the 22023 below as "no such transition"; it is the targets validator.
  const reBase = one(await sql(`
    SELECT (SELECT count(*)::int FROM public.product_variants WHERE product_id='${state.productId}' AND retired_at IS NULL) AS variants,
           (SELECT count(*)::int FROM public.product_media WHERE product_id='${state.productId}') AS media;`));
  const reGuard = await rpc("product_decide", admin.token, {
    _product_id: state.productId, _decision: "reopen",
    _expected_version: await ver(state.productId), _applicant_note: "Mở lại để sửa (CP27).",
    _requested_targets: [],
    _client_token: `${state.run}-re-guard`,
  });
  const stGuard = one(await sql(`SELECT status::text, is_published FROM public.products WHERE id='${state.productId}';`));
  const pubGuard = await publicProduct(state.productSlug);
  const reNow = one(await sql(`
    SELECT (SELECT count(*)::int FROM public.product_variants WHERE product_id='${state.productId}' AND retired_at IS NULL) AS variants,
           (SELECT count(*)::int FROM public.product_media WHERE product_id='${state.productId}') AS media;`));

  record("17b", "reopen without structured targets is refused, and nothing moves",
    reGuard.status >= 400 && stGuard.status === "suspended" && stGuard.is_published === false && !pubGuard.found
      && reNow.variants === reBase.variants && reNow.media === reBase.media ? "PASS" : "FAIL",
    `reopen with empty targets HTTP ${reGuard.status} ${reGuard.body.slice(0, 90)} · status=${stGuard.status} · is_published=${stGuard.is_published} · public=${pubGuard.found} · variants/media ${reNow.variants}/${reNow.media} vs baseline ${reBase.variants}/${reBase.media}`);

  // The real reopen, then the same call again with the same client token: the
  // replay identity is the token (the version check runs after it), and a
  // replay must answer without writing a second event.
  const reopen = await rpc("product_decide", admin.token, {
    _product_id: state.productId, _decision: "reopen",
    _expected_version: await ver(state.productId), _applicant_note: "Bổ sung lại ảnh trước khi bán tiếp.",
    _requested_targets: [{ section: "media" }],
    _client_token: `${state.run}-re2`,
  });
  const st = one(await sql(`SELECT status::text, is_published FROM public.products WHERE id='${state.productId}';`));
  const pubAfterReopen = await publicProduct(state.productSlug);
  const replay = await rpc("product_decide", admin.token, {
    _product_id: state.productId, _decision: "reopen",
    _expected_version: null, _applicant_note: "Lặp lại cùng mã.",
    _requested_targets: [{ section: "media" }],
    _client_token: `${state.run}-re2`,
  });
  const replayed = j(replay)?.replayed === true;
  const reEvents = one(await sql(`
    SELECT count(*)::int AS n FROM public.product_moderation_events
    WHERE product_id='${state.productId}' AND decision='reopen';`));

  record("17c", "reopen goes to needs_changes without republishing, and a replay does not double it",
    reopen.status === 200 && st.status === "needs_changes" && st.is_published === false && !pubAfterReopen.found
      && replay.status === 200 && replayed && reEvents.n === 1 ? "PASS" : "FAIL",
    `reopen HTTP ${reopen.status} → status=${st.status} · is_published=${st.is_published} · public=${pubAfterReopen.found} · replay HTTP ${replay.status} replayed=${replayed} · reopen events=${reEvents.n}`);

  // ── 17d — after reopen, the ordinary cycle: fix, resubmit, approve ─────────
  await rpc("product_update", seller.token, {
    _product_id: state.productId, _expected_version: await ver(state.productId),
    _patch: { description: "Vợt carbon, lõi polymer, cán 5 inch. Fixture CP27 (đã bổ sung sau reopen)." },
  });
  const resub = await rpc("product_submit", seller.token, {
    _product_id: state.productId, _expected_version: await ver(state.productId), _client_token: `cp27-resub2-${state.run}`,
  });
  const s3 = one(await sql(`SELECT status::text FROM public.products WHERE id='${state.productId}';`));
  const ap2 = await rpc("product_decide", admin.token, {
    _product_id: state.productId, _decision: "approve",
    _expected_version: await ver(state.productId), _applicant_note: "Đạt (sau reopen).",
    _client_token: `${state.run}-ap2`,
  });
  const s4 = one(await sql(`SELECT status::text, is_published FROM public.products WHERE id='${state.productId}';`));
  const pubAfterApprove = await publicProduct(state.productSlug);

  record("17d", "after reopen the ordinary cycle applies, and approve still does not publish",
    resub.status === 200 && s3.status === "pending_review" && ap2.status === 200
      && s4.status === "approved" && s4.is_published === false && !pubAfterApprove.found ? "PASS" : "FAIL",
    `resubmit HTTP ${resub.status} → ${s3.status} · approve HTTP ${ap2.status} → ${s4.status} · is_published=${s4.is_published} · public before republish=${pubAfterApprove.found}`);

  // ── 17e — §7.J ends with "publish lại theo đúng vòng": the worker, again ───
  // This is also what hands sections E and F a populated catalogue — without
  // it the sweep after this file would measure an empty shell, the exact
  // false-green §8 forbids. The worker's copy step is an upsert, so a
  // republish after the suspension cleanup is its designed retry path.
  const rePub = await fetch(`${SB}/functions/v1/shop-media-lifecycle`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${seller.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "publish", product_id: state.productId }),
  });
  const rePubBody = await rePub.text();
  const pubFinal = await publicProduct(state.productSlug);
  const searchFinal = await fetch(`${SB}/rest/v1/rpc/shop_public_search`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ _q: "CP27" }),
  }).then(async (r) => ({ status: r.status, text: await r.text() }));
  const shopFinal = await fetch(`${SB}/rest/v1/rpc/shop_public_shop`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ _slug: state.shopSlug }),
  }).then(async (r) => ({ status: r.status, text: await r.text() }));
  // shop_public_shop answers with a product_count, not a product list.
  let shopCount = 0;
  try { shopCount = JSON.parse(shopFinal.text)?.shop?.product_count ?? 0; } catch { /* not json */ }

  // The republish/cleanup race: suspension queued these very keys for deletion,
  // and the five-minute cron may have CLAIMED a job before product_publish_commit
  // swept the queue (the sweep covers pending and in_progress rows, but cannot
  // un-claim a worker already holding the payload in memory). So: prove the
  // queue holds nothing for this product's public keys, then fetch the actual
  // bytes twice, with a pause longer than any worker invocation in between —
  // a projection row cannot vouch for an object the worker deleted after it.
  const pendingJobs = one(await sql(`
    SELECT count(*)::int AS n FROM public.shop_media_cleanup_jobs
    WHERE bucket_id = 'shop-product-media' AND state <> 'done'
      AND object_path IN (SELECT public_path FROM public.product_media
                          WHERE product_id='${state.productId}' AND public_path IS NOT NULL);`));
  let media = [];
  try { media = JSON.parse(pubFinal.text)?.media ?? []; } catch { /* not json */ }
  const keys = media.map((m) => m.public_path).filter(Boolean);
  const bytesAlive = async () => {
    const rs = await Promise.all(keys.map((k) => fetch(`${SB}/storage/v1/object/public/shop-product-media/${k}`)));
    return rs.every((r) => r.ok);
  };
  const aliveNow = keys.length > 0 && await bytesAlive();
  await new Promise((r) => setTimeout(r, 10_000));
  const aliveStill = keys.length > 0 && await bytesAlive();

  record("17e", "the worker republishes it — public on PDP, search and shop page, and the bytes outlive the cleanup queue",
    rePub.ok && pubFinal.found
      && searchFinal.status === 200 && searchFinal.text.includes(state.productSlug)
      && shopFinal.status === 200 && shopCount >= 1
      && pendingJobs.n === 0 && aliveNow && aliveStill ? "PASS" : "FAIL",
    `republish HTTP ${rePub.status} ${rePubBody.slice(0, 80)} · PDP=${pubFinal.found} · search ${searchFinal.status} has slug=${searchFinal.text.includes(state.productSlug)} · shop page ${shopFinal.status} product_count=${shopCount} · cleanup jobs on public keys=${pendingJobs.n} · ${keys.length} rendition(s) alive now=${aliveNow}, after 10s=${aliveStill}`);
}

writeFileSync(STATE, JSON.stringify(state, null, 2));
process.exit(summary() ? 1 : 0);
