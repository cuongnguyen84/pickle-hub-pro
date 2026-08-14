/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Injected at build time (vite.config.ts `define`) — the same per-build token
// appended to the entry filename. "dev" outside production builds.
declare const __BUILD_ID__: string;

// Build-time switch for the shop prototype (D4, 2026-08-11). Absent in a
// production build, "1" under `npm run dev:proto` / `npm run build:proto`.
interface ImportMetaEnv {
  readonly VITE_PROTO_SHOP?: string;
}
