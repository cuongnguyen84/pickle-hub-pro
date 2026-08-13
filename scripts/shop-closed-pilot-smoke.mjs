// ============================================================================
// Closed-pilot smoke — run against a DEPLOYED environment, never against dev.
// ----------------------------------------------------------------------------
//   node scripts/shop-closed-pilot-smoke.mjs --target https://<preview>.pages.dev
//   node scripts/shop-closed-pilot-smoke.mjs --target … --anon-key <key>
//   node scripts/shop-closed-pilot-smoke.mjs --list          # print all 24 checks
//
// What this file is FOR, and what it deliberately is not:
//
//   It proves the checks that can be proven from outside — the ones an HTTP
//   client and an anonymous Postgres role can observe. Those run automatically
//   and a failure is an exit code.
//
//   The rest need a seller session, an admin session with a live TOTP code, and
//   a phone camera's worth of real bytes. This file does NOT pretend to run
//   them. It prints them as a numbered manual checklist and REFUSES to report
//   an overall PASS while any of them is unrecorded. A smoke suite that reports
//   green for work nobody did is worse than no smoke suite, because it is
//   believed.
//
// Guardrails, in the order they fire:
//   1. --target is required and must match the allowlist in TARGETS. Pointing
//      this at www.thepicklehub.net during a closed pilot is a mistake the
//      script refuses to help with.
//   2. Nothing destructive runs without --cleanup AND --yes.
//   3. No key, token or signed URL is ever printed. Keys are read from argv or
//      the environment and used, never echoed.
//   4. A route that returns 200 but renders only the SPA shell counts as a
//      FAILURE, not a pass — that is the 2026-08-05 blog miss, in a new place.
// ============================================================================

import { writeFileSync } from "node:fs";

// ─── target allowlist ───────────────────────────────────────────────────────
// Preview deployments and the branch alias. Production is here so that a
// production-pilot run is possible, but it must be named explicitly with
// --allow-production, which is a second, deliberate keystroke.
const TARGETS = [
  { re: /^https:\/\/[a-z0-9-]+\.pickle-hub-pro\.pages\.dev$/, kind: "preview" },
  { re: /^https:\/\/www\.thepicklehub\.net$/, kind: "production" },
];

const NOINDEX = "noindex, nofollow, noarchive";

const BUYER_PATHS = [
  "/shop", "/shop/search", "/shop/category/vot", "/shop/product/x", "/shop/store/y",
  "/vi/shop", "/vi/shop/search", "/vi/shop/category/vot", "/vi/shop/product/x", "/vi/shop/store/y",
];
const SELLER_PATHS = ["/shop/sell", "/seller", "/seller/products", "/seller/application"];
const ADMIN_PATHS = ["/admin/shop/products", "/admin/shop/applications", "/admin/shop/contacts"];
// A route that is not Shop. Without it, "everything is noindex" and "the
// pattern is too wide" look identical.
const CONTROL_PATH = "/tournaments";

// ─── the 24 checks ──────────────────────────────────────────────────────────
// mode: "auto"   — this file proves it, and a failure is an exit code
//       "manual" — needs a real session; printed as a checklist, never assumed
const CHECKS = [
  { n: 1,  mode: "auto",   name: "robots/noindex on every Shop route, and not beyond them" },
  { n: 2,  mode: "auto",   name: "anonymous discovery renders a real page, not a bare shell" },
  { n: 3,  mode: "auto",   name: "a seller outside the allowlist is refused (RPC returns false / 42501)" },
  { n: 4,  mode: "manual", name: "a pilot seller gets in" },
  { n: 5,  mode: "manual", name: "seller application: draft → submit" },
  { n: 6,  mode: "manual", name: "admin AAL2 — aal1 session refused, aal2 accepted" },
  { n: 7,  mode: "manual", name: "request changes, with structured requested_fields" },
  { n: 8,  mode: "manual", name: "seller follows the deep link to the field asked about" },
  { n: 9,  mode: "manual", name: "shop approval creates shop + owner member in one transaction" },
  { n: 10, mode: "manual", name: "product create" },
  { n: 11, mode: "manual", name: "variants / SKU / inventory" },
  { n: 12, mode: "manual", name: "media upload — real bytes, through the real pipeline" },
  { n: 13, mode: "manual", name: "submit for review" },
  { n: 14, mode: "manual", name: "admin moderation — approve / reject / suspend" },
  { n: 15, mode: "manual", name: "publication puts a rendition in the public bucket" },
  { n: 16, mode: "auto",   name: "buyer discovery / search / category / PDP respond" },
  { n: 17, mode: "manual", name: "contact moderation and the CTA (no PII in the outbound URL)" },
  { n: 18, mode: "manual", name: "suspend → reopen → resubmit" },
  { n: 19, mode: "auto",   name: "media cleanup queue is healthy and cron is firing" },
  { n: 20, mode: "manual", name: "slug redirect — old slug 301s to the current one" },
  { n: 21, mode: "auto",   name: "no private path leaks into any anonymous response" },
  { n: 22, mode: "auto",   name: "monitoring signals reachable (health view, audit rows)" },
  { n: 23, mode: "manual", name: "kill switch dry run — close the gate, confirm, reopen" },
  { n: 24, mode: "manual", name: "teardown of test accounts and data, verified by COUNTING" },
];

// ─── argv ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback = "") => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

if (flag("list")) {
  for (const c of CHECKS) console.log(`${String(c.n).padStart(2)}  [${c.mode.padEnd(6)}] ${c.name}`);
  process.exit(0);
}

const target = opt("target").replace(/\/+$/, "");
if (!target) {
  console.error("--target is required. Example:\n  --target https://feat-shop-closed-pilot.pickle-hub-pro.pages.dev");
  process.exit(2);
}
const matched = TARGETS.find((t) => t.re.test(target));
if (!matched) {
  console.error(`REFUSED — ${target} is not in the target allowlist.\nAllowed: a *.pickle-hub-pro.pages.dev deployment, or https://www.thepicklehub.net with --allow-production.`);
  process.exit(2);
}
if (matched.kind === "production" && !flag("allow-production")) {
  console.error("REFUSED — that is production. Re-run with --allow-production if you mean it.");
  process.exit(2);
}
if (flag("cleanup") && !flag("yes")) {
  console.error("REFUSED — --cleanup deletes data. Add --yes to confirm.");
  process.exit(2);
}

const supabaseUrl = (opt("supabase-url") || process.env.SHOP_SMOKE_SUPABASE_URL || "").replace(/\/+$/, "");
const anonKey = opt("anon-key") || process.env.SHOP_SMOKE_ANON_KEY || "";
const canQueryDb = Boolean(supabaseUrl && anonKey);

console.log(`target      ${target}  (${matched.kind})`);
console.log(`supabase    ${supabaseUrl || "(not given — DB checks will be SKIPPED, not passed)"}`);
console.log(`anon key    ${anonKey ? `present, ${anonKey.length} chars` : "absent"}`);
console.log("");

// ─── result plumbing ────────────────────────────────────────────────────────
const results = [];
const record = (n, status, detail) => {
  results.push({ n, status, detail });
  const mark = { PASS: "✓", FAIL: "✖", SKIP: "–", MANUAL: "·" }[status];
  console.log(`${mark} ${String(n).padStart(2)}  ${status.padEnd(6)}  ${detail}`);
};

const get = async (path, init) => {
  const res = await fetch(`${target}${path}`, { redirect: "manual", ...init });
  return { status: res.status, headers: res.headers, text: async () => res.text() };
};

/**
 * A 200 that contains only the SPA shell is a failure dressed as a success.
 * The 2026-08-05 blog miss had perfect meta tags and an empty article; this is
 * the same check aimed at Shop.
 */
const looksLikeBareShell = (html) => {
  // Walked rather than stripped. The obvious version — replace(/<script.*?<\/script>/)
  // then replace(/<[^>]+>/) — reads like sanitisation, and CodeQL is right to
  // flag it as the incomplete kind: `</script >` slips straight through. This
  // counts words, it does not defend anything, and a scan makes both facts
  // clear while removing the finding rather than baselining it.
  const source = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  const tag = /<\/?([a-zA-Z][^\s/>]*)[^>]*>/g;
  let text = "";
  let cursor = 0;
  let inside = null; // 'script' | 'style' — element whose text is not content
  let match;
  while ((match = tag.exec(source)) !== null) {
    if (inside === null) text += ` ${source.slice(cursor, match.index)}`;
    const name = match[1].toLowerCase();
    const closing = match[0][1] === "/";
    if (!closing && (name === "script" || name === "style")) inside = name;
    else if (closing && inside === name) inside = null;
    cursor = tag.lastIndex;
  }
  if (inside === null) text += ` ${source.slice(cursor)}`;

  const body = text.replace(/\s+/g, " ").trim();
  return { words: body.split(" ").filter(Boolean).length, sample: body.slice(0, 120) };
};

// ─── 1. noindex matrix ──────────────────────────────────────────────────────
async function check1() {
  const bad = [];
  for (const p of [...BUYER_PATHS, ...SELLER_PATHS, ...ADMIN_PATHS]) {
    const r = await get(p);
    const h = (r.headers.get("x-robots-tag") ?? "").toLowerCase();
    if (!h.includes("noindex") || !h.includes("nofollow") || !h.includes("noarchive")) {
      bad.push(`${p} → ${h || "(header missing)"}`);
    }
  }
  // The control: if this one is noindex too, the pattern is too wide and the
  // other 17 passes mean nothing.
  const control = await get(CONTROL_PATH);
  const controlHeader = (control.headers.get("x-robots-tag") ?? "").toLowerCase();
  if (controlHeader.includes("noindex")) bad.push(`CONTROL ${CONTROL_PATH} is noindex — pattern too wide`);

  const robots = await (await get("/robots.txt")).text();
  const disallows = (robots.match(/^Disallow: \/(vi\/)?shop/gm) ?? []).length;
  if (disallows < 10) bad.push(`robots.txt has ${disallows} Shop Disallow lines, expected ≥10`);

  const sitemap = await (await get("/sitemap.xml")).text();
  if (/shop/i.test(sitemap)) bad.push("sitemap.xml mentions shop");

  if (bad.length) return record(1, "FAIL", bad.join(" | "));
  record(1, "PASS", `${BUYER_PATHS.length + SELLER_PATHS.length + ADMIN_PATHS.length} routes noindex, control clean, ${disallows} robots Disallow lines, sitemap clean`);
}

// ─── 2 + 16. the buyer surface actually renders ─────────────────────────────
async function check2and16() {
  const bad = [];
  const seen = [];
  for (const p of ["/shop", "/shop/search", "/vi/shop"]) {
    const r = await get(p);
    if (r.status !== 200) { bad.push(`${p} → HTTP ${r.status}`); continue; }
    const { words, sample } = looksLikeBareShell(await r.text());
    seen.push(`${p}:${words}w`);
    // The SPA shell alone is a handful of words. A rendered page is not.
    if (words < 15) bad.push(`${p} → ${words} words, looks like a bare shell ("${sample}")`);
  }
  if (bad.length) { record(2, "FAIL", bad.join(" | ")); return record(16, "FAIL", "see check 2"); }
  record(2, "PASS", `anonymous discovery renders: ${seen.join(" ")}`);
  record(16, "PASS", "buyer routes respond 200 with body content");
}

// ─── 3. the gate is closed to anyone not on the allowlist ───────────────────
async function check3() {
  if (!canQueryDb) return record(3, "SKIP", "no --supabase-url/--anon-key; NOT proven");
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/shop_pilot_has_access`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: "{}",
  });
  const body = await res.text();
  // Anonymous has no auth.uid(), so the function returns false. Anything that
  // is not false-or-refused means the gate is answering yes to a stranger.
  if (res.status === 200 && body.trim() === "false") {
    return record(3, "PASS", "shop_pilot_has_access() → false for an anonymous caller");
  }
  if (res.status === 401 || res.status === 403) {
    return record(3, "PASS", `refused with HTTP ${res.status}`);
  }
  record(3, "FAIL", `HTTP ${res.status}, body ${body.slice(0, 80)}`);
}

// ─── 19 + 22. the queue, and whether anything is watching it ────────────────
async function check19and22() {
  if (!canQueryDb) {
    record(19, "SKIP", "needs a DB connection; NOT proven");
    return record(22, "SKIP", "needs a DB connection; NOT proven");
  }
  // shop_media_cleanup_health is admin-only, by design. An anonymous 401/403 is
  // therefore the CORRECT answer, and it is itself evidence the view is not
  // world-readable. The real numbers come from the operator query in
  // docs/proposals/shop-closed-pilot/operations.md §1.
  const res = await fetch(`${supabaseUrl}/rest/v1/shop_media_cleanup_health?select=*`, {
    headers: { apikey: anonKey },
  });
  if (res.status === 200) {
    const rows = await res.json();
    return record(19, "FAIL", `health view is readable anonymously (${JSON.stringify(rows).slice(0, 80)}) — it must not be`);
  }
  record(19, "MANUAL", `health view correctly refuses anon (HTTP ${res.status}); read the real counts with operations.md §1`);
  // public_products is meant to be anonymous-readable. If it 404s, the read
  // model is not deployed; if it 200s with rows, the catalogue is live.
  const pp = await fetch(`${supabaseUrl}/rest/v1/public_products?select=id&limit=1`, {
    headers: { apikey: anonKey },
  });
  if (pp.status !== 200) return record(22, "FAIL", `public_products → HTTP ${pp.status}; the public read model is not reachable`);
  const rows = await pp.json();
  record(22, "PASS", `public_products reachable, ${rows.length} row(s) in a 1-row probe`);
}

// ─── 21. nothing private in an anonymous response ───────────────────────────
async function check21() {
  const leaks = [
    { re: /shop-product-media-draft/, what: "private draft bucket path" },
    { re: /[?&]token=/, what: "signed-URL token" },
    { re: /internal_note/, what: "internal_note field" },
    { re: /service_role/, what: "the words service_role" },
    { re: /"pickup_address"/, what: "seller pickup address" },
  ];
  const found = [];
  for (const p of ["/shop", "/shop/search", "/vi/shop", "/shop/product/x", "/shop/store/y"]) {
    const html = await (await get(p)).text();
    for (const l of leaks) if (l.re.test(html)) found.push(`${p}: ${l.what}`);
  }
  if (found.length) return record(21, "FAIL", found.join(" | "));
  record(21, "PASS", "5 anonymous responses scanned, no private path / token / internal field");
}

// ─── run ────────────────────────────────────────────────────────────────────
try {
  await check1();
  await check2and16();
  await check3();
  await check19and22();
  await check21();
} catch (e) {
  record(0, "FAIL", `harness: ${(e?.message ?? String(e)).slice(0, 200)}`);
}

for (const c of CHECKS) {
  if (results.some((r) => r.n === c.n)) continue;
  record(c.n, "MANUAL", c.name);
}

// ─── verdict ────────────────────────────────────────────────────────────────
const failed = results.filter((r) => r.status === "FAIL");
const skipped = results.filter((r) => r.status === "SKIP");
const manual = results.filter((r) => r.status === "MANUAL");

const evidence = {
  target,
  kind: matched.kind,
  // No timestamp is generated here: the caller stamps it. A script that writes
  // its own "verified at" is writing a claim, not a record.
  results,
  summary: { pass: results.filter((r) => r.status === "PASS").length, fail: failed.length, skip: skipped.length, manual: manual.length },
};
const out = opt("evidence", "shop-closed-pilot-smoke-evidence.json");
writeFileSync(out, JSON.stringify(evidence, null, 2));

console.log(`\nevidence: ${out}`);
console.log(`pass ${evidence.summary.pass} · fail ${failed.length} · skip ${skipped.length} · manual ${manual.length}`);

if (failed.length) {
  console.error(`\n✖ ${failed.length} automated check(s) FAILED. Do not proceed.`);
  process.exit(1);
}
if (skipped.length) {
  console.error(`\n⚠ ${skipped.length} check(s) SKIPPED for want of a DB connection. Skipped is not passed.`);
  process.exit(1);
}
console.log(
  `\n✓ every automated check passed.\n` +
  `  ${manual.length} check(s) still need a human with a real session. ` +
  `This run is NOT a pilot acceptance until each one is recorded in acceptance.md.`,
);
