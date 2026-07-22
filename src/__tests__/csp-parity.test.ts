// ============================================================================
// CSP parity: public/_headers (user path) ↔ functions/_middleware.ts (bot path)
// ----------------------------------------------------------------------------
// The middleware's SECURITY_HEADERS block claims to mirror public/_headers,
// but nothing enforced that — frame-src silently dropped dashboard.dupr.com +
// uat.dupr.gg for months (found during the QA-04 DUPR SSO investigation,
// PR #432). This test locks the two frame/child-src lists together: change
// one, the test forces you to change the other.
//
// Scoped to frame-src + child-src on purpose — those are the directives that
// drifted and the ones where drift breaks a user-visible feature (embeds).
// Full-policy equality would fail on legitimate differences (report-uri).
// ============================================================================

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function directiveTokens(csp: string, directive: string): string[] {
  const m = csp.match(new RegExp(`${directive} ([^;]+);`));
  if (!m) throw new Error(`directive ${directive} not found`);
  return m[1].trim().split(/\s+/).sort();
}

const headersFile = readFileSync("public/_headers", "utf8");
// Enforced policy only — the Report-Only line is a separate header.
const enforcedLine = headersFile
  .split("\n")
  .find((l) => l.trim().startsWith("Content-Security-Policy:"));
if (!enforcedLine) throw new Error("enforced CSP line not found in public/_headers");

const middlewareSource = readFileSync("functions/_middleware.ts", "utf8");
// SECURITY_HEADERS builds the CSP from concatenated string literals; joining
// the raw source is enough for directive extraction.
const middlewareCsp = middlewareSource;

describe("CSP parity between public/_headers and functions/_middleware.ts", () => {
  for (const directive of ["frame-src", "child-src"]) {
    it(`${directive} lists are identical`, () => {
      expect(directiveTokens(middlewareCsp, directive)).toEqual(
        directiveTokens(enforcedLine, directive),
      );
    });
  }

  it("bot path allows the DUPR SSO origins (the drift that bit us)", () => {
    const frame = directiveTokens(middlewareCsp, "frame-src");
    expect(frame).toContain("https://dashboard.dupr.com");
    expect(frame).toContain("https://uat.dupr.gg");
  });
});
