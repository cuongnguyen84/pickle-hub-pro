// ============================================================================
// The retry action in ErrorState is a 44px touch target.
// ----------------------------------------------------------------------------
// It was 41. `h-11` is 2.75rem, which is only 44px while the root font-size is
// 16px, so the board's global "≥44×44" criterion cannot be expressed in rem
// and then assumed. The browser gate measured 74×41 on a real page.
//
// This asserts the declared floor rather than a computed box, because jsdom has
// no layout engine and would report 0×0 for everything — a test that "passes"
// on a zero-height button is worse than no test. The computed box is measured
// by scripts/admin-moderation-qa.mjs against a real browser; this file is the
// cheap guard that fails in CI the moment somebody puts `size="sm"` back.
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Comments are stripped first. The first version of this test matched the
// comment explaining why `size="sm"` was removed, and failed on the fix.
const read = (p: string) =>
  readFileSync(resolve(__dirname, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const SOURCES: [string, string][] = [
  ["ErrorState", read("../PageStates.tsx")],
  ["AdminMFAGate", read("../../admin/AdminMFAGate.tsx")],
];

describe("error-state actions meet the 44px touch target", () => {
  it.each(SOURCES)("%s declares an explicit 44px floor", (_name, src) => {
    expect(src).toMatch(/min-h-\[44px\]/);
    expect(src).toMatch(/min-w-\[44px\]/);
  });

  it.each(SOURCES)("%s does not use the dense `sm` button size for a retry", (_name, src) => {
    // h-9 is 36px. An error retry is the only control on the screen.
    expect(src).not.toMatch(/size="sm"[^>]*>\s*\{?\s*t?\.?common\.?retry/);
    expect(src).not.toMatch(/size="sm"[^>]*>\s*Thử lại/);
  });

  it("does not express the floor in rem, where the root size can move it", () => {
    // h-11 alone is what produced 41px. If it comes back as the ONLY sizing,
    // this test is the thing that notices.
    for (const [name, src] of SOURCES) {
      const hasRemOnly = /className="[^"]*\bh-11\b[^"]*"/.test(src) && !/min-h-\[44px\]/.test(src);
      expect(hasRemOnly, `${name} relies on h-11 alone`).toBe(false);
    }
  });
});
