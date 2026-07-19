/**
 * Single source of truth for detecting stale-chunk load failures after a
 * deploy. Used by BOTH the window-level recovery in pwa.ts and the React
 * ChunkErrorBoundary in App.tsx — the two lists drifting apart is exactly
 * what let iOS Safari's "Importing a module script failed" fall through to
 * the generic error UI (2026-07-19 live-stream incident).
 */
export const isChunkErrorMessage = (msg: unknown): boolean => {
  if (typeof msg !== "string") return false;
  return (
    msg.includes("Importing a module script failed") || // Safari / WKWebView
    msg.includes("Failed to fetch dynamically imported module") || // Chrome
    msg.includes("error loading dynamically imported module") || // Firefox
    msg.includes("Loading chunk") || // webpack-style fallback
    msg.includes("ChunkLoadError") ||
    msg.includes("Unexpected token '<'") || // SPA fallback served HTML as JS
    msg.includes("Unexpected token <")
  );
};
