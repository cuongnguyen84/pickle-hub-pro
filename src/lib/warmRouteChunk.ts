/**
 * Fire-and-forget warm-up for the active route's lazy chunk.
 * ----------------------------------------------------------------------------
 * App.tsx starts the chunk for the current URL at module-evaluation time, so
 * the request is already in flight by the time React renders. That warm-up is
 * an OPTIMISATION: the same chunk is imported again through `lazyRetry` +
 * `React.lazy`, which is where retries, the ChunkErrorBoundary and the reload
 * recovery all live. Nothing about correctness depends on the warm-up call.
 *
 * But the warm-up promise had no rejection handler. `void load()` silences the
 * lint rule, it does not handle the rejection — so whenever the shell was
 * stale (Cloudflare Pages deletes the previous build's hashed chunks on every
 * deploy) or the network blipped, the floating promise rejected and surfaced
 * as an `unhandledrejection`. errorReporter dutifully wrote it to
 * client_errors as "Importing a module script failed" with no stack and no
 * context — describing a failure the boundary had ALREADY recovered from.
 *
 * That made it the single largest error category in the table (21 of the 150
 * rows in the 30 days to 24/08/2026, every one of them on `/`, `/blog/:slug`,
 * `/vi/blog/:slug` or `/san/:slug` — exactly the four warmed paths). The cost
 * is not a crash, because there is no crash. The cost is triage: this table is
 * the only production error monitoring the site has, and a recovered failure
 * that reports itself as loudly as an unrecovered one buries the rows that
 * actually need a human.
 *
 * So: swallow it here, at the one call site that genuinely does not care.
 * A warm-up that fails costs a cache miss and nothing else. Every OTHER path
 * to the same chunk still reports, still retries, still reloads.
 *
 * @param load Dynamic-import thunk, e.g. `() => import("./pages/Index")`.
 * @returns A promise that always fulfils — awaited only by tests.
 */
export function warmRouteChunk(load: () => Promise<unknown>): Promise<void> {
  try {
    // `load()` can throw SYNCHRONOUSLY — it is an arbitrary thunk, and a
    // throw before it returns a promise is invisible to the handler below.
    return Promise.resolve(load()).then(
      () => undefined,
      () => undefined,
    );
  } catch {
    return Promise.resolve();
  }
}
