// SEO-02/03 slug-parity guard. The HOT-03 failure class was a slug present
// in one SEO surface and missing from another (bots 404 / dropped from the
// sitemap). This test locks the three EN-blog surfaces to the SAME slug set
// so that class of drift fails in CI instead of in production.
//
// It does NOT assert title/description equality: BLOG_POST_META.title is the
// full SSR <title> while metadata.metaTitleEn is a separate shorter SEO meta
// title by design, and dateModified is set per-post. Reconciling those is a
// content decision (SEO-02 generation), tracked separately; this guard is the
// zero-risk half that prevents the exact HOT-03 recurrence today.

import { describe, it, expect } from "vitest";
import { BLOG_POST_META } from "../../../functions/_lib/render/blog-meta";
import { EN_BLOG_SLUGS } from "../../../functions/_lib/static-blog-slugs";
import { blogMetadata } from "../../content/blog/metadata";

const ssrSlugs = new Set(Object.keys(BLOG_POST_META));
const sitemapSlugs = new Set(EN_BLOG_SLUGS);
const metadataSlugs = new Set(blogMetadata.map((m) => m.slug));

function missing(from: Set<string>, against: Set<string>): string[] {
  return [...against].filter((s) => !from.has(s)).sort();
}

describe("EN blog SEO surfaces cover the same slug set", () => {
  it("every metadata.ts post has an SSR BLOG_POST_META entry (else bots 404)", () => {
    const gap = missing(ssrSlugs, metadataSlugs);
    expect(gap, `metadata.ts posts missing from BLOG_POST_META:\n${gap.join("\n")}`).toEqual([]);
  });

  it("every metadata.ts post is in the static sitemap (HOT-03 class)", () => {
    const gap = missing(sitemapSlugs, metadataSlugs);
    expect(gap, `metadata.ts posts missing from EN_BLOG_SLUGS:\n${gap.join("\n")}`).toEqual([]);
  });

  it("every SSR BLOG_POST_META entry has backing metadata + sitemap presence", () => {
    const noMeta = missing(metadataSlugs, ssrSlugs);
    const noSitemap = missing(sitemapSlugs, ssrSlugs);
    expect(noMeta, `BLOG_POST_META slugs missing from metadata.ts:\n${noMeta.join("\n")}`).toEqual([]);
    expect(noSitemap, `BLOG_POST_META slugs missing from EN_BLOG_SLUGS:\n${noSitemap.join("\n")}`).toEqual([]);
  });

  it("no duplicate slugs within any surface", () => {
    const sm = EN_BLOG_SLUGS.filter((s, i) => EN_BLOG_SLUGS.indexOf(s) !== i);
    const md = blogMetadata.map((m) => m.slug).filter((s, i, a) => a.indexOf(s) !== i);
    expect([...sm, ...md]).toEqual([]);
  });
});
