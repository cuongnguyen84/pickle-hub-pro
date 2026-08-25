import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * PostgREST caps every response at `max-rows = 1000` and does it silently:
 * `.limit(5000)` comes back with status 200, `error = null`, and exactly 1000
 * rows. Nothing in the logs says the sitemap is now incomplete.
 *
 * That is how /sitemap-news.xml served 500 of 709 EN articles for months
 * (fixed 2026-08-23, #644) — every article published before 2026-07-31 had
 * quietly fallen out, with no internal links to those pages either.
 *
 * This test is the tripwire for the same failure on the tables that are large
 * or growing. It is deliberately a source-text assertion: the bug lives in the
 * *query*, and by the time a rendered fixture could show it we would already be
 * over the cap in production.
 *
 * Row counts on 2026-08-25 — news_items 1611, matches 977, venues 896 and
 * climbing ~100/month off the Google Places enrichment run. The remaining
 * sitemaps (blog 68, events 27, livestreams 29, organizations 3, players 40
 * after its DB-side filters, tournaments 15, videos 6) are two orders of
 * magnitude from the cap; add them here the day one of them stops being.
 */
const PAGED_SITEMAPS = [
  "sitemap-news.xml.ts",
  "sitemap-matches.xml.ts",
  "sitemap-venues.xml.ts",
] as const;

function source(file: string): string {
  return readFileSync(resolve(import.meta.dirname, "..", file), "utf8");
}

/** Code only — these files discuss `.limit(5000)` in their comments. */
function code(file: string): string {
  return source(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("sitemaps over growing tables page past the PostgREST 1000-row cap", () => {
  for (const file of PAGED_SITEMAPS) {
    describe(file, () => {
      it("pages with fetchAllRows instead of a bare .limit()", () => {
        const s = code(file);
        expect(s).toContain("fetchAllRows");
        // `.limit(5000)` is the exact shape that looks like it asks for 5000
        // rows and silently receives 1000.
        expect(s).not.toMatch(/\.limit\(\s*\d{4,}\s*\)/);
      });

      it("orders by a unique tie breaker so rows cannot shuffle between pages", () => {
        const s = code(file);
        // fetchAllRows pages with .range(from, to). Without a second, unique
        // ORDER BY column, rows sharing the first column's value can repeat or
        // vanish across a page boundary — and bulk scripts write identical
        // timestamps to whole tables at a time.
        const orderCalls = s.match(/\.order\(/g) ?? [];
        expect(orderCalls.length).toBeGreaterThanOrEqual(2);
        expect(s).toContain(".range(from, to)");
      });
    });
  }
});
