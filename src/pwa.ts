/**
 * PWA service worker registration.
 *
 * Skips registration when running inside Capacitor native WebView to avoid
 * conflicts with native asset loading. Web browsers get the full PWA flow.
 */
import { registerSW } from "virtual:pwa-register";
import { Capacitor } from "@capacitor/core";

export function initPwa() {
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
