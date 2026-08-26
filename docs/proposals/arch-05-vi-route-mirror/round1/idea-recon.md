# ARCH-05 recon: collapse `/vi/*` route mirror in `src/App.tsx`

Read-only recon. No design/recommendation.

## 1. Route counts (verified by grep, not the roadmap's "~45" estimate)

- Total `<Route>` elements in `src/App.tsx`: **192** (`grep -c '<Route path=' src/App.tsx`)
- Real `/vi/*` routes (excluding false-positive `/videos`): **63** — `src/App.tsx:567-787` (two clusters: social/venues/etc. interleaved with EN routes lines 567-661, then a dedicated "Vietnamese /vi/* routes" block at `src/App.tsx:743-787`)
- EN (non-`/vi`) routes: **129**
- Of the 129 EN routes, **63 have an exact `/vi`-prefixed mirror**, **66 have no `/vi` mirror at all** (admin/*, creator/*, auth/*, match/*, share/*, embed/*, legacy quick-tables/su-kien aliases, `/tran-dau/*`, `/nguoi-choi/:username`, `/clb/*`, `/dupr`, `*` catch-all — full list captured during recon, all intentionally VI-agnostic surfaces: admin, creator, auth callbacks, or already-Vietnamese canonical paths).
- **Path-segment divergence: zero.** Every one of the 63 `/vi/*` paths is the EN path with a literal `/vi` prefix prepended — no case where the segment itself is translated (e.g. no `/vi/giai-dau/:id` vs `/tournament/:id`). Verified programmatically: stripping `/vi` from all 63 VI paths produces an exact string match against the EN path list with 0 mismatches. So the mirror is a pure prefix map, not a translated-slug map.

## 2. Component divergence between EN/VI

- **Different component:** `/blog/:slug` → `BlogPost` (`src/App.tsx:664`) vs `/vi/blog/:slug` → `ViBlogPost` (`src/App.tsx:755`). Only pair using two distinct page components.
- **Same component, prop-driven:** `/news/:slug` → `<NewsArticle language="en" />` (`src/App.tsx:656`) vs `/vi/news/:slug` → `<ViLanguageWrapper><NewsArticle language="vi" /></ViLanguageWrapper>` (`src/App.tsx:753`). `/news` (no slug) has no `language` prop and self-detects (comment `src/App.tsx:652-654`: "reads language from i18n context (geo-aware)").
- **Same component, no wrapper, reads locale from elsewhere:** 3 real page routes intentionally skip `ViLanguageWrapper`: `/vi/social/:slug/live` → `SocialEventLive` (`src/App.tsx:585`), `/vi/rankings` → `Rankings` (`src/App.tsx:658`), `/vi/feed` → `Feed` (`src/App.tsx:661`). (Two more `/vi/*` entries without the wrapper are `Navigate` alias redirects, not pages: `/vi/su-kien` and `/vi/su-kien/:slug/live`, `src/App.tsx:588,593`.)

## 3. Language-set mechanism — two layers, route-structure-dependent

- `src/i18n/loader.ts:13-14` — `isVietnamesePath(pathname) = pathname === "/vi" || pathname.startsWith("/vi/")`. This is the single source of truth for "is this a VI path," used in two places:
  1. **On mount** — `src/i18n/index.tsx:41-64` (`getInitialLanguage`) checks `isVietnamesePath(window.location.pathname)` *before* any component renders, so a hard load of any `/vi/*` URL is already VI by the time `I18nProvider` renders children — independent of whether the matched `<Route>` uses `ViLanguageWrapper`.
  2. **On client-side SPA navigation** — `ViLanguageWrapper` (`src/components/layout/ViLanguageWrapper.tsx`) is the *only* mechanism that flips language via `useEffect` + `setLanguageFromUrl` when the route tree re-renders without a full page reload. It also sets `document.documentElement.lang`.
  3. Geo-detection (`src/i18n/index.tsx:139-186`) explicitly bails if `isVietnamesePath` is true (line 143, 171) — geo must never override an explicit `/vi/*` URL.
- **Consequence relevant to any route-collapse:** the 3 routes noted in §2 that omit `ViLanguageWrapper` rely on `getInitialLanguage()` being correct on hard-load; SPA-internal navigation into those exact routes without a full reload would not flip language via the wrapper effect (unverified in a browser during this recon — noted as observed code path, not tested behavior).

## 4. ARCH-01 dependency status

`docs/roadmap-8.5-9.md:199`: `ARCH-01 | done | 2d | Define feature/domain module boundaries and dependency rules | BASE-04`. Shipped 2026-07-16, PR #334, deliverable `docs/architecture-boundaries.md` (`docs/roadmap-8.5-9.md:356`). ARCH-05 itself: `docs/roadmap-8.5-9.md:203`, status `later`, depends on `ARCH-01` — dependency is satisfied.

## 5. Prior art / precedent

- **No route-config array exists anywhere in the repo** — `grep -rn "RouteConfig\|routeConfig\|routes.map\|createBrowserRouter" src` returned zero matches. All 192 routes are hand-written JSX `<Route>` elements directly in `src/App.tsx`.
- Lazy loading: all pages go through a `lazyRetry()` wrapper (`src/App.tsx:36-44`) built on `React.lazy` + a 1.5s-delayed single retry on chunk-load failure; three special-case routes use plain `lazy()` for named exports (`src/App.tsx:159-167`, `QuickTableRedirects.tsx`).
- **No `.legacy.tsx` files are currently routed** — `find src/pages -name "*.legacy.tsx"` and `grep '\.legacy' src/App.tsx` both empty. CLAUDE.md's legacy-rollback pattern exists as a convention but has no live instance in the router right now.
- **No dedicated routing test suite.** `tests/smoke.spec.ts:160` and `tests/visual.spec.ts:46` each touch exactly one `/vi` path (`/vi` home) as part of broader smoke/visual suites — not a systematic EN/VI route-parity test. No unit test asserts the mirror set is complete or consistent.

## 6. SEO/prerender surface — decoupled from client route structure

- `functions/_middleware.ts:184` strips the `/vi` prefix by regex (`pathname.replace(/^\/vi(?=\/|$)/, "") || "/"`) and dispatches to `renderX(..., lang)` handlers based on presence/absence of that prefix in the raw request path — **this logic reads the URL string directly, not React Router config**. A client-side route-collapse refactor (wrapper route or config array) does not touch this file and is safe for prerender as long as the resulting URLs are byte-identical to today's.
- Several existing 301 redirects already normalize `/vi` variants server-side ahead of the middleware's own dispatch: `/vi/org|tournament|watch/:slug` canonical fixes (`functions/_middleware.ts:219-236`), `/vi/livestream` → `/vi/live` (`:237-253`), `/vi/blog/:slug` → EN canonical (`:254-300`), `/vi/` trailing-slash collapse (`:301-308`).
- Sitemap segments carrying `/vi` URLs (hreflang `xhtml:link`, not separate VI-only sitemap files): `functions/sitemap-events.xml.ts`, `sitemap-organizations.xml.ts`, `sitemap-venues.xml.ts`, `sitemap-static.xml.ts`, `sitemap-news.xml.ts`, `sitemap-blog.xml.ts`, `sitemap-tournaments.xml.ts`, `sitemap-players.xml.ts`.

## 7. Legacy `.legacy.tsx` routing

None found. No `*.legacy.tsx` file exists under `src/pages/` in the current tree, and `src/App.tsx` references no `.legacy` import. Not a factor for this route table today.
