// AUDIT-03 (2026-11-10) — /rss.xml is the bilingual Mailchimp feed but shipped
// 0 EN items: EN came from a hand-kept list of 2025/early-2026 posts that the
// newest VI rows pushed out of the top 20. EN now derives from blogMetadata.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blogMetadata } from "../../src/content/blog/metadata";
import { buildEnRssItems } from "../rss.xml";

describe("rss.xml EN items", () => {
  const items = buildEnRssItems(blogMetadata);

  it("emits one /blog/<slug> item per metadata entry", () => {
    expect(items.map((i) => i.link)).toEqual(blogMetadata.map((m) => `/blog/${m.slug}`));
    for (const i of items) expect(i.lang).toBe("en");
  });

  it("carries the 2026-11-10 Worlds posts with their real dates", () => {
    for (const slug of [
      "world-championships-2026-new-generation-analysis",
      "new-paddles-world-championships-2026",
    ]) {
      const m = blogMetadata.find((x) => x.slug === slug)!;
      expect(items).toContainEqual({
        title: m.titleEn,
        link: `/blog/${slug}`,
        description: m.metaDescriptionEn,
        pubDate: "2026-11-10",
        lang: "en",
      });
    }
  });

  it("no longer hardcodes an EN_POSTS list", () => {
    const src = readFileSync("functions/rss.xml.ts", "utf8");
    expect(src).not.toMatch(/EN_POSTS/);
    expect(src).not.toMatch(/pubDate:\s*"2025-/);
  });
});
