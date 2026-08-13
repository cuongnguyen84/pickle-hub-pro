# Devil's-advocate pass — GPT-5.6 (codex exec, reasoning=high), 2026-08-09

Provider: `codex exec --sandbox read-only` (ChatGPT account). Note: `-m gpt-5.6`
returned `400 invalid_request_error: The 'gpt-5.6' model is not supported when
using Codex with a ChatGPT account` → re-run on the account default model with
`model_reasoning_effort=high`. Prompt: `./risk-gpt-prompt.md` (self-contained,
model had no repo access).

Verification of every claim below is in `../round1/risk-auditor.md` §"Phản biện
độc lập". Raw reply follows verbatim.

---

The current evidence does not prove `/live` causes 78% of CLS. It proves that 78% of emitted poor-CLS callbacks were attributed by GA4 to a URL under `/live` when GA processed them. With an SPA, document-scoped CLS, lazy analytics loading, and repeated visibility reports, those are materially different claims.

The strongest concrete suspect is the WatchLive loading-tree replacement: when the stream query finishes, the skeleton shell is removed and replaced by a differently padded tree containing a new back-link above the player. The player visibly changes vertical position. That is exactly the kind of late, large shift consistent with field CLS around 0.67 and Lighthouse showing zero.

## The three options

### 1. Register dimensions and wait

Production impact: none. Registering the two event-scoped dimensions is genuinely safe.

The wrong conclusion comes from treating the resulting data as route-causal:

- `cls_shift_target` identifies the largest contributing target in the document's winning CLS session window. It does not prove which React route caused the shift.
- `route` remains unregistered, and even if registered, its value was frozen at document boot. It describes the landing route, not the route active when the shift happened.
- Built-in `pagePath` describes the current/processed SPA location, while CLS continues across the whole document.
- A user can accumulate a shift on `/`, navigate to `/live/x`, then background the tab. That document-wide CLS report can be filed under `/live/x`.
- Registering the dimensions cannot repair the existing 457 events.

Waiting seven days therefore delays the fix while preserving the attribution defect. Do the registration now, but do not make it a seven-day blocker. Also expect `cls_shift_target` to be high-cardinality and potentially collapsed in GA reporting.

User-visible symptom: none from registration; another week of the existing player jump from the wait.

### 2. Build Playwright reproduction tooling

If it is truly dev-only and kept out of the production bundle, this is safe to ship.

There are several concrete false-negative traps:

- Default Playwright may present a headless/bot user agent. Your middleware can then return the bot prerender rather than the real-user SPA.
- `navigator.webdriver` disables the existing RUM module. That is fine for a custom observer, but it means the test is not exercising the full production instrumentation path.
- Installing the observer after `page.goto()` can miss the skeleton-to-loaded swap. It must be installed with an init script before application JavaScript.
- A Chromium mobile profile does not reproduce SwiftUI WebView/iOS WebKit keyboard and viewport behavior.
- A test without real auth, Presence, comments, and stream state will never trigger the asynchronous viewer span or the relevant long-lived behavior.
- Shifts within 500 ms of user input have `hadRecentInput` and do not count toward CLS. A script that simply dumps every layout-shift entry will accuse innocent tap/keyboard transitions.

There is also a real production-side effect if the script uses a live production stream: starting playback activates the 30-second view counter, and joining Presence can raise the public concurrent-viewer number. Repeated test runs inflate broadcast metrics, and viewers can literally see the count increase. Use a test stream/backend or explicitly suppress the view-counter write.

"Playwright observed zero CLS" is not evidence of safety unless those traps are addressed.

### 3. Fix everything blind

I would reject this as one production change.

Concrete failure modes:

- Changing the viewer condition to `concurrentViewers > 0` makes an unreserved span appear on virtually every stream. When Presence connects, the metadata row reflows. Users see the title/status metadata jump several seconds after load. That expands the suspected trigger instead of fixing it.
- Reserving an arbitrary width can permanently force the flex row to wrap on narrow Vietnamese screens. Users see wasted space or metadata moved to another row even when no count is present.
- "Fixing" login by rendering an actionable login form before auth resolves creates an auth race: an already-authenticated user sees a login flash, may start typing, and then loses the input when redirected.
- Freezing the chat panel at 400 px to suppress the 400→280 shift can put its composer behind the iOS keyboard. The visible failure is that users cannot see what they type or reach Send.
- Shipping all four changes together destroys diagnosis. A pass cannot identify the fix, and a failure cannot falsify any individual suspect.

Some narrow versions are safe: make the loading shell reserve the exact loaded back-link/player geometry; preserve the existing fixed player aspect ratio; use an inert login-form-shaped placeholder; and reserve viewer-count space based on measured localized content without broadening its render condition.

## Why the `/live = 78%` conclusion is unsound

The raw count is arithmetically correct: `/live/*` supplied 226 of 291 poor events, or 77.7%. The causal interpretation is not.

Specific measurement mechanisms:

- `onCLS` is document-scoped. React Router navigation does not reset it.
- SPA `page_view` events do not reset the web-vitals observer.
- Default `onCLS` can report the same document/metric ID on the first hide and again after later hides if CLS increases. The 457 rows are callbacks, not necessarily 457 page loads or users.
- Livestreams are long-lived and frequently backgrounded when users lock phones or switch apps. They have more opportunities to emit repeat callbacks than `/login` or ordinary pages.
- One livestream URL contributing 209 events does not mean 209 independent affected users without deduplication by `metric_id`.
- The normalized `route` captured at boot is absent from reports. Built-in `pagePath` can instead reflect the current SPA URL when the event is sent or when queued gtag commands are processed.
- Because the external gtag library is lazy, the inline `gtag` stub can queue commands. That part is normally safe. But a no-interaction user who leaves before the 60-second load loses the in-memory queue on document destruction. Fast exits are undercounted; long-lived streams are preferentially measured.
- Initializing web-vitals through idle work also loses documents that exit before the import and listeners complete.
- `debug_mode: true` does not provide useful per-shift debugging through the Data API. If a GA4 developer-traffic filter is ever activated, it can exclude all these production events.

The honest statement is: "Poor CLS callbacks are heavily concentrated on documents reported while a `/live/*` URL is active." Anything stronger requires route-scoped local evidence or a redesigned field metric.

## Success-criterion arithmetic

Current good rate:

```text
148 / 457 = 32.4%
```

At least 75% of 457 requires:

```text
ceil(457 × 0.75) = 343 good events
343 − 148 = 195 additional good classifications
```

The dominant livestream has 179 poor and 10 needs-improvement events. Even converting all 189 to good yields:

```text
(148 + 189) / 457 = 73.7%
```

So completely fixing that one broadcast still fails the written criterion.

All `/live/*` rows contain 23 good and 237 non-good events. Converting every live non-good event yields:

```text
(148 + 237) / 457 = 84.2%
```

The target is arithmetically attainable, but requires converting at least 195 of the 237 non-good live events—82.3%—assuming identical traffic volume and composition.

Removing or suppressing live telemetry would not pass:

```text
non-live good = 125
non-live total = 197
125 / 197 = 63.5%
```

More importantly, the next seven-day percentage cannot causally satisfy or falsify the fix. A week without a major livestream can pass through traffic mix; another large broadcast can fail it. GA4 `%good` also is not the same as the 28-day CrUX p75 used by PageSpeed.

## `reportAllChanges: true` is a KPI-corruption trap

Do not send intermediate updates under the same `web_vital` event used for the success criterion.

A single document might emit:

```text
CLS 0.02 → good
CLS 0.08 → good
CLS 0.31 → poor
```

GA4 then counts two good events and one poor event for one ultimately poor page experience. Long livestreams with more shifts generate more rows. With no actual sampling, this turns `%good` into "percentage of intermediate callbacks that happened to be good," not percentage of good page experiences. It can make the stated target pass without improving a single user's final CLS.

If intermediate reporting is needed for diagnosis, use a separately named, genuinely sampled diagnostic event. Keep the final KPI event deduplicated to one final value per `metric_id`.

## Deployment timing

Do not deploy this during a broadcast or shortly before one.

A push to `main` simultaneously changes:

- New web navigations.
- Capacitor and SwiftUI WebViews, without app-store rollout control.
- Potentially service-worker-controlled sessions after navigation/update.

On a slow network, NetworkFirst can return a cached older navigation response after its three-second timeout. That HTML may reference old content-hashed chunks while production now serves a newer deployment. A later lazy import can fail with a chunk-load error, producing a blank route or dead player. A revert creates another version; it is not an instantaneous rollback for already loaded or cached clients.

The uncommitted Mux ABR change must not hitchhike on the CLS deployment. Starting at the highest rendition on Vietnamese mobile networks causes slow startup and repeated buffering. Users see a black/spinning player and consume substantially more data. The absolute quality selector itself should not cause CLS inside the fixed player box; the ABR behavior is the dangerous part.

## Ship/refuse decision

I would ship:

- GA4 dimension registration immediately, without waiting as a gate.
- A dev-only reproduction harness using a non-bot UA, pre-navigation observer, test stream, and explicit auth/Presence/keyboard/visibility scenarios.
- One isolated geometry fix for the WatchLive loading→loaded player position.
- A daylight Vietnam deployment when no broadcast is running, with the operator present.

I would refuse:

- The four-part blind fix batch.
- `concurrentViewers > 0` without a correctly sized reserved placeholder.
- `reportAllChanges: true` feeding the existing KPI event.
- The highest-rendition Mux WIP in the CLS change.
- Declaring `/live` causal—or declaring success—from raw GA4 event percentages without deduplicating final values by document/`metric_id`.
