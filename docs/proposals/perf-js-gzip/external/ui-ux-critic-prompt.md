# UX brief — deeper JS lazy-loading on a Vietnamese pickleball web app

## Product
ThePickleHub: bilingual (Vietnamese-primary, ~95% VN users) pickleball platform.
React 18 + Vite SPA, also wrapped in a Capacitor native shell + installable PWA.
Audience is mobile-dominant, mid-tier Android, on 3G/4G mobile data, often arriving
via a Facebook deep link straight to one page (a live stream, a match, a tournament,
a scoring screen). They do not browse the IA; they land mid-task.

Perf targets (Vietnam p75): LCP <= 2.5s, INP <= 200ms, CLS <= 0.1.

## The proposed change (this is a REPORT phase, no code yet)
Reduce shipped JS gzip. Two goals: (a) faster initial load of `/` and `/vi`;
(b) total aggregate gzip under 1,800 KB (currently ~1,930 KB).
Candidate tactics under consideration:
1. Lazy-load even deeper: icons, dialogs, charts inside admin, etc.
2. Swap a heavy dependency (recharts, 108 KB gz) for a lighter chart lib.
3. Trim the entry chunk (suspected react-dom leaking into entry via a subpath import).

## Current lazy-loading reality (already shipped)
- ~95% of route pages are already React.lazy(). Only the home page is eager.
- Route-level Suspense fallback = a bare centered spinner on a blank background
  (no header, no bottom nav, no skeleton). One shared spinner for EVERY lazy route,
  including the live-scoring pages.
- The Mux video vendor chunk (~297 KB gz) is already lazy — the inline home live
  player loads only when a court is actually live; its fallback is a grey thumbnail
  placeholder box (not a spinner). This one is good.
- recharts (108 KB gz) already lazy at component boundary.
- TeamMatchView has 11 dialogs already lazy-loaded (organizer setup: create team,
  registration, lineup, generate matches, playoff/group setup, invite, settings).
  Their Suspense fallback is `null` — i.e. when the user taps the button that opens
  the dialog, NOTHING renders on screen until the chunk arrives over the network.
- LIVE SCORING (referee entering points mid-match, team-match scoring, doubles-elim
  scoring) happens on SEPARATE full route pages that are lazy at the route level, so
  they get the bare spinner fallback.

## Constraints from the product owner
- Willing to accept a brief loading flash ONLY IF it is <500ms AND shows a skeleton
  (not a blank spinner).

## Questions I need a concrete second opinion on
1. Where is deeper lazy-loading genuinely harmless on real VN mobile networks, and
   where does it create a user-perceptible stall? Be specific about these touchpoints:
   opening a scoring dialog mid-game, tapping play on a livestream, opening rankings
   with a chart.
2. Is `Suspense fallback={null}` on an interaction-triggered dialog acceptable, or is
   it a "dead tap" bug that must be fixed before lazy-loading anything else the same way?
3. Which flows are "must never feel slow" (blocker if lazy-delayed even <500ms) vs
   "fine to lazy"? Give a BLOCKER / WARNING / OK verdict per flow type.
4. What is the right prefetch strategy (on hover, on viewport, on route-idle) so that
   deeper lazy chunks are warmed before the tap that needs them?
5. Icon lazy-loading specifically: is per-icon dynamic import ever worth it, or is that
   a known anti-pattern that trades a real stall for trivial KB?

Be specific and concrete. Name the exact element and the exact fix. No generic
design platitudes.
