import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      // Auto-update SW when new version deploys
      registerType: "autoUpdate",
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
          // Supabase REST — NetworkFirst with fast timeout
          {
            urlPattern: /^https:\/\/ajvlcamxemgbxduhiqrl\.supabase\.co\/rest\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-rest",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 100, maxAgeSeconds: 5 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
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
            "@dnd-kit/sortable",
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
}));
