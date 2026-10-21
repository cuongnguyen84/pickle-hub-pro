# ThePickleHub Performance Audit — Core Web Vitals (2026-08-25)

> ## ⚠️ CORRECTION (verified by orchestrator, 2026-08-25)
>
> This report repeatedly describes LCP as **"declining / worsening"**. That reading is inverted.
> The quoted numbers are LCP **2684ms (6/14–7/11) → 2485ms (7/26–8/22)**: lower LCP is *better*, so the
> trend is an **improvement of ~200ms**, not a regression. CLS likewise moved **0.68 → 0.35**, also an
> improvement.
>
> The corrected reading: **both metrics are trending in the right direction, but CLS (0.35) still fails
> the 0.25 "poor" threshold outright and LCP (2485ms) sits ~15ms under the 2500ms pass line.**
> CLS remains the top priority; the urgency comes from the absolute value, not from a downward trend.
>
> All measurements, per-page tables and recommended fixes in this file stand.


## Executive Summary

**Origin-Level Field Data (CrUX Mobile, p75):**
- **LCP**: 2485ms — BORDERLINE PASS (good threshold: 2500ms), declining trend
- **CLS**: 0.35 — FAILING (good threshold: 0.1, poor threshold: 0.25)
- **INP**: Insufficient data (last value 133ms when available — GOOD)
- **FCP**: 1079ms — PASS (< 1800ms, 90% good)
- **TTFB**: 638ms — PASS (< 800ms, 86% good)

**Status**: Two of three primary CWV metrics are at risk. **CLS is the primary blocker** (31.4% of mobile visits are poor), and LCP is marginally passing with a declining trend.

---

## Field Data vs. Lab Data Discrepancy

### Field Data (CrUX, real users 28-day window)
Mobile (Origin-level, p75 as of 2026-08-22):
| Metric | p75 | Rating | Good % | Needs Improv. % | Poor % |
|--------|-----|--------|--------|-----------------|--------|
| TTFB | 638ms | Fast | 85.9% | 11.3% | 2.8% |
| FCP | 1079ms | Fast | 90.0% | 4.1% | 5.9% |
| LCP | 2485ms | Average | 75.3% | 18.8% | 5.9% |
| CLS | 0.35 | Slow | 58.8% | 9.8% | 31.4% |

**Trend**: LCP declining from 2684ms (6/14-7/11) to 2485ms (7/26-8/22), though still marginal. CLS improving from 0.68 to 0.35 over the same period (positive signal).

### Lab Data (PageSpeed Insights Mobile)
Home page (EN, single Lighthouse run):
| Metric | Lab Value | Score |
|--------|-----------|-------|
| FCP | 3976ms | 0.23 |
| LCP | 9644ms | 0 |
| CLS | 0.207 | 0.6 |
| Total Blocking Time | 3ms | 1.0 |
| Speed Index | 5315ms | 0.58 |
| Interactive | 9688ms | 0.29 |

**Lab vs. Field Gap**: Lab LCP of 9.6s vs. field 2.5s is a 3.8x difference — suggests the lab throttle (Lighthouse's simulated 4G) is overly aggressive OR the lab test encountered an unoptimized code path. The field data is more representative since it reflects real Vietnamese mobile users on actual networks.

**Performance Score**: 53 (mobile) / 67 (desktop)

---

## Key Findings by Impact

### 1. Cumulative Layout Shift (CLS) — CRITICAL FAILURE
**Status**: 0.35 p75 (31.4% of visits poor)

**Lab Root Cause**: Lighthouse detected 2 large layout shifts:
1. A section element (`.tl-section`) with 0.1916 score
2. An inline text/content element with 0.0154 score

**Specific Issues**:
- **Feed timeline expansion**: The main content area (`.tl-root > .tl-scroll`) shifts as new content loads dynamically without reserved space
- **Image loading without dimensions**: The hero/livemain image from Google Drive loads without explicit width/height, causing reflow
- **Late font loading**: Font `font-display: swap` can cause FOIT (Flash of Invisible Text) before @font-face loads, but fonts are preloaded so risk is low

**Expected Impact**: 31.4% of mobile users see poor CLS; cumulative shift > 0.25 affects user experience negatively.

**Concrete Fixes**:
1. **Preload/fetchpriority on hero image** (Google Drive image at `lh3.googleusercontent.com/d/1q1xC3RynySdrYNscwFZ7eqSi1twj5a5q=w768`):
   ```tsx
   // In the component rendering the hero image
   <img 
     src="..." 
     alt="..."
     width={768}  // Explicit dimensions
     height={432} // (calculate based on aspect ratio)
     loading="eager"
     fetchpriority="high"
     decoding="async"
   />
   ```
2. **Container queries or aspect-ratio for feed cards**: Set `aspect-ratio` on feed items to reserve space before images load
   ```css
   .tl-section {
     container-type: inline-size;
     aspect-ratio: 9 / 16; /* or match your content */
   }
   ```
3. **Delay dynamic content injection**: Use `waitForLoadingStates` pattern instead of immediately rendering new posts; wait until previous posts' images are loaded before injecting next batch

---

### 2. Largest Contentful Paint (LCP) — BORDERLINE CRITICAL
**Status**: 2485ms p75 (75.3% good, but declining)

**Lab LCP**: 9.6s (grossly unoptimized lab run)

**Root Causes**:
1. **Render-blocking CSS**: `index-PZm3LViP.css` (45.6 kB transfer) blocks render for 1811ms estimated waste
   - The CSS is loaded render-blocking in the `<head>` with no async/defer equivalent
   - Inline critical CSS (current approach) is good, but the remaining CSS should be deferred
2. **Hero image not preloaded**: Google Drive image is discovered late in the load waterfall
   - Preconnect exists but no explicit preload with fetchpriority
3. **Large image file size**: The hero image is 548 kB (unoptimized for mobile width)
   - The URL shows `w=768`, but actual rendered size on mobile is likely 400-430px
   - Estimated 508 kB waste (93% of the file is unused)
4. **JavaScript execution delay**: Supabase + React hydration delay before LCP resource is fetched
   - vendor-supabase (215 kB) loads before the page content is interactive

**Field Trend**: LCP is declining (worsening) from 2684ms → 2485ms. This marginal pass will fail if trend continues.

**Concrete Fixes**:
1. **Preload hero image aggressively**:
   ```html
   <!-- In index.html <head> -->
   <link rel="preload" as="image" href="https://lh3.googleusercontent.com/d/1q1xC3RynySdrYNscwFZ7eqSi1twj5a5q=w768" 
     imagesizes="(max-width: 640px) 430px, 768px"
     imagesrcset="https://...w430 430w, https://...w768 768w" />
   ```
2. **Defer non-critical CSS**:
   ```html
   <!-- Move to end of <body> or use rel="stylesheet" with onload -->
   <link rel="stylesheet" href="..." media="print" onload="this.media='all'" />
   ```
3. **Optimize hero image delivery**:
   - Use WebP/AVIF fallback via `<picture>` element
   - Serve responsive srcset (w=430, w=600, w=768)
   - Consider self-hosting the image on Cloudflare KV if Google Drive is the bottleneck
4. **Defer Supabase initialization**:
   - Only initialize realtime subscriptions after FCP (move to `useEffect`)
   - Load vendor-supabase asynchronously after the entry chunk

---

### 3. Render-Blocking CSS — HIGH IMPACT
**Status**: 1811ms estimated waste (index-PZm3LViP.css)

**Cause**: The full stylesheet is loaded render-blocking in `<head>` without async deferred pattern.

**Fix**:
```tsx
// In vite.config.ts, add CSS splitting for above/below-the-fold
// OR manually create critical.css with just shell/header/hero styles,
// defer the rest:

// index.html
<style>/* Critical inline CSS (already done) */</style>
<link rel="stylesheet" href="/assets/index.css" media="print" onload="this.media='all'" />
<noscript><link rel="stylesheet" href="/assets/index.css" /></noscript>
```

This could save ~200-300ms of FCP.

---

### 4. Unused JavaScript — MEDIUM IMPACT
**Status**: 115 kB (estimated waste)

**Breakdown**:
- **vendor-supabase**: 43 kB unused (realtime subscriptions not needed on home)
- **vendor-ui**: 42.5 kB unused (UI components for admin/shop routes not loaded)
- **index (entry)**: 31.7 kB unused

**Why It Matters**: Unused JS delays FCP and blocks main thread during parsing. On Vietnam mobile (often 3G), 115 kB over a slow connection adds 1-2s to load time.

**Fixes**:
1. **Code-split vendor-supabase** — only import realtime on pages that need it:
   ```tsx
   const RealtimeSubscriber = React.lazy(() => import('./realtime/RealtimeSubscriber'));
   // Only render on feed, tournament detail, etc.
   ```
2. **Tree-shake unused Radix UI components**:
   - Audit which Radix components are actually used
   - Split vendor-ui into vendor-ui-core (Dialog, Tabs, Tooltip) and vendor-ui-optional (Dropdown, Popover) 
   - Only ship core to home page
3. **Dynamic import for admin/shop features**:
   ```tsx
   const AdminLayout = React.lazy(() => import('./admin/AdminLayout'));
   const ProtoShop = React.lazy(() => import('./proto/shop/ProtoShopApp'));
   ```

---

### 5. Image Delivery Optimization — MEDIUM-HIGH IMPACT
**Status**: 637 kB estimated waste

**Issues**:
1. **Unoptimized hero image** (Google Drive, 548 kB → 508 kB waste)
   - Not WebP/AVIF
   - No responsive srcset
   - Width mismatch (fetching w=768 for mobile < 430px)

2. **DUPR partnership strip** (dupr-strip.png, 85 kB → 75 kB waste)
   - PNG instead of WebP (no modernImageFormats detected)
   - No responsive variant

3. **News thumbnails** (small files 8-58 kB, 7-54 kB waste)
   - Unoptimized for thumbnail display

**Concrete Fixes**:
1. **Hero image**:
   ```tsx
   // Instead of raw <img src="...">
   <picture>
     <source srcset="/images/hero-home-430.avif 1x, /images/hero-home-860.avif 2x" type="image/avif" media="(max-width: 640px)" />
     <source srcset="/images/hero-home-768.webp 1x, /images/hero-home-1536.webp 2x" type="image/webp" />
     <img src="/images/hero-home-768.jpg" alt="..." loading="eager" fetchpriority="high" width={768} height={432} />
   </picture>
   ```
2. **DUPR strip**: Convert PNG to WebP (no AVIF needed for partnership graphics)
3. **CDN image optimization**: Leverage Cloudflare Image Resizing or Supabase Storage image transformation

---

### 6. Long Tasks & Main-Thread Blocking — MEDIUM IMPACT
**Status**: 1 long task (56ms), desktop TBT 420ms

**Cause**: Script evaluation taking 380ms, style/layout taking 189ms, other work 194ms.

**Issues**:
- React reconciliation during hydration blocks main thread
- No visible breakup of heavy operations into chunks < 50ms
- Supabase client initialization during hydration

**Fixes**:
1. **Defer heavy initialization**:
   ```tsx
   // src/main.tsx
   setTimeout(() => {
     initRealtimeSubscriptions();
     initAnalytics();
   }, 0);
   ```
2. **Use requestIdleCallback** for non-critical work:
   ```tsx
   if ('requestIdleCallback' in window) {
     requestIdleCallback(() => prefetchData());
   } else {
     setTimeout(prefetchData, 2000);
   }
   ```
3. **Split bundle to reduce parse/compile time**:
   - The entry chunk (217 kB) + vendor-ui (265 kB) = 482 kB of JS
   - Parse time alone is ~800ms on slow mobile
   - Split vendor-ui into two chunks: core + optional

---

### 7. Desktop Performance — Below Target
**Lab Metrics (Desktop)**:
- LCP: 1876ms (GOOD, 0.67 score)
- FCP: 641ms (EXCELLENT, 0.98 score)
- CLS: 0.018 (EXCELLENT, 1.0 score)
- TBT: 421ms (NEEDS IMPROVEMENT, 0.38 score)

Desktop field LCP (2035ms) is GOOD but TBT is high due to long script execution.

---

## Lighthouse Audits Summary

| Category | Status | Impact |
|----------|--------|--------|
| **Layout Shifts** | 2 shifts found | CLS failing |
| **Render-Blocking CSS** | 45.6 kB, 1811ms waste | High FCP delay |
| **Unused JavaScript** | 115 kB | Delays FCP, blocks main thread |
| **Unused CSS** | 35 kB | Minimal impact |
| **Image Delivery** | 637 kB savings available | Hero image is 93% waste |
| **Cache Lifetimes** | Cloudflare beacon 1-day TTL | Repeat visit slowdown |
| **Long Tasks** | 1 × 56ms task | Blocks interactivity briefly |
| **Console Errors** | Supabase WebSocket failures (lab-only, DNS isolation) | Benign in lab |

---

## Bundle Analysis

**Gzipped Sizes** (Production Build):
| Chunk | Size | Notes |
|-------|------|-------|
| vendor-video | 250 kB | Mux player + hls.js (lazy-loaded route) |
| vendor-ui | 83.8 kB | Radix UI components (core + optional, could split) |
| index (entry) | 66.7 kB | Main app logic, React router, hooks |
| vendor-supabase | 55.9 kB | Supabase client (used on all pages even if realtime not needed) |
| locale-en | 35.1 kB | EN translation dictionary (deferred correctly) |
| locale-vi | 37.6 kB | VI translation dictionary (deferred correctly) |

**Precache** (PWA): 39 entries, 1.6 MB (includes all above + fonts + icons)

---

## Recommendations by Priority

### P0 — CLS Fix (Critical, 1-2 days)
1. Add explicit width/height to hero image + fetchpriority
2. Add aspect-ratio to feed timeline cards
3. Ensure all dynamic content gets reserved space

**Expected Impact**: CLS 0.35 → 0.15 (40% failure rate → 5-10%)

### P1 — LCP Optimization (Critical, 2-3 days)
1. Preload hero image with correct srcset
2. Defer non-critical CSS
3. Optimize hero image format + size (WebP, AVIF, responsive)
4. Lazy-load Supabase realtime until after FCP

**Expected Impact**: LCP 2485ms → 1800ms (below good threshold, stop declining trend)

### P2 — Render-Blocking CSS (High, 1 day)
1. Inline critical styles (already done)
2. Defer rest of CSS with media="print" + onload trick

**Expected Impact**: FCP 1079ms → 900ms, LCP ~2000ms

### P3 — Code-Split Vendor Chunks (Medium, 2-3 days)
1. Extract vendor-ui core from optional UI components
2. Lazy-load Supabase realtime
3. Defer analytics/GA4 initialization

**Expected Impact**: Entry chunk < 150 kB, FCP < 800ms lab

### P4 — Image Optimization (Medium, 1-2 days)
1. Convert hero image to WebP/AVIF with responsive srcset
2. Convert DUPR partnership strip to WebP
3. Implement image CDN (Cloudflare Image Resizing or Supabase Storage)

**Expected Impact**: LCP -200ms (faster image download), CLS -0.05 (smaller layout shift)

### P5 — Long Tasks & Main-Thread Work (Low, ongoing)
1. Use requestIdleCallback for non-critical initialization
2. Break React reconciliation into chunks < 50ms (React 19 compiler helps)
3. Monitor with PerformanceObserver for long tasks in production

**Expected Impact**: TBT 421ms → 250ms (desktop), smoother interactivity

---

## Monitoring & Next Steps

1. **Deploy fixes in this order**: CLS → LCP → CSS defer → Code-split → Image opt
2. **After each deploy**, run CrUX History API query to confirm field data improves
3. **Set CWV alerts**: Alert if LCP > 2600ms or CLS > 0.25 for 3+ days
4. **Use Web Vitals library** in production:
   ```tsx
   import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';
   getCLS(console.log);
   getLCP(console.log);
   getFCP(console.log);
   getTTFB(console.log);
   ```
5. **Test on real Vietnam networks**: Use Chrome DevTools throttling or WebPageTest with Vietnam proxy

---

## References

- **Lab Tool**: Lighthouse 13.4.0 via PageSpeed Insights API
- **Field Tool**: CrUX History API (28-day rolling window, p75 metric)
- **Test URLs**: 
  - EN Home: `https://www.thepicklehub.net/`
  - VI Home: `https://www.thepicklehub.net/vi`
- **Config Files**:
  - Bundling: `vite.config.ts` (manual chunks, PWA precache)
  - Fonts: `index.html` (inlined @font-face, preload links)
- **Audience**: ~95% Vietnam mobile (3G/4G networks)

---

## Appendix: CrUX Field Data Trend (p75)

```
Date Range              LCP     FCP     CLS     Status
2026-06-14–07-11       2684ms  1219ms  0.68    ⚠️ Poor CLS, declining LCP
2026-06-21–07-18       2423ms  1127ms  0.67    ⚠️ CLS worse
2026-06-28–07-25       2331ms  1098ms  0.62    ⚠️ CLS still poor
2026-07-05–08-01       2346ms  1035ms  0.4     ⚠️ CLS improving
2026-07-12–08-08       2346ms  1035ms  0.37    ✅ CLS trend better
2026-07-19–08-15       2485ms  1079ms  0.35    ⚠️ LCP worsening, CLS recovering
```

**Interpretation**: CLS is recovering month-over-month, but LCP is worsening (heading toward failure). Immediate action on LCP preloading + CSS deferral needed.
