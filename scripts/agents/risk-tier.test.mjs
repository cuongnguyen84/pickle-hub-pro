// Pins the classifier's contract: the tier is the WORST file in the change,
// unknown paths are not GREEN, and the narrow rules sit above the broad ones
// they carve out of (rule order is load-bearing — a reorder silently
// downgrades verdicts).
import { describe, it, expect } from "vitest";
import { classify, parseFiles } from "./risk-tier.mjs";

describe("classify", () => {
  it("calls an applied migration RED — git revert cannot un-run it", () => {
    expect(classify(["supabase/migrations/20260804090000_x.sql"]).tier).toBe("RED");
  });

  it("takes the worst tier across the change, not the last or most common", () => {
    const r = classify([
      "src/pages/Live.tsx",
      "docs/notes.md",
      "apple/ThePickleHub/App/Info.plist",
    ]);
    expect(r.tier).toBe("RED");
  });

  it("keeps a src-only change GREEN", () => {
    expect(classify(["src/pages/Live.tsx", "src/hooks/useX.ts"]).tier).toBe("GREEN");
  });

  it("treats an unrecognised path as AMBER, never GREEN", () => {
    const r = classify(["some/new/surface.conf"]);
    expect(r.tier).toBe("AMBER");
    expect(r.files[0].why).toMatch(/unrecognised/);
  });

  it("exempts shared edge-function tests from the AMBER edge rule (order matters)", () => {
    expect(
      classify(["supabase/functions/_shared/__tests__/burn-alert.test.ts"]).tier,
    ).toBe("GREEN");
    expect(classify(["supabase/functions/news-rewrite/index.ts"]).tier).toBe("AMBER");
  });

  it("keeps pgTAP tests GREEN despite living under supabase/ (order matters)", () => {
    // Caught on the first real run: supabase/tests/*.sql fell through to the
    // unknown-path AMBER and inflated the verdict of a migration PR.
    expect(classify(["supabase/tests/rls_auth_matrix.test.sql"]).tier).toBe("GREEN");
  });

  it("flags SSR render + config.toml, the two silent-failure surfaces", () => {
    expect(classify(["functions/_lib/render/blog.ts"]).tier).toBe("AMBER");
    expect(classify(["supabase/config.toml"]).tier).toBe("RED");
  });
});

describe("parseFiles", () => {
  it("accepts commas, spaces and git's newline output alike", () => {
    expect(parseFiles("a.ts, b.ts\nc.ts  d.ts")).toEqual([
      "a.ts",
      "b.ts",
      "c.ts",
      "d.ts",
    ]);
    expect(parseFiles("")).toEqual([]);
  });
});
