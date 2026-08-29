# Prompt gửi GPT-5.6 (codex exec) — 2026-08-09

Role given: senior product designer reviewing a mobile-first bilingual (Vietnamese-primary) sports web app. Be specific and concrete. Name the exact element and the exact fix. No generic design platitudes.

---

## Context (self-contained — you cannot see the repo)

**Product:** ThePickleHub, a pickleball platform. ~95% of the audience is Vietnamese, on mid-tier Android phones, on 4G, one-handed, often standing at a noisy court. Vietnamese is the primary language, English secondary. React 18 SPA + Tailwind + shadcn/ui, also loaded inside a Capacitor native WebView (remote URL, not a precached shell). Mux for video.

**Problem:** Field data (GA4 web-vitals RUM, Vietnam + mobile segment, 29/07–08/08, n=457) says CLS p75 ≈ 0.67, only 32.4% "good", 63.7% "poor". Page-level split of poor CLS events:
- `/live/<id>` (the livestream watch page): ~226/291 poor ≈ 78% of all poor CLS
- `/` (home): 37 poor / 15 good
- `/login`: 15 poor / 90 good

Lab (Lighthouse) CLS on the same pages reads 0.000. Standing hypothesis: the shifts accrue over the page *lifecycle* (long dwell time on a livestream — 30-60 minutes — with chat, presence, and async data updating), not at initial paint.

Element-level attribution is NOT available: the client already sends `attribution.largestShiftTarget`, but the GA4 custom dimension was never registered and GA4 does not backfill, so we would have to register it and wait 7 days.

## The actual screens

### A. `/live/<id>` — livestream watch page, 390px viewport

Vertical order on mobile:
1. Back link "Trực tiếp" (~40px tall incl. margin)
2. **Sticky video player**, `position: sticky; top: 56px`, full-bleed (negative side margins), `aspect-video` → 390×219px. Overlays (tap-to-play, geo-block, login-gate countdown) are all `absolute inset-0`, so they never change the box.
3. A chat toggle button ("Chat" + chevron). Collapsed by default. Tapping expands a chat panel of fixed height `h-[400px]` (`h-[280px]` when the soft keyboard is up) directly below the button.
4. `<h1>` stream title, 24px, Vietnamese titles often wrap to 2–3 lines.
5. **Metadata row**: `display:flex; flex-wrap:wrap; gap:16px; font-size:14px`, containing in DOM order:
   - organizer link (24px avatar + name + verified badge)
   - **viewer count — rendered ONLY when the Supabase Presence channel has connected AND count > 0.** Presence connects 1–4s after page load on 4G. Copy: `1.234 đang xem` ("1,234 watching"). Reconnects (tab backgrounding, network flap on 4G) can drop and re-add it.
   - total views, rendered immediately with a default of `0` and then replaced when the query resolves: `0 lượt xem` → `1.234 lượt xem`
   - date/time
   With `flex-wrap`, inserting or widening any of these can push the later items onto a new line, growing the row by ~20px and pushing everything below down.
6. Like / share / report bar
7. Description + a block of always-rendered Vietnamese SEO body copy (3 paragraphs)
8. Comments (async, grows)
9. Below that: "other live streams" list (async, grows, appended at the very bottom)

Loading state today: while the stream row is fetching, the page renders a **different tree** — a skeleton with different padding, no back link, and a player skeleton that is inset (358px wide → 201px tall) instead of full-bleed (390 → 219px). When real data lands, everything moves.

### B. `/login`
While auth state is being restored, the whole page is a single centered spinner. When auth resolves, the spinner is replaced by header + wordmark + email/password form. 15 poor / 90 good.

### C. `/` home
The "Đang trực tiếp" (Live now) hero section **returns null** until the livestreams query resolves, then is inserted at the TOP of the content stack, pushing the editorial and news sections down by ~350px. Same for a logged-in-only "log a match" CTA that appears after auth resolves.

### D. Fonts (site-wide, may affect all three pages)
`html { font-family: Inter }`. Vietnamese subsets of Inter and Geist are `font-display: swap`; the Latin subsets are `font-display: optional`. Only the two Geist subsets are `<link rel=preload>`ed — **inter-vietnamese.woff2 is not preloaded and is `swap`**. So on 4G, Vietnamese text (i.e. nearly all body copy) first paints in the system fallback and re-flows when Inter Vietnamese arrives. The team deliberately moved VI subsets from `optional` to `swap` on 2026-08-06 because dropping the VI subset renders "nghề" as "nghê" — permanently wrong diacritics were judged worse than a reflow.

## Constraints

- Bundle budget headroom is ~65 KB; the fix cannot add a library.
- Must not break Mux signed playback or the login gate overlays.
- Must ship identically to web and to the Capacitor WebView.
- Vietnamese strings run 20–40% longer than English; anything with a fixed width breaks.
- Touch targets ≥ 44px; WCAG 2.1 AA.
- CLS excludes shifts within 500ms of user input, so the user-tapped chat expand does NOT count.

## The question

For each async UI element on a mobile video page, which is right — **reserve space**, **overlay it (absolute/fixed, out of flow)**, or **fade/animate it in** — and why? Specifically:

1. The viewer-count chip ("1.234 đang xem") that appears 1–4s after load and can disappear on reconnect. Reserving space means a visible empty gap for the first seconds. Overlaying it on the video means covering match footage. Rendering "0 đang xem" was explicitly rejected by the owner as bad social proof. What is the right answer, and where exactly should the chip live?
2. The "0 lượt xem" → real number swap, and digit-count changes (9 → 10 → 100 viewers) inside a `flex-wrap` row.
3. The loading state for the whole page: hold a skeleton that exactly matches the final geometry (feels slower, but zero shift), or render the real page progressively? Where is the line for a court-side user who deep-links in from Facebook and wants the video playing in under 3 seconds?
4. The home "Live now" hero that is currently `return null` → inserted at the top. Reserve a fixed-height slot (empty when there is no live stream — most of the day), or move it below the editorial section, or something else?
5. The font `swap` reflow: given the team refuses `optional` for Vietnamese, what is the correct fix that keeps diacritics AND kills the reflow? Be concrete about metric overrides.
6. `/login`: spinner → form. Is a full-page spinner ever the right call for an auth-restore of typically 200–800ms, or should the form render immediately in a disabled/optimistic state?

For each: name the element, the exact CSS/markup fix, and any Vietnamese copy that has to change. Flag anything where the CLS fix would make the experience *worse* for a user standing at a court on 4G — that trade-off matters more to us than the metric.
