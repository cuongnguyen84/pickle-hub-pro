# Risk brief — JS gzip bundle optimization (ThePickleHub)

You cannot see the repo. Everything you need is below. Be concrete: name the
mechanism, the trigger, the user-visible symptom. Reject generic risk language.

## Product
- React 18 + Vite + vite-plugin-pwa SPA. ~2000 real users, ~95% Vietnamese mobile.
- Hosted on Cloudflare Pages (prod branch `main`, auto-deploy on push). SEO
  prerender for bots done by Cloudflare Pages Functions that build HTML strings
  from Supabase queries — they NEVER load the JS bundle.
- Capacitor native iOS/Android apps load the LIVE remote URL (not a bundled
  shell); the service worker is deliberately skipped inside the native WebView.
- One solo operator. No revert button for anything that needs app-store review,
  but native here just loads remote web so a web deploy reaches native instantly.

## The change (report first, then ship incrementally, each item approved separately)
Goal: (a) faster first load of `/` and `/vi`; (b) total gzipped JS aggregate from
1930 KB down under an 1800 KB advisory budget. CI gate is a hard 1970 KB (strict).
Four categories of work under consideration:
1. **Config chunking** — edit `manualChunks` in vite.config.ts. A known suspect:
   `react-dom/client` subpath import may not match the `"react-dom"` manualChunks
   key, so most of react-dom is bundled into the entry chunk instead of a vendor
   chunk. Fixing it changes which modules land in the entry vs vendor-react chunk.
2. **Deeper lazy-loading** — wrap more routes/components in React.lazy (dynamic
   import). ~95% of routes are already lazy; entry + a few heavy route chunks remain.
3. **Dependency swap** — e.g. replace recharts (~108 KB gz, used across admin +
   rankings pages) with a lighter charting lib.
4. **Dead-code deletion** — remove unused modules.

## Known production history (facts, already true today)
- 2026-07-11 OUTAGE: a hashed entry filename (`index-[hash].js`) got reused across
  two builds with DIFFERENT content while an immutable 1-year cache (browser/SW/CDN)
  pinned the old copy. Old users hung on a "Loading…" screen; React never mounted;
  no JS error. New users / preview URLs / curl all worked.
  - FIX TIER 1 (deployed, verified): entry filename now carries a build-unique
    token `index-[hash]-<BUILD_ID>.js` where BUILD_ID=Date.now().toString(36).
    Vendor/lazy chunks keep pure content-hash names so unchanged chunks stay cached.
  - FIX TIER 2 (deployed, verified): Cloudflare Pages Function intercepts /assets/*
    requests; if a hashed asset is missing it returns a real uncacheable 404 instead
    of the SPA index.html (which used to get pinned as "HTML-as-JS" for a year).
- Service worker (Workbox) precache is a WHITELIST of exact chunk-name globs:
  `assets/index-*.js`, `assets/vendor-react-*.js`, `assets/vendor-ui-*.js`,
  `assets/vendor-supabase-*.js`, `assets/vendor-query-*.js`, `assets/vendor-date-*.js`,
  `assets/vendor-capacitor-*.js`, `assets/types-*.js`, plus a few journey-screen
  route chunks (Index, Tournaments, Feed, SocialEventDetail, CreateSocialEvent).
  Everything NOT whitelisted is served network-first then runtime-cached CacheFirst
  by a catch-all `/assets/*.js` rule. `locale-*` chunks are explicitly excluded
  from precache (one-language-only rule).
- lazyRetry() wraps dynamic imports: on import failure it retries once after 1.5s,
  then a ChunkErrorBoundary clears all caches + unregisters SW + reloads.
- CI: quality.yml runs lint/typecheck/unit/build + bundle-size gate (strict 1970 KB).
  Playwright e2e smoke on the preview URL. A post-deploy smoke on production with
  auto-revert. Playwright smoke has a history of deploy-race flakes.
- Bundle-size script sums gzip of ALL .js in dist/ (aggregate, not initial-load).
  Splitting/chunking redistributes but does NOT reduce the sum — only deletion or
  dependency cuts reduce total.

## Your job
For EACH of the 4 categories, find the specific way it breaks production and what
the user sees. Rank likelihood + impact. In particular pressure-test:
- Does renaming/reshaping a manualChunks vendor chunk break the SW precache whitelist,
  and what exactly does a user (fresh vs returning, online vs offline, PWA-installed
  vs browser tab) experience if `vendor-react-*.js` no longer matches?
- Given FIX TIER 1 + TIER 2 above, can a chunking change still reproduce the
  2026-07-11 "Loading…" outage, or is that class closed? Explain the mechanism.
- Dependency swap regression surface for charts on admin/rankings — concrete failure.
- Deeper lazy = more chunks = more chunk-404-after-deploy opportunities. Real risk
  or absorbed by lazyRetry + ChunkErrorBoundary?
If a category is genuinely safe given the mitigations, say so plainly and briefly.
