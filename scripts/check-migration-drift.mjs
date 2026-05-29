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
// IMPORTANT — advisory by default. ThePickleHub applies migrations by
// running SQL directly via the Management API (see handoff doc §9), NOT via
// `supabase db push`, so `supabase_migrations.schema_migrations` is NOT a
// reliable record of what's applied — it under-reports and produces false
// "unapplied" positives. Therefore this script only WARNS by default and
// exits 0. Set DRIFT_STRICT=1 to make repo-ahead-of-DB a hard failure once
// the schema_migrations ledger has been reconciled.
//
// Env:
//   SUPABASE_ACCESS_TOKEN   (required) Management API PAT
//   SUPABASE_PROJECT_REF    (default ajvlcamxemgbxduhiqrl)
//   DRIFT_STRICT            (optional) "1" => exit 1 on repo-ahead drift
//
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

    const strict = process.env.DRIFT_STRICT === "1";

    if (missingOnDb.length) {
      console.error(
        `\n⚠ ${missingOnDb.length} migration file(s) in repo with no schema_migrations row on prod:`,
      );
      for (const v of missingOnDb.slice(0, 10)) console.error(`   - ${local.get(v)}`);
      if (missingOnDb.length > 10)
        console.error(`   … and ${missingOnDb.length - 10} more`);
      console.error(
        "\n  NOTE: likely applied via direct SQL (Management API), which does\n" +
          "  not write schema_migrations. This is advisory unless DRIFT_STRICT=1.",
      );
    }
    if (missingLocally.length) {
      console.error(
        `\n⚠ ${missingLocally.length} migration row(s) on prod with NO local file (review).`,
      );
    }

    if (strict && missingOnDb.length) {
      console.error("\n✖ DRIFT_STRICT=1 and repo is ahead of DB — failing.");
      process.exit(1);
    }
    console.log("\n(advisory mode — not failing the build)");
    process.exit(0);
  } catch (e) {
    console.error("✖ Drift check error:", e.message);
    process.exit(1);
  }
})();
