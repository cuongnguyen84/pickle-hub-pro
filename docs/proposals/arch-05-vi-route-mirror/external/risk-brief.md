# Change under review: collapse a duplicated `/vi/*` route mirror in a React SPA

## Product context
- Bilingual (Vietnamese/English) React 18 + React Router **v6.30** SPA. ~2000 real users, ~95% Vietnamese. Solo maintainer.
- SEO is the lifeblood. 63 `/vi/*` URLs are already indexed by Google. Rule: URLs must NOT change (byte-identical) and indexed VI pages must keep rendering VI content.
- Bots get server-side prerendered HTML from a Cloudflare Pages middleware that reads the raw URL string (strips the `/vi` prefix via regex, dispatches to per-route renderers). This SSR path is DECOUPLED from React Router config — it does not import the router. Real (non-bot) users get an `index.html` shell + JS bundle; React Router then matches client-side.
- Catch-all route `path="*"` → a NotFound (404) page.

## The proposed change
Today `src/App.tsx` hand-writes 192 `<Route>` elements. 129 are EN routes; 63 of those have an exact `/vi`-prefixed mirror (same path with `/vi` prepended; no translated slugs). The proposal: collapse the 63 duplicated `/vi/*` entries into a single declaration — either a wrapper route (`<Route path="/vi/*">` containing a nested `<Routes>`), or a route-config array mapped twice (once bare, once with `/vi` prefix).

## Known non-uniformity of the mirror (this is the crux)
The 63 mirrors are NOT identical transformations:
1. Most `/vi/*` routes wrap the page in `<ViLanguageWrapper>` (a component whose `useEffect` flips i18n language to "vi" and sets `document.documentElement.lang="vi"`, restoring "en" on unmount).
2. BUT 3 real pages deliberately OMIT the wrapper (`/vi/rankings`, `/vi/feed`, `/vi/social/:slug/live`) — they rely on a mount-time `getInitialLanguage()` that reads the URL on hard-load only.
3. `/blog/:slug` renders component `BlogPost`; `/vi/blog/:slug` renders a DIFFERENT component `ViBlogPost`.
4. `/news/:slug` renders `<NewsArticle language="en"/>`; `/vi/news/:slug` renders `<NewsArticle language="vi"/>`. Bare `/news` passes NO language prop (self-detects).
5. Some `/vi/*` routes nest extra auth wrappers inside the language wrapper (`<ViLanguageWrapper><ConditionalAuth>...`), others add `<RequireAuth>`. 6 routes have these auth-nesting variants.
6. Language flip on client-side SPA navigation (no full reload) happens ONLY via `ViLanguageWrapper`'s effect. On hard-load, a separate mount-time function sets language regardless of wrapper.

## Test coverage reality
- ZERO routing tests. No test asserts the set of route paths, EN/VI parity, or that a given path maps to the right component/props.
- Smoke tests touch exactly one `/vi` path (the `/vi` home).

## Rollback
- Pure client-side code. No DB migration, no native app-store build (the native Capacitor app loads the live remote URL, so a web deploy reaches native instantly — and reverts instantly too). `git revert` + redeploy works.

## Your task
You are a hostile staff SRE. Find the SPECIFIC failure this refactor causes in production. Name the mechanism, the trigger, the user-visible symptom. Focus especially on: (a) failure modes that are INVISIBLE to SEO/bot monitoring but hit real VN users, (b) ways the non-uniform mirror gets silently flattened wrong, (c) whether a single-wrapper-route vs config-array approach has different blast radius. Reject generic risk language. If a concern is actually safe given the decoupled SSR + ranked v6 matching, say so plainly.
