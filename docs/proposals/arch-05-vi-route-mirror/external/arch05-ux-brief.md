# ARCH-05 — collapse the /vi/* route mirror. UX-regression review brief

## Context
ThePickleHub: bilingual (Vietnamese-primary, ~95% VI users) pickleball web app.
React 18 + React Router v6 SPA + Vite. Mobile-dominant, users arrive mostly via
Facebook/Zalo deep links straight to a single page, mid-tier Android on 4G.

## The refactor (purely technical)
Today `src/App.tsx` hand-writes 63 Vietnamese routes as an exact prefix mirror of
63 English routes: e.g. `/tournaments` and `/vi/tournaments`, `/social/:slug` and
`/vi/social/:slug`. Path-segment divergence is zero — every VI path is the EN path
with a literal `/vi` prefix. Goal: declare each route ONCE and generate the `/vi`
mirror from a config array or a single wrapper route. Hard constraint: the resulting
URLs must be byte-identical to today's (VI URLs are indexed; SEO is the lifeblood).

## The language mechanism (this is where behavior can regress)
1. `getInitialLanguage()` runs before first render: if `window.location.pathname`
   starts with `/vi`, language = "vi". So a HARD LOAD of any /vi/* URL is correct
   regardless of route config.
2. `<ViLanguageWrapper>` wraps MOST /vi routes. Its `useEffect` on mount calls
   `setLanguageFromUrl("vi")` (loads VI dictionary), sets `<html lang=vi>`, and on
   UNMOUNT runs cleanup `setLanguageFromUrl("en")` + `<html lang=en>`. This is the
   only thing that flips language on client-side SPA navigation (no full reload).
3. `<LanguageSwitcher>` (EN|VI toggle in header) is DECOUPLED from the route table.
   It does a pure string transform: EN->VI `navigate("/vi"+pathname+search)`,
   VI->EN `navigate(pathname.replace(/^\/vi/,"")||"/"+search)`. Does not read the
   route config at all.
4. `<ScrollToTop>` (mounted outside <Routes>) resets `window.scrollTo(0,0)` and
   moves focus to `#main-content` on every PUSH/REPLACE navigation (keyed on
   pathname), leaves POP (back/forward) to browser-native restoration.

## The special cases the naive "map EN routes with /vi prefix" would flatten wrong
- `/blog/:slug` renders component `BlogPost`; `/vi/blog/:slug` renders a DIFFERENT
  component `ViBlogPost` (VI blog posts have their own slugs/content, stored
  separately). A flat prefix map would render BlogPost at /vi/blog/:slug -> VI blog
  readers get the wrong component / broken page.
- `/vi/news/:slug` = `<NewsArticle language="vi"/>` vs `/news/:slug` =
  `<NewsArticle language="en"/>`; `/vi/news` = `<News language="vi"/>` vs `/news` =
  `<News/>` (self-detects locale).
- 3 routes DELIBERATELY OMIT ViLanguageWrapper today: `/vi/feed` (Feed),
  `/vi/rankings` (Rankings), `/vi/social/:slug/live` (SocialEventLive, a live
  court-side real-time scoring page). All three read `useI18n().language` to decide
  what to render. On hard-load they are correct (getInitialLanguage). On SPA nav
  they inherit whatever the context language currently is. Reason for omission was
  never documented — could be intentional (avoid dictionary reload flash on a live
  page) or just oversight/inconsistency.
- 66 other EN routes (admin/*, creator/*, auth, /clb/*, catch-all) have NO /vi
  mirror at all.

## Questions
1. Which real USER behaviors can regress if the 63 pairs collapse to one
   declaration? Rank by severity.
2. The 3 currently-unwrapped routes: if the config wraps ALL /vi routes uniformly
   in ViLanguageWrapper, SPA-navigation INTO those routes would now flip language
   via the wrapper (today it doesn't; a VI user who SPA-navigates into /vi/feed
   after leaving a wrapped /vi page — whose unmount reset language to "en" — can
   currently see the feed in ENGLISH). Is uniform wrapping a fix or a risk? What
   would you check before shipping it, especially for the live scoring page?
3. Any risk to the LanguageSwitcher toggle, scroll restoration, or focus handling?
4. 404: /vi/<nonexistent> hits the catch-all NotFound (no wrapper). Hard-load shows
   VI (getInitialLanguage); SPA-nav from a /vi page could show EN. Worth fixing in
   the same refactor or leave it?
Be concrete: name the exact element and the exact fix. No generic platitudes.
