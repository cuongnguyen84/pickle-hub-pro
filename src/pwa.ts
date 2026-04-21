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

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Auto-update on next load — no user prompt needed.
      // Could show a toast here instead if we want users to opt in.
      updateSW(true);
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
