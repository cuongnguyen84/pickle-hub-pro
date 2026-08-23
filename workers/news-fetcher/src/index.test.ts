// Chạy chung với gate của repo: `npx vitest run workers` (workers-ci.yml),
// hoặc riêng: `npx vitest run workers/news-fetcher` từ gốc repo.
// Kiểm trên HTML thật đã lưu trong __fixtures__, không mock.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  decodeEntities,
  HTML_SCRAPE_CONFIGS,
  normalizeItemLink,
  parseListingCards,
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
