import { describe, expect, it } from "vitest";
import { localizeFeedBlogs, type FeedBlogLocalePost, type FeedBlogLocaleRow } from "../feed-blog-locale";

const NOW = Date.parse("2026-11-22T00:00:00Z");

const posts: FeedBlogLocalePost[] = [
  {
    slug: "paddle-rules",
    publishedDate: "2026-11-20",
    titleEn: "What the paddle rule changes",
    titleVi: "Luật vợt thay đổi thế nào",
    metaDescriptionEn: "English excerpt",
    excerptVi: "Tóm tắt tiếng Việt",
  },
  {
    slug: "untitled-en",
    publishedDate: "2026-11-19",
    titleEn: "",
    titleVi: "Chỉ có tiêu đề tiếng Việt",
    metaDescriptionEn: "",
    excerptVi: "Đoạn Việt",
  },
];

const viRow: FeedBlogLocaleRow = {
  item_type: "blog",
  item_id: "vi-1",
  slug: "luat-vot",
  title: "Tiêu đề từ cơ sở dữ liệu",
  excerpt: "tóm tắt",
  published_at: "2026-11-20T00:00:00.000Z",
  score: 1,
};

describe("localizeFeedBlogs", () => {
  it("lists English posts on the English page and Vietnamese rows on the Vietnamese page", () => {
    const en = localizeFeedBlogs([viRow], "en", posts, NOW);
    expect(en.map((row) => row.title)).toEqual([
      "What the paddle rule changes",
      "Chỉ có tiêu đề tiếng Việt",
    ]);
    expect(en.map((row) => row.blog_lang)).toEqual(["en", "en"]);
    expect(en.map((row) => row.slug)).toEqual(["paddle-rules", "untitled-en"]);
    expect(en.find((row) => row.slug === "untitled-en")?.excerpt).toBe("Đoạn Việt");

    const vi = localizeFeedBlogs([viRow], "vi", posts, NOW);
    expect(vi).toEqual([{ ...viRow, blog_lang: "vi" }]);
  });

  it("keeps the Vietnamese rows when no English post falls in the window", () => {
    const old: FeedBlogLocalePost[] = [{ ...posts[0], publishedDate: "2020-01-01" }];
    const rows = localizeFeedBlogs([viRow], "en", old, NOW);
    expect(rows).toEqual([{ ...viRow, blog_lang: "vi" }]);
  });

  it("fills a blank Vietnamese title from the static post with the same slug", () => {
    const blank: FeedBlogLocaleRow = { ...viRow, slug: "paddle-rules", title: "  " };
    const rows = localizeFeedBlogs([blank], "vi", posts, NOW);
    expect(rows[0]?.title).toBe("Luật vợt thay đổi thế nào");
    expect(rows[0]?.blog_lang).toBe("vi");
  });
});
