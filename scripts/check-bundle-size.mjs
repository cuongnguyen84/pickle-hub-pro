#!/usr/bin/env node
// ============================================================================
// Bundle budgets (gzipped JS) — perf-js-gzip.
// ----------------------------------------------------------------------------
// Measures three numbers instead of one aggregate:
//
//   CODE     gz of all JS except bilingual blog content chunks. Blog posts are
//            per-slug lazy content (assets/blog-post-*.js) that grows with
//            every published article; counting them as "code" made the budget
//            creep on each post. Each content chunk still has its own cap so a
//            bloated article stays red.
//   CONTENT  gz of the blog-post-* chunks.
//   INITIAL  gz the browser actually fetches on first paint: entry <script>
//            + <link rel="modulepreload"> in dist/index.html + their static
//            imports, resolved recursively. An aggregate can stay flat while a
//            lazy chunk silently becomes eager (recharts did exactly that) —
//            only this number catches it.
//
// STRICT also asserts every initial-load chunk matches a PWA precache glob in
// vite.config.ts (a boot-critical chunk missing from precache bricks installed
// PWAs on offline launch).
//
// Env:
//   BUNDLE_BUDGET_KB           total-gz backstop (default 1970)
//   BUNDLE_CODE_BUDGET_KB      CODE budget (default 1800)
//   BUNDLE_INITIAL_BUDGET_KB   INITIAL budget (default 280)
//   BUNDLE_CONTENT_CHUNK_KB    per blog-post chunk cap (default 20)
//   BUNDLE_STRICT              "1" => exit 1 on any breach
//
// Run after `npm run build`. Usage: node scripts/check-bundle-size.mjs
// ============================================================================

import { readdirSync, readFileSync, statSync, existsSync, appendFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname, resolve } from "node:path";

const BUDGETS = {
  total: Number(process.env.BUNDLE_BUDGET_KB || 1970),
  code: Number(process.env.BUNDLE_CODE_BUDGET_KB || 1800),
  initial: Number(process.env.BUNDLE_INITIAL_BUDGET_KB || 280),
  contentChunk: Number(process.env.BUNDLE_CONTENT_CHUNK_KB || 20),
};
const STRICT = process.env.BUNDLE_STRICT === "1";
const CONTENT_RE = /(?:^|\/)blog-post-[^/]+\.js$/;

export function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

// Static imports of a built ESM chunk. `[^"'()]*?` keeps dynamic `import(`
// from matching; covers `import x from"./a.js"`, `import"./a.js"`,
// `export{x}from"./a.js"`.
export function staticImports(source) {
  const out = [];
  const re = /(?:import|export)\s*[^"'()]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g;
  for (let m; (m = re.exec(source)); ) out.push(m[1] ?? m[2]);
  return out.filter((s) => s.endsWith(".js"));
}

// Entry <script src> + <link rel="modulepreload"> from index.html, then their
// static import graph. Returns dist-relative paths.
export function initialLoadFiles(dist) {
  const html = readFileSync(join(dist, "index.html"), "utf8");
  const seeds = [
    ...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g),
    ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
  ].map((m) => m[1]);

  const seen = new Set();
  const queue = seeds.map((s) => resolve(dist, s.replace(/^\//, "")));
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    for (const spec of staticImports(readFileSync(file, "utf8"))) {
      queue.push(
        spec.startsWith("/") ? resolve(dist, spec.slice(1)) : resolve(dirname(file), spec),
      );
    }
  }
  const abs = resolve(dist) + "/";
  return [...seen].map((f) => f.replace(abs, ""));
}

// PWA precache globPatterns from vite.config.ts, as regexes. Line comments
// are stripped first so a commented-out pattern is not counted as covering.
export function precachePatterns(viteConfigSource) {
  const block = viteConfigSource.match(/globPatterns:\s*\[([^\]]*)\]/);
  if (!block) return [];
  const cleaned = block[1].replace(/\/\/[^\n]*/g, "");
  return [...cleaned.matchAll(/["']([^"']+)["']/g)].map(
    (m) => new RegExp("^" + m[1].replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*") + "$"),
  );
}

function main() {
  const DIST = "dist";
  let files;
  try {
    files = walk(DIST);
  } catch {
    console.error(`✖ ${DIST}/ not found — run \`npm run build\` first.`);
    process.exit(STRICT ? 1 : 0);
  }

  const rows = files
    .map((f) => {
      const buf = readFileSync(f);
      return { file: f.replace(`${DIST}/`, ""), raw: buf.length, gz: gzipSync(buf).length };
    })
    .sort((a, b) => b.gz - a.gz);

  const kb = (n) => (n / 1024).toFixed(1);
  const sum = (rs) => rs.reduce((s, r) => s + r.gz, 0);

  const contentRows = rows.filter((r) => CONTENT_RE.test(r.file));
  const codeRows = rows.filter((r) => !CONTENT_RE.test(r.file));
  const initialFiles = initialLoadFiles(DIST);
  const initialRows = rows.filter((r) => initialFiles.includes(r.file));

  const totals = {
    total: sum(rows),
    code: sum(codeRows),
    content: sum(contentRows),
    initial: sum(initialRows),
  };

  const lines = [
    "### Bundle size (gzipped JS)",
    "",
    "| Chunk | raw KB | gz KB |",
    "|---|---:|---:|",
    ...rows.slice(0, 15).map((r) => `| ${r.file} | ${kb(r.raw)} | ${kb(r.gz)} |`),
    ...(rows.length > 15 ? [`| …${rows.length - 15} more | | |`] : []),
    "",
    `**INITIAL (first-paint) gz: ${kb(totals.initial)} KB** / budget ${BUDGETS.initial} KB — ${initialRows.length} critical-path requests`,
    `**CODE gz: ${kb(totals.code)} KB** / budget ${BUDGETS.code} KB`,
    `**CONTENT (blog) gz: ${kb(totals.content)} KB** across ${contentRows.length} chunks (cap ${BUDGETS.contentChunk} KB each)`,
    `**Total gz JS: ${kb(totals.total)} KB** / backstop ${BUDGETS.total} KB`,
  ];
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
    } catch {
      /* ignore summary write errors */
    }
  }

  const breaches = [];
  if (totals.initial > BUDGETS.initial * 1024)
    breaches.push(`INITIAL ${kb(totals.initial)} KB > ${BUDGETS.initial} KB`);
  if (totals.code > BUDGETS.code * 1024)
    breaches.push(`CODE ${kb(totals.code)} KB > ${BUDGETS.code} KB`);
  if (totals.total > BUDGETS.total * 1024)
    breaches.push(`Total ${kb(totals.total)} KB > backstop ${BUDGETS.total} KB`);
  for (const r of contentRows)
    if (r.gz > BUDGETS.contentChunk * 1024)
      breaches.push(`content chunk ${r.file} ${kb(r.gz)} KB > ${BUDGETS.contentChunk} KB`);

  // Boot-critical ⊆ precache whitelist (offline PWA launch needs every
  // initial-load chunk precached; a drifted manualChunks name bricks it).
  const patterns = precachePatterns(readFileSync("vite.config.ts", "utf8"));
  if (!patterns.length) {
    // Parse failure must fail loud — an empty list would silently disable the guard.
    breaches.push("could not parse any globPatterns from vite.config.ts — precache-coverage guard has nothing to check");
  } else {
    for (const f of initialFiles)
      if (!patterns.some((re) => re.test(f)))
        breaches.push(`initial-load chunk ${f} matches no precache globPattern in vite.config.ts`);
  }

  if (breaches.length) {
    for (const b of breaches) console.error(`${STRICT ? "✖" : "⚠"} ${b}`);
    if (STRICT) process.exit(1);
    console.warn("⚠ advisory — set BUNDLE_STRICT=1 to enforce");
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  main();
}
