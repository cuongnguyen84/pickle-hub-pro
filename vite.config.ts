/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

// Unique-per-build token appended to the ENTRY chunk filename only.
// ----------------------------------------------------------------------------
// 2026-07-11 outage: the entry file (index-[hash].js) was served STALE from
// immutable caches (browser HTTP cache / SW / CDN edge) because a hashed entry
// filename ended up reused across builds with different content — the app hung
// at "Loading…" with no error. Rollup computes the entry hash from content that
// still references dependency chunks; that hash can collide across builds while
// the final rewritten content differs. Appending a build token guarantees the
// entry filename is globally unique every deploy, so no immutable cache can ever
// serve a mismatched entry. Vendor/lazy chunks keep pure content-[hash] naming,
// so unchanged chunks stay cached (no needless re-download on Vietnam mobile).
const BUILD_ID = Date.now().toString(36);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  // Strip noisy console.log/debug/info from production bundles (incl. realtime
  // payload dumps). console.warn/error are kept for prod diagnostics.
  esbuild: {
    pure: mode === "production" ? ["console.log", "console.debug", "console.info"] : [],
  },
  plugins: [
    react(),
    // Bundle analysis — opt-in via ANALYZE=1 to avoid slowing every prod build.
    process.env.ANALYZE === "1" &&
      visualizer({
        filename: "dist/stats.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
    VitePWA({
      // Auto-update SW when new version deploys
      registerType: "autoUpdate",
      // Đổi tên khỏi sw.js: CDN từng cache /sw.js 29 ngày (rule /*.js immutable
      // trong _headers) → client cài mãi SW cũ, kẹt bundle cũ. sw-v2.js cũng bị
      // CDN cache immutable ngay sau deploy (Pages không cho rule cụ thể override
      // rule /*.js) → bump v3 sau khi _headers đã BỎ hẳn /*.js. KHÔNG đổi lại
      // tên cũ kể cả khi purge CDN.
      filename: "sw-v3.js",
      // Register SW at runtime (we do manual registration in src/pwa.ts so we can
      // skip it inside Capacitor native WebView — see src/pwa.ts)
      injectRegister: null,
      // Static assets to include in precache
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "android-chrome-192x192.png",
        "android-chrome-512x512.png",
        "og-image.png",
        "robots.txt",
      ],
      manifest: {
        name: "ThePickleHub",
        short_name: "TPH",
        description: "Pickleball tournaments, livestream & community — Asia-first",
        theme_color: "#0D3A1F",
        background_color: "#181b20",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "vi",
        categories: ["sports", "news", "social"],
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache hashed build assets only — EXCLUDE index.html so users
        // always get the freshest shell after deploy. Prevents the "flash
        // of old UI then auto-reload" pattern that surfaced post Phase 4.
        globPatterns: ["**/*.{js,css,ico,png,svg,woff,woff2}"],
        // Don't precache huge chunks — let them lazy load on demand
        globIgnores: ["**/vendor-video*", "**/blog-data*", "**/index.html"],
        // Max single-file precache size
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Force the new SW to take control immediately on activate
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          // Navigation requests (HTML shell) — NetworkFirst with short
          // timeout. Online users always see the latest shell, offline
          // users still get a recent cached copy.
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-shell",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 5, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase REST — NEVER cache. Responses are per-user (RLS +
          // bearer token); a URL-keyed cache could serve account A's data to
          // account B on a shared device when the network times out. The
          // legacy "supabase-rest" cache from the old NetworkFirst rule is
          // purged client-side (src/lib/pwa/cache.ts) on boot + sign-out.
          {
            urlPattern: /^https:\/\/ajvlcamxemgbxduhiqrl\.supabase\.co\/rest\//,
            handler: "NetworkOnly",
          },
          // Supabase storage images — CacheFirst, long-lived
          {
            urlPattern: /^https:\/\/ajvlcamxemgbxduhiqrl\.supabase\.co\/storage\//,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage",
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Mux thumbnails / poster images
          {
            urlPattern: /^https:\/\/image\.mux\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "mux-images",
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google user avatars
          {
            urlPattern: /^https:\/\/lh3\.googleusercontent\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-avatars",
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts CSS
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-css",
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          // Google Fonts webfonts
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Own-domain images
          {
            urlPattern: /\.(png|jpg|jpeg|webp|avif|svg|gif)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "site-images",
              expiration: { maxEntries: 150, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // SPA fallback for client-side routes
        navigateFallback: "/index.html",
        // Don't fallback for these — let server/CDN handle
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/functions\//,
          /^\/og\//,
          /^\/sitemap/,
          /^\/robots\.txt/,
          /^\/.well-known/,
          /\.(xml|txt|json)$/,
        ],
      },
      devOptions: {
        enabled: false,
        type: "module",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // Entry gets a build-unique token (see BUILD_ID note above); other
        // chunks/assets keep default content-hash names for cross-deploy caching.
        entryFileNames: `assets/[name]-[hash]-${BUILD_ID}.js`,
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-ui": [
            "sonner",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
          ],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-dnd": [
            "@dnd-kit/core",
            "@dnd-kit/utilities",
          ],
          "vendor-charts": ["recharts"],
          "vendor-date": ["date-fns"],
          "vendor-capacitor": [
            "@capacitor/core",
            "@capacitor/app",
            "@capacitor/browser",
            "@capacitor/push-notifications",
            "@capacitor/splash-screen",
            "@capacitor/status-bar",
          ],
          "vendor-video": ["@mux/mux-player-react", "hls.js"],
        },
      },
    },
  },
  // Ensure static files in public folder are served with correct MIME types
  assetsInclude: ["**/*.xml"],
  // Vitest — src/ unit tests PLUS the pure, Deno-free helper tests co-located
  // under supabase/functions/_shared/__tests__ (dupr-parser, dupr-validation,
  // token-crypto). Those were vitest-syntax but previously unrun because the
  // blanket `supabase/**` exclude swallowed them. The exclude now targets only
  // the edge functions that import `Deno.*` (which can't run under node), not
  // the shared pure helpers. Playwright specs in tests/ use @playwright/test,
  // not vitest, so they stay excluded.
  test: {
    include: [
      "src/**/*.test.{ts,tsx}",
      "supabase/functions/_shared/__tests__/**/*.test.ts",
    ],
    exclude: ["node_modules/**", "dist/**", "tests/**"],
    environment: "node",
    // Coverage of test-imported files. Threshold locks the baseline
    // (86.9% statements on 2026-05-29) so a regression that adds untested
    // imported code reds the gate. Buffer left below baseline to avoid
    // tripping on normal variance. Raise as coverage grows.
    coverage: {
      provider: "v8",
      reporter: ["text-summary"],
      thresholds: {
        statements: 83,
      },
    },
  },
}));
