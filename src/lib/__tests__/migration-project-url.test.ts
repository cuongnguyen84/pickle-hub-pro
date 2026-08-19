// ============================================================================
// No migration may name a project host — CP18
// ----------------------------------------------------------------------------
// Every scheduled job and trigger that calls an Edge Function used to carry the
// production host as a literal, which is correct for one environment and
// dangerous for two: a staging database applying the same migrations schedules
// jobs that POST to production, with staging's own secret, every five minutes.
//
// The fix is a runtime lookup (public.ops_project_url(), vault key
// `project_url`, no fallback). This file is what stops the literal coming back
// — and it will come back, because writing the URL inline is the obvious thing
// to do and it works on the machine of whoever writes it.
//
// The rule is deliberately blunt: after stripping comments, a migration may not
// contain a project ref at all. A narrower rule ("only inside url :=") invites
// an argument about what counts as a call site, and the argument is how the
// next one slips through.
// ============================================================================

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve(__dirname, "../../../supabase/migrations");
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

/** SQL with `--` line comments removed. Dollar-quoted job bodies survive,
 *  which is the point: a cron command string is executable code, not prose. */
const code = (sql: string) => sql.replace(/--[^\n]*/g, "");

const PROJECT_REF = /[a-z]{20}\.supabase\.co/;

describe("CP18 — migrations do not name a project host", () => {
  it("has at least the call sites this rule exists for", () => {
    // A guard that guards nothing passes forever. If this drops to zero,
    // someone removed the scheduled jobs, not the risk.
    const callers = FILES.filter((f) =>
      /ops_project_url\(\)\s*\|\|\s*'\/functions\/v1\//.test(readFileSync(resolve(DIR, f), "utf8")),
    );
    expect(callers.length).toBeGreaterThanOrEqual(20);
  });

  it.each(FILES)("%s contains no project host in executable SQL", (file) => {
    const sql = code(readFileSync(resolve(DIR, file), "utf8"));
    const hit = sql.match(PROJECT_REF);
    expect(
      hit?.[0],
      `${file} hardcodes ${hit?.[0]} — use public.ops_project_url() so staging cannot call production`,
    ).toBeUndefined();
  });

  it("routes every Edge Function call through the helper", () => {
    for (const file of FILES) {
      const sql = code(readFileSync(resolve(DIR, file), "utf8"));
      // Every /functions/v1/ path must be concatenated onto the helper, never
      // onto a string that starts with https://.
      for (const m of sql.matchAll(/(.{0,60})\/functions\/v1\//g)) {
        expect(
          m[1],
          `${file}: a /functions/v1 path is built from something other than ops_project_url()`,
        ).toMatch(/ops_project_url\(\)\s*\|\|\s*'$/);
      }
    }
  });

  it("defines the helper before its first caller", () => {
    // A clean `db reset` runs in filename order. If the helper sorts after a
    // migration that calls it, a fresh environment fails to build at all —
    // which is safe, but it fails at the worst moment.
    const helper = FILES.find((f) => f.includes("ops_project_url"));
    expect(helper).toBeDefined();
    const firstCaller = FILES.find((f) =>
      /ops_project_url\(\)/.test(code(readFileSync(resolve(DIR, f), "utf8"))) && f !== helper,
    );
    expect(firstCaller).toBeDefined();
    expect(helper! < firstCaller!).toBe(true);
  });

  it("gives the helper no fallback to fall back to", () => {
    const helper = FILES.find((f) => f.includes("ops_project_url"))!;
    const sql = code(readFileSync(resolve(DIR, helper), "utf8"));
    // Two exceptions and no COALESCE: missing config and malformed config both
    // stop the job. A default here would be a silent second production client.
    expect(sql).toMatch(/RAISE EXCEPTION 'project_url is not configured'/);
    expect(sql).toMatch(/RAISE EXCEPTION 'project_url is malformed/);
    expect(sql).not.toMatch(/coalesce\s*\(\s*_url/i);
    expect(sql).not.toMatch(/supabase\.co'\s*\)/);
  });

  it("keeps the host and the secret as two separate lookups", () => {
    // They answer different questions — "where" and "may I". A deployment that
    // gets one right and the other wrong has to fail, not half-work, so they
    // must not share a key.
    const helper = FILES.find((f) => f.includes("ops_project_url"))!;
    const sql = code(readFileSync(resolve(DIR, helper), "utf8"));
    expect(sql).toContain("name = 'project_url'");
    expect(sql).not.toContain("cron_secret");
  });
});
