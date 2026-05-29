#!/usr/bin/env node
// ============================================================================
// Phase 3F — bundle-size budget (gzipped JS).
// ----------------------------------------------------------------------------
// Sums the gzipped size of the built JS in dist/ and prints a per-chunk table.
// ADVISORY by default (exits 0) so the first runs just establish a baseline;
// set BUNDLE_STRICT=1 to fail when total gz JS exceeds BUNDLE_BUDGET_KB.
//
// Env:
//   BUNDLE_BUDGET_KB   total gzipped-JS budget in KB (default 1800)
//   BUNDLE_STRICT      "1" => exit 1 when over budget
//
// Run after `npm run build`. Usage: node scripts/check-bundle-size.mjs
// ============================================================================

import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const DIST = "dist";
const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB || 1800);
const STRICT = process.env.BUNDLE_STRICT === "1";

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

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

const totalGz = rows.reduce((s, r) => s + r.gz, 0);
const kb = (n) => (n / 1024).toFixed(1);

const summary = process.env.GITHUB_STEP_SUMMARY;
const lines = [
  "### Bundle size (gzipped JS)",
  "",
  "| Chunk | raw KB | gz KB |",
  "|---|---:|---:|",
  ...rows.slice(0, 15).map((r) => `| ${r.file} | ${kb(r.raw)} | ${kb(r.gz)} |`),
  ...(rows.length > 15 ? [`| …${rows.length - 15} more | | |`] : []),
  "",
  `**Total gz JS: ${kb(totalGz)} KB** / budget ${BUDGET_KB} KB`,
];
console.log(lines.join("\n"));
if (summary) {
  try {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(summary, lines.join("\n") + "\n");
  } catch {
    /* ignore summary write errors */
  }
}

const overBy = totalGz - BUDGET_KB * 1024;
if (overBy > 0) {
  const msg = `Total gz JS ${kb(totalGz)} KB exceeds budget ${BUDGET_KB} KB by ${kb(overBy)} KB`;
  if (STRICT) {
    console.error(`✖ ${msg}`);
    process.exit(1);
  }
  console.warn(`⚠ ${msg} (advisory — set BUNDLE_STRICT=1 to enforce)`);
}
process.exit(0);
