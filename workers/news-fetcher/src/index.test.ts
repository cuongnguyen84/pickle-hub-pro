import { describe, expect, it } from "vitest";

import { parsePickleAsiaPosts } from "./index";

describe("parsePickleAsiaPosts", () => {
  it("maps public Pickle Asia rows and keeps a sufficiently long article body", () => {
    const content = `<p>${"Asian pickleball reporting with verified tournament details. ".repeat(100)}</p>`;
    const [item] = parsePickleAsiaPosts([
      {
        slug: "vietnam-pickleball-update",
        title: "Vietnam Pickleball Update",
        excerpt: "<strong>A regional update</strong> from Da Nang.",
        content,
        hero_image_url: "https://pickle.asia/image.webp",
        published_at: "2026-09-07T17:46:00+00:00",
        status: "published",
      },
    ]);

    expect(item).toMatchObject({
      title: "Vietnam Pickleball Update",
      link: "https://pickle.asia/blogs/vietnam-pickleball-update",
      summary: "A regional update from Da Nang.",
      image_url: "https://pickle.asia/image.webp",
      published_at: "2026-09-07T17:46:00.000Z",
    });
    expect(item.raw_body?.length).toBeGreaterThanOrEqual(4_000);
    expect(item.raw_body).not.toContain("<p>");
  });

  it("marks a known short body as brief and skips malformed rows", () => {
    const items = parsePickleAsiaPosts([
      {
        slug: "short-update",
        title: "Short Update",
        excerpt: "Short source brief.",
        content: "<p>Too short to support a full rewrite.</p>",
        published_at: "2026-09-08T00:00:00Z",
        status: "published",
      },
      {
        slug: "../../admin",
        title: "Invalid slug",
        published_at: "2026-09-08T00:00:00Z",
        status: "published",
      },
      {
        slug: "invalid-date",
        title: "Invalid date",
        published_at: "not-a-date",
        status: "published",
      },
      {
        slug: "scheduled-draft",
        title: "Scheduled draft",
        published_at: "2026-09-09T00:00:00Z",
        status: "draft",
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].raw_body).toBeNull();
  });
});
