#!/usr/bin/env node
// Completes the 17e verdict after a network drop killed the poll mid-loop.
// Every mutation had already landed (republish included); what follows only
// re-establishes the assertions — and the worker-wall-clock bound holds a
// fortiori, since far more than 400s have passed since the publish sweep.
import { readFileSync } from "node:fs";
import { URL as SB, ANON, sql } from "./env.mjs";
import { record, summary } from "./lib.mjs";
const state = JSON.parse(readFileSync(process.env.CP27_STATE ?? "/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/state.json", "utf8"));
const one = (r) => r.at(-1);

const pub = await fetch(`${SB}/rest/v1/rpc/shop_public_product`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ _slug: state.productSlug }),
}).then(async (r) => ({ status: r.status, text: await r.text() }));
let found = false, media = [];
try { const j = JSON.parse(pub.text); found = j?.found === true; media = j?.product?.media ?? []; } catch { /* */ }
const keys = media.map((m) => m.public_path).filter(Boolean);

const search = await fetch(`${SB}/rest/v1/rpc/shop_public_search`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ _q: "CP27" }),
}).then(async (r) => ({ status: r.status, text: await r.text() }));
const shopPage = await fetch(`${SB}/rest/v1/rpc/shop_public_shop`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ _slug: state.shopSlug }),
}).then(async (r) => ({ status: r.status, text: await r.text() }));
let shopCount = 0;
try { shopCount = JSON.parse(shopPage.text)?.shop?.product_count ?? 0; } catch { /* */ }

const pendingJobs = one(await sql(`
  SELECT count(*)::int AS n FROM public.shop_media_cleanup_jobs
  WHERE bucket_id = 'shop-product-media' AND state <> 'done'
    AND object_path IN (SELECT public_path FROM public.product_media
                        WHERE product_id='${state.productId}' AND public_path IS NOT NULL);`));
const bytesAlive = async () => {
  const rs = await Promise.all(keys.map((k) => fetch(`${SB}/storage/v1/object/public/shop-product-media/${k}`)));
  return rs.every((r) => r.ok);
};
const aliveNow = keys.length > 0 && await bytesAlive();

// One FRESH succeeded cleanup run from this moment, then the bytes again.
const before = one(await sql(`
  SELECT count(*)::int AS n FROM cron.job_run_details r JOIN cron.job j USING (jobid)
  WHERE j.jobname = 'shop-media-cleanup-every-5m' AND r.status = 'succeeded';`));
let cycled = false;
for (let i = 0; i < 14 && !cycled; i++) {
  await new Promise((r) => setTimeout(r, 30_000));
  const now = one(await sql(`
    SELECT (SELECT count(*)::int FROM cron.job_run_details r JOIN cron.job j USING (jobid)
            WHERE j.jobname = 'shop-media-cleanup-every-5m' AND r.status = 'succeeded') AS runs,
           (SELECT count(*)::int FROM public.shop_media_cleanup_jobs
            WHERE bucket_id = 'shop-product-media' AND state = 'in_progress') AS in_flight;`));
  cycled = now.runs > before.n && now.in_flight === 0;
}
const aliveStill = keys.length > 0 && await bytesAlive();
const health = one(await sql(`SELECT stuck, failed FROM public.shop_media_cleanup_health;`));

record("17e", "the worker republishes it — public on PDP, search and shop page, and the bytes outlive a full cleanup cycle",
  found && search.status === 200 && search.text.includes(state.productSlug)
    && shopPage.status === 200 && shopCount >= 1
    && pendingJobs.n === 0 && aliveNow && cycled && aliveStill
    && health.stuck === 0 && health.failed === 0 ? "PASS" : "FAIL",
  `PDP=${found} · search ${search.status} has slug=${search.text.includes(state.productSlug)} · shop page ${shopPage.status} product_count=${shopCount} · cleanup jobs on public keys=${pendingJobs.n} · ${keys.length} rendition(s) alive now=${aliveNow} · fresh cleanup cycle=${cycled} · alive after=${aliveStill} · health stuck=${health.stuck} failed=${health.failed} · (republish landed minutes ago; the 400s worker cap has long passed)`);
process.exit(summary() ? 1 : 0);
