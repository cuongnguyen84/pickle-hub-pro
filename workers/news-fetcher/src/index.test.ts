// Chạy chung với gate của repo: `npx vitest run workers` (workers-ci.yml),
// hoặc riêng: `npx vitest run workers/news-fetcher` từ gốc repo.
// Kiểm trên HTML thật đã lưu trong __fixtures__, không mock.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  decodeEntities,
  extractScrapeLinks,
  HTML_SCRAPE_CONFIGS,
  isAdvertorialItem,
  isTransientFetchError,
  isWithinMaxAge,
  NEWS_FETCHER_USER_AGENT,
  normalizeItemLink,
  parseListingCards,
  parsePickleAsiaPosts,
} from "./index";

const listing = readFileSync(
  new URL("../__fixtures__/theapp-news-listing.html", import.meta.url),
  "utf8",
);

describe("parseListingCards — listing Webflow của APP", () => {
  const items = parseListingCards(listing, HTML_SCRAPE_CONFIGS.app);

  it("lấy được tiêu đề, link, ngày, ảnh từ card", () => {
    expect(items.length).toBeGreaterThanOrEqual(5);

    for (const item of items) {
      expect(item.link).toMatch(/^https:\/\/www\.theapp\.global\/news\/[a-z0-9-]+$/);
      expect(item.title.length).toBeGreaterThanOrEqual(5);
      expect(item.title).not.toContain("<");
      expect(Number.isFinite(Date.parse(item.published_at))).toBe(true);
    }
  });

  it("đọc đúng một bài mốc trong fixture", () => {
    const known = items.find((item) =>
      item.link.endsWith("/watch-gender-doubles-from-detroit"),
    );
    expect(known).toBeDefined();
    expect(known?.title).toBe("Watch Gender Doubles from Detroit");
    expect(known?.published_at.slice(0, 10)).toBe("2026-08-22");
    expect(known?.image_url).toMatch(/^https:\/\/cdn\.prod\.website-files\.com\//);
  });

  it("loại link trùng và không vượt trần mỗi feed", () => {
    expect(new Set(items.map((item) => item.link)).size).toBe(items.length);
    expect(items.length).toBeLessThanOrEqual(8);
  });

  it("nguồn không có listingCards thì không nuốt nhầm", () => {
    expect(parseListingCards(listing, HTML_SCRAPE_CONFIGS["ppa-tour"])).toEqual([]);
  });
});

describe("normalizeItemLink", () => {
  it("bỏ tham số tracking để khoá dedupe ổn định", () => {
    expect(
      normalizeItemLink(
        "https://pickleballrookie.com/bai-viet?utm_source=rss&utm_medium=rss&utm_campaign=bai-viet",
      ),
    ).toBe("https://pickleballrookie.com/bai-viet");
    // Cùng bài, utm khác nhau → cùng một source_url ⇒ dedupe vẫn ăn.
    expect(normalizeItemLink("https://x.com/a?utm_source=rss")).toBe(
      normalizeItemLink("https://x.com/a?utm_campaign=khac"),
    );
  });

  it("giữ query thật và vá scheme thiếu của feed pickleball.com", () => {
    expect(normalizeItemLink("https://x.com/a?p=123&utm_source=rss")).toBe(
      "https://x.com/a?p=123",
    );
    expect(normalizeItemLink("pickleball.com/news/abc")).toBe(
      "https://pickleball.com/news/abc",
    );
    // Rác thì trả nguyên, để isSafePublicFeedUrl loại.
    expect(normalizeItemLink("not a url")).toBe("https://not a url");
  });
});

describe("decodeEntities", () => {
  it("giải mã entity số của feed WordPress", () => {
    // Đúng thứ đã lọt vào tiêu đề bài đã đăng của MLP.
    expect(decodeEntities("Recap &#038; Bracket Update")).toBe("Recap & Bracket Update");
    expect(decodeEntities("MLP PLAYOFFS &#8211; DALLAS")).toBe("MLP PLAYOFFS – DALLAS");
    expect(decodeEntities("&#x27;quoted&#x27;")).toBe("'quoted'");
    expect(decodeEntities("a &amp; b &lt;c&gt;")).toBe("a & b <c>");
  });

  it("quét một lượt, không double-unescape", () => {
    expect(decodeEntities("&amp;lt;script&amp;gt;")).toBe("&lt;script&gt;");
  });

  it("giữ nguyên entity lạ hoặc mã số vô lý", () => {
    expect(decodeEntities("&unknownthing; &#99999999;")).toBe("&unknownthing; &#99999999;");
  });
});

describe("isTransientFetchError", () => {
  it("chỉ nhận timeout/abort, không nhận lỗi HTTP hay lỗi thường", () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    const abort = new Error("aborted");
    abort.name = "AbortError";

    expect(isTransientFetchError(timeout)).toBe(true);
    expect(isTransientFetchError(abort)).toBe(true);
    expect(isTransientFetchError(new Error("feed HTTP 404"))).toBe(false);
    expect(isTransientFetchError(new TypeError("bad url"))).toBe(false);
    expect(isTransientFetchError(null)).toBe(false);
    expect(isTransientFetchError("timeout")).toBe(false);
  });
});

describe("isWithinMaxAge — lọc độ tươi khi quét ứng viên og-meta", () => {
  const NOW = Date.parse("2026-10-23T06:00:00.000Z");
  const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

  it("nhận bài trong 30 ngày, loại bài già hơn và ngày hỏng", () => {
    expect(isWithinMaxAge(daysAgo(0), NOW)).toBe(true);
    expect(isWithinMaxAge(daysAgo(29), NOW)).toBe(true);
    expect(isWithinMaxAge(daysAgo(30), NOW)).toBe(true); // đúng biên: giữ
    expect(isWithinMaxAge(daysAgo(31), NOW)).toBe(false);
    expect(isWithinMaxAge(daysAgo(154), NOW)).toBe(false);
    expect(isWithinMaxAge("không-phải-ngày", NOW)).toBe(false);
    expect(isWithinMaxAge("", NOW)).toBe(false);
  });

  it("mô phỏng sitemap lastmod lẫn cũ/mới (ca Dink Authority): quét qua bài cũ, dừng khi đủ bài tươi", () => {
    // Tuổi đăng theo đúng thứ tự lastmod đo thật 23/10/2026 — bài tươi nằm
    // rải rác sau bài cũ, nên trần quét phải sâu hơn số bài cần gom.
    const agesByLastmodOrder = [0, 154, 56, 170, 493, 202, 32, 6, 7, 9, 8, 3];
    const collected: string[] = [];
    for (const age of agesByLastmodOrder.slice(0, 12)) {
      if (collected.length >= 4) break;
      if (isWithinMaxAge(daysAgo(age), NOW)) collected.push(daysAgo(age));
    }
    expect(collected).toEqual([daysAgo(0), daysAgo(6), daysAgo(7), daysAgo(9)]);
  });
});

// Bộ lọc bot của pickleball.com trả 403 cho User-Agent không theo khuôn
// "Mozilla/5.0 (compatible; <bot>; +<url>)" — 1/9 nguồn chết âm thầm suốt 4
// ngày (2026-08-28 → 09-01). Test này giữ CẢ HAI nửa của thoả thuận: đúng
// khuôn để qua được WAF, VÀ vẫn tự khai danh tính thật để không thành giả
// dạng trình duyệt.
describe("NEWS_FETCHER_USER_AGENT", () => {
  it("theo khuôn Mozilla/5.0 (compatible; …) mà bộ lọc bot mong đợi", () => {
    expect(NEWS_FETCHER_USER_AGENT.startsWith("Mozilla/5.0 (compatible; ")).toBe(true);
  });

  it("vẫn tự khai đúng tên bot và URL liên hệ — không giả dạng trình duyệt", () => {
    expect(NEWS_FETCHER_USER_AGENT).toContain("ThePickleHub-news-fetcher/1.0");
    expect(NEWS_FETCHER_USER_AGENT).toContain("+https://www.thepicklehub.net");
    // Không được mang dấu hiệu của một trình duyệt thật.
    expect(NEWS_FETCHER_USER_AGENT).not.toMatch(/Chrome|Safari|Firefox|Gecko|AppleWebKit/);
  });
});

describe("parsePickleAsiaPosts", () => {
  it("maps a published post and keeps a sufficiently long API body", () => {
    const paragraph = "Pickle Asia reports tournament facts and player context for readers. ".repeat(100);
    const items = parsePickleAsiaPosts([
      {
        slug: "vietnam-pickleball-open-2026",
        title: "<strong>Vietnam Pickleball Open 2026</strong>",
        excerpt: "<p>A regional tournament recap.</p>",
        content: `<article><p>${paragraph}</p></article>`,
        hero_image_url: "https://cdn.example.com/pickle.jpg",
        published_at: "2026-09-07T08:30:00+07:00",
        status: "published",
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Vietnam Pickleball Open 2026",
      link: "https://pickle.asia/blogs/vietnam-pickleball-open-2026",
      summary: "A regional tournament recap.",
      image_url: "https://cdn.example.com/pickle.jpg",
      published_at: "2026-09-07T01:30:00.000Z",
    });
    expect(items[0].raw_body?.length).toBeGreaterThanOrEqual(4_000);
    expect(items[0].raw_body).not.toContain("<p>");
  });

  it("marks short content as a brief and rejects malformed or draft rows", () => {
    const items = parsePickleAsiaPosts([
      {
        slug: "short-update",
        title: "<script>ignore me</script>Short update",
        excerpt: "One paragraph",
        content: "<p>This body is intentionally shorter than the full-body threshold.</p>",
        hero_image_url: null,
        published_at: "2026-09-07T00:00:00Z",
        status: "published",
      },
      {
        slug: "../unsafe",
        title: "Unsafe slug",
        published_at: "2026-09-07T00:00:00Z",
        status: "published",
      },
      {
        slug: "bad-date",
        title: "Bad date",
        published_at: "not-a-date",
        status: "published",
      },
      {
        slug: "not-public",
        title: "Draft",
        published_at: "2026-09-07T00:00:00Z",
        status: "draft",
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Short update");
    expect(items[0].link).toBe("https://pickle.asia/blogs/short-update");
    expect(items[0].raw_body).toBeNull();
  });
});

const duprListing = readFileSync(
  new URL("../__fixtures__/dupr-blog-listing.html", import.meta.url),
  "utf8",
);

describe("parseListingCards — listing Webflow của DUPR Blog", () => {
  const items = parseListingCards(duprListing, HTML_SCRAPE_CONFIGS["dupr-blog"]);

  it("lấy được tiêu đề, link /post/, ngày, tóm tắt, ảnh từ card bloggrid_card", () => {
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (const item of items) {
      expect(item.link).toMatch(/^https:\/\/www\.dupr\.com\/post\/[a-z0-9-]+$/);
      expect(item.title.length).toBeGreaterThanOrEqual(5);
      expect(Number.isFinite(Date.parse(item.published_at))).toBe(true);
    }
  });

  it("đọc đúng một bài mốc trong fixture", () => {
    const known = items.find((item) =>
      item.link.endsWith("/inside-riverside-the-calgary-pickleball-club-built-on-dupr"),
    );
    expect(known).toBeDefined();
    expect(known?.title).toBe(
      "Inside Riverside, the Calgary pickleball club built on DUPR",
    );
    expect(known?.published_at.slice(0, 10)).toBe("2026-10-20");
    expect(known?.summary).toContain("Riverside Club is a 15-court");
  });
});

describe("extractScrapeLinks — đường og-meta mở rộng", () => {
  it("Times Now: chỉ giữ link bài -article- dưới mục pickleball, giữ thứ tự listing", () => {
    const html = [
      '<a href="https://www.timesnownews.com/sports/pickleball/first-story-article-101">a</a>',
      '<a href="https://www.timesnownews.com/sports/cricket/other-article-102">b</a>',
      '<a href="https://www.timesnownews.com/sports/pickleball">mục</a>',
      '<a href="https://www.timesnownews.com/sports/pickleball/second-story-article-103">c</a>',
      '<a href="https://www.timesnownews.com/sports/pickleball/first-story-article-101">trùng</a>',
    ].join("\n");
    expect(extractScrapeLinks(html, HTML_SCRAPE_CONFIGS["times-now"])).toEqual([
      "https://www.timesnownews.com/sports/pickleball/first-story-article-101",
      "https://www.timesnownews.com/sports/pickleball/second-story-article-103",
    ]);
  });

  it("Dink Authority: đọc <loc> sitemap, loại bản /es/ /pt/, sắp lastmod mới nhất trước", () => {
    const xml = [
      "<url><loc>https://www.dinkauthoritymagazine.com/news/old-story</loc><lastmod>2026-09-01T00:00:00.000Z</lastmod></url>",
      "<url><loc>https://www.dinkauthoritymagazine.com/es/news/historia</loc><lastmod>2026-10-22T00:00:00.000Z</lastmod></url>",
      "<url><loc>https://www.dinkauthoritymagazine.com/tips/new-tip</loc><lastmod>2026-10-20T00:00:00.000Z</lastmod></url>",
      "<url><loc>https://www.dinkauthoritymagazine.com/about</loc><lastmod>2026-10-21T00:00:00.000Z</lastmod></url>",
    ].join("\n");
    expect(extractScrapeLinks(xml, HTML_SCRAPE_CONFIGS["dink-authority"])).toEqual([
      "https://www.dinkauthoritymagazine.com/tips/new-tip",
      "https://www.dinkauthoritymagazine.com/news/old-story",
    ]);
  });

  it("PPA: đường cũ giữ nguyên — slug root, loại trang mục", () => {
    const html =
      '<a href="/122-shot-rally-amazing-point/">x</a><a href="/about/">y</a>';
    expect(extractScrapeLinks(html, HTML_SCRAPE_CONFIGS["ppa-tour"])).toEqual([
      "https://www.ppatour.com/122-shot-rally-amazing-point/",
    ]);
  });
});

describe("isAdvertorialItem — bộ lọc advertorial của pipeline tin tức", () => {
  it("chặn bài nguồn tự khai quảng cáo", () => {
    expect(isAdvertorialItem({ title: "Sponsored: the only paddle you need" })).toBe(true);
    expect(
      isAdvertorialItem({ title: "Weekend recap", summary: "Sponsored content from PaddleCo." }),
    ).toBe(true);
    expect(isAdvertorialItem({ title: "Weekend recap", categories: ["News", "Sponsored"] })).toBe(true);
    expect(isAdvertorialItem({ title: "Advertorial: inside the shoe lab" })).toBe(true);
  });

  it("CHO QUA bài review sản phẩm và tin đối tác — mục tiêu của đợt mở rộng", () => {
    expect(
      isAdvertorialItem({ title: "Expert review: Does the RPM Jade live up to the hype?" }),
    ).toBe(false);
    expect(
      isAdvertorialItem({ title: "Gearbox GX2 Review: Is It the Best Power Paddle of 2025?" }),
    ).toBe(false);
    expect(isAdvertorialItem({ title: "The best full-foam (Gen 4) pickleball paddles" })).toBe(false);
    expect(
      isAdvertorialItem({ title: "DUPR and Pickle Time Partner to Grow Pickleball in Thailand" }),
    ).toBe(false);
    expect(
      isAdvertorialItem({ title: "Weekend recap", categories: ["News & Reviews"] }),
    ).toBe(false);
  });
});
