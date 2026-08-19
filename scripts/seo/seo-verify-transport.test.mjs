// Guards two ways scripts/seo/seo_verify.py used to lie about production.
//
// 1. Python installed from python.org ships without a populated system trust
//    store on macOS, so every urlopen raised CERTIFICATE_VERIFY_FAILED. The
//    gate turned that into "empty <title>" and "no hreflang alternates
//    (prerender likely incomplete)" on EVERY url — language that reads as a
//    site outage, produced by a local CA problem.
// 2. `drift baseline` stored those unreachable fetches anyway, writing the
//    hash of an empty string as the baseline, so the next compare would report
//    a huge fabricated change the moment the fetch started working.
//
// These run the real script against an unroutable host, which fails the same
// way a TLS failure does (status 0), without needing the network.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, "seo_verify.py");
// .invalid is reserved by RFC 2606 and never resolves.
const UNREACHABLE = "https://unreachable.invalid/";

function run(args) {
  try {
    return execFileSync("python3", [SCRIPT, ...args], {
      encoding: "utf8",
      timeout: 60_000,
    });
  } catch (err) {
    // A failing gate exits non-zero; its stdout is what we assert on.
    return `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
}

describe("seo_verify transport failures", () => {
  it("reports an unreachable url as unreachable, not as broken content", () => {
    const out = run(["bot-check", UNREACHABLE, "--json"]);
    expect(out).toContain("could not reach url");
    // The false alarms: these described the site when the fetch never landed.
    expect(out).not.toContain("prerender likely incomplete");
    expect(out).not.toContain("empty <title>");
  });

  it("refuses to store a baseline it could not fetch", () => {
    const dir = mkdtempSync(join(tmpdir(), "seo-drift-"));
    try {
      const db = join(dir, "drift.db");
      const out = run(["drift", "baseline", UNREACHABLE, "--db", db, "--json"]);
      expect(out).toContain("skipped");
      // The empty-string sha256 prefix — what an unreachable fetch used to
      // record as this url's content hash.
      expect(out).not.toContain("e3b0c44298fc1c14");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds its TLS context from certifi so a bare interpreter still works", () => {
    const src = execFileSync("cat", [SCRIPT], { encoding: "utf8" });
    expect(src).toContain("import certifi");
    expect(src).toContain("cafile=certifi.where()");
    expect(src).toContain("context=_TLS_CONTEXT");
  });
});
