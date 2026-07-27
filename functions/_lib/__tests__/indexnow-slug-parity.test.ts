import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { blogMetadata } from "../../../src/content/blog/metadata";
import { EN_BLOG_SLUGS } from "../static-blog-slugs";

// /api/indexnow used to carry its own hand-copied list of EN blog slugs. It
// drifted three times (2026-06-10, 2026-07-11, 2026-07-27) and every drift was
// invisible: the endpoint answers `submitted: <n>` and HTTP 200 either way, so
// a ping that silently skipped the five newest posts looked like a success.
//
// Two assertions, because they fail for different reasons: the first catches a
// slug that never got pinged, the second catches someone reintroducing a local
// copy of the list.
const source = readFileSync("functions/api/indexnow.ts", "utf8");

describe("indexnow EN blog slugs", () => {
  it("covers every published EN post — no post can be silently skipped", () => {
    const covered = new Set(EN_BLOG_SLUGS);
    const missing = blogMetadata.map((p) => p.slug).filter((s) => !covered.has(s));
    expect(missing, `EN posts that would never be submitted to IndexNow:\n${missing.join("\n")}`).toEqual([]);
  });

  it("derives the list instead of copying it", () => {
    expect(source).toContain('from "../_lib/static-blog-slugs"');
    // A literal slug array in this file means someone started a fourth copy.
    const arrayLiteral = source.match(/BLOG_SLUGS\s*=\s*\[/);
    expect(arrayLiteral, "indexnow.ts declares its own slug array again — import EN_BLOG_SLUGS instead").toBeNull();
  });
});
