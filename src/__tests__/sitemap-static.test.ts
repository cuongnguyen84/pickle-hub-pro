import { describe, expect, it } from "vitest";

import { EN_BLOG_SLUGS } from "../../functions/_lib/static-blog-slugs";

describe("sitemap-static EN blog manifest", () => {
  it("includes the Beijing Open recap exactly once", () => {
    const matches = EN_BLOG_SLUGS.filter(
      (slug) => slug === "ppa-beijing-open-2026-recap",
    );

    expect(matches).toHaveLength(1);
  });
});
