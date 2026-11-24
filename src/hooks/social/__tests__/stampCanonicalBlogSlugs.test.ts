// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { stampCanonicalBlogSlugs } from "../useFeedBlogs";
import type { FeedTimelineItem } from "../useFeedTimeline";

function blogItem(overrides: Record<string, unknown> = {}): FeedTimelineItem {
  return {
    type: "blog",
    cursor_id: "uuid-1",
    id: "uuid-1",
    slug: "luat-goi-bong-out-ly-hoang-nam-fair-play",
    title: "Bài viết",
    excerpt: null,
    cover_image_url: null,
    category: null,
    published_at: "2026-11-24T10:00:00Z",
    ranked_at: "2026-11-24T10:00:00Z",
    score: 0,
    lang: "vi",
    ...overrides,
  } as FeedTimelineItem;
}

describe("stampCanonicalBlogSlugs", () => {
  it("stamps the overlay canonical slug onto the timeline copy", () => {
    const timeline = [blogItem()];
    const overlay = [
      blogItem({
        canonical_slug: "line-call-rules-ly-hoang-nam-fair-play",
      }),
    ];
    const out = stampCanonicalBlogSlugs(timeline, overlay);
    expect(out[0].type).toBe("blog");
    if (out[0].type === "blog") {
      expect(out[0].canonical_slug).toBe(
        "line-call-rules-ly-hoang-nam-fair-play",
      );
      // The card link still uses the VI slug.
      expect(out[0].slug).toBe("luat-goi-bong-out-ly-hoang-nam-fair-play");
    }
  });

  it("leaves items untouched when the overlay has no canonical slugs", () => {
    const timeline = [blogItem()];
    const out = stampCanonicalBlogSlugs(timeline, [blogItem()]);
    expect(out).toBe(timeline);
  });

  it("does not overwrite a canonical slug the item already carries", () => {
    const timeline = [
      blogItem({ canonical_slug: "create-tournament-by-chat" }),
    ];
    const overlay = [
      blogItem({
        canonical_slug: "line-call-rules-ly-hoang-nam-fair-play",
      }),
    ];
    const out = stampCanonicalBlogSlugs(timeline, overlay);
    if (out[0].type === "blog") {
      expect(out[0].canonical_slug).toBe("create-tournament-by-chat");
    }
  });

  it("ignores non-blog items and unmatched ids", () => {
    const timeline = [blogItem({ cursor_id: "uuid-other", id: "uuid-other" })];
    const overlay = [
      blogItem({
        canonical_slug: "line-call-rules-ly-hoang-nam-fair-play",
      }),
    ];
    const out = stampCanonicalBlogSlugs(timeline, overlay);
    if (out[0].type === "blog") {
      expect(out[0].canonical_slug).toBeUndefined();
    }
  });
});
