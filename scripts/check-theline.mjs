#!/usr/bin/env node
// ============================================================================
// check-theline.mjs — TheLine design-system conformance on CHANGED files.
// ----------------------------------------------------------------------------
// Keeps new/edited UI aligned with the production TheLine layout. Like the
// lint gate, it only inspects files changed in the PR/push so legacy code is
// grandfathered. Rules:
//
//   [HARD]     <TheLineLayout ...> must include a `title` prop. Missing =
//              `<title>undefined</title>` ships to prod (the /dupr bug).
//   [advisory] Raw color literals (#hex, rgb()/rgba()/hsl()/hsla() with a
//              numeric arg) — use a `--tl-*` token or a Tailwind semantic
//              class instead. `hsl(var(--x))` is fine (token-based).
//   [advisory] A new routed page (src/pages/<name>.tsx) should render inside
//              TheLineLayout so it inherits nav/footer/theme.
//
// Exit 1 only on HARD violations. Set THELINE_STRICT=1 to also fail advisories.
//
// Usage:
//   node scripts/check-theline.mjs <file...>      # explicit files (CI passes these)
//   node scripts/check-theline.mjs                # auto-diff HEAD~1..HEAD
// ============================================================================

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const STRICT = process.env.THELINE_STRICT === "1";

// Files where raw color values are legitimate (token/theme definitions, config,
// vector art) — never flagged for the color rule.
const COLOR_ALLOW = [
  /src\/styles\//,
  /src\/index\.css$/,
  /tailwind\.config\.(t|j)s$/,
  /\.svg$/,
];

// #rgb / #rrggbb / #rrggbbaa, OR rgb()/rgba()/hsl()/hsla() with a numeric first
// arg (so `hsl(var(--primary))` token usage is NOT flagged).
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(\s*[\d.]/g;

function targetFiles() {
  if (process.argv.length > 2) return process.argv.slice(2);
  let base = process.env.BASE_SHA;
  if (!base) {
    try {
      base = execSync("git rev-parse HEAD~1", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
    } catch {
      return [];
    }
  }
  try {
    return execSync(
      `git diff --name-only --diff-filter=ACMR ${base} HEAD -- '*.tsx' '*.css'`,
      { stdio: ["ignore", "pipe", "ignore"] },
    )
      .toString()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

const files = targetFiles().filter(
  (f) => (f.endsWith(".tsx") || f.endsWith(".css")) && existsSync(f),
);

const hard = [];
const advisory = [];

for (const f of files) {
  const src = readFileSync(f, "utf8");
  const lines = src.split("\n");

  // Rule 1 — TheLineLayout title (HARD), per-FILE.
  // DynamicMeta sets `document.title = \`${title} | ThePickleHub\`` with no
  // fallback, so a TheLineLayout rendered without a title ships
  // "undefined | ThePickleHub". We flag a file only when it uses
  // <TheLineLayout> but NONE of its tags pass a `title` — i.e. the page has no
  // title at all. A page that titles its main render but omits it on a
  // loading/error sub-state is fine. We check `title=` INSIDE the
  // TheLineLayout tag (not anywhere in the file) so an unrelated
  // `<button title=...>` can't mask a missing layout title.
  const tagRe = /<TheLineLayout(\s[^>]*?)?\/?>/g;
  let usesLayout = false;
  let anyTitled = false;
  let firstTagLine = 0;
  let tm;
  while ((tm = tagRe.exec(src)) !== null) {
    usesLayout = true;
    if (!firstTagLine) firstTagLine = src.slice(0, tm.index).split("\n").length;
    if (/\btitle\s*=/.test(tm[1] ?? "")) anyTitled = true;
  }
  if (usesLayout && !anyTitled) {
    hard.push(
      `${f}:${firstTagLine}  uses <TheLineLayout> but none of its tags set a \`title\` — page ships "undefined | ThePickleHub"`,
    );
  }

  // Rule 2 — raw color literals (advisory).
  if (!COLOR_ALLOW.some((re) => re.test(f))) {
    lines.forEach((line, i) => {
      const t = line.trim();
      // Skip comments + CSS custom-property definitions (`--x: #hex` = a token).
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
      if (/^--[\w-]+\s*:/.test(t)) return;
      // Strip var(...) first so a token's fallback value — e.g.
      // `var(--tl-bg, #08090a)` — isn't flagged. That's correct usage
      // (token + graceful fallback), not a hardcoded color.
      const scan = line.replace(/var\([^)]*\)/g, "");
      const hits = scan.match(COLOR_RE);
      if (hits) {
        advisory.push(
          `${f}:${i + 1}  raw color ${[...new Set(hits)].join(", ")} — use a --tl-* token or Tailwind class`,
        );
      }
    });
  }

  // Rule 3 — new routed page should wrap TheLineLayout (advisory).
  if (/^src\/pages\/[^/]+\.tsx$/.test(f) && !f.endsWith(".legacy.tsx")) {
    if (!/TheLineLayout/.test(src) && !/ViLanguageWrapper/.test(src)) {
      advisory.push(
        `${f}  page does not reference TheLineLayout — wrap it so it gets the nav/footer/theme`,
      );
    }
  }
}

if (advisory.length) {
  console.log(`⚠ TheLine advisory (${advisory.length}):`);
  for (const a of advisory) console.log("   " + a);
}
if (hard.length) {
  console.error(`\n✖ TheLine hard violations (${hard.length}):`);
  for (const h of hard) console.error("   " + h);
}
if (!hard.length && !advisory.length) {
  console.log(`✓ TheLine conformance OK (${files.length} changed file(s)).`);
}

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary && (hard.length || advisory.length)) {
  try {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(
      summary,
      [
        "### TheLine conformance",
        ...hard.map((h) => `- ❌ ${h}`),
        ...advisory.map((a) => `- ⚠️ ${a}`),
        "",
      ].join("\n") + "\n",
    );
  } catch {
    /* ignore */
  }
}

if (hard.length || (STRICT && advisory.length)) process.exit(1);
process.exit(0);
