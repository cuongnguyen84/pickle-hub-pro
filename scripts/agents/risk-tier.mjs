#!/usr/bin/env node
// ============================================================================
// risk-tier — path-based RED/AMBER/GREEN classifier for a proposed change.
// ----------------------------------------------------------------------------
// Answers exactly one question: **if this breaks, can `git revert` + redeploy
// undo it?**
//
//   GREEN  revert + redeploy restores the previous state. Ship freely.
//   AMBER  revert works, but something outside the Pages deploy must also be
//          redeployed or invalidated (edge function, KV cache, worker asset).
//   RED    revert does NOT undo it. An applied migration, a shipped native
//          build, a sent push, a deployed Worker. Needs Cuong.
//
// The verdict is a FLOOR, not a ceiling (.claude/agents/risk-auditor.md): the
// auditor reads intent and may raise a tier, never lower it. This script only
// reads paths — a src/-only diff that drops a column via raw SQL still looks
// GREEN here and is RED in reality.
//
// Usage:
//   node scripts/agents/risk-tier.mjs --base origin/main           # diff vs a ref
//   node scripts/agents/risk-tier.mjs --files "a.ts,b.sql"         # or space-separated
//   node scripts/agents/risk-tier.mjs --base origin/main --json
//   node scripts/agents/risk-tier.mjs --files "..." --exit-code    # 2 on RED, 1 on AMBER
// ============================================================================

import { execFileSync } from "node:child_process";

/**
 * Ordered rules — first match wins per file, so put the narrow exceptions
 * ABOVE the broad rule they carve out of.
 * @type {Array<{re: RegExp, tier: "RED"|"AMBER"|"GREEN", why: string}>}
 */
export const RULES = [
  // ── GREEN exceptions that must outrank the broad RED/AMBER rules below ───
  {
    re: /^supabase\/tests\//,
    tier: "GREEN",
    why: "pgTAP tests — run in CI against a disposable db, never applied to prod",
  },

  // ── RED: git revert cannot undo these ────────────────────────────────────
  {
    re: /^supabase\/migrations\//,
    tier: "RED",
    why: "applied migration — reverting the file does not un-run the SQL; needs a reverse migration",
  },
  {
    re: /^apple\//,
    tier: "RED",
    why: "native iOS build ships through App Store review — no revert button once released",
  },
  {
    re: /^workers\/[^/]+\/(src\/|wrangler\.toml)/,
    tier: "RED",
    why: "Cloudflare Worker deploys out-of-band (wrangler deploy); main is not its source of truth",
  },
  {
    re: /^supabase\/config\.toml$/,
    tier: "RED",
    why: "verify_jwt flips 401 every logged-in user (ES256/HS256 workaround, CLAUDE.md)",
  },

  // ── AMBER: revert works but something else must be redeployed/invalidated ─
  {
    // Narrow exception above the broad edge-function rule: pure shared helpers
    // are unit-tested and carry no deploy of their own.
    re: /^supabase\/functions\/_shared\/__tests__\//,
    tier: "GREEN",
    why: "unit tests for shared edge helpers — no deploy surface",
  },
  {
    re: /^supabase\/functions\//,
    tier: "AMBER",
    why: "edge function deploys separately from Pages — reverting main does not redeploy it",
  },
  {
    re: /^functions\/(_middleware\.ts|_lib\/render\/)/,
    tier: "AMBER",
    why: "SSR for bots — stale KV HTML survives a revert until the pr:v** cache key is bumped",
  },
  {
    re: /^functions\/sitemap|^functions\/_lib\/static-blog-slugs/,
    tier: "AMBER",
    why: "sitemap surface — a bad deploy can deindex; recovery is crawl-rate-bound, not deploy-bound",
  },
  {
    re: /^(package\.json|package-lock\.json|vite\.config\.ts)$/,
    tier: "AMBER",
    why: "build/dependency surface — lockfile regressions break CI installs, not just this PR",
  },
  {
    re: /^\.github\/workflows\//,
    tier: "AMBER",
    why: "CI definition — a broken gate is invisible until the thing it guards ships",
  },
  {
    re: /^src\/content\/blog\/|^src\/i18n\//,
    tier: "AMBER",
    why: "content/i18n — a missing metadata entry 404s bots while the SPA renders fine",
  },

  // ── GREEN: ordinary application code ─────────────────────────────────────
  { re: /^src\//, tier: "GREEN", why: "app code — revert + redeploy restores it" },
  { re: /^(docs\/|tests\/|scripts\/)/, tier: "GREEN", why: "not shipped to users" },
];

const ORDER = { GREEN: 0, AMBER: 1, RED: 2 };

/**
 * Classify a list of repo-relative paths.
 * @param {string[]} files
 * @returns {{tier: "RED"|"AMBER"|"GREEN", files: Array<{file: string, tier: string, why: string}>}}
 */
export function classify(files) {
  const rows = files.map((file) => {
    const hit = RULES.find((r) => r.re.test(file));
    // Unknown paths are AMBER, never GREEN: an unrecognised surface is one
    // nobody has reasoned about, which is not the same as one known to be safe.
    return hit
      ? { file, tier: hit.tier, why: hit.why }
      : { file, tier: "AMBER", why: "unrecognised path — no rule covers this surface yet" };
  });
  const tier = rows.reduce(
    (worst, r) => (ORDER[r.tier] > ORDER[worst] ? r.tier : worst),
    "GREEN",
  );
  return { tier, files: rows };
}

/** Split --files on commas, whitespace and newlines. */
export function parseFiles(raw) {
  return (raw ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Paths changed against a git ref, three-dot so only THIS branch's work counts. */
export function changedSince(base) {
  return parseFiles(
    execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
      encoding: "utf8",
    }),
  );
}

function main(argv) {
  const iBase = argv.indexOf("--base");
  const iFiles = argv.indexOf("--files");
  if (iBase === -1 && iFiles === -1) {
    console.error(
      'usage: risk-tier.mjs (--base <ref> | --files "p1,p2") [--json] [--exit-code]',
    );
    return 64;
  }
  const files =
    iBase !== -1 ? changedSince(argv[iBase + 1]) : parseFiles(argv[iFiles + 1]);
  if (!files.length) {
    // No files is not GREEN — it means the invocation was wrong (bad ref,
    // empty branch). Saying GREEN here would wave through an unclassified change.
    console.error("✖ no changed files found — check the ref or --files argument");
    return 64;
  }

  const result = classify(files);

  if (argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const badge = { RED: "🔴", AMBER: "🟡", GREEN: "🟢" }[result.tier];
    console.log(`${badge} ${result.tier}\n`);
    for (const r of result.files) {
      if (r.tier === "GREEN") continue; // only the reasons that moved the verdict
      console.log(`  ${r.tier.padEnd(5)} ${r.file}\n        ${r.why}`);
    }
    if (result.tier === "RED") {
      console.log(
        "\n  git revert does NOT undo this. Cuong must approve before merge.",
      );
    }
  }

  if (argv.includes("--exit-code")) {
    return { GREEN: 0, AMBER: 1, RED: 2 }[result.tier];
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
