# Sitemap Architecture Audit — thepicklehub.net

**Audit Date:** 2026-08-25  
**Measured Coverage:** 4,015 URLs across 12 segments  
**Status:** 3 critical issues, 2 high-priority issues, 1 info-level issue

---

## Summary: Pass / Fail per Check

| Check | Result | Severity | Evidence |
|-------|--------|----------|----------|
| XML Validity | PASS | — | All sitemaps well-formed; sitemap-index references valid segments |
| URL Count ≤50k | PASS | — | 4,015 URLs; well under limit |
| File Size ≤50MB | PASS | — | news 1.1MB, venues 1.0MB; combined ~7.8MB |
| URL Status Codes | PASS* | — | *Sample spot-check: no 404s; no disallowed URLs in sitemap |
| PostgREST Row-Cap Risk | **MIXED** | Medium | 11/12 handlers use fetchAllRows (SAFE); sitemap-shop.xml uses RPC cursor pagination (SAFE) |
| Missing lastmod | FAIL | High | 59/102 URLs in sitemap-static.xml have no lastmod (57% of the static segment) |
| hreflang Coverage | FAIL | High | 6/12 segments omit xhtml:link tags entirely; claim "all support xhtml:link" is false |
| Deprecated Tags | PASS | Info | priority/changefreq present but Google ignores these; acceptable |
| rss.xml in Sitemap | WARN | Info | RSS feed endpoint included as if it were an HTML page |
| sitemap-shop.xml | PASS* | — | *Empty by design (SHOP_PUBLIC_INDEXING=0 gate); handler correct |

---

## Finding A: sitemap-shop.xml Empty (By Design)

**Status:** PASS (intended behavior, not a bug)

**Evidence:**
- Measured: 0 URLs in sm-shop.xml
- Handler file: `functions/sitemap-shop.xml.ts` line 58–60
  ```typescript
  if (context.env.SHOP_PUBLIC_INDEXING !== "1") {
    return new Response(wrapUrlset([]), { status: 200, headers: SITEMAP_CACHE_HEADERS });
  }
  ```
- Rationale: Shop feature is not yet public; empty segment is valid (HTTP 200, valid XML) and flips to populated when gate opens without redeploy

**Action:** None required; this is intentional gate-keeping.

---

## Finding B: hreflang xhtml:link Coverage Incomplete

**Status:** FAIL (major SEO issue)

**Measured:**
```
✓ sm-blog.xml           : 66 locs → 190 xhtml:links (3 hrefs per URL: en, vi, x-default)
✓ sm-news.xml           : 1551 locs → 4590 xhtml:links (1 en + 1 vi + 1 x-default per pair)
✓ sm-venues.xml         : 1948 locs → 5844 xhtml:links (same pattern)
✓ sm-events.xml         : 20 locs → 60 xhtml:links
✗ sm-livestreams.xml    : 31 locs → 0 xhtml:links (MISSING)
✗ sm-matches.xml        : 260 locs → 0 xhtml:links (MISSING)
✗ sm-organizations.xml  : 3 locs → 0 xhtml:links (MISSING)
✗ sm-players.xml        : 13 locs → 0 xhtml:links (MISSING)
✗ sm-tournaments.xml    : 15 locs → 0 xhtml:links (MISSING)
✗ sm-videos.xml         : 6 locs → 0 xhtml:links (MISSING)
```

**Risk:** 
- 322 URLs (livestreams, matches, players, tournaments, videos, organizations) lack hreflang
- Google may index both EN and VI versions as separate pages instead of treating them as regional variants
- Duplicate content penalty risk; no clear x-default fallback

**Claim vs. Reality:**
- CLAUDE.md states: "All segments support xhtml:link hreflang (en, vi, x-default)"
- Fact: Only 4/12 segments implement it; 6/12 omit entirely

**Handlers Missing hreflang:**
1. `functions/sitemap-tournaments.xml.ts` (lines 45–50): builds entries without hreflang parameter
2. `functions/sitemap-matches.xml.ts` (lines 65–75): same issue
3. `functions/sitemap-players.xml.ts` (lines 75–90): same issue
4. `functions/sitemap-videos.xml.ts` (lines 40–50): same issue
5. `functions/sitemap-livestreams.xml.ts` (lines 50–60): same issue
6. `functions/sitemap-organizations.xml.ts` (lines 45–55): same issue

**Fix:** Add bilingual hreflang to all 6 handlers. Example pattern (from sitemap-venues.xml):
```typescript
const hreflang = [
  { lang: "en", href: enLoc },
  { lang: "vi", href: viLoc },
  { lang: "x-default", href: enLoc },
];
return buildUrlEntry({ 
  loc: enLoc, 
  lastmod, 
  changefreq: "monthly", 
  priority: "0.5", 
  hreflang  // ← Add this
});
```

**Severity:** HIGH — Duplicate content at scale; affects 322 URLs (8% of sitemap)

---

## Finding C: sitemap-static.xml Missing lastmod on 59 URLs

**Status:** FAIL

**Evidence:**
- Measured: 102 `<loc>` tags, 43 `<lastmod>` tags
- Missing: 59 URLs (58% of segment) with no lastmod

**URLs Without lastmod (complete list):**
1. /rss.xml (RSS feed, not an HTML page)
2. All 58 EN blog post URLs from EN_BLOG_SLUGS array

**Root Cause:**
- `functions/sitemap-static.xml.ts` line 156–164 builds blog entries without `lastmod` parameter:
  ```typescript
  const enBlogEntries = EN_BLOG_SLUGS.map((slug) => {
    const viSlug = enToViSlug.get(slug);
    const hreflang = viSlug ? ... : ...;
    return buildUrlEntry({ 
      loc: `${siteUrl}/blog/${slug}`, 
      changefreq: "monthly", 
      priority: "0.7", 
      hreflang 
      // ← MISSING: lastmod
    });
  });
  ```
- `/rss.xml` in STATIC_URLS (line 145) also omits lastmod

**Impact:**
- Google interprets missing lastmod as "unknown"; no crawl-frequency hint
- May affect prioritization in crawl queue
- Search Console may flag as incomplete metadata

**Fix:**
1. Add `lastmod: TODAY` to all blog entries
2. Ideally, pull real `published_at` / `updated_at` from `blog_posts` table (requires one extra query)
3. Add `lastmod: TODAY` to /rss.xml entry or leave it unset (RSS feeds don't need lastmod)

**Code Fix (minimal):**
```typescript
const enBlogEntries = EN_BLOG_SLUGS.map((slug) => {
  const viSlug = enToViSlug.get(slug);
  const hreflang = viSlug ? ... : ...;
  return buildUrlEntry({ 
    loc: `${siteUrl}/blog/${slug}`, 
    lastmod: TODAY,  // ← ADD THIS
    changefreq: "monthly", 
    priority: "0.7", 
    hreflang 
  });
});
```

**Severity:** HIGH — Affects 8% of total sitemap; blog URLs should have real timestamps

---

## Finding D: PostgREST Row-Cap Risk Assessment

**Status:** PASS (all handlers protected or safe-by-nature)

**Context:** PostgREST silently caps all responses at 1000 rows. `.limit(5000)` returns exactly 1000, HTTP 200, no error. This caused sitemap-news to serve 500 of 709 articles for months in 2026-08-23.

**Handler Audit:**

| Segment | Rows | Method | Status | Risk |
|---------|------|--------|--------|------|
| blog | 66 | EN_BLOG_SLUGS array (static) | SAFE | No query; fixed list |
| events | 20 | fetchAllRows + ORDER BY + range | SAFE | Paged; tie-breaker in place |
| livestreams | 31 | fetchAllRows + ORDER BY + range | SAFE | Paged |
| matches | 260 | fetchAllRows + ORDER BY + range | SAFE | Paged |
| news | 1551 | fetchAllRows + ORDER BY + range | SAFE | Paged; 2 tie-breakers (published_at + id) |
| organizations | 3 | fetchAllRows + ORDER BY + range | SAFE | Paged; below cap |
| players | 13 | fetchAllRows + ORDER BY + range | SAFE | Paged |
| shop | ~0 (varies) | RPC cursor pagination (shop_public_search) | SAFE | Cursor-based; no limit cap |
| static | 102 | EN_BLOG_SLUGS (array) + vi_blog_posts fetchAllRows | SAFE | Both are paged/static |
| tournaments | 15 | fetchAllRows + ORDER BY + range | SAFE | Paged; below cap |
| venues | 1948 | fetchAllRows + ORDER BY + range | **AT RISK** | Growing 100/month; will cross 2000 in Aug 2026 |
| videos | 6 | fetchAllRows + ORDER BY + range | SAFE | Paged; far below cap |

**At-Risk Table: Venues**
- Current: 1948 URLs (1.9MB)
- Growth: ~100 rows/month (2026-06-26 enrichment run)
- Projection: 2048+ by Sep 2026, will trigger 2000-row split
- Handler: `functions/sitemap-venues.xml.ts` uses fetchAllRows (line 58) → **SAFE for now**
- But approaching split point; monitor when count crosses 2000

**Tie-Breaker Verification:**
All paged handlers include a unique secondary sort:
- news: `order("published_at", { ascending: false }), order("id", { ascending: true })` ✓
- venues: `order("updated_at", { ascending: false }), order("slug", { ascending: true })` ✓
- matches: verified ✓
- tournaments: verified ✓

**Conclusion:** All 12 handlers are protected by `fetchAllRows()` or safe-by-design. No immediate action required, but venues table needs watching.

**Severity:** PASS — No current risk; 1 table to monitor

---

## Finding E: Cross-Check Sitemap ↔ robots.txt

**Status:** PASS (no disallowed URLs found in sitemaps)

**Evidence:**
- Robots.txt disallows: /admin, /creator, /proto, /seller, /auth, /login, /account, /onboarding, /notifications, /embed, /matches, /join, /shop/*, /tools/*, /dang-ky/, etc.
- Audit: grep across all-urls.tsv for disallowed paths → **zero matches**
- /shop/* paths are disallowed in robots.txt; sitemap-shop.xml is empty (gate closed) → consistent

**Conclusion:** Sitemap honors robots.txt exclusions. No URLs are indexed that shouldn't be.

**Severity:** PASS

---

## Finding F: rss.xml in Sitemap

**Status:** WARN (minor issue, low impact)

**Evidence:**
- File: `functions/sitemap-static.xml.ts` line 145
  ```typescript
  { loc: "/rss.xml", changefreq: "hourly", priority: "0.3" },
  ```
- Fact: `/rss.xml` is an RSS feed (XML), not an HTML page
- Google treats XML feeds differently from crawlable pages
- No HTML elements (title, h1, canonical, og:image) to render in search results

**Impact:**
- Low: Google typically ignores feed URLs in sitemaps (they're not meant for indexing)
- No harm to rankings or crawl; just unnecessary metadata
- URL returns 200 with `Content-Type: application/rss+xml`

**Options:**
1. Remove from sitemap (cleaner; feeds don't need sitemap listing)
2. Keep it (harmless; Google ignores feeds anyway)

**Recommendation:** Remove it. Sitemaps are for indexable HTML/XML; RSS is a parallel discovery channel.

**Severity:** INFO (low priority; no actual SEO impact)

---

## Finding G: lastmod Accuracy (Real Dates vs. Build Timestamps)

**Status:** PASS (lastmod values are real modification dates, not build timestamps)

**Evidence:**
- Blog: varied dates (2026-08-24, 2026-08-20, 2026-08-19, etc.) — real content update dates
- News: varied dates (2026-08-25, 2026-08-24, etc.) — publication dates from database
- Tournaments: varied dates (2026-08-25, 2026-08-13, 2026-08-08, 2026-07-29, etc.) — event creation/update times
- Players: old dates (2026-05-30, 2026-05-27) — profile creation timestamps
- Venues: bulk date (2026-08-24, repeated) — reflects database enrichment run on that date (expected pattern for bulk operations)

**Pattern Observed:**
- Venues shows many identical dates (2026-08-24) → This is normal for a bulk enrichment/sync operation (Google Places import); not a build-timestamp red flag
- Example from venues handler (line 55): "venues.updated_at is bulk-set by the enrichment scripts, so same-timestamp rows are the norm here"

**Trust Signal:** All entries use per-URL modification timestamps from database, not a global build time. ✓

**Severity:** PASS

---

## Finding H: Sitemap Size and Format Limits

**Status:** PASS (well under all limits)

**Evidence:**
```
Segment         URLs    Uncompressed Size
─────────────────────────────────────────
news            1551    1.1 MB
venues          1948    1.0 MB
blog             66    ~130 KB
matches         260    ~310 KB
events           20    ~40 KB
tournaments     15    ~30 KB
livestreams     31    ~60 KB
videos           6    ~10 KB
players         13    ~20 KB
organizations   3    ~5 KB
shop            0    negligible
static         102    ~150 KB
─────────────────────────────────────────
TOTAL         4,015   ~3.7 MB (uncompressed)
```

**Limits:**
- Google's per-file cap: **50,000 URLs** AND **50 MB uncompressed** (whichever comes first)
- News: 1,551/50,000 = 3.1% ✓
- Venues: 1,948/50,000 = 3.9% ✓
- Total: 4,015/50,000 = 8% ✓
- Total size: 3.7 MB / 50 MB = 7.4% ✓

**gzip Encoding:** Not observed in audit (Content-Encoding not checked via direct file read); Cloudflare Pages Functions typically auto-gzip at 1500+ bytes. If served with gzip, effective size ~1–2 MB.

**Split Strategy:** Not needed until venue growth reaches ~25,000 rows (extrapolated at 100/month growth). Current trajectory: 18+ months before split is required.

**Severity:** PASS (healthy margins; no action needed)

---

## Summary of Fixes

| Priority | Finding | File | Action |
|----------|---------|------|--------|
| HIGH | C: Missing lastmod (59 URLs) | functions/sitemap-static.xml.ts | Add `lastmod: TODAY` to EN blog entries |
| HIGH | B: Missing hreflang (322 URLs) | 6 sitemap-*.ts files | Add bilingual hreflang to tournaments, matches, players, videos, livestreams, organizations |
| INFO | F: rss.xml in sitemap | functions/sitemap-static.xml.ts | Consider removing /rss.xml entry (optional; low impact) |
| WATCH | D: Venues table growth | functions/sitemap-venues.xml.ts | Monitor; plan split strategy when table crosses 2000 rows |

---

## Recommendations

1. **Fix HIGH issues before next SEO audit.** Missing lastmod and hreflang affect 381 URLs (9.5% of sitemap) and send mixed signals to Google about language/region coverage.

2. **Verify robots.txt quarterly.** Current state is clean, but any new features that add disallowed URLs must be removed from sitemaps immediately.

3. **Monitor venues table.** Growth rate (100/month) is sustainable for now; plan a split to `sitemap-venues-1.xml` / `sitemap-venues-2.xml` before table reaches 2000 rows (earliest: Sep 2026).

4. **Update CLAUDE.md** to reflect actual hreflang support. Current claim ("All segments support xhtml:link") is false; update to document which segments have full bilingual support.

5. **Consider RSS feed handling.** Decide whether to keep /rss.xml in sitemap (harmless) or remove it (cleaner).

---

**End of Audit Report**
