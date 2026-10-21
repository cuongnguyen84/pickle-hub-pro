#!/usr/bin/env node
// ============================================================================
// soak-watch — post-deploy regression watch for the 30-minute soak window.
// ----------------------------------------------------------------------------
// A 200 from a post-deploy curl proves the shell booted one second after
// deploy, for a logged-out bot. Real regressions need a logged-in user on a
// slow phone hitting the changed route, and they surface over MINUTES. This
// script watches for them.
//
// It looks for NEW error signatures, not error volume. Volume moves with
// traffic all day and means nothing; a message that never appeared in the
// baseline window and starts appearing after your SHA is causal and specific.
//
// Signal source: the `client_errors` table (browser errors POSTed by
// src/lib/... via the client-errors edge helper) — the same table
// `errors-telegram-alert` alerts on, so the two agree on what "an error" is.
// The fingerprint below is deliberately identical to the one in
// supabase/functions/errors-telegram-alert/index.ts; if that one changes,
// change this one. (Duplicated rather than imported: that file is Deno TS and
// importing it from node would need a build step for three lines of string
// slicing.)
//
// ponytail: client-side errors only. An edge function 500 that never reaches
// a browser is invisible here — add a function_edge_logs source if a soak
// ever misses one that way.
//
// Env:
//   SUPABASE_ACCESS_TOKEN   (required) Management API PAT
//   SUPABASE_PROJECT_REF    (default ajvlcamxemgbxduhiqrl)
//
// Usage:
//   node scripts/agents/soak-watch.mjs --baseline --out /tmp/soak-<slug>.json
//   node scripts/agents/soak-watch.mjs --watch --baseline-file /tmp/soak-<slug>.json \
//     --minutes 30 --interval 3 [--json]
//
// Exit codes:
//   0  window completed with no new signature
//   1  NEW signature detected → revert now (bails early, does not wait out
//      the window: every extra minute of evidence is a minute more users hit it)
//   2  usage / configuration error
// ============================================================================

import { writeFileSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const REF = process.env.SUPABASE_PROJECT_REF || "ajvlcamxemgbxduhiqrl";
const BASELINE_HOURS = 24;

/** Identical to errors-telegram-alert/index.ts:48 — keep in sync. */
export function fingerprint(message, stack) {
  const msg = (message ?? "").slice(0, 200);
  const stackLine = (stack ?? "").split("\n")[0]?.slice(0, 200) ?? "";
  return `${msg}|${stackLine}`;
}

/**
 * Signatures present in `rows` that are absent from `baseline`.
 * @param {Set<string>} baseline
 * @param {Array<{message?: string|null, stack?: string|null, recorded_at?: string, url?: string|null}>} rows
 */
export function newSignatures(baseline, rows) {
  const found = new Map();
  for (const r of rows) {
    const fp = fingerprint(r.message, r.stack);
    if (baseline.has(fp)) continue;
    const prev = found.get(fp);
    if (prev) prev.count += 1;
    else
      found.set(fp, {
        signature: fp,
        count: 1,
        first_seen: r.recorded_at,
        sample_url: r.url ?? null,
      });
  }
  return [...found.values()];
}

async function query(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error("✖ SUPABASE_ACCESS_TOKEN not set");
    process.exit(2);
  }
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  if (!res.ok) {
    throw new Error(`Management API query failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Normalise an instant to a canonical ISO string before it reaches SQL.
 * The watch path takes this value out of a JSON file supplied by the caller,
 * so it is untrusted input interpolated into a statement that runs on prod
 * under a Management API PAT. Round-tripping through Date makes a quote
 * impossible to smuggle through, and rejects garbage loudly instead of
 * querying a nonsense window.
 */
export function isoOrThrow(value, label) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`${label} is not a valid timestamp: ${value}`);
  return d.toISOString();
}

const errorsSince = (instant) =>
  query(
    `SELECT message, stack, url, recorded_at FROM public.client_errors ` +
      `WHERE recorded_at > '${isoOrThrow(instant, "since")}' ` +
      `ORDER BY recorded_at DESC LIMIT 2000;`,
  );

async function captureBaseline(out) {
  const since = new Date(Date.now() - BASELINE_HOURS * 3600_000).toISOString();
  const rows = await errorsSince(since);
  const signatures = [...new Set(rows.map((r) => fingerprint(r.message, r.stack)))];
  const baseline = {
    captured_at: new Date().toISOString(),
    window_hours: BASELINE_HOURS,
    rows_scanned: rows.length,
    signatures,
  };
  writeFileSync(out, JSON.stringify(baseline, null, 2));
  console.log(
    `📋 baseline: ${signatures.length} known signature(s) from ${rows.length} error(s) ` +
      `in the last ${BASELINE_HOURS}h → ${out}`,
  );
  // An empty baseline is not proof of a healthy app — it is equally the shape
  // of a broken collector. Say so rather than letting the soak inherit a
  // silent "everything is new" state.
  if (!rows.length) {
    console.warn(
      "⚠ zero errors in the baseline window — either genuinely quiet or client_errors " +
        "is not being written. Verify before trusting a green soak.",
    );
  }
  return 0;
}

async function watch({ baselineFile, minutes, interval, json }) {
  // A mistyped --minutes (Number("abc") === NaN) or --minutes 0 would make the
  // loop condition false on the first evaluation: zero polls, no API call, and
  // a cheerful "soak clean" exit 0. That is precisely the false green this
  // script exists to prevent, so refuse to run rather than report on nothing.
  if (!Number.isFinite(minutes) || minutes <= 0) {
    console.error(`✖ --minutes must be a positive number (got ${minutes})`);
    return 2;
  }
  if (!Number.isFinite(interval) || interval <= 0) {
    console.error(`✖ --interval must be a positive number (got ${interval})`);
    return 2;
  }

  const baseline = JSON.parse(readFileSync(baselineFile, "utf8"));
  if (!Array.isArray(baseline.signatures) || !baseline.captured_at) {
    console.error(`✖ ${baselineFile} is not a baseline file (need captured_at + signatures)`);
    return 2;
  }
  const known = new Set(baseline.signatures);
  // Only errors recorded after the baseline was taken can be caused by this
  // deploy. Anything older is pre-existing by definition.
  const since = baseline.captured_at;
  const deadline = Date.now() + minutes * 60_000;
  let polls = 0;

  // Progress goes to stderr under --json: stdout must stay a single parseable
  // document, since the caller pipes it straight into JSON.parse.
  const note = json ? console.error : console.log;
  note(`👀 soak ${minutes}m (poll ${interval}m) against ${known.size} known signature(s)`);

  while (Date.now() < deadline) {
    await sleep(Math.min(interval * 60_000, Math.max(0, deadline - Date.now())));
    polls += 1;
    const rows = await errorsSince(since);
    const fresh = newSignatures(known, rows);

    if (fresh.length) {
      const verdict = {
        result: "NEW_SIGNATURE",
        polls,
        elapsed_min: Math.round((minutes * 60_000 - (deadline - Date.now())) / 60_000),
        new_signatures: fresh,
      };
      if (json) console.log(JSON.stringify(verdict, null, 2));
      else {
        console.error(`\n🔴 NEW ERROR SIGNATURE after ${polls} poll(s) — REVERT NOW\n`);
        for (const f of fresh) {
          console.error(`  ×${f.count}  ${f.signature.split("|")[0]}`);
          console.error(`         first ${f.first_seen}  ${f.sample_url ?? ""}`);
        }
      }
      return 1;
    }

    const left = Math.max(0, Math.round((deadline - Date.now()) / 60_000));
    if (!json) console.log(`  ✓ poll ${polls}: ${rows.length} error(s), 0 new — ${left}m left`);
  }

  if (json) console.log(JSON.stringify({ result: "CLEAN", polls }, null, 2));
  else
    console.log(
      `\n🟢 soak clean — ${polls} poll(s), no new signature.\n` +
        `   Proves nothing threw that never threw before. Does NOT prove anyone used the feature.`,
    );
  return 0;
}

function arg(argv, name, fallback) {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  try {
    if (argv.includes("--baseline")) {
      const out = arg(argv, "--out");
      if (!out) {
        console.error("✖ --baseline needs --out <file>");
        process.exit(2);
      }
      process.exit(await captureBaseline(out));
    } else if (argv.includes("--watch")) {
      const baselineFile = arg(argv, "--baseline-file");
      if (!baselineFile) {
        console.error("✖ --watch needs --baseline-file <file>");
        process.exit(2);
      }
      process.exit(
        await watch({
          baselineFile,
          minutes: Number(arg(argv, "--minutes", "30")),
          interval: Number(arg(argv, "--interval", "3")),
          json: argv.includes("--json"),
        }),
      );
    } else {
      console.error(
        "usage: soak-watch.mjs --baseline --out <file>\n" +
          "       soak-watch.mjs --watch --baseline-file <file> [--minutes 30] [--interval 3] [--json]",
      );
      process.exit(2);
    }
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(2);
  }
}
