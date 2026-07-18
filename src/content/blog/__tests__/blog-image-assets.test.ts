// ============================================================================
// Every /images/blog/* path referenced from blog content must exist in
// public/. Third occurrence of the same prod bug (2026-07-18): a post ships
// referencing a hero webp that was never committed → 404 on /blog + broken
// og:image + red smoke on every PR (pickleball-court-dimensions,
// vietnam-dupr-leaderboard, singapore-open-2026-preview). This kills the
// class: the PR that adds the post fails CI until the image is committed.
// ============================================================================

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(__dirname, "../../../..");
const POSTS_DIR = resolve(__dirname, "../posts");

function blogImageRefs(source: string): string[] {
  return [...source.matchAll(/["'`](\/images\/blog\/[^"'`\s)]+)["'`]/g)].map(
    // Strip ?v=N cache-busters — only the file on disk matters.
    (m) => m[1].split("?")[0],
  );
}

const sources: Array<[string, string]> = [
  ["metadata.ts", readFileSync(resolve(__dirname, "../metadata.ts"), "utf8")],
  ...readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f): [string, string] => [
      `posts/${f}`,
      readFileSync(join(POSTS_DIR, f), "utf8"),
    ]),
];

describe("blog image assets exist in public/", () => {
  it.each(sources.filter(([, src]) => blogImageRefs(src).length > 0))(
    "%s references only committed images",
    (_name, src) => {
      const missing = [...new Set(blogImageRefs(src))].filter(
        (ref) => !existsSync(join(ROOT, "public", ref)),
      );
      expect(missing).toEqual([]);
    },
  );

  it("sanity: the scan actually finds refs (guards against a regex rot)", () => {
    const total = sources.reduce(
      (n, [, src]) => n + blogImageRefs(src).length,
      0,
    );
    expect(total).toBeGreaterThan(50);
  });
});
