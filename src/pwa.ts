/**
 * PWA service worker registration.
 *
 * Skips registration when running inside Capacitor native WebView to avoid
 * conflicts with native asset loading. Web browsers get the full PWA flow.
 */
import { registerSW } from "virtual:pwa-register";
import { Capacitor } from "@capacitor/core";
import { purgeAuthSensitiveCaches } from "@/lib/pwa/cache";
import { isChunkErrorMessage } from "@/lib/chunkError";
import { installStaleShellGuard } from "@/lib/staleShell";

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
  const isChunkError = isChunkErrorMessage;

  // In-memory backup flag for environments that block sessionStorage
  // (sandboxed iframes, opaque origins, strict-privacy WebViews). Survives
  // for the lifetime of THIS JS execution — i.e. one reload cycle.
  // Combined with the sessionStorage flag this means: even if storage is
  // blocked, the second chunk error in the same tab is a no-op (no loop).
  let reloadAttemptedInProcess = false;

  const recover = (): void => {
    if (reloadAttemptedInProcess) return;
    reloadAttemptedInProcess = true;

    // Codex P1 fix on PR #175: if sessionStorage access throws (sandboxed
    // origins, embedded WebViews, strict privacy mode) we previously
    // fell through to reload anyway → every chunk error after the reload
    // triggers another reload → infinite loop. Now we only reload when
    // the storage flag was successfully set OR was already set in a
    // prior reload (so we know storage works and we already tried once).
    let storageWorks = false;
    let alreadyReloaded = false;
    try {
      alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
      sessionStorage.setItem(RELOAD_FLAG, "1");
      storageWorks = sessionStorage.getItem(RELOAD_FLAG) === "1";
    } catch {
      storageWorks = false;
    }

    if (alreadyReloaded) {
      // Already tried once and the chunk error is still hitting us.
      // Stop here so the user sees the normal error UI instead of a
      // reload loop. They can manually hard-reload to retry.
      return;
    }
    if (!storageWorks) {
      // Storage is blocked — we can't persist the flag across reloads,
      // so a reload would just loop. Skip the auto-recovery and let
      // the error UI surface. The in-process flag still prevents
      // multiple reloads inside this same JS execution.
      return;
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

  // Preventive layer: detect a newer deploy BEFORE a stale lazy chunk 404s.
  // Runs in Capacitor WebView too (remote URL, no SW — this is its only
  // freshness signal besides the reactive boundary above). Skip in dev:
  // there's no build-id.txt and Vite serves modules unhashed.
  if (!import.meta.env.DEV) {
    installStaleShellGuard();
  }

  // One-time eviction of the legacy "supabase-rest" cache written by the old
  // NetworkFirst SW (now NetworkOnly). Runs on every boot; a no-op once the
  // cache is gone. Prevents stale per-user REST data lingering after upgrade.
  void purgeAuthSensitiveCaches();

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
  // FIRST-INSTALL EXCEPTION (2026-07-23): when no SW controlled the page at
  // load time, this controllerchange is the very first install claiming the
  // page via clientsClaim. The page came straight from the network, so its
  // chunks already match the current deploy — reloading gains nothing and
  // COSTS a phantom full reload seconds into every first-time visit (and
  // made every fresh-profile Playwright test flaky: focus lost, "execution
  // context destroyed", ERR_ABORTED — the chronic smoke reds of 2026-07-22).
  const hadControllerAtLoad = Boolean(navigator.serviceWorker?.controller);
  let reloadingFromSW = false;
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (!hadControllerAtLoad) return;
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
