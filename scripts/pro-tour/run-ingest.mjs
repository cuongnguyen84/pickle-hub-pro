/**
 * Bundle scripts/pro-tour/ingest-results.ts with the esbuild that Vite
 * already installs, then run it. Keeps the cron free of an extra TypeScript
 * runner. Arguments are forwarded (--backfill, --execute, --dry-run).
 *
 * Run from the repository root.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, "ingest-results.ts");
const dir = mkdtempSync(resolve(tmpdir(), "pro-results-ingest-"));
const outfile = resolve(dir, "ingest.mjs");

const esbuild = require("esbuild");
await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile,
  logLevel: "silent",
});

const child = spawnSync(process.execPath, [outfile, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  cwd: process.cwd(),
});
rmSync(dir, { recursive: true, force: true });
process.exit(child.status ?? 1);
