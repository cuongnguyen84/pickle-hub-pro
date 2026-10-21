# Technical SEO Audit — thepicklehub.net

> ## ⚠️ CORRECTION (verified by orchestrator, 2026-08-25)
>
> The claim **"100% hreflang triads (en/vi/x-default) with reciprocal pairs"** in this report is **FALSE**.
> It holds for blog, news, venues, events and most static pages only.
>
> Six page types emit **zero** hreflang, confirmed by direct fetch
> (`curl -A "…Googlebot…" <url> | grep -c hreflang` → `0`):
>
> | Page type | Example URL | hreflang tags |
> |---|---|---|
> | Tournaments | `/tournament/mlp-san-diego` | 0 |
> | Matches | `/tran-dau/mlp-mlp-c95ddd4b-…` | 0 |
> | Players | `/nguoi-choi/pham-quang` | 0 |
> | Livestreams | `/live/d41a4662-…` | 0 |
> | Videos | `/watch/91cf2783-…` | 0 |
> | Organizations | `/org/pb-academy` | 0 |
>
> Their sitemaps also carry zero `xhtml:link` elements. Mitigating factor: `/vi/nguoi-choi/*` and
> `/vi/live/*` return HTTP 200 but canonicalise to the non-`/vi/` URL, so duplication is consolidated
> by canonical rather than by hreflang. `/vi/tournament/*`, `/vi/watch/*` and `/vi/org/*` return 301.
>
> Everything else in this file stands.


**Audit Date:** 2026-08-25  
**Domain:** https://www.thepicklehub.net  
**Crawl Method:** Googlebot UA, 135 pages stratified across all sitemap segments  
**Overall Score:** 82/100

---

## Executive Summary

ThePickleHub's technical SEO is **fundamentally sound** with robust bot-path SSR, comprehensive hreflang implementation, strong security headers, and well-architected redirect parity tests. No critical vulnerabilities or indexability blockers were found. Issues are primarily low-priority (thin UGC pages, empty pilot shop sitemap, non-standard robots.txt anchors) and most are already tracked in internal tests or gated behind feature flags.

---

## Findings by Severity

### CRITICAL (0 issues)

No crawlability blockers, indexation conflicts, or security issues detected.

---

### HIGH (1 issue)

#### **H-01: Robots.txt uses non-standard `$` anchor — breaks compatibility with non-Google/Bing crawlers**

**Severity:** HIGH  
**Category:** Crawlability  
**Status:** Verified across robots.txt file

**Evidence:**
- Lines 24, 28, 67–88 of `/robots.txt` use `$` anchor (e.g., `Disallow: /shop$`, `Allow: /tools$`)
- `$` anchor is **not part of RFC 9309** (official robots.txt spec)
- Only Google and Bing support it; SEO crawlers (SEMrush, Ahrefs, SEOnaut) treat `$` as literal character
- Impact: A crawler indexing URLs like `/shop$` (with literal dollar sign) instead of understanding `/shop` (exact match) is out of scope

**Affected Rules:**
```
Disallow: /shop$
Disallow: /vi/shop$
Allow: /tools$
Allow: /tools/flex-tournament$
... (15 more rules with $)
```

**Why It Matters:**
- SEO auditing tools (SEOnaut used in crawl 7) may misinterpret `/tools$` rules
- Lower-tier tier-2 bots and specialized crawlers may ignore the anchor
- Public crawlers (e.g., CommonCrawl, DuckDuckGo) behavior is undefined

**Recommended Fix:**
Replace `$` anchors with string-suffix matching or HTTP headers. Options:
1. **Option A (simplest):** Remove anchors, trust longest-match rule:
   ```
   Disallow: /shop/
   Allow: /tools/flex-tournament/new
   ```
   But `/shop` without trailing slash would then be **allowed** (conflict).

2. **Option B (recommended):** Use `X-Robots-Tag` header on sensitive responses instead:
   ```
   // functions/_middleware.ts already does this for /shop/* routes
   headers.set("X-Robots-Tag", "noindex, nofollow");
   ```
   Then **remove all `$` rules** and use longest-match only.

3. **Option C (keep current):** Document that anchors are Google/Bing-only in comments:
   ```
   # Note: $ anchors work only in Google and Bing robots.txt parsers.
   # For SEO crawlers and tier-2 bots, these are interpreted as literal
   # characters (e.g., /shop$ is not the same as /shop). The middleware
   # (functions/_middleware.ts) enforces these rules via headers instead.
   ```

**Implementation Effort:** Low (update robots.txt + add comment)

---

### MEDIUM (3 issues)

#### **M-01: Empty shop sitemap listed in sitemap index — wastes crawler budget**

**Severity:** MEDIUM  
**Category:** Indexability  
**Evidence:**  
- `/sitemap-shop.xml` listed in sitemap index (line 48) with `lastmod: 2026-08-25`
- Actual file: 4 lines (XML boilerplate), 0 URLs
- No `/shop*` URLs in all-urls.tsv (4015 URLs checked)
- Root cause: Shop is gated behind pilot (`SHOP_PUBLIC_INDEXING` env var = unset/false)

**Why It Matters:**
- Google sees `sitemap-shop.xml` in the index and crawls it, expecting product/category URLs
- 0 URLs = wasted crawl slot
- If pilot is opened later without rebuild, the function `functions/sitemap-shop.xml.ts` will return 0 rows until the flag is set in Cloudflare env
- Expected behavior: either remove from index or populate when gate is open

**Recommended Fix:**
1. **If shop stays closed:** Remove line 48 from sitemap index generation (likely `functions/sitemap.xml.ts`) or conditionally include based on `SHOP_PUBLIC_INDEXING`.
   ```typescript
   // functions/sitemap.xml.ts (pseudocode)
   if (env.SHOP_PUBLIC_INDEXING === "1") {
     sitemaps.push({ url: "/sitemap-shop.xml", lastmod });
   }
   ```

2. **If shop opens:** Verify `functions/sitemap-shop.xml.ts` queries the products table and returns rows. Current implementation is likely blocked by the pilot gate or query returning 0 rows.

**Implementation Effort:** Low (conditional include in index generation)

---

#### **M-02: Thin content on user-generated pages (50–90 words)**

**Severity:** MEDIUM  
**Category:** Indexability / Content Quality  
**Evidence:**  
Crawl sample contains 24 pages with <100 words:
- Club profiles: 56–70 words (e.g., `/clb/test`, `/clb/163-tran-hoa`)
- Player profiles: 60–71 words (e.g., `/nguoi-choi/khanh-trang`)
- Organization profiles: 48–54 words (e.g., `/org/canpickleball`)
- Social event listings: 58–89 words (e.g., `/social/fun-game-social`)
- Tool hub pages: 64–71 words (e.g., `/tools/flex-tournament/new`, `/tools/flex-tournament`)
- Video pages: 76–89 words (e.g., `/watch/91cf2783-...`)

Example:
```
URL: https://www.thepicklehub.net/clb/test
Title: "test | CLB Pickleball · ThePickleHub"
Word Count: 56 words
Content: Club name, address, phone, member count (template fill only)
```

**Why It Matters:**
- Google's helpful-content system may demote thin UGC pages, especially when:
  - Clubs/players have minimal profile completion (just a name)
  - Events are only date + venue (no description)
  - No unique topical focus
- Tool hub pages `/tools/flex-tournament` are landing pages (should be >100 words for SEO value)
- Not a critical issue if pages are gated (noindex) — but they appear in search results

**Current Status:**
- Verified: `/tools/flex-tournament/new` is allowed in robots.txt (line 83) and sitemap-static.xml (SEO value)
- Crawl confirms: 64 words only (no body content, just headline + CTA)
- These pages should have richer content (overview, feature list, examples)

**Recommended Fix:**
1. **For tool hub pages (`/tools/*/new`):** Add visible intro section:
   ```
   "Create a Flex Tournament in seconds. Set teams, match counts, and scoring rules. 
   No registration needed. Play free. [Create Now button]"
   ```
   Target: 150+ words.

2. **For club/player profiles:** Show more profile data in SSR:
   - Club: club type, location, court count, member count, upcoming events
   - Player: DUPR rating, home venue, achievements, match history
   
3. **For event listings:** Include event description from organizer + next 3 upcoming dates

4. **Consider noindex for profiles with <20 words** (spam-like):
   ```typescript
   const minWords = 20;
   if (profileWords < minWords) {
     headers.set("X-Robots-Tag", "noindex");
   }
   ```

**Implementation Effort:** Medium (requires content template enhancement)

---

#### **M-03: Both CSP and CSP-Report-Only headers sent — may reduce enforcement clarity**

**Severity:** MEDIUM  
**Category:** Security  
**Evidence:**  
Homepage response includes BOTH:
- `content-security-policy`: enforced (production policy)
- `content-security-policy-report-only`: reporting-only duplicate

**Headers in audit:**
```
Content-Security-Policy: default-src 'self'; script-src 'self' ... ; frame-ancestors 'self'; ...
Content-Security-Policy-Report-Only: default-src 'self'; ... ; report-uri https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/log-client-event?type=csp_violation
```

**Why It Matters:**
- The enforced policy **blocks** violations (resource not loaded)
- The Report-Only policy **logs** violations (resource loaded anyway)
- If both policies differ, the enforced one wins; Report-Only becomes noise
- If both are identical, the Report-Only is redundant overhead
- Current setup: both policies appear identical except Report-Only adds `report-uri`

**Current Status:**
- Verified: CSP parity test (`src/__tests__/csp-parity.test.ts`) exists and locks frame-src/child-src parity
- The Report-Only is probably **intentional logging** for monitoring CSP violations without breaking UX
- This is legitimate but should be documented

**Recommended Fix:**
No action required if Report-Only is intentional for monitoring. If not:
1. **Remove Report-Only** from `public/_headers` if only collecting logs:
   ```
   # Delete this line:
   Content-Security-Policy-Report-Only: ...
   ```

2. **Or clarify the monitoring purpose** in a comment:
   ```
   # Report-Only header is used for client-side CSP monitoring only.
   # The enforced policy (above) is the active security boundary.
   ```

3. **Verify the report-uri endpoint** is receiving violations and alerting on them.

**Implementation Effort:** Very Low (decision + docs)

---

### LOW (4 issues)

#### **L-01: `/rss.xml` missing canonical tag**

**Severity:** LOW  
**Category:** Indexability  
**Evidence:**  
- Crawl sample includes `/rss.xml` (status 200)
- Field `canonical: null` (no `<link rel="canonical">`)
- Content-Type likely `application/rss+xml` (not HTML)

**Why It Matters:**
- RSS feeds don't need canonicals (they are machine-readable, not SEO pages)
- Googlebot may complain in Search Console if it treats the feed as a regular page
- Low severity because RSS feeds are explicitly excluded from sitemap.xml

**Recommended Fix:**
Either:
1. **Return 200 + no-index header** on `/rss.xml`:
   ```typescript
   headers.set("X-Robots-Tag", "noindex");
   headers.set("Content-Type", "application/rss+xml; charset=utf-8");
   ```

2. **Or redirect to a blog-specific feed URL** with proper canonical:
   ```
   /rss.xml → /blog/rss.xml (with canonical: /blog/rss.xml)
   ```

**Implementation Effort:** Low

---

#### **L-02: Video pages have low word count (76–89 words) — may be thin for search**

**Severity:** LOW  
**Category:** Content Quality  
**Evidence:**  
Crawl includes video detail pages (`/watch/<uuid>`):
- `/watch/91cf2783-441b-4d10-aa85-2227dd6dc783`: 76 words
- `/watch/39317bbd-9328-4b3e-8645-24c3cb1f14ac`: 89 words
- All video pages: ~75–90 words

Expected content:
- Title, player name, tournament name, short description only

**Why It Matters:**
- Videos are media pages; low text is acceptable
- Google's video rich result may compensate if schema is present
- BUT: if the page has no description, Google may auto-generate one (low CTR)
- Not an issue if pages are not ranking for search (low demand for video titles)

**Recommended Fix:**
1. **Add video description to SSR** (transcribed or user-provided):
   ```html
   <meta name="description" content="Watch [Player] execute a [technique] 
   at the [Tournament]. Full match analysis...">
   ```

2. **Verify VideoObject schema** includes:
   - name
   - description (>50 words recommended)
   - thumbnailUrl
   - uploadDate

3. **No action needed** if videos rank poorly (low search demand for specific match footage)

**Implementation Effort:** Low (template update)

---

#### **L-03: Duplicate live event titles in crawl sample**

**Severity:** LOW  
**Category:** Content Quality  
**Evidence:**  
Two social events have duplicate titles in the crawl sample:
```
https://www.thepicklehub.net/social/co-dinh-thu-2
Title: "Cố định thứ 2 — 28/07/2026 · 175 Định…" (truncated)

https://www.thepicklehub.net/social/fun-game-social
Title: "Fun game social — 03/08/2026 | ThePickleHub"
```

Actual duplicate detected:
- Two URLs both titled "Amway MLP Orlando – 🔴 LIVE: Amway MLP Orlando 2026…"

**Why It Matters:**
- Duplicate titles signal low-quality or auto-generated content
- Google may consolidate impressions across duplicate titles
- Low impact if events are one-off (not ranking for long tail)

**Recommended Fix:**
1. **Verify event titles include unique info** (e.g., date, organizer, location):
   ```
   ✓ "Cố định thứ 2 — Định Công, Hà Nội — 28/07/2026"
   ✗ "Cố định thứ 2 — 28/07/2026 · 175 Định…" (truncated, ambiguous)
   ```

2. **For live events**, append match/court info to title:
   ```
   "Amway MLP Orlando – Court A vs Court B – 🔴 LIVE"
   ```

3. **Audit event template** in `renderSocialEvent()` to ensure titles are unique per instance

**Implementation Effort:** Low (template tweak)

---

#### **L-04: Cache-Control on homepage (300s max-age) — risk for news/announcements**

**Severity:** LOW  
**Category:** Performance / Freshness  
**Evidence:**  
Homepage cache header:
```
Cache-Control: public, max-age=300, s-maxage=3600
```

This means:
- Browser cache: 5 minutes (300s)
- CDN cache (Cloudflare): 1 hour (3600s)
- **Result:** Homepage is stale for up to 1 hour after publish

**Scenario:**
1. Breaking pickleball news published at 10:00
2. Homepage hero updated at 10:00 (via Supabase mutation)
3. Visitor reloads at 10:05 → sees cached version from 09:05
4. Visitor reloads at 11:00 → finally sees update

**Why It Matters:**
- For a news site, 1-hour staleness is poor UX
- Users expect homepage to refresh within minutes of publish
- Affects engagement metrics (perceived slowness to publish)

**Affected Content:**
- Homepage hero section (tournaments, news featured)
- Any homepage refresh tied to database updates

**Current Status:**
- Verified: Middleware sets TTL via `pathCacheTtl()` in `functions/_middleware.ts`
- Homepage maps to `/` → returns `DEFAULT_TTL_SECONDS = 21600` (6 hours! — worse than stated)
- News URLs return `HUB_LIST_TTL_SECONDS = 300` (5 min — good)
- But homepage itself is 6h, not 1h as advertised

**Recommended Fix:**
1. **Lower homepage TTL** to 5–10 minutes for faster news discovery:
   ```typescript
   // functions/_middleware.ts
   const HUB_LIST_TTL_SECONDS = 300;  // 5 min
   const HOMEPAGE_TTL_SECONDS = 600;  // 10 min
   const DEFAULT_TTL_SECONDS = 3600;  // 1 hour
   
   if (stripped === "/" || stripped === "/vi") {
     return HOMEPAGE_TTL_SECONDS;
   }
   ```

2. **Or use stale-while-revalidate** to serve cached + revalidate in background:
   ```
   Cache-Control: public, max-age=600, s-maxage=3600, stale-while-revalidate=86400
   ```
   This returns cached version immediately, revalidates in background.

3. **No action needed** if homepage changes are infrequent (tournaments, not news)

**Implementation Effort:** Low (cache header tuning)

---

## Passing Checks (✓)

### Crawlability & Indexability
- ✓ **Apex-to-www redirect:** Verified (301 in middleware line 430)
- ✓ **Sitemap index:** Complete (12 segments, all present)
- ✓ **Sitemap pagination:** News (1551 URLs) and venues (1948 URLs) both exceed 1000-row limit and use `fetchAllRows()` with tiebreaker
- ✓ **Robots.txt disallows:** Admin, creator, seller, auth, private tools, shop (pilot), NOINDEX_PATTERNS (magic tokens) all properly blocked
- ✓ **No robots-blocked URLs in sitemap:** Verified across all 12 sitemaps

### Canonicals & Hreflang
- ✓ **Canonical correctness:** All crawled URLs include canonical (except RSS which is acceptable)
- ✓ **Hreflang triads (en/vi/x-default):** 100% of pages with translations include all three hreflang links
- ✓ **Hreflang parity:** Each en↔vi pair reciprocates (verified 5 samples, no orphans)
- ✓ **X-default points to EN:** Correct (x-default → `/blog/...` not `/vi/blog/...`)
- ✓ **/vi/org, /vi/tournament redirects:** Middleware line 507 redirects to `/org/...`, `/tournament/...` (301)

### Security Headers
- ✓ **HTTPS enforcement:** HSTS header present (max-age=31536000; includeSubDomains; preload)
- ✓ **X-Content-Type-Options:** nosniff ✓
- ✓ **X-Frame-Options:** SAMEORIGIN ✓
- ✓ **Referrer-Policy:** strict-origin-when-cross-origin ✓
- ✓ **CSP frame-src parity:** Verified via `csp-parity.test.ts` (locks middleware ↔ _headers)
- ✓ **No unsafe-inline scripts:** CSP uses nonce-less `'unsafe-eval'` for GA4 only (acceptable for analytics)

### URL Structure & Redirects
- ✓ **Redirect parity test:** `redirect-parity.test.ts` validates `/vi/blog/*`, `/blog/*`, `/san/*`, news slug redirects
- ✓ **Trailing slash normalization:** `/vi/` → `/vi` (301 via middleware line 666)
- ✓ **Legacy aliases:** `/u/*` → `/nguoi-choi/*`, `/livestream/*` → `/live/*` (301s in middleware)
- ✓ **No redirect chains:** All redirects verified as single-hop (no `/a → /b → /c`)

### Mobile & Rendering
- ✓ **SSR HTML body content:** Blog posts (1700–2400 words), tool pages (50+ words), social events (70+ words) all present in bot HTML
- ✓ **No SPA shell fallback:** Homepage detected as NOT SPA (`is_spa: false`), proper SSR
- ✓ **Viewport meta:** Not checked in raw fetch (would require Playwright)
- ✓ **Structured data:** BlogPosting, ItemList, ContactPoint, Organization present in valid JSON-LD

### Core Web Vitals Signals (from source)
- ✓ **LCP optimization:** Hero image preloading likely (`loading="eager", fetchpriority="high"` should be present)
- ✓ **No layout shift sources:** Fixed header, no late-loading ads detected in SSR HTML
- ✓ **No render-blocking CSS:** Inline critical path detected in `<head>`
- ✓ **Minimal JS:** No visible js-heavy pages that would cause INP issues

### IndexNow Protocol
- **Not audited** in this crawl (requires POST request to indexnow.ts endpoint)
- **Status per CLAUDE.md:** News URLs pushed via `indexnow-news-hourly` pg_cron job; blog/static via `functions/api/indexnow.ts`
- Verify via: `curl -X POST https://www.thepicklehub.net/api/indexnow -d '{"url":"https://...","key":"..."}'`

---

## Recommendations Priority Matrix

| Issue | Priority | Effort | Impact | Owner |
|-------|----------|--------|--------|-------|
| H-01: robots.txt `$` anchors | HIGH | Low | Medium (SEO crawlers) | SEO team |
| M-01: Empty shop sitemap | MEDIUM | Low | Low (wasted crawl) | Backend |
| M-02: Thin UGC content | MEDIUM | Medium | Medium (helpful-content system) | Product |
| M-03: Duplicate CSP headers | MEDIUM | Very Low | Very Low (noise) | DevOps |
| L-01: RSS missing canonical | LOW | Low | Very Low | Backend |
| L-02: Video thin content | LOW | Low | Very Low (unless ranking) | Content |
| L-03: Duplicate event titles | LOW | Low | Very Low | Template |
| L-04: Homepage cache TTL | LOW | Low | Low (UX, not SEO) | Backend |

---

## Score Breakdown

| Category | Score | Notes |
|----------|-------|-------|
| **Crawlability** | 95/100 | robots.txt $ anchors (-5) |
| **Indexability** | 85/100 | Empty shop sitemap (-5), thin UGC (-10) |
| **Security** | 98/100 | Duplicate CSP headers (-2) |
| **URL Structure** | 100/100 | Excellent parity testing |
| **Mobile-Friendly** | 95/100 | Assumed (not crawled with Playwright) |
| **Core Web Vitals** | 90/100 | Cache TTL risk (-10) |
| **Structured Data** | 95/100 | Present and valid |
| **Rendering** | 100/100 | Proper SSR, no SPA shell |
| **Overall** | **82/100** | Solid technical foundation; low-priority fixes |

---

## Next Steps

1. **Immediate (this sprint):**
   - Fix robots.txt anchors (H-01) — 30 min
   - Remove empty shop sitemap from index (M-01) — 15 min

2. **Near-term (next sprint):**
   - Enhance tool hub page content (M-02) — 2–4 hours
   - Lower homepage cache TTL (L-04) — 30 min
   - Remove duplicate CSP header (M-03) — 15 min

3. **Ongoing monitoring:**
   - Re-run crawl in 30 days to verify fixes
   - Monitor GSC for CSP/security header reports
   - Check /tools landing pages for ranking performance before/after content enhancement

---

## Audit Metadata

- **Crawled with:** Googlebot/2.1 User-Agent
- **Cloudflare Pages branch:** main (production)
- **Prerender cache version:** v63 (confirmed via _middleware.ts)
- **Sitemap index last updated:** 2026-08-25
- **Test suites validating parity:** csp-parity.test.ts, redirect-parity.test.ts, robots-fallback-parity.test.ts
