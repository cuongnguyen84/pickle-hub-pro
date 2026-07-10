#!/usr/bin/env node
// ============================================================================
// Migration duplicate guard — network-free, token-free, runs on EVERY PR.
// ----------------------------------------------------------------------------
// Catches the class of bug from PR #280: a rebase/merge silently re-added the
// old-named copies of migrations that PR #278 had already renamed to unique
// `…+1` timestamps. Result: four 14-digit versions existed twice, and the
// drift checker's `Map<version,file>.set()` swallowed the collision
// (last-writer-wins) instead of flagging it.
//
// This guard fails the build when EITHER:
//   1. Two files share the same 14-digit version prefix, OR
//   2. Two files have identical content (a byte-for-byte re-add), even at
//      different versions — the exact signature of the #280 regression.
//
// Deliberately has NO network / Management-API dependency so it runs in CI
// without SUPABASE_ACCESS_TOKEN. `findMigrationDuplicates` is a pure function
// (data in → findings out) so it is unit-tested directly.
//
// Usage: node scripts/check-migration-duplicates.mjs
// ============================================================================

import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const VERSION_RE = /^(\d{14})_/;

/**
 * Pure duplicate detector.
 * @param {Array<{name: string, content: string}>} files
 * @returns {{ versionDuplicates: Array<{version: string, files: string[]}>,
 *             contentDuplicates: Array<{hash: string, files: string[]}> }}
 */
export function findMigrationDuplicates(files) {
  const byVersion = new Map(); // version -> string[]
  const byContent = new Map(); // sha256 -> string[]

  for (const { name, content } of files) {
    const m = name.match(VERSION_RE);
    if (m) {
      const arr = byVersion.get(m[1]) ?? [];
      arr.push(name);
      byVersion.set(m[1], arr);
    }
    const hash = createHash("sha256").update(content).digest("hex");
    const arr = byContent.get(hash) ?? [];
    arr.push(name);
    byContent.set(hash, arr);
  }

  const versionDuplicates = [...byVersion.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([version, names]) => ({ version, files: names.sort() }))
    .sort((a, b) => a.version.localeCompare(b.version));

  const contentDuplicates = [...byContent.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([hash, names]) => ({ hash, files: names.sort() }))
    .sort((a, b) => a.files[0].localeCompare(b.files[0]));

  return { versionDuplicates, contentDuplicates };
}

function readMigrations(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((name) => ({ name, content: readFileSync(join(dir, name), "utf8") }));
}

// CLI entry — only run when executed directly, not when imported by a test.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const dir = join(__dirname, "..", "supabase", "migrations");
  const files = readMigrations(dir);
  const { versionDuplicates, contentDuplicates } = findMigrationDuplicates(files);

  let failed = false;

  if (versionDuplicates.length) {
    failed = true;
    console.error(`\n✖ ${versionDuplicates.length} duplicate migration version(s):`);
    for (const { version, files: names } of versionDuplicates) {
      console.error(`   ${version} → ${names.join("  |  ")}`);
    }
  }

  if (contentDuplicates.length) {
    failed = true;
    console.error(`\n✖ ${contentDuplicates.length} migration(s) with identical content (re-add signature):`);
    for (const { files: names } of contentDuplicates) {
      console.error(`   ${names.join("  ≡  ")}`);
    }
  }

  if (failed) {
    console.error(
      "\n  Fix: delete the re-added copy, keep the uniquely-versioned twin.\n" +
        "  See scripts/check-migration-duplicates.mjs header for the #278/#280 history.\n",
    );
    process.exit(1);
  }

  console.log(`✓ ${files.length} migrations — no duplicate versions or content.`);
  process.exit(0);
}
