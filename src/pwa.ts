/**
 * PWA service worker registration.
 *
 * Skips registration when running inside Capacitor native WebView to avoid
 * conflicts with native asset loading. Web browsers get the full PWA flow.
 */
import { registerSW } from "virtual:pwa-register";
import { Capacitor } from "@capacitor/core";

/**
 * Detect chunk-import failures and force a clean reload. After a deploy,
 * the currently-running bundle still holds chunk URLs from the previous
 * build. When the user navigates to a route whose lazy import resolves
 * to a now-deleted chunk hash, the browser throws "Importing a module
 * script failed" / "Failed to fetch dynamically imported module" and the
 * UI shows the generic error boundary on every nav click. A one-time
 * cache-busting reload picks up the fresh index.html which references
 * the new chunk hashes.
 *
 * Runs in BOTH browser PWA and Capacitor WebView — Capacitor caches the
 * JS bundle too, so the same recovery path applies.
 */
function installChunkErrorRecovery(): void {
  const RELOAD_FLAG = "__chunk_reload_pending__";
  const isChunkError = (msg: unknown): boolean => {
    if (typeof msg !== "string") return false;
    return (
      msg.includes("Importing a module script failed") ||
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("error loading dynamically imported module") ||
      msg.includes("Loading chunk ") // webpack-style fallback
    );
  };

  const recover = (): void => {
    // Avoid reload loops: if we've already attempted a reload this
    // session and it didn't fix the problem, fall through to the normal
    // error UI rather than spinning forever.
    try {
      if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;
      sessionStorage.setItem(RELOAD_FLAG, "1");
    } catch {
      // sessionStorage unavailable — best-effort reload anyway.
    }
    window.location.reload();
  };

  window.addEventListener("error", (e) => {
    if (isChunkError(e?.message) || isChunkError((e?.error as Error)?.message)) {
      recover();
    }
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e?.reason as Error | string | undefined;
    const msg = reason instanceof Error ? reason.message : reason;
    if (isChunkError(msg)) {
      recover();
    }
  });

  // Clear the flag after a successful 30s of running — implies the
  // reload worked and we're back to healthy chunks. Future deploys
  // then get their own one-shot recovery.
  setTimeout(() => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      // ignore
    }
  }, 30_000);
}

export function initPwa() {
  // Chunk-import error recovery runs everywhere — Capacitor WebView and
  // browser PWA alike. Must register BEFORE any lazy imports fire so
  // the early-route navigation crash can self-heal.
  installChunkErrorRecovery();

  // Do not register SW inside Capacitor native WebView — native handles assets.
  if (Capacitor.isNativePlatform()) {
    return;
  }

  // Don't register in development unless explicitly enabled
  if (import.meta.env.DEV) {
    return;
  }

  // When a new SW takes control mid-session (via clientsClaim from workbox
  // config), force-reload so the page picks up fresh chunks matching the
  // new index.html shell. Without this, users with the pre-9425f6a SW saw
  // a stuck-reload loop on lazy routes because the OLD SW kept serving
  // OLD index.html that referenced no-longer-existent chunk hashes.
  let reloadingFromSW = false;
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (reloadingFromSW) return;
    reloadingFromSW = true;
    window.location.reload();
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // New version available. updateSW(true) calls skipWaiting +
      // reloads — fast path. Explicit window.location.reload() as a
      // fallback for browsers that ignore the Workbox auto-reload.
      // Combined with workbox skipWaiting + clientsClaim + NetworkFirst
      // on navigations, users see the new shell on first load after
      // deploy instead of "flash of old UI then phantom reload".
      updateSW(true).catch(() => {
        window.location.reload();
      });
    },
    onOfflineReady() {
      // Site is cached and ready for offline use.
      // eslint-disable-next-line no-console
      console.info("[PWA] App is ready to work offline.");
    },
    onRegisterError(error) {
      // eslint-disable-next-line no-console
      console.warn("[PWA] Service worker registration failed:", error);
    },
  });
}
