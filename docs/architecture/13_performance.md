# Performance review

## Bundle and loading

The app has many route screens, but nearly all are dynamic imports (`src/App.tsx`). Critical route modules are preloaded for home, blog detail and venue detail; heavy team-match dialogs and the home live player are component-lazy. The prototype shop is build-time disabled in production because it previously added about 106 KB gzip (comment in `App.tsx`). Bundle visualization and budget scripts are configured in `vite.config.ts` and `scripts/check-bundle-size.mjs`; current budgets are documented in `docs/perf-budgets.md`. Capacitor remote-wrapper mode means hosted bundle performance is also mobile-wrapper performance; the stale checked-in iOS bundle is not evidence of the current production bundle.

Risks: `App.tsx` itself is a large route registry; shared imports pulled into it become entry cost. `xlsx`, Mux/HLS, editor/admin tooling and large fixture/prototype modules should remain behind dynamic boundaries. Generated Capacitor bundles are not useful inputs to web source analysis.

## Rendering and state

The global Query Client avoids focus/mount refetch and caches for five minutes. Auth provider value is memoized. Many complex pages remain large and own substantial dialog/state composition (`TeamMatchView.tsx`, `WatchLive.tsx`, creator/admin screens), creating rerender and maintenance risk. Memoization is selective, not universal; profile before adding it.

## Network/query behavior

- Home data prefetch is path-gated to avoid competing with venue/article LCP (`src/lib/prefetch-policy.ts`).
- Livestream list may perform a second organization-logo batch lookup, not one query per card (`useLivestreamData.ts`).
- Tournament pages fetch root and child collections separately, enabling key-level invalidation but potentially causing request fan-out.
- Mutation invalidation can refetch several collections; preserve narrow, stable keys.
- Edge invocations can retry once on transport/blob anomalies; mutations must remain idempotent.
- `product-import-enrich` can perform a Gemini enrichment call, a grounded-search call, up to five product-page fetch chains (up to four redirects each), and image extraction in one request; it uses timeouts on page fetches but is a high-latency/high-cost path.

## Realtime and telemetry

Chat, live presence and notification subscriptions are long-lived. Each must filter by resource/user and unsubscribe on cleanup; broad channels would increase browser and Realtime load. Presence is enabled only for live streams. View/client events are batched and database rate limited, reducing per-interaction writes but making batch size and flush cadence important.

## Database bottlenecks

Likely hot tables are `chat_messages`, presence/view/error/rate-limit rows, notifications, event registrations/payment orders, and score tables. Verified supporting indexes cover the common resource/time/status paths (`04_database.md`). Atomic score/bracket RPCs take locks: this protects correctness but creates contention if UIs retry aggressively or score large batches. News/ops claim queues depend on partial status/time indexes and bounded batches.

## Known controls and candidates

| Control/candidate | Evidence/status |
|---|---|
| Route splitting and retry | implemented in `App.tsx` |
| PWA stale-chunk recovery | implemented with capped reload boundary |
| Bundle budget/visualizer | `scripts/check-bundle-size.mjs`, Vite config |
| Web Vitals RUM | `src/lib/webVitalsRum.ts`, `log-client-event` |
| Crawler HTML caching | Cloudflare middleware/render utilities |
| Large component decomposition | candidate only; do not refactor without feature-specific profiling |
| Query/RPC explain plans | candidate for hot production queries; migrations show indexes but not runtime cardinality |

Do not claim a bottleneck from file size alone. Use bundle reports, Web Vitals, Supabase query statistics and Realtime metrics before optimization.
