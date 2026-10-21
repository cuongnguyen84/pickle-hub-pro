// Audit 2026-08-09 — AuthCallback bypassed the redirect sanitizer Login
// already used, re-opening the open-redirect vector safeRedirect.ts exists
// to close. The sanitizer itself is unit-tested in auth/__tests__/
// safeRedirect.test.ts; this pins that the callback page actually routes
// through it instead of navigating the raw ?redirect= param.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(import.meta.dirname, "../../pages/AuthCallback.tsx"),
  "utf8",
);

describe("AuthCallback post-auth redirect", () => {
  it("routes the ?redirect= param through safeInternalPath", () => {
    expect(source).toContain('safeInternalPath(searchParams.get("redirect"))');
    expect(source).not.toMatch(/navigate\(\s*searchParams\.get\("redirect"\)/);
  });
});
