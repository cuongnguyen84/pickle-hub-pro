/**
 * Single source of truth for detecting stale-chunk load failures after a
 * deploy. Used by BOTH the window-level recovery in pwa.ts and the React
 * ChunkErrorBoundary in App.tsx — the two lists drifting apart is exactly
 * what let iOS Safari's "Importing a module script failed" fall through to
 * the generic error UI (2026-07-19 live-stream incident).
 *
 * Two DIFFERENT failure shapes both mean "this tab is running a mixed-version
 * module graph", and both must be in this list:
 *
 *   1. The chunk never arrived. The old bundle asks for a hash that the new
 *      deploy deleted, so the request 404s or the CDN SPA-fallback answers
 *      with index.html. That is the first block below.
 *
 *   2. The chunk arrived, but it is the WRONG generation. Entry chunk from
 *      deploy A links against vendor chunk from deploy B (one came from the
 *      service worker, the other from the CDN), the import resolves, and the
 *      binding it wants is not in the module's export list. The engine throws
 *      at link time with wording that shares not one word with block 1 — so
 *      no amount of loosening block 1 would ever have caught it. Missed until
 *      2026-09-05, when three rows on
 *      /vi/blog/lich-thi-dau-pickleball-world-cup-2026-da-nang showed users
 *      getting the dead generic error screen, mid-World-Cup, on the busiest
 *      article of the week, while the recovery that exists precisely for this
 *      sat one string short of firing.
 *
 * What this list does NOT promise. Block 2 fires at module-link time, so
 * application logic cannot raise it — but "link-time" is not the same as
 * "deploy skew only". A CJS-interop dependency through optimizeDeps, an
 * externalised ESM import, or a manualChunks split that produces a circular
 * chunk graph can all raise the same wording in production without failing
 * the build or reproducing on a dev reload. In that case the user gets caches
 * purged and up to three reloads before the manual "Tải lại trang" button —
 * annoying, self-limiting, and silent in client_errors, because
 * componentDidCatch reports only the errors it does NOT recognise. The reload
 * cap is the safety property here, not any claim that a match is always skew.
 */
export const isChunkErrorMessage = (msg: unknown): boolean => {
  if (typeof msg !== "string") return false;
  return (
    // 1. Chunk failed to load at all.
    msg.includes("Importing a module script failed") || // Safari / WKWebView
    msg.includes("Failed to fetch dynamically imported module") || // Chrome
    msg.includes("error loading dynamically imported module") || // Firefox
    msg.includes("Loading chunk") || // webpack-style fallback
    msg.includes("ChunkLoadError") ||
    msg.includes("Unexpected token '<'") || // SPA fallback served HTML as JS
    msg.includes("Unexpected token <") ||
    // 2. Chunk loaded, wrong generation — the export it links to is gone.
    // Matched on the stable prefix: the quoted binding name ('p', 'ke', …) is
    // minifier output and differs on every build. The JSC prefix deliberately
    // stops before "is not found", so it also covers that engine's star-export
    // variant ("…cannot be resolved by star export entries") — this codebase
    // re-exports through barrels, so that shape is reachable.
    msg.includes("Importing binding name") || // Safari / WKWebView
    msg.includes("does not provide an export named") || // Chrome / V8
    msg.includes("doesn't provide an export named") || // Firefox (modern)
    // Anchored on the colon that SpiderMonkey always emits before the binding
    // name. Without it, "import not found" is ordinary English and would one
    // day collide with a Shop bulk-import message — turning a Shop bug into a
    // cache purge and a reload loop with nothing in client_errors.
    msg.includes("import not found:") || // Firefox / SpiderMonkey
    msg.includes("ambiguous import:") || // Firefox / SpiderMonkey
    msg.includes("ambiguous indirect export") // Firefox / SpiderMonkey
  );
};
