import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NEWS_SITEMAP_WINDOW_DAYS } from "../sitemap-news.xml";

const root = resolve(import.meta.dirname, "../..");
const source = (p: string) => readFileSync(resolve(root, p), "utf8");

/**
 * 2026-09-07 — the sitemap asks Google to spend crawl budget, and the two
 * clusters below were asking for far more than they returned. Both changes are
 * one line each and both revert to "worse but green" if someone deletes them,
 * so they are pinned here with the numbers that justified them.
 *
 * Measured on the GSC exports of 2026-09-07 and the Search Analytics API for
 * the 90 days to 2026-09-04:
 *
 *   /vi/news/*   937 in sitemap · 695 crawled · 116 clicks · 622 zero-click
 *                206 of the 419 "Discovered – currently not indexed" URLs
 *   /tran-dau/*  266 in sitemap · 151 crawled ·  11 clicks
 *   /blog/*      122 URLs       ·               7,920 clicks
 */
describe("sitemap crawl budget", () => {
  it("news is advertised on a recency window, not in full", () => {
    const news = source("functions/sitemap-news.xml.ts");
    // The window has to be applied in the query. Filtering after fetchAllRows
    // would still page through every row and would still hand PostgREST the
    // unbounded scan the window exists to avoid.
    expect(news).toContain('.gte("published_at", windowStart)');
    expect(news).toContain("NEWS_SITEMAP_WINDOW_DAYS");
  });

  it("the news window stays inside the range the traffic data supports", () => {
    // Below ~30d the sitemap would drop articles still in their first crawl
    // cycle; above ~180d it covers 902 of 937 rows and stops being a window.
    expect(NEWS_SITEMAP_WINDOW_DAYS).toBeGreaterThanOrEqual(30);
    expect(NEWS_SITEMAP_WINDOW_DAYS).toBeLessThanOrEqual(180);
  });

  it("the match segment is not advertised in the sitemap index", () => {
    const index = source("functions/sitemap.xml.ts");
    // Delisted, not deleted: an index entry that 404s flags the whole index,
    // which is why the file must survive even though the index drops it.
    const listed = index
      .split("\n")
      .some((l) => l.includes('"/sitemap-matches.xml"') && !l.trimStart().startsWith("//"));
    expect(listed).toBe(false);
  });

  it("the delisted match segment still answers", () => {
    // renderMatch and the URLs stay live; only the invitation is withdrawn.
    expect(() => source("functions/sitemap-matches.xml.ts")).not.toThrow();
  });

  it("URLs that are permanently gone answer 410, never a bare 404", () => {
    const mw = source("functions/_middleware.ts");
    // The five survivors of the 2026-09-07 re-crawl of the GSC 404 export.
    // A bare 404 keeps a URL in Google's retry queue; 410 removes it.
    for (const p of [
      "/watch/9439d561-5857-4b94-8304-7d787c5502c3",
      "/watch/c2138621-6d0d-4bb1-82e4-7cb9ff249de0",
      "/watch/c8e56c37-d405-4281-b66f-c5d925f89595",
      "/live/3e211e67-2caa-",
      "/vi/news/ly",
    ]) {
      expect(mw, p).toContain(`"${p}"`);
    }
  });

  it("the prerender cache key was bumped alongside the 410s", () => {
    // Those five paths have a cached 404 body. Without a new key the KV copy
    // outlives the deploy and the 410 never reaches a crawler.
    const mw = source("functions/_middleware.ts");
    const m = mw.match(/const cacheKey = `pr:v(\d+):/);
    expect(m, "cacheKey not found — did the format change?").toBeTruthy();
    expect(Number(m![1])).toBeGreaterThanOrEqual(107);
  });
});
