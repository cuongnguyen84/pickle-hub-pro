#!/usr/bin/env node
// ============================================================================
// codeql-gate.mjs — local CodeQL SARIF gate (security.yml)
// ============================================================================
// GitHub pulled code-scanning SARIF upload for free-plan private repos
// (2026-07-21), which also removed Security-tab dismissals. This gate reads
// the SARIF produced by codeql-action/analyze (upload: never) and fails on
// any finding NOT covered by scripts/codeql-baseline.json — i.e. the same
// semantic the upload path had: new findings block, human-accepted ones
// don't. Adding to the baseline is a reviewed, in-repo act with a written
// reason, replacing the old dismiss button.
//
// Usage:
//   node scripts/codeql-gate.mjs <sarif-dir>     # exit 1 on non-baselined finding
//   node scripts/codeql-gate.mjs --self-check
// ============================================================================

import { readFileSync, readdirSync } from "node:fs";

export function evaluate(sarifRuns, baseline) {
  const accepted = baseline.accepted ?? [];
  const matchedBaseline = new Set();
  const blocking = [];
  const allowed = [];
  for (const run of sarifRuns) {
    for (const r of run.results ?? []) {
      const uri =
        r.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? "(no file)";
      const line = r.locations?.[0]?.physicalLocation?.region?.startLine ?? 0;
      const entryIdx = accepted.findIndex(
        (a) => a.ruleId === r.ruleId && a.file === uri,
      );
      const finding = {
        ruleId: r.ruleId,
        uri,
        line,
        level: r.level ?? "warning",
        text: r.message?.text?.slice(0, 160) ?? "",
      };
      if (entryIdx >= 0) {
        matchedBaseline.add(entryIdx);
        allowed.push(finding);
      } else {
        blocking.push(finding);
      }
    }
  }
  const stale = accepted
    .map((a, i) => ({ ...a, i }))
    .filter((a) => !matchedBaseline.has(a.i));
  return { blocking, allowed, stale };
}

function selfCheck() {
  const runs = [
    {
      results: [
        {
          ruleId: "js/known-fp",
          message: { text: "old accepted" },
          locations: [{ physicalLocation: { artifactLocation: { uri: "a.ts" }, region: { startLine: 1 } } }],
        },
        {
          ruleId: "js/new-bug",
          message: { text: "fresh finding" },
          locations: [{ physicalLocation: { artifactLocation: { uri: "b.ts" }, region: { startLine: 2 } } }],
        },
      ],
    },
  ];
  const baseline = {
    accepted: [
      { ruleId: "js/known-fp", file: "a.ts", reason: "x" },
      { ruleId: "js/gone", file: "c.ts", reason: "y" },
    ],
  };
  const { blocking, allowed, stale } = evaluate(runs, baseline);
  console.assert(blocking.length === 1 && blocking[0].ruleId === "js/new-bug", "new finding blocks");
  console.assert(allowed.length === 1 && allowed[0].ruleId === "js/known-fp", "baselined finding allowed");
  console.assert(stale.length === 1 && stale[0].ruleId === "js/gone", "stale baseline entry reported");
  console.assert(evaluate([], baseline).blocking.length === 0, "empty SARIF passes");
  console.log("self-check OK");
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  if (process.argv.includes("--self-check")) {
    selfCheck();
    process.exit(0);
  }
  const dir = process.argv[2] ?? "codeql-results";
  const files = readdirSync(dir).filter((f) => f.endsWith(".sarif"));
  if (files.length === 0) {
    console.error(`codeql-gate: no SARIF in ${dir} — analysis step broken`);
    process.exit(1);
  }
  const runs = files.flatMap(
    (f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")).runs ?? [],
  );
  const baseline = JSON.parse(
    readFileSync(new URL("./codeql-baseline.json", import.meta.url), "utf8"),
  );
  const { blocking, allowed, stale } = evaluate(runs, baseline);

  for (const a of allowed) {
    console.log(`BASELINED (accepted FP): [${a.level}] ${a.ruleId} ${a.uri}:${a.line}`);
  }
  for (const s of stale) {
    console.log(`::warning::stale baseline entry no longer matches anything: ${s.ruleId} ${s.file} — remove it from scripts/codeql-baseline.json`);
  }
  if (blocking.length > 0) {
    for (const b of blocking) {
      console.error(`[${b.level}] ${b.ruleId}: ${b.text}`);
      console.error(`    ${b.uri}:${b.line}`);
    }
    console.error(
      `\n${blocking.length} CodeQL finding(s) not in baseline — failing. ` +
        `A true fix beats a baseline entry; baseline only with a reviewed reason in scripts/codeql-baseline.json.`,
    );
    process.exit(1);
  }
  console.log(`CodeQL: 0 new findings (${allowed.length} baselined)`);
}
