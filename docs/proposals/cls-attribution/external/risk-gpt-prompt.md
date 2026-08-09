# Hostile SRE review brief — "cls-attribution" change on ThePickleHub

You cannot see the repo. Everything you need is below. Be concrete: name the
mechanism, the trigger, the user-visible symptom. Reject generic risk language.
If a part of this is genuinely safe, say so plainly and briefly.

## The product

ThePickleHub — bilingual (Vietnamese/English) pickleball platform, ~2000 real
users, ~95% Vietnamese, solo-operated by one person (Cuong). Stack:

- React 18 + TypeScript + Vite SPA (client-side routing via react-router).
- Hosted on Cloudflare Pages, production branch `main`, auto-deploy on push.
  Assets are content-hashed. A separate Cloudflare Pages Functions middleware
  does SSR prerender for bot user-agents only (real users always get the SPA).
- Supabase (Postgres + Realtime + Edge Functions) backend.
- Livestreaming via Mux. Live chat + concurrent-viewer count via Supabase
  Realtime Presence.
- Native iOS/Android apps (Capacitor + a separate SwiftUI app) load the SAME
  remote production URL in a WebView — so a web deploy immediately reaches
  native users too, with no app-store review.
- A PWA service worker (`sw-v3.js`, workbox generateSW) precaches 39 entries
  (1.5 MB). `index.html` is deliberately excluded from precache; navigation
  requests use NetworkFirst with a 3s timeout. The SW registration is
  deliberately skipped inside the Capacitor native WebView.
- Analytics: Google Analytics 4 (standard/free property, id G-JQG63B6NX0).

## The problem being solved

Core Web Vitals CLS (Cumulative Layout Shift) for Vietnam + mobile is bad:
p75 ≈ 0.67 against a target of ≤ 0.10. Only 32.4% of CLS samples rate "good"
(the target is ≥75% good). LCP for the same segment is borderline-passing
(≈2423 ms against a 2500 ms target, ~73.7% good). Google's PageSpeed CWV
assessment for the origin currently reads "Failed", entirely due to CLS.

Lab tools (Lighthouse) report CLS 0.000 on the same pages. So the shifts are
not happening at initial paint; they accrue later in the page's life.

## The measurement pipeline as it exists today (all of this is already shipped)

`src/lib/webVitalsRum.ts` runs once at app boot from `main.tsx`:

- It bails out entirely in dev, when `navigator.webdriver` is true, or when
  `window.gtag` is undefined.
- It captures a `pageContext` ONCE at boot: `route` (the pathname at document
  load, with unknown path segments replaced by `:id`), `locale`,
  `device_class` (from `window.innerWidth`), `app_surface` (web /
  capacitor_ios / capacitor_android).
- It then dynamically `import("web-vitals/attribution")` inside
  `requestIdleCallback(..., {timeout: 3000})` and registers
  `onCLS/onFCP/onINP/onLCP/onTTFB` with DEFAULT options (i.e.
  `reportAllChanges` is false — CLS is reported once when the page is first
  hidden, and again on later hides if more shift accrued).
- Each report calls `gtag('event','web_vital', {...})` with ~17 params
  including `metric_name`, `metric_rating`, `metric_value`, `metric_id`,
  `route`, `market_segment` (vn/international/unknown, resolved server-side
  via a `/api/rum-context` fetch, cached in sessionStorage),
  `navigation_scope: "document"`, and a literal `sample_rate: 1` (there is NO
  actual sampling — every metric of every page load is sent).
- For CLS only it also attaches `cls_shift_target`
  (`attribution.largestShiftTarget`, a CSS selector string truncated to 100
  chars) and `cls_load_state`.

GA4 bootstrap in `index.html`:

- `gtag('config','G-JQG63B6NX0',{ send_page_view: false, debug_mode: true })`
  runs at document load. NOTE: `debug_mode: true` is hardcoded on in
  production.
- The gtag.js script itself is lazy-loaded — only on the first `pointerdown`,
  `keydown`, or `scroll`, or after a 60-second timeout, whichever comes first.
- A user-agent/`navigator.webdriver` guard prevents gtag from being defined at
  all for bots/headless/Lighthouse.
- On every SPA route change a React hook fires
  `gtag('event','page_view',{page_path, page_location, page_title})`.

GA4 custom dimensions registered so far (event-scoped): about 12, including
`metric_name` and `metric_rating` (registered 2026-07-28). NOT registered:
`cls_shift_target`, `cls_load_state`, `route`. Because they are unregistered,
the GA4 Data API cannot query them at all, and GA4 custom dimensions are NOT
retroactive — events sent before registration read as "(not set)" forever.

## The field data actually available (GA4, Vietnam + mobile, CLS only, 2026-07-29 → 2026-08-08)

Only the built-in `pagePath` dimension crossed with `metric_rating`. Full raw
table, n = 457 events (good 148 / poor 291 / needs-improvement 18):

```
/live/d7750a98...  poor=179  good=20  ni=10   <- one single livestream event
/login             good=90   poor=15  ni=2
/                  poor=37   good=15  ni=3
/live/3e211e67...  poor=22
/live/8ca98c2a...  poor=17
/live              good=3    poor=3
/live/d41a4662...  poor=3    ni=1
/live/10779a7c...  poor=2
/onboarding        good=6    ni=2
/org/tapickleball  poor=3
/auth/callback     poor=2
/vi                poor=2
/videos            good=2
/feed              poor=1
(~15 more blog/venue/news pages with 1 event each)
```

So: all `/live/*` pages together = 260 events, 226 of them poor (78% of all
poor). One single livestream contributes 179 of those 226.

## The page under suspicion: `/live/<uuid>` (file `src/pages/WatchLive.tsx`, ~592 lines)

Structure on mobile:
- While loading: a completely different DOM tree — a `tl-shell` container with
  `paddingTop:32`, containing an `aspect-video` Skeleton plus two small
  skeleton bars.
- After the livestream row loads: a different tree — `container-wide
  section-spacing`, a back-link row ABOVE the player, then the player in a
  `position:sticky; top:56px; z-40; margin-inline:-1rem` wrapper with a fixed
  `aspect-video` box.
- Overlays (tap-to-play, preview countdown, geo-block, login-gate) are all
  `position:absolute; inset:0` inside that fixed box.
- Below the player: a mobile chat toggle button; when expanded, a ChatPanel
  with height class `h-[400px]`, switching to `h-[280px]` when an on-screen
  keyboard is detected (a `useKeyboardHeight` hook).
- Below that: an `<h1>` title, a status badge, then a flex-wrap metadata row.
  Inside that row, a concurrent-viewer `<span>` is conditionally rendered:
  `{isConnected && concurrentViewers >= MIN_PUBLIC_VIEWERS && (<span>…N đang
  xem</span>)}`. It appears asynchronously, seconds after page load, once
  Supabase Realtime Presence connects. It has no reserved width or min-height.
  There is currently an uncommitted work-in-progress diff on another branch
  that changes this condition to `concurrentViewers > 0`, which would make the
  span appear far more often (i.e. on essentially every live stream, not just
  busy ones).
- Further below: comment section, related-stream cards, all loaded async.
- A `useIntervalViewCounter` hook posts a view event every 30s while playing.

`/login` renders a full-page centered spinner while auth state resolves, then
replaces that entire tree with the login form.

Meanwhile there is a second uncommitted WIP diff on the Mux player component
that, for live streams, sets `capRenditionToPlayerSize={false}` and
`renditionOrder="desc"` (i.e. start ABR at the highest rendition, up to 1080p)
and adds an absolutely-positioned quality `<select>` overlay for iPhone.

## Prior history that matters

- There have already been about 12 separate commits titled "fix CLS ..." on
  this codebase over the last month, all aimed at the HOME page live section,
  the news feed, blog and venue images. None ever touched `/live/<id>`.
- There is a test file that pins geometry-related string literals (aspect
  ratio classes, skeleton class names, `fit: "contain"`) in the home, venue and
  blog files, to stop regressions. It does NOT cover WatchLive, the Mux player,
  the chat panel, or the login page.
- There is no local CLS reproduction tooling of any kind — no Playwright test
  anywhere uses `PerformanceObserver` or the `layout-shift` entry type.
- A prior perf milestone slipped 4 days past its due date because it depended
  on "wait N days for GA4 data".
- A prior incident: a GA4 milestone was written assuming dimensions had been
  registered, they had not been, and the entire measurement window was
  unusable and unrecoverable (non-retroactive).
- Production incident history on this exact surface: a Supabase schema-cache
  outage during a live broadcast; a hashed-filename collision outage;
  service-worker "phantom reload" flakes after deploys.

## The three options on the table

1. **Register the two missing GA4 custom dimensions** (`cls_shift_target`,
   `cls_load_state`, event-scoped) and wait ~7 days for field data before
   touching any code. Zero code change.
2. **Build local repro tooling**: a Playwright script that opens `/live/<id>`
   on a throttled mobile profile, attaches a `PerformanceObserver` for
   `layout-shift` entries, and dumps the offending nodes. Dev-only, no
   production bundle impact.
3. **Fix the suspects directly and blind**: reserve space for the
   viewer-count span, make the loading skeleton geometrically identical to the
   loaded tree, stop the login spinner→form full-page swap, stabilise the chat
   panel. Then measure after.

Some combination is likely. Possibly also: change `onCLS` to
`reportAllChanges: true` so intermediate shift values are visible in the field.

## Budgets and constraints you must respect

- CI-enforced JS bundle budgets, measured just now on the current tree:
  INITIAL (first paint) 225.3 KB gz / 280 budget; CODE 1520.1 KB gz / 1800;
  total 1904.0 KB gz / 1970 backstop — the check script already prints
  "headroom low: 66.0 KB left (<5%)".
- The success criterion currently written down is: "CLS %good for Vietnam
  mobile ≥ 75% at the next GA4 read, same predicate as before."
- Rollback for pure client code is `git revert` + push (Cloudflare redeploys,
  and native WebView picks it up too since it loads the remote URL).
- One operator. Livestreams happen at night Vietnam time. There is no on-call
  rotation.

## What I want from you

1. The specific way each of the three options breaks production or produces a
   wrong conclusion. Name the mechanism and the user-visible symptom.
2. Anything in the measurement pipeline above that makes the `/live` = 78%
   conclusion unsound. Be precise about gtag.js / web-vitals semantics.
3. Whether the stated success criterion can actually be satisfied or falsified
   by this work, given the numbers in the raw table. Do the arithmetic.
4. Anything about `reportAllChanges: true` in this specific setup that is a
   trap.
5. Deploy-timing risk on a live-streaming surface for a single operator.
6. What you would refuse to ship, and what you'd say is genuinely safe.
