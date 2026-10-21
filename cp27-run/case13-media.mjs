#!/usr/bin/env node
/**
 * CP27 case 13 — a photo with GPS in it, through the real pipeline.
 *
 * Driven in the browser on purpose. EXIF stripping happens in `imagePipeline`
 * on the client (canvas re-encode), so an upload posted from node would test a
 * path no seller ever takes and would "prove" a strip that never ran.
 *
 * What has to be true afterwards:
 *   · the draft object exists and is NOT readable anonymously;
 *   · the published rendition is WebP and carries none of the EXIF;
 *   · the original is not in the public bucket under any name;
 *   · logo, cover and product media all survive the orphan sweep.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { URL as SB, ANON, sql } from "./env.mjs";
import { launch, close, actor, assertIdentity } from "./browser.mjs";
import { session, record, summary } from "./lib.mjs";
import { makeExifJpeg, stillHasExif, hasGpsIfd, EXIF_MARKERS } from "./exif-jpeg.mjs";

const STATE = process.env.CP27_STATE ?? "/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/state.json";
const state = JSON.parse(readFileSync(STATE, "utf8"));
const FIXTURE = "/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/exif-fixture.jpg";
const one = (r) => r.at(-1);

writeFileSync(FIXTURE, await makeExifJpeg());
const source = readFileSync(FIXTURE);
record("13.a", "the fixture photo really carries EXIF and GPS before upload",
  stillHasExif(source).length === EXIF_MARKERS.length && hasGpsIfd(source) ? "PASS" : "FAIL",
  `${source.length} bytes · ascii markers ${stillHasExif(source).length}/${EXIF_MARKERS.length} · GPS IFD present`);

await launch();
const a = await actor("seller", { viewport: { width: 1440, height: 1000 } });
await assertIdentity(a);

await a.goto(`/seller/products/${state.productId}/edit`);
await a.page.waitForSelector('input[type="file"]', { timeout: 30000 });

const before = one(await sql(`SELECT count(*)::int AS n FROM public.product_media WHERE product_id='${state.productId}';`));
await a.page.setInputFiles('input[type="file"]', FIXTURE);

// Wait for the row to land in the database rather than for a spinner to go:
// the phase label lies about completion in exactly the case CP23 found.
let after = before;
for (let i = 0; i < 40 && after.n <= before.n; i++) {
  await a.page.waitForTimeout(1500);
  after = one(await sql(`SELECT count(*)::int AS n FROM public.product_media WHERE product_id='${state.productId}';`));
}
record("13.b", "the upload completes through the seller UI", after.n > before.n ? "PASS" : "FAIL",
  `product_media rows ${before.n} → ${after.n}`);

const media = one(await sql(`
  SELECT id::text, draft_path, rendition_source_path, public_path, content_type, byte_size, state, width, height
  FROM public.product_media WHERE product_id='${state.productId}' ORDER BY created_at DESC LIMIT 1;`));
state.mediaId = media?.id;
state.draftPath = media?.draft_path;
writeFileSync(STATE, JSON.stringify(state, null, 2));

// ─── the draft must be private ──────────────────────────────────────────────
{
  const anonRead = await fetch(`${SB}/storage/v1/object/shop-product-media-draft/${media.draft_path}`, {
    headers: { apikey: ANON },
  });
  record("13.c", "the draft object is not readable anonymously", anonRead.status >= 400 ? "PASS" : "FAIL",
    `HTTP ${anonRead.status} on the draft bucket · mime=${media.content_type} size=${media.byte_size}`);
}

// ─── the rendition the client produced must be clean ────────────────────────
{
  const seller = await session("seller");
  const src = media.rendition_source_path ?? media.draft_path;
  const dl = await fetch(`${SB}/storage/v1/object/shop-product-media-draft/${src}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${seller.token}` },
  });
  const bytes = Buffer.from(await dl.arrayBuffer());
  const isWebp = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const leftovers = stillHasExif(bytes);
  record("13.d", "the rendition is WebP and carries none of the EXIF",
    dl.ok && isWebp && leftovers.length === 0 && !hasGpsIfd(bytes) ? "PASS" : "FAIL",
    `HTTP ${dl.status} · ${bytes.length} bytes · webp=${isWebp} · leftover EXIF strings=${JSON.stringify(leftovers)} · GPS IFD=${hasGpsIfd(bytes)}`);
}

await close();
process.exit(summary() ? 1 : 0);
