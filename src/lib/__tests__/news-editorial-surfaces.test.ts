import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractArticleText,
  isSafePublicFeedUrl,
} from "../../../workers/news-fetcher/src/index";

const root = resolve(import.meta.dirname, "../../..");

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("news editorial public surfaces", () => {
  it("extracts grounded article prose and rejects unsafe fetch targets", () => {
    const html = `
      <header><p>This header should not survive extraction at all.</p></header>
      <article>
        <h2>Championship update from the tour</h2>
        <p>The opening paragraph contains enough factual reporting to become useful source material for the editorial rewrite.</p>
        <script>alert("bad")</script>
        <p>The second paragraph records the event result and gives the rewrite pipeline another grounded block of information.</p>
        <p>Shop now</p>
      </article>
    `;
    const result = extractArticleText(html);
    expect(result).toContain("Championship update from the tour");
    expect(result).toContain("The opening paragraph");
    expect(result).not.toContain("alert");
    expect(result).not.toContain("header should not survive");
    expect(result).not.toContain("Shop now");

    expect(isSafePublicFeedUrl("https://ppatour.com/feed/")).toBe(true);
    expect(isSafePublicFeedUrl("http://ppatour.com/feed/")).toBe(false);
    expect(isSafePublicFeedUrl("https://127.0.0.1/feed")).toBe(false);
    expect(isSafePublicFeedUrl("https://10.0.0.8/feed")).toBe(false);
    expect(isSafePublicFeedUrl("https://news.internal/feed")).toBe(false);
  });

  it("does not select or render the private source URL", () => {
    const publicFiles = [
      "src/hooks/useNewsItems.ts",
      "src/hooks/useNewsItemBySlug.ts",
      "src/hooks/useFeaturedNews.ts",
      "src/hooks/social/useFeedNews.ts",
      "src/pages/News.tsx",
      "src/pages/NewsArticle.tsx",
      "functions/_lib/render/news.ts",
    ];
    for (const file of publicFiles) {
      expect(source(file), file).not.toContain("source_url");
    }
  });

  it("renders stored editorial content through client and SSR sanitizers", () => {
    const client = source("src/pages/NewsArticle.tsx");
    const ssr = source("functions/_lib/render/news.ts");
    expect(client).toContain("DOMPurify.sanitize(article.content_html");
    expect(ssr).toContain("sanitizeBlogHtml(r.content_html)");
    expect(client).toContain("ThePickleHub Editorial");
    expect(ssr).toContain("ThePickleHub Editorial");
  });

  it("keeps source attribution as text rather than an outbound CTA", () => {
    const client = source("src/pages/NewsArticle.tsx");
    const ssr = source("functions/_lib/render/news.ts");
    expect(client).not.toContain("Read the full article");
    expect(client).not.toContain("Đọc toàn bộ bài viết");
    expect(ssr).not.toContain("Read the full article");
    expect(ssr).not.toContain("Đọc nguyên văn");
  });
});
