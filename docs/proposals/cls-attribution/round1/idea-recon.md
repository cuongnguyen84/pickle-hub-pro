# idea-recon — cls-attribution (2026-08-09)

## Prior art

- docs/perf-05-report-2026-07-28.md:54-60 — P1 finding already logged: CLS p75 mobile ~0.67, %good 32.4%. Explicit hypothesis already written: web-vitals measures CLS over the whole page lifecycle (SPA soft-nav + infinite scroll + presence/chat re-renders on long-dwell pages), not just initial load — Lighthouse/lab CLS on the same pages reads 0.000. This directly explains why /live/<id> (long dwell time, continuous chat/presence updates) dominates 78% of poor CLS while lab tests are clean.
- src/lib/webVitalsRum.ts:146-189 (buildWebVitalEvent) — CLS attribution capture is already built (PR #502, aba1c7b8): reads attribution.largestShiftTarget / loadState from web-vitals/attribution and puts them on event.cls_shift_target / event.cls_load_state, truncated to 100 chars. This is exactly the client-side instrumentation the idea needs — it's just not queryable in GA4 yet. No code work needed for capture, only GA4 config.
- git log --grep CLS shows 9 prior standalone "Fix live section CLS" commits (c9459ac4, cfaf1288, 5626bcd8, d82c39c0, 6579a20e, 1d3108ef, 322addbb, 89a237f1, bb190956, e03e0959) plus 29cbe75e/ba1b7a70 (PERF-04 image CLS) and ce5da34c (fix(feed): cut CLS from auth-gated nudge, skeleton mismatch, broken thumbs, #504) — this exact class of bug has been chased repeatedly on the home live section and feed; none targeted /live/<id> (WatchLive) directly.
- src/lib/__tests__/layout-stability-surfaces.test.ts pins string literals in Index.tsx, HomeNewsFeed.tsx, LiveSection.tsx (fit: "contain", skeleton class names), VenueDetail.tsx, ViBlogPost.tsx, BlogPost.tsx (aspect-ratio classes). It does NOT touch WatchLive.tsx, MuxPlayer.tsx, ChatPanel.tsx, or Login.tsx — zero regression coverage on the pages the GA4 data actually implicates.

## Touch surface (likely)

- src/pages/WatchLive.tsx — /live/<id> page. Player box is aspect-video (fixed geometry, :276/:316), overlays (TapToPlayOverlay, PreviewCountdown, GeoBlockOverlay, LivestreamGateOverlay) are all absolute inset-0 — confirmed no box-size shift from those. Suspect: the conditionally-rendered viewer-count <span> at :420-430 (isConnected && concurrentViewers > 0) inserts inline content into the metadata row asynchronously after Presence connects — no reserved width/min-height. Has uncommitted WIP diff (threshold changed from MIN_PUBLIC_VIEWERS floor to > 0, unrelated to CLS) — note for the fix author to rebase off main, not this WIP branch.
- src/components/video/MuxPlayer.tsx — player itself is stable (fixed aspect-video wrapper, poster/video swap inside same box). Has uncommitted WIP diff (iPhone native-HLS quality <select>, absolutely positioned top-3 right-3 z-30 — doesn't affect layout box, but it's new markup on a page under CLS investigation; flag for the fix author).
- src/components/chat/ChatPanel.tsx — desktop sidebar h-[500px] fixed (WatchLive.tsx:562), mobile toggle-driven (h-[280px]/h-[400px], WatchLive.tsx:375) — collapsed by default so no load-time shift, but new messages/keyboard-height changes reflow within a fixed height (not itself a CLS source unless height class changes after data loads — not verified).
- src/pages/Login.tsx:283-306 vs :330+ — full-page swap: authLoading renders a different DOM tree (centered spinner only) than the resolved form. This is a whole-page content replacement, a classic large single shift — matches /login: 15 poor. No Turnstile widget present in this file.
- src/lib/webVitalsRum.ts — attribution capture, if GA4 dims get registered this is the read path.
- src/lib/__tests__/layout-stability-surfaces.test.ts — where a new pinned-geometry assertion for /live/<id> and /login would go, following the existing pattern.

## Data

- No DB tables/RPCs involved — client rendering + GA4 analytics only.
- GA4: custom event web_vital, params metric_name, metric_rating (registered 28/07, event-scoped, non-retroactive), cls_shift_target / cls_load_state (sent by client since #502 but NOT YET registered as GA4 custom dimensions — 00-data-ga4-raw.txt shows Data API errors for cls_shift_target, cls_load_state, route).

## Binding constraints found

- docs/perf-05-report-2026-07-28.md:39-43 — GA4 custom dimension không hồi tố (pre-registration events read as (not set) forever). Any new dimension registered today only starts collecting from today.
- docs/perf-05-report-2026-07-28.md:54-60 — standing hypothesis to test/falsify before any element-level fix: SPA lifecycle CLS ≠ initial-load CLS: onCLS should use reportAllChanges or raw LayoutShift sources to see if the shift accrues over the session (chat/presence) rather than at paint.
- 00-intake.md — perf budget headroom ~65KB on INITIAL/CODE bundles; fix cannot grow either.
- 00-intake.md — must not break signed playback / Mux player; must ship to both web and native WebView (native uses remote URL).

## Test coverage today

- src/lib/__tests__/webVitalsRum.test.ts — covers buildWebVitalEvent attribution attachment/omission logic (unit-level), route normalization, market segment bucketing. Does not touch DOM/render output.
- src/lib/__tests__/layout-stability-surfaces.test.ts — pins home/venue/blog geometry strings only. Gap: zero coverage for /live/<id> (WatchLive/MuxPlayer/ChatPanel) or /login.
- No Playwright test or helper anywhere in tests/ uses PerformanceObserver/LayoutShift/CLS — no local repro tooling exists; CLS currently only observable via field GA4/CrUX.

## Unknowns worth asking Cuong

1. Register the two missing GA4 custom dims (cls_shift_target, cls_load_state, event-scoped) now and wait ~7 days for field data — or fix blind against the PERF-05 hypothesis (SPA-lifecycle accrual on /live) using local repro first?
2. Should the fix scope include /login's spinner→form full-page swap (15 poor, low volume) in the same pass, or defer to a /live-only pass given it's 78% of the total?
