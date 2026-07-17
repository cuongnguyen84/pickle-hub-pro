## Bottom line

Do **not** pursue deeper splitting uniformly.

- Keep Mux lazy. Its 297 KB vendor chunk is large enough to justify an interaction-time load, and video startup already carries a loading expectation.
- Keep charts lazy, but render the rankings content and a fixed-size chart skeleton before the chart library arrives.
- Keep rare organizer dialogs lazy only after replacing `fallback={null}` and warming the likely next dialog.
- Do **not** split scoring controls, scoring corrections, confirmation dialogs, bottom-navigation icons, or button icons into separate interaction-time chunks.
- Per-icon dynamic imports are not worth it.
- Deeper lazy-loading will reduce initial-route transfer, but **will not reduce the 1,930 KB aggregate build gzip**. The 1,800 KB aggregate goal requires dependency removal, deduplication, or replacement.

Because a cold 3G chunk request cannot reliably finish within 500 ms, any interaction that must meet the owner’s `<500 ms` rule must either be bundled with its route or prefetched before the tap.

---

# 1. Verdict by touchpoint

## Opening a scoring dialog mid-game: **BLOCKER**

This includes score correction, point reversal, game completion, match confirmation, side switching, timeout, or any other modal opened while a referee is actively scoring.

### Why

The referee expects the tap to take effect immediately. Even a 200–400 ms unexplained delay can cause a second tap, an incorrect point, or uncertainty about whether the first tap registered. On cold mobile cache, a separate chunk can take well over 500 ms due to connection setup, Facebook WebView behavior, radio wake-up, and JS parse/evaluation.

### Exact fix

- Bundle the **scoring controls and all routine scoring dialogs in the scoring route chunk**.
- On tapping a scoring action, update the pressed state or score state synchronously.
- Do not put a Suspense boundary between the point button and the immediate result.
- Only split non-critical secondary tools such as:
  - full match audit history,
  - export/share sheet,
  - advanced statistics,
  - rarely used administrator override tooling.

If “open scoring” means navigating from a match page to the full scoring route:

- Prefetch the scoring route as soon as the live match card or **“Bắt đầu chấm điểm”** button becomes visible to an authorized referee.
- For a direct deep link to a scoring URL, prioritize that route import immediately during bootstrap.
- Replace the global blank spinner with a scoring-specific shell containing:
  - persistent match/team names,
  - fixed score boxes,
  - disabled point controls or score-button skeletons,
  - text such as **“Đang tải bảng điểm…”**.

Do not show the standard site header or bottom nav if the real scoring screen intentionally omits them; the fallback should match the final scoring layout rather than create a second layout shift.

---

## Tapping Play on a livestream: **WARNING, current approach is broadly correct**

Mux is 297 KB gzip, so keeping it lazy is justified.

### Exact fix

Retain the poster/thumbnail and video aspect ratio immediately after the tap. The play button should respond synchronously:

1. Replace or animate the play button immediately.
2. Keep the court image visible.
3. Add an in-frame loading state such as **“Đang tải video trực tiếp…”**.
4. Prevent duplicate taps while the player chunk initializes.

Do not replace the entire card or page with a centered spinner.

### Prefetch behavior

- If there is one currently live court and its player is above the fold, prefetch the Mux chunk when the live card enters the viewport.
- If the home page contains many live courts, do not prefetch a player chunk per card; it is one shared vendor chunk, so prefetch only when the first genuinely playable live card approaches the viewport.
- On `Save-Data` or very slow connections, wait for the explicit Play tap rather than consuming 297 KB speculatively.
- `pointerdown` can start the import slightly earlier, but it is not enough to guarantee a sub-500 ms load. The immediate poster-based loading state is still required.

The existing grey thumbnail placeholder is acceptable because it reserves the player geometry. Adding visible Vietnamese loading copy would make the tap response clearer.

---

## Opening rankings with a chart: **OK to lazy-load the chart; WARNING for the route**

The chart should not block names, ranks, points, filters, or the ranking date.

### Exact fix

When `/rankings` opens:

- Render the rankings title, filters, date, top players, and list/table without waiting for the chart library.
- Reserve the exact chart height.
- Render a chart-shaped skeleton with axis/grid placeholders.
- Lazy-load the chart when its container is approximately 400–600 px from the viewport.

If the chart is the primary above-the-fold content, start loading it at route idle immediately after the ranking list becomes interactive. Avoid a sequence of:

1. blank route spinner,
2. route appears,
3. second chart spinner.

That “double wait” will feel slower than the actual network timing.

Since Recharts is already component-lazy, further splitting inside Recharts will not help. Replacing Recharts can reduce aggregate gzip, but validate Vietnamese labels, responsive sizing, touch tooltips, accessibility, and required chart types before choosing a replacement.

---

# 2. `Suspense fallback={null}` on dialogs

## Verdict: **It is a dead-tap bug**

For an interaction-triggered dialog, `fallback={null}` means the visible result of the tap is nothing. Users cannot distinguish loading from a missed tap or broken button. This is especially problematic on mid-tier Android and in Facebook’s in-app browser.

It should be fixed before adding more dialogs with the same pattern.

## Exact fix for the 11 TeamMatchView dialogs

Keep the modal shell and loading treatment eager:

- On tap, synchronously set the dialog’s `open` state.
- Immediately render:
  - modal scrim,
  - dialog container,
  - title if already known,
  - fixed-height field/row skeletons,
  - disabled footer button placeholders,
  - optional text **“Đang tải…”**.
- Lazy-load only the dialog body or feature implementation.
- Preserve focus handling and allow the close button to work while content loads.
- Disable the launch button after the first tap to prevent duplicate opens.

Do not place a single Suspense boundary around the entire `TeamMatchView`, because that could replace the underlying page with a fallback when a dialog suspends.

### Important constraint

A skeleton does not make an unlimited delay acceptable. The owner permits it only below 500 ms. Therefore:

- Prefetch likely dialogs before interaction.
- Bundle the highest-frequency dialog with `TeamMatchView` if its cold p75 remains above 500 ms.
- Keep truly rare dialogs lazy.

For example:

- **Lineup and score-entry setup:** preload early or bundle; likely during event operation.
- **Create team, invite, playoff setup, advanced settings:** fine to keep lazy if the shell appears immediately and the chunks are prefetched based on context.

---

# 3. Flow-level verdicts

| Flow or element | Verdict | Required treatment |
|---|---|---|
| Tap `+1`, `-1`, undo, side switch, timeout | **BLOCKER** | No interaction-time chunk. Bundle with scoring route and respond synchronously. |
| Open score correction or game/match confirmation dialog | **BLOCKER** | Bundle with scoring route. Never use `fallback={null}`. |
| Enter a scoring route from an active match | **BLOCKER** | Prefetch when scoring CTA becomes visible; use scoring-specific route skeleton on a cache miss. |
| Direct Facebook deep link to a scoring URL | **BLOCKER** | Start that route import immediately from the URL; no generic blank page. |
| Bare global route spinner for scoring, live match, or deep-linked tournament page | **BLOCKER** | Replace with route-specific shells that preserve expected page geometry and context. |
| Tap Play on a livestream | **WARNING** | Mux may remain lazy. Show immediate loading state inside the existing poster frame. |
| Livestream autoplay or automatic Mux prefetch on every card | **WARNING** | Avoid on mobile data; preload only a likely visible live player. |
| Rankings list, filters, and top-ranked players | **WARNING** | Route can be lazy, but must have a rankings skeleton. Do not wait for chart code. |
| Rankings chart below the list | **OK** | Lazy-load near viewport with fixed-height chart skeleton. |
| Admin analytics charts | **OK** | Lazy-load on tab selection or shortly before the chart enters the viewport. |
| Team lineup dialog during active event operation | **WARNING** | Lazy only if prefetched and immediate modal shell is shown; otherwise bundle. |
| Create team, invite, playoff/group setup, organizer settings | **OK** | Keep lazy, but replace null fallback and prefetch based on visible CTA or likely sequence. |
| Export, advanced reports, audit history | **OK** | Lazy on explicit intent; show an immediate panel/dialog loading state. |
| Header, bottom-nav, scoring-button, close, back, and status icons | **BLOCKER** | Include in the owning route or shared UI chunk. Never fetch per icon. |
| Decorative icons below the fold | **OK** | Static SVG/CSS or bundled with the feature; no need for per-icon dynamic imports. |

“BLOCKER” here means the interaction must not depend on a cold chunk fetch. A skeleton is not sufficient for point entry or score correction.

---

# 4. Prefetch strategy

## Do not use hover as the primary strategy

Hover is largely irrelevant for the mobile-dominant audience. It is only a desktop enhancement.

Use the following order:

## A. Viewport prefetch for visible navigation intent

Use this for links and CTAs that strongly predict the next action.

Examples:

- Prefetch the scoring route when **“Bắt đầu chấm điểm”** enters the viewport for a referee.
- Prefetch the lineup dialog when the **“Xếp đội hình”** button enters the viewport in the active organizer step.
- Prefetch the rankings route when a rankings card/link approaches the viewport.
- Prefetch the chart chunk when the chart container is 400–600 px below the viewport.

Prefer a positive `IntersectionObserver` root margin rather than waiting until the element is already visible.

Do not prefetch every offscreen route in a long home feed.

## B. Route-idle prefetch for highly probable next actions

After the current route reaches LCP and becomes interactive, warm only the chunks predicted by that route and user role.

Examples:

- On an organizer’s TeamMatchView, preload lineup and registration chunks, not all 11 dialogs.
- On a referee’s active match page, preload the scoring route immediately.
- On rankings, preload the chart after the list is rendered.
- On a tournament setup step, preload the most likely next step’s dialog.

`requestIdleCallback` only identifies main-thread availability; it does not mean mobile data is free. Apply connection and data-saver checks before starting large speculative requests.

## C. Pointer intent as a final optimization

On `pointerdown` or `touchstart`, start the import before the subsequent `click`.

This can save a small amount of time but must not be the only strategy for critical chunks. A cold request will often outlast the tap-to-click interval.

On desktop, `mouseenter`/focus can do the same, but it should be supplementary.

## D. Direct deep-link prioritization

Users frequently land directly on one page, so initial route selection should not wait behind unrelated home or navigation code.

For `/scoring/...`, `/live/...`, `/match/...`, and `/tournament/...`:

- Resolve and import the matched route immediately.
- Do not eagerly initialize analytics, admin modules, charts, or unrelated route registries first.
- Render an appropriate route shell while that specific route loads.

This is more important than prefetch because no previous page exists to warm the chunk.

## E. Network policy

A practical policy:

- `Save-Data`: prefetch only critical next-step chunks.
- `2g`/very slow effective connection: avoid large speculative chunks such as Mux and charts.
- `3g`: prefetch small high-probability chunks; avoid warming all dialogs.
- `4g`/Wi-Fi: allow route-idle prefetch of the next one or two likely actions.

In the Capacitor shell, previously used hashed chunks should remain available through normal web asset caching. Avoid pre-caching every lazy chunk on first install/update, because that merely moves the aggregate download into the startup/update path.

---

# 5. Icon lazy-loading

## Per-icon dynamic import: **do not do it**

It trades trivial byte savings for:

- an extra async boundary,
- possible network request or chunk lookup,
- icon pop-in,
- button width/height changes,
- delayed recognition of scoring and navigation controls,
- more chunk-manifest and runtime overhead.

It is particularly bad for:

- bottom-nav icons,
- back/close icons,
- Play,
- `+1`/`-1`,
- undo,
- timeout,
- settings buttons,
- dialog action icons.

## Exact fix

- Use static direct imports from the icon package rather than importing the package barrel if that barrel prevents tree-shaking.
- Verify the production bundle to ensure only used icons are included.
- Bundle icons with their owning route or feature.
- Inline tiny critical SVGs where appropriate.
- If an icon library still contributes substantial aggregate gzip, replace it with a small curated internal SVG set.

Feature-level splitting is acceptable: admin-only icons can live in the admin chunk because the entire admin feature is already lazy. Do not create one chunk per icon.

---

# Bundle-size implications and recommended order

The aggregate target needs a separate plan from initial-load optimization.

## Deeper splitting does not lower aggregate gzip

Splitting 20 KB out of the entry chunk creates another chunk containing approximately the same code, often with some additional wrapper/runtime overhead. It helps `/` and `/vi` only if that chunk is not requested there. It does not materially move 1,930 KB below 1,800 KB.

## Recommended investigation order

1. **Fix the suspected `react-dom` leakage or duplication.**  
   Inspect the production bundle graph and source maps. Confirm that React and ReactDOM exist once, in the intended shared chunk, and that no subpath import creates a duplicated implementation.

2. **Measure actual icon-library inclusion.**  
   Check whether a barrel import or dynamic icon registry causes the full icon set to be retained. Replace with direct static imports or a curated SVG set.

3. **Evaluate the Recharts replacement.**  
   Recharts is 108 KB gzip, so even removing all of it leaves roughly another 22 KB needed to meet the 130 KB aggregate reduction. A replacement must therefore be paired with another reduction.

4. **Remove duplicate utilities and locale data.**  
   Look specifically for multiple date libraries, duplicated formatting helpers, unused English locale packs, and admin-only dependencies included in shared chunks.

5. **Only then add deeper feature splitting for initial-route performance.**  
   Use it to improve `/` and `/vi`, not as evidence that aggregate gzip has fallen.

## Release gate

Before shipping deeper lazy-loading, test cold-cache p75 on a mid-tier Android profile and Facebook in-app browser conditions. Record:

- tap-to-dialog-shell,
- tap-to-usable-dialog,
- tap-to-video-loading-state,
- tap-to-player-ready,
- route-start-to-scoring-controls,
- chart-container-visible-to-chart-rendered,
- duplicate-tap rate.

Any scoring interaction requiring a cold chunk fetch should fail the release gate, regardless of whether its lab median is below 500 ms.