#!/usr/bin/env node
// ============================================================================
// Migration drift check — local supabase/migrations/* vs applied on prod.
// ----------------------------------------------------------------------------
// Catches the "migration file in repo but never applied to the DB" trap
// (CLAUDE.md: "Code in source != deployed"). Queries the prod
// supabase_migrations.schema_migrations table via the Management API and
// diffs the applied version set against the timestamp prefixes of the local
// migration files.
//
// Env:
//   SUPABASE_ACCESS_TOKEN   (required) Management API PAT
//   SUPABASE_PROJECT_REF    (default ajvlcamxemgbxduhiqrl)
//
// Exit codes: 0 = in sync, 1 = drift / error.
// Usage: node scripts/check-migration-drift.mjs
// ============================================================================

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || "ajvlcamxemgbxduhiqrl";

if (!TOKEN) {
  console.error("✖ SUPABASE_ACCESS_TOKEN not set");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

function localVersions() {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  const versions = new Map(); // version -> filename
  for (const f of files) {
    const m = f.match(/^(\d{14})/);
    if (m) versions.set(m[1], f);
  }
  return versions;
}

async function appliedVersions() {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query:
          "select version from supabase_migrations.schema_migrations order by version;",
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Management API query failed: ${res.status} ${await res.text()}`);
  }
  const rows = await res.json();
  return new Set(rows.map((r) => String(r.version)));
}

(async () => {
  try {
    const local = localVersions();
    const applied = await appliedVersions();

    const missingOnDb = [...local.keys()]
      .filter((v) => !applied.has(v))
      .sort();
    const missingLocally = [...applied]
      .filter((v) => !local.has(v))
      .sort();

    console.log(
      `Local migrations: ${local.size} · Applied on prod: ${applied.size}`,
    );

    if (missingOnDb.length === 0 && missingLocally.length === 0) {
      console.log("✓ Migration state in sync.");
      process.exit(0);
    }

    if (missingOnDb.length) {
      console.error(
        `\n✖ ${missingOnDb.length} migration file(s) in repo NOT applied to prod:`,
      );
      for (const v of missingOnDb) console.error(`   - ${local.get(v)}`);
    }
    if (missingLocally.length) {
      console.error(
        `\n⚠ ${missingLocally.length} migration(s) applied on prod with NO local file:`,
      );
      for (const v of missingLocally) console.error(`   - ${v}`);
    }
    // Only the "repo ahead of DB" case is a hard failure (unapplied work).
    process.exit(missingOnDb.length ? 1 : 0);
  } catch (e) {
    console.error("✖ Drift check error:", e.message);
    process.exit(1);
  }
})();
