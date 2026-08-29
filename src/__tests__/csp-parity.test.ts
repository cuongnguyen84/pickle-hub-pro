// ============================================================================
// CSP parity: public/_headers (user path) ↔ functions/_middleware.ts (bot path)
// ----------------------------------------------------------------------------
// The middleware's SECURITY_HEADERS block claims to mirror public/_headers,
// but nothing enforced that — frame-src silently dropped dashboard.dupr.com +
// uat.dupr.gg for months (found during the QA-04 DUPR SSO investigation,
// PR #432). This test locks those lists together: change one, the test forces
// you to change the other.
//
// 2026-08-29: style-src joined the list. Chrome's built-in Translate loads its
// stylesheet from www.gstatic.com, which the policy did not allow, so Translate
// rendered unstyled (49 csp_violation reports / 3w). Fixing that meant editing
// the SAME directive in three places — both _headers lines and the middleware —
// which is exactly the drift shape the frame-src incident had, so the directive
// is now locked here too rather than trusted to reviewer diligence.
//
// Full-policy equality is still not asserted: report-uri legitimately differs.
// ============================================================================

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Two fixes over the original `${directive} ([^;]+);`:
//   * `(?:;|$)` — the LAST directive of a policy carries no trailing
//     semicolon, so the old pattern silently could not see form-action;
//   * a leading `(?:^|[;:])` boundary — without it `base-uri` would also be
//     found inside `report-uri`, and any directive name could be matched
//     mid-token. The `:` alternative is the `Content-Security-Policy:` header
//     name separator, which precedes the very first directive.
function directiveTokens(csp: string, directive: string): string[] {
  const m = csp.match(new RegExp(`(?:^|[;:])\\s*${directive} ([^;]+)(?:;|$)`));
  if (!m) throw new Error(`directive ${directive} not found`);
  return m[1].trim().split(/\s+/).sort();
}

const headersFile = readFileSync("public/_headers", "utf8");
const headerLine = (prefix: string): string => {
  const line = headersFile.split("\n").find((l) => l.trim().startsWith(prefix));
  if (!line) throw new Error(`${prefix} line not found in public/_headers`);
  return line;
};
// Enforced policy only — the Report-Only line is a separate header.
const enforcedLine = headerLine("Content-Security-Policy:");
const reportOnlyLine = headerLine("Content-Security-Policy-Report-Only:");

// SECURITY_HEADERS builds the CSP from concatenated string literals separated
// by explanatory comments. Regexing the RAW source was "enough" only by luck:
// the match is first-wins, so the moment a comment above a directive mentions
// that directive's own name the test reads the PROSE instead of the policy.
// That is not hypothetical — it fired while adding style-src here on
// 2026-08-29. So reconstruct the policy from the string literals only, and
// drop comment lines on the floor.
function middlewareCsp(source: string): string {
  const start = source.indexOf('"Content-Security-Policy":');
  if (start === -1) throw new Error("SECURITY_HEADERS CSP not found in functions/_middleware.ts");
  const parts: string[] = [];
  for (const line of source.slice(start).split("\n").slice(1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) continue;
    const literal = trimmed.match(/^"(.*)"\s*[+,]?$/);
    if (literal) {
      parts.push(literal[1]);
      continue;
    }
    if (parts.length > 0) break;
  }
  if (parts.length === 0) throw new Error("no CSP string literals parsed from functions/_middleware.ts");
  return parts.join("");
}

const middlewareCspValue = middlewareCsp(
  readFileSync("functions/_middleware.ts", "utf8"),
);

// Every directive the enforced policy declares, so a directive added later is
// covered without anyone remembering to extend a hand-written list.
const enforcedDirectives = enforcedLine
  .slice(enforcedLine.indexOf(":") + 1)
  .split(";")
  .map((part) => part.trim().split(/\s+/)[0])
  .filter(Boolean);

describe("CSP parity between public/_headers and functions/_middleware.ts", () => {
  for (const directive of ["frame-src", "child-src", "style-src"]) {
    it(`${directive} lists are identical`, () => {
      expect(directiveTokens(middlewareCspValue, directive)).toEqual(
        directiveTokens(enforcedLine, directive),
      );
    });
  }

  it("bot path allows the DUPR SSO origins (the drift that bit us)", () => {
    const frame = directiveTokens(middlewareCspValue, "frame-src");
    expect(frame).toContain("https://dashboard.dupr.com");
    expect(frame).toContain("https://uat.dupr.gg");
  });

  it("style-src allows Chrome Translate's stylesheet host", () => {
    for (const csp of [enforcedLine, reportOnlyLine, middlewareCspValue]) {
      expect(directiveTokens(csp, "style-src")).toContain("https://www.gstatic.com");
    }
  });

  // The two _headers policies are meant to be the same policy, one enforcing
  // and one reporting. When they silently diverge, every csp_violation row is
  // read with the wrong meaning: a report from a LOOSER enforced policy is a
  // false alarm, and a directive missing from Report-Only reports nothing at
  // all while still blocking users. report-uri is the one allowed difference.
  it("enforced and Report-Only policies agree on every directive except report-uri", () => {
    for (const directive of enforcedDirectives) {
      expect({ directive, tokens: directiveTokens(reportOnlyLine, directive) }).toEqual({
        directive,
        tokens: directiveTokens(enforcedLine, directive),
      });
    }
    expect(reportOnlyLine).toContain("report-uri ");
    expect(enforcedLine).not.toContain("report-uri ");
  });
});
