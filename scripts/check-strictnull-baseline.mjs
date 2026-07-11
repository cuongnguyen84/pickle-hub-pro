#!/usr/bin/env node
// ============================================================================
// strictNullChecks ratchet — TEMPORARY, remove once the flag is enabled.
// ----------------------------------------------------------------------------
// While strictNullChecks is being landed across several PRs (waves 1–4), this
// guard runs `tsc --strictNullChecks` and fails CI if the diagnostic count
// RISES above the recorded baseline. That way parallel work can only reduce
// the count, never add new null-safety debt before the activation PR.
//
// When you fix diagnostics, lower `max` in strictnull-baseline.json to the new
// count (the script tells you the number). When the count reaches 0, enable
// strictNullChecks in tsconfig.app.json and delete this script + its CI step.
// ============================================================================

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const baseline = JSON.parse(
  readFileSync(join(__dirname, "strictnull-baseline.json"), "utf8"),
);

let out = "";
try {
  execSync("npx tsc -p tsconfig.app.json --noEmit --strictNullChecks", {
    cwd: join(__dirname, ".."),
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (e) {
  // tsc exits non-zero when there are diagnostics — that's expected here.
  out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
}

const count = (out.match(/error TS\d+/g) ?? []).length;
const { max } = baseline;

if (count > max) {
  console.error(
    `✖ strictNullChecks diagnostics rose: ${count} > baseline ${max}.\n` +
      `  New null-safety debt was added. Fix it, or (if intentional) this is a regression.`,
  );
  process.exit(1);
}

if (count < max) {
  console.log(
    `✓ strictNullChecks diagnostics down to ${count} (baseline ${max}).\n` +
      `  Lower "max" in scripts/strictnull-baseline.json to ${count} to ratchet.`,
  );
} else {
  console.log(`✓ strictNullChecks diagnostics at baseline (${count}).`);
}
process.exit(0);
