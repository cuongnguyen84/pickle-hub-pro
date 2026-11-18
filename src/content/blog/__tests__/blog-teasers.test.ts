// DEBT-09: client surfaces read blogTeasers instead of blogMetadata. The
// teaser list is derived from metadata.ts, so it must carry every post in
// the same order with the same card fields.
import { describe, expect, it } from "vitest";
import { blogMetadata } from "../metadata";
import { blogTeasers } from "../teasers";
import { truncateExcerpt } from "../excerpt";

describe("blogTeasers", () => {
  it("has the same slugs, in order, as blogMetadata", () => {
    expect(blogTeasers.map((t) => t.slug)).toEqual(blogMetadata.map((m) => m.slug));
  });

  it("copies card fields verbatim and cuts the VI description to ticker length", () => {
    blogMetadata.forEach((m, i) => {
      const t = blogTeasers[i];
      expect(t).toEqual({
        slug: m.slug,
        publishedDate: m.publishedDate,
        updatedDate: m.updatedDate,
        author: m.author,
        tags: m.tags,
        heroImage: m.heroImage,
        titleEn: m.titleEn,
        titleVi: m.titleVi,
        metaDescriptionEn: m.metaDescriptionEn,
        excerptVi: truncateExcerpt(m.metaDescriptionVi),
      });
      expect(truncateExcerpt(t.excerptVi)).toBe(t.excerptVi);
    });
  });

  it("keeps SSR-only fields out", () => {
    for (const t of blogTeasers) {
      for (const k of ["metaTitleEn", "metaTitleVi", "metaDescriptionVi", "ctaPath", "ctaLabel"]) {
        expect(t).not.toHaveProperty(k);
      }
    }
  });
});
