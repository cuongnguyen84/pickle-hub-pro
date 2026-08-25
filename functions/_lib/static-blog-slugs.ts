// SEO-02 (2026-07-17): GENERATED from src/content/blog/metadata.ts — the
// single blog source of truth. Do not hand-edit. Consumed by
// sitemap-static.xml.ts; slug parity with BLOG_POST_META is guaranteed by
// construction (both derive from blogMetadata) and locked by
// src/lib/__tests__/blog-seo-surfaces.test.ts.

import { blogMetadata } from "../../src/content/blog/metadata";

export const EN_BLOG_SLUGS: readonly string[] = blogMetadata.map((p) => p.slug);

/**
 * Same list, carrying each post's real modification date.
 *
 * sitemap-static.xml emitted all 58 EN blog URLs with no <lastmod> at all
 * (2026-08-25 audit: 102 <loc> but only 43 <lastmod>). The date has to come
 * from the post — updatedDate when it exists, publishedDate otherwise — and
 * NOT from a build timestamp. Every URL claiming it changed today is a
 * trust-destroying signal: Google learns the field is noise and stops using
 * it, which costs the recrawl priority the field exists to earn.
 */
export const EN_BLOG_ENTRIES: readonly { slug: string; lastmod: string }[] =
  blogMetadata.map((p) => ({
    slug: p.slug,
    lastmod: p.updatedDate ?? p.publishedDate,
  }));
