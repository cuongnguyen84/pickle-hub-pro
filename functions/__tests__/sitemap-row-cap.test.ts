/**
 * CAP-01 — no sitemap segment may issue an unpaged PostgREST query.
 *
 * PostgREST caps every response at `max-rows = 1000` and does it silently:
 * `.limit(5000)` comes back with exactly 1000 rows, HTTP 200, `error = null`.
 * Nothing in the logs says the sitemap is now incomplete. That is how
 * /sitemap-news.xml served 500 of 709 EN articles for months before #644
 * (2026-08-23) found it — every article published before 2026-07-31 quietly
 * missing from both the sitemap and Google's index, with no internal links to
 * those pages either.
 *
 * Row counts on 2026-08-25: news_items 1611, matches 977, venues 896 and
 * climbing ~100/month off the Google Places enrichment run (2026-06 +687,
 * 2026-07 +69, 2026-08 +136). venues was ~104 courts from repeating the
 * failure on the segment that carries 68% of site impressions.
 *
 * The remaining segments are two orders of magnitude from the cap (blog 68,
 * events 27, livestreams 29, organizations 3, players 40 after its DB-side
 * filters, tournaments 15, videos 6). They are covered here anyway, and that
 * is the deliberate difference from the first version of this file: an
 * allowlist of "the big tables" has to be revisited every time one of the
 * small ones stops being small, and the day that revisit gets skipped is the
 * day this test passes while the sitemap is already short. Paging a 3-row
 * table costs one request; remembering to come back costs a regression.
 *
 * It is a source-text test on purpose. The failure mode is a plausible-looking
 * query returning a plausible-looking result, so there is no behaviour to
 * assert against a live database — only the shape of the call. A future
 * segment that copies the old pattern fails here instead of in Search Console
 * six weeks later.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FUNCTIONS_DIR = join(__dirname, "..");

const segmentFiles = readdirSync(FUNCTIONS_DIR)
  .filter((f) => /^sitemap-.*\.xml\.ts$/.test(f))
  .sort();

/** Strip // line comments and block comments so prose about `.limit(5000)`
 *  (there is a lot of it, deliberately) doesn't trip the assertions. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("sitemap segments respect the PostgREST 1000-row cap", () => {
  it("finds the segment files (guards against a bad glob silently passing)", () => {
    expect(segmentFiles.length).toBeGreaterThanOrEqual(11);
  });

  it.each(segmentFiles)("%s issues no bare .limit() query", (file) => {
    const code = stripComments(readFileSync(join(FUNCTIONS_DIR, file), "utf8"));
    // Not just `.limit(5000)`: any bare limit on a sitemap read is either
    // capped at 1000 anyway or is an undocumented cut of the URL list.
    expect(code).not.toMatch(/\.limit\s*\(/);
  });

  it.each(segmentFiles)("%s pages through fetchAllRows when it queries at all", (file) => {
    const code = stripComments(readFileSync(join(FUNCTIONS_DIR, file), "utf8"));
    // sitemap-shop.xml.ts answers an empty urlset while the indexing gate is
    // shut and never reaches Supabase — nothing to page.
    if (!/\.from\s*\(/.test(code)) return;
    expect(code).toMatch(/fetchAllRows/);
    expect(code).toMatch(/\.range\s*\(/);
  });

  it.each(segmentFiles)("%s gives every paged query a unique tie breaker", (file) => {
    const code = stripComments(readFileSync(join(FUNCTIONS_DIR, file), "utf8"));
    if (!/fetchAllRows/.test(code)) return;
    // Every fetchAllRows call must order by at least two columns. A single
    // ORDER BY on a non-unique column (updated_at, start_at, published_at —
    // all of which repeat in this schema; the alobo venue import and the
    // Places enrichment both bulk-write one timestamp across hundreds of rows)
    // lets rows shuffle between pages, so some are returned twice and others
    // never at all.
    //
    // Splitting on the identifier also yields the fragment after the import
    // statement, which has no .range( — only fragments that open a query count.
    const calls = code
      .split(/fetchAllRows/)
      .slice(1)
      .filter((fragment) => fragment.includes(".range("));
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const upToRange = call.slice(0, call.indexOf(".range("));
      const orderCount = (upToRange.match(/\.order\s*\(/g) || []).length;
      expect(orderCount).toBeGreaterThanOrEqual(2);
    }
  });
});
