/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Injected at build time (vite.config.ts `define`) — the same per-build token
// appended to the entry filename. "dev" outside production builds.
declare const __BUILD_ID__: string;
