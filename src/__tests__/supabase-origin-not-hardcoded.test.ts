/**
 * No shipped asset may name a Supabase project ref that the build did not choose.
 *
 * The client reads VITE_SUPABASE_URL, so the JS graph follows the environment
 * on its own. Four things sit OUTSIDE that graph and used to hardcode the
 * production ref, which meant a staging build still reached production:
 *
 *   · <link rel="preconnect"> and <link rel="dns-prefetch"> in index.html —
 *     a DNS lookup and a TLS handshake to production on every page load;
 *   · the CSP report-uri in public/_headers — violation reports POSTed to the
 *     production log-client-event, writing staging-origin rows into production;
 *   · two service-worker urlPattern regexes in vite.config.ts — pinned to the
 *     production host, so on any other environment they match NOTHING. One of
 *     them is the rule that says Supabase REST must never be cached because
 *     responses are per-user. A safety rule that quietly stops applying is
 *     worse than one that was never written.
 *
 * Found 2026-08-13 by the staging preflight, before the first write to staging.
 *
 * These files are checked as TEXT rather than through a build, because the
 * failure is a literal string sitting in a source file — and because a test
 * that needs a full production build to fail is a test nobody runs.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

/** Any Supabase project ref: 20 lowercase letters before .supabase.co */
const ANY_REF = /\b([a-z]{20})\.supabase\.co/g;

const refsIn = (text: string) => [...text.matchAll(ANY_REF)].map((m) => m[1]);

describe("no environment is hardcoded into a shipped asset", () => {
  it("index.html names no project ref at all — the origin is a build-time marker", () => {
    const html = read("index.html");

    expect(html).toContain('href="%SUPABASE_ORIGIN%"');
    // Both hints, not just the one somebody remembered.
    expect(html).toContain('rel="preconnect" href="%SUPABASE_ORIGIN%"');
    expect(html).toContain('rel="dns-prefetch" href="%SUPABASE_ORIGIN%"');
    // Including in comments: the marker is replaced everywhere in the file, so
    // a ref written in a comment ships as a ref.
    expect(refsIn(html)).toEqual([]);
  });

  it("the CSP report-uri points at the build's own Supabase", () => {
    const headers = read("public/_headers");

    expect(headers).toContain("report-uri %SUPABASE_ORIGIN%/functions/v1/log-client-event");
    expect(refsIn(headers)).toEqual([]);
  });

  it("the service worker's Supabase rules are built from the configured origin", () => {
    const config = read("vite.config.ts");

    // The two rules must be derived, not literal. `reEscape` is what makes an
    // origin safe to drop into a RegExp.
    expect(config).toContain("new RegExp(`^${reEscape(SUPABASE_ORIGIN)}/rest/`)");
    expect(config).toContain("new RegExp(`^${reEscape(SUPABASE_ORIGIN)}/storage/`)");
    // No leftover literal pattern for either path.
    expect(config).not.toMatch(/urlPattern:\s*\/\^https:\\\/\\\/[a-z]{20}\\\.supabase/);
  });

  it("keeps exactly one hardcoded ref — the documented fallback — and says why", () => {
    const config = read("vite.config.ts");
    const refs = refsIn(config);

    // The fallback reproduces the pre-fix artifact when the variable is absent,
    // so a build with no env cannot silently emit a half-configured page. It is
    // the ONLY place a ref is allowed to appear.
    expect(refs).toEqual(["ajvlcamxemgbxduhiqrl"]);
    expect(config).toContain('viteEnv.VITE_SUPABASE_URL || "https://ajvlcamxemgbxduhiqrl.supabase.co"');
  });

  it("errorReporter falls back the same way, and reads the env first", () => {
    const reporter = read("src/lib/errorReporter.ts");

    // This one is inside the JS graph and already env-driven; the assertion is
    // that the fallback stays a FALLBACK and does not become the value.
    const envFirst = reporter.indexOf("import.meta.env.VITE_SUPABASE_URL");
    const fallback = reporter.indexOf("ajvlcamxemgbxduhiqrl");
    expect(envFirst).toBeGreaterThan(-1);
    expect(envFirst).toBeLessThan(fallback);
  });
});
