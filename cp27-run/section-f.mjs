#!/usr/bin/env node
/**
 * CP27 section F — what an anonymous visitor can see, in the DOM and on the wire.
 *
 * Run against a populated fixture, so the private columns being looked for
 * actually exist on the rows the buyer surfaces are rendering. An empty
 * catalogue cannot leak, which is why the earlier pass proved nothing here.
 *
 * `owner_user_id` is treated the way the Product Owner classified it: a
 * documented privacy-hardening debt on the REST table, and a hard failure if it
 * reaches a buyer's DOM or a buyer call site.
 */
import { readFileSync } from "node:fs";
import { launch, close, actor, assertIdentity } from "./browser.mjs";
import { record, summary } from "./lib.mjs";
import { sql } from "./env.mjs";

const state = JSON.parse(readFileSync(process.env.CP27_STATE ?? "/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/state.json", "utf8"));

/**
 * Two kinds of rule, because the repo's own contract distinguishes them and the
 * first version of this file did not.
 *
 * A key NAME may legitimately survive into a buyer projection: the public
 * product carries `"stock_on_hand": null` four times, keeping the shape stable
 * while withholding the number. Searching for the bare word called that a leak.
 * What must never appear is the VALUE — a real quantity, a real internal note,
 * a real raw contact string. Mirrors BUYER_FORBIDDEN / BUYER_FORBIDDEN_VALUES
 * in `scripts/shop-p2b-acceptance-qa.mjs`.
 */
const FORBIDDEN = [
  ["draft_path value", /"draft_path"\s*:\s*"[^"]/],
  ["rendition_source_path value", /"rendition_source_path"\s*:\s*"[^"]/],
  ["draft bucket", /shop-product-media-draft/],
  ["/original", /\/original\b/],
  ["internal note text", /"internal_note"\s*:\s*"[^"]|CP27 internal/],
  ["client_token value", /"client_token"\s*:\s*"[^"]|cp27-p1-|cp27-rec-|rehearse-\d/],
  ["real stock quantity", /"stock_on_hand"\s*:\s*-?\d/],
  ["pickup address", /Duong Fixture/i],
  ["account email", /p2b27-[a-z]+-[a-z0-9-]+@/i],
  ["phone", /0900000000/],
  ["cleanup queue", /shop_media_cleanup/],
  ["signed url", /[?&]token=|\/object\/sign\//],
  ["service role", /service_role/],
  ["TOTP", /otpauth|factor_id|totp_secret/i],
  ["owner_user_id", /owner_user_id/],
];

const BUYER_ROUTES = [
  "/shop",
  "/shop/search?q=CP27",
  "/shop/category/vot",
  `/shop/product/${state.productSlug}`,
  `/shop/store/${state.shopSlug}`,
  `/vi/shop`,
];

await launch();
const a = await actor("anon");
await assertIdentity(a);

const domHits = [];
const netHits = [];
const restCalls = [];

a.page.on("response", async (res) => {
  const url = res.url();
  if (!/supabase\.co\/(rest|functions|storage)/.test(url)) return;
  restCalls.push(url);
  let text = "";
  try { text = await res.text(); } catch { return; }
  for (const [name, re] of FORBIDDEN) {
    if (re.test(text) || re.test(url)) netHits.push({ where: url.split("?")[0].split("/rest/v1/")[1] ?? url, what: name });
  }
});

for (const route of BUYER_ROUTES) {
  await a.goto(route);
  await a.page.waitForTimeout(4000);
  const html = await a.page.content();
  for (const [name, re] of FORBIDDEN) if (re.test(html)) domHits.push({ route, what: name });
}
await close();

// The fixture really does hold every one of these, so a clean scan means the
// surfaces withhold them rather than that they were never there.
const present = (await sql(`
  SELECT (SELECT count(*)::int FROM public.product_media WHERE draft_path IS NOT NULL) AS drafts,
         (SELECT count(*)::int FROM public.product_variants WHERE stock_on_hand IS NOT NULL) AS stocks,
         (SELECT count(*)::int FROM public.shop_applications WHERE internal_note IS NOT NULL OR pickup_address IS NOT NULL) AS apps;`)).at(-1);

record("F-fixture", "the private data being searched for exists in the database",
  present.drafts > 0 && present.stocks > 0 ? "PASS" : "FAIL",
  `draft paths=${present.drafts} · stock rows=${present.stocks} · applications with pickup/internal=${present.apps}`);

const dom = domHits.filter((h) => h.what !== "owner_user_id");
const net = netHits.filter((h) => h.what !== "owner_user_id");
record("F-dom", "no private field in an anonymous DOM", dom.length === 0 ? "PASS" : "FAIL",
  dom.length ? dom.map((h) => `${h.route} → ${h.what}`).join(" · ") : `${BUYER_ROUTES.length} buyer routes scanned, ${FORBIDDEN.length} markers each`);
record("F-net", "no private field in an anonymous response", net.length === 0 ? "PASS" : "FAIL",
  net.length ? net.map((h) => `${h.where} → ${h.what}`).join(" · ") : `${restCalls.length} Supabase responses inspected`);

const ownerDom = domHits.filter((h) => h.what === "owner_user_id");
const ownerNet = netHits.filter((h) => h.what === "owner_user_id");
const selectStar = restCalls.filter((u) => /\/rest\/v1\/shops\?[^ ]*select=\*/.test(u));
record("F-owner", "owner_user_id: documented debt, but no buyer call site and no DOM exposure",
  ownerDom.length === 0 && ownerNet.length === 0 && selectStar.length === 0 ? "PASS" : "FAIL",
  `DOM hits=${ownerDom.length} · response hits=${ownerNet.length} · buyer calls to /shops?select=*=${selectStar.length}`);

process.exit(summary() ? 1 : 0);
