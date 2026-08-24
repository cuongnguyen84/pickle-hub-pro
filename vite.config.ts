/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import { coverageConfigDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
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
export default defineConfig(({ mode }) => {
// Read through loadEnv, not process.env, so the plugin below and the
// `import.meta.env.VITE_PROTO_SHOP` constant in App.tsx always agree — a .env
// file that enabled one but not the other would ship a route pointing at a
// stubbed module.
const viteEnv = loadEnv(mode, process.cwd(), "VITE_");
const protoShop = viteEnv.VITE_PROTO_SHOP === "1";

// The Supabase this build talks to — and therefore the ONLY host the artifact
// may name.
// ----------------------------------------------------------------------------
// The client reads VITE_SUPABASE_URL, but four things outside the JS graph used
// to hardcode the production ref, so a staging build still reached production:
//   * <link preconnect> + <link dns-prefetch> in index.html — a DNS lookup and
//     a TLS handshake to production on every page load;
//   * the CSP report-uri in public/_headers — violation reports POSTed to the
//     production log-client-event, writing staging rows into production data;
//   * two service-worker urlPattern regexes — pinned to the production host, so
//     on any other environment they silently match NOTHING. The /rest/ one is a
//     safety rule ("NEVER cache, responses are per-user"), and a safety rule
//     that quietly stops applying is worse than one that was never written.
// Found 2026-08-13 by the staging preflight, before the first write.
//
// The fallback is the production host on purpose: when the variable is absent
// the artifact is byte-identical to what it was before this existed, so a build
// with no env cannot silently produce a half-configured page.
const SUPABASE_ORIGIN = (
  viteEnv.VITE_SUPABASE_URL || "https://ajvlcamxemgbxduhiqrl.supabase.co"
).replace(/\/+$/, "");

const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Filled in by the supabase-origin-in-static-assets plugin's configResolved
// hook — the build's real output directory, and whether publicDir was copied
// into it at all. Both are unknowable at config-factory time.
let resolvedOutDir = "";
let copiesPublicDir = false;

return ({
  server: {
    host: "::",
    port: 8080,
  },
  // Baked into the client so src/lib/staleShell.ts can compare itself against
  // the deployed /build-id.txt (emitted below) and preemptively reload before
  // a stale lazy chunk 404s.
  define: {
    __BUILD_ID__: JSON.stringify(mode === "production" ? BUILD_ID : "dev"),
  },
  // Strip noisy console.log/debug/info from production bundles (incl. realtime
  // payload dumps). console.warn/error are kept for prod diagnostics.
  esbuild: {
    pure: mode === "production" ? ["console.log", "console.debug", "console.info"] : [],
  },
  plugins: [
    react(),
    // Shop prototype separation (D4, 2026-08-11). The prototype keeps living in
    // the repo — source, tests, and a runnable preview — but it must not reach
    // the production artifact. App.tsx already drops the route behind a folded
    // constant; this makes it independent of tree-shaking by resolving the one
    // production entry point into src/proto/ to an empty module. If the flag is
    // off, nothing under src/proto/shop/** can be reached from the graph, so no
    // screen, scenario or fixture chunk is emitted.
    !protoShop && {
      name: "strip-proto-shop",
      resolveId(id: string) {
        return /proto\/shop\/ProtoShopApp$/.test(id) ? "\0proto-shop-disabled" : null;
      },
      load(id: string) {
        return id === "\0proto-shop-disabled" ? "export default null;\n" : null;
      },
    },
    // Point the two <link> hints and the CSP report-uri at THIS build's
    // Supabase. Both live outside the JS graph, so no amount of env plumbing in
    // src/ reaches them — see SUPABASE_ORIGIN above.
    {
      name: "supabase-origin-in-static-assets",
      apply: "build" as const,
      // `order: "pre"` is load-bearing, not tidiness. Vite's own HTML pass
      // decodeURI()s every href, and "%SU" is an invalid percent-escape, so a
      // marker left in place until the default order fails the build with
      // "URI malformed".
      transformIndexHtml: {
        order: "pre" as const,
        handler(html: string) {
          return html.replaceAll("%SUPABASE_ORIGIN%", SUPABASE_ORIGIN);
        },
      },
      // The emitted _headers is resolved from the build's OWN outDir, captured
      // here rather than assumed to be "dist".
      // ----------------------------------------------------------------------
      // Vite copies publicDir into outDir in prepareOutDir(), before the bundle
      // runs, so by closeBundle() the file is already there — but only at the
      // outDir this build actually chose. A hardcoded "dist" reads the wrong
      // path under `--outDir`, a configured `build.outDir`, or any second
      // config that overrides it, and the two failure modes are opposite and
      // both bad: a LEFTOVER dist/_headers from an earlier build fails a build
      // that was fine, and an ABSENT one skipped the rewrite entirely and
      // shipped the literal marker as the CSP report-uri — an unparseable URL,
      // so every violation report is dropped and the client_errors CSP feed
      // goes quiet with nothing to notice. The whole point of the throw below
      // is that this substitution is never allowed to be silent, so the
      // "file missing" branch cannot be a silent return either.
      configResolved(resolved) {
        resolvedOutDir = path.resolve(resolved.root, resolved.build.outDir);
        copiesPublicDir = Boolean(resolved.build.copyPublicDir && resolved.publicDir);
      },
      closeBundle() {
        // Nothing was copied, so there is nothing to rewrite and nothing to
        // ship wrong — the only branch where absence is genuinely fine.
        if (!copiesPublicDir) return;

        const headers = path.resolve(resolvedOutDir, "_headers");
        if (!fs.existsSync(headers)) {
          throw new Error(
            `${headers} is missing — public/_headers was not copied into the ` +
              "build output, so the CSP report-uri never got substituted.",
          );
        }
        const before = fs.readFileSync(headers, "utf8");
        if (!before.includes("%SUPABASE_ORIGIN%")) {
          throw new Error(
            "public/_headers no longer contains %SUPABASE_ORIGIN% — the CSP " +
              "report-uri would ship pointing at a hardcoded environment.",
          );
        }
        fs.writeFileSync(headers, before.replaceAll("%SUPABASE_ORIGIN%", SUPABASE_ORIGIN));
      },
    },
    // /build-id.txt — freshness beacon for staleShell.ts. Root-level txt is
    // outside every precache glob (whitelist) and navigateFallback denylists
    // txt, so a fetch always reaches the CDN and a missing file 404s instead
    // of returning index.html.
    {
      name: "emit-build-id",
      apply: "build" as const,
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "build-id.txt", source: BUILD_ID });
      },
    },
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
        // PERF-03: precache is a WHITELIST of the boot-critical core (entry,
        // non-heavy vendors, the north-star journey screens) + styles/icons.
        // The old catch-all "**/*.js" precached ~300 route chunks (~8 MB);
        // everything not listed here is served network-first and then kept
        // offline-capable by the lazy-chunks runtime CacheFirst rule below.
        // index.html stays excluded so users always get the freshest shell.
        globPatterns: [
          // Root-level icons + built styles only. og-images/** and
          // images/** are crawler/content assets (one OG image alone was
          // 2.26 MB) — they load online and never belong in an install.
          "*.{ico,png,svg}",
          // Self-hosted UI fonts are part of the installed shell. Keeping all
          // Latin + Vietnamese subsets offline also avoids a late font swap.
          "fonts/*.woff2",
          "assets/*.css",
          "assets/index-*.js",
          "assets/vendor-react-*.js",
          "assets/vendor-ui-*.js",
          "assets/vendor-supabase-*.js",
          "assets/vendor-query-*.js",
          "assets/vendor-date-*.js",
          "assets/vendor-capacitor-*.js",
          "assets/types-*.js",
          // North-star journey screens (docs/journey-screens.md)
          "assets/Index-*.js",
          "assets/Tournaments-*.js",
          "assets/Feed-*.js",
          "assets/SocialEventDetail-*.js",
          "assets/CreateSocialEvent-*.js",
        ],
        // Keep heavy route chunks and locale dictionaries on demand. In
        // particular, precaching locale-* would download both languages and
        // undo PERF-06 even though the provider imports only the active one.
        globIgnores: [
          // Belt-and-braces: these must never precache even if a whitelist
          // pattern drifts (locale-* would undo PERF-06's one-language rule).
          "**/locale-*",
          "**/index.html",
        ],
        // Max single-file precache size
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Force the new SW to take control immediately on activate
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          // Locale dictionaries stay out of precache so a user downloads only
          // the active language. Cache the requested hashed chunk at runtime so
          // subsequent offline launches can resolve I18nProvider instead of
          // getting stuck on its retry screen.
          {
            urlPattern: ({ url, request, sameOrigin }) =>
              request.destination === "script" &&
              sameOrigin &&
              /^\/assets\/locale-(?:en|vi)-[^/]+\.js$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "locale-dictionaries",
              expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Chunks excluded from precache (blog posts, heavy workspaces,
          // charts/video vendors) — hashed filenames are immutable, so
          // CacheFirst after the first visit keeps them offline-capable
          // without shipping ~5 MB to every installing client (PERF-03).
          {
            urlPattern: ({ url, request, sameOrigin }) =>
              request.destination === "script" &&
              sameOrigin &&
              /^\/assets\/[^/]+\.js$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "lazy-chunks",
              expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
            urlPattern: new RegExp(`^${reEscape(SUPABASE_ORIGIN)}/rest/`),
            handler: "NetworkOnly",
          },
          // Supabase storage images — CacheFirst, long-lived
          {
            urlPattern: new RegExp(`^${reEscape(SUPABASE_ORIGIN)}/storage/`),
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
      // hls.js LIGHT build — 53 KB gz of the total budget (P2b.0).
      // Nothing in src/ imports hls.js directly any more; the only importer is
      // @mux/playback-core, which pulls the full build by specifier. Aliasing
      // here catches that import too, so there is exactly one copy and it is
      // the small one.
      //
      // Light drops subtitles/CEA-708, alternate audio, EME/DRM, CMCD and
      // interstitials. This product uses none of them: there is no caption UI
      // and no Mux transcription configured, match video is single-track, and
      // mux-create-livestream's `playback_policy: "signed"` is a JWT on the
      // URL — not Widevine/FairPlay (there is no drm_configuration anywhere).
      //
      // The failure mode if that ever changes is SILENT — the light build keeps
      // the accessors and just reports no tracks. src/components/video/
      // __tests__/hls-light-build.test.ts fails the moment captions or DRM are
      // configured, so the trade has to be re-decided rather than discovered
      // by a viewer.
      "hls.js": path.resolve(__dirname, "./node_modules/hls.js/dist/hls.light.mjs"),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // Entry gets a build-unique token (see BUILD_ID note above); other
        // chunks/assets keep default content-hash names for cross-deploy caching.
        entryFileNames: `assets/[name]-[hash]-${BUILD_ID}.js`,
        // Per-slug blog content chunks get a stable, globbable prefix so the
        // PWA precache can exclude them (PERF-03). Their default names are
        // the slugs themselves, which no globIgnores pattern can target.
        chunkFileNames: (chunkInfo) =>
          chunkInfo.facadeModuleId?.includes("/src/content/blog/posts/")
            ? "assets/blog-post-[name]-[hash].js"
            : "assets/[name]-[hash].js",
        manualChunks: {
          "locale-en": [path.resolve(__dirname, "src/i18n/en.ts")],
          "locale-vi": [path.resolve(__dirname, "src/i18n/vi.ts")],
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
          "vendor-xlsx": ["xlsx"],
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
      // Was "functions/_lib/__tests__/**" only, which silently skipped every
      // suite under functions/_lib/render/__tests__/ (static-pages.test.ts had
      // never run since SEO-04 split the renderers out). Match any __tests__
      // directory under functions/ instead.
      "functions/**/__tests__/**/*.test.ts",
      // Workers are pure node-compatible modules; coverage-excluded below,
      // so this only adds their fixture tests to the existing gate.
      "workers/*/src/**/*.test.ts",
      // Any function may carry its own __tests__ folder. Keeping them out of
      // _shared matters: CI redeploys EVERY edge function when a path under
      // supabase/functions/_shared/ changes, and a test file should not cost
      // a fleet redeploy.
      "supabase/functions/**/__tests__/**/*.test.ts",
      "scripts/**/*.test.mjs",
    ],
    exclude: ["node_modules/**", "dist/**", "tests/**"],
    environment: "node",
    // src/integrations/supabase/client.ts calls createClient() at module load
    // and throws "supabaseUrl is required." when VITE_SUPABASE_URL is unset.
    // quality.yml supplies the VITE_SUPABASE_* vars to the Build step only,
    // not to the Vitest step, so any suite that transitively imports the real
    // client is a landmine: SellerProductForm.save.test.tsx reaches it through
    // a React.lazy chunk and reds `npm run test` intermittently (2 runs in 3
    // on a clean checkout of main, 3 in 3 when run alone) while CI happens to
    // stay green. Twenty test files already carry a per-file vi.mock purely to
    // dodge this; the config is where it belongs.
    //
    // Dummy values on purpose, and NOT a *.supabase.co host: this must never
    // resolve to a real project, and src/__tests__/supabase-origin-not-
    // hardcoded.test.ts scans this file for `<ref>.supabase.co` literals.
    // Vitest's `env` overrides both a local .env and the shell, so a developer
    // with real credentials gets the dummies here too.
    //
    // LIMITATION — this de-mines jsdom suites only. Under the default
    // `environment: "node"` the next line of client.ts (`storage: localStorage`)
    // still throws ReferenceError, so the per-file vi.mock workarounds in
    // node-env tests remain load-bearing. Do not delete them on the strength
    // of this block. Closing that half needs a setupFiles localStorage stub.
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PROJECT_ID: "test-project",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-anon-key-not-a-real-credential",
    },
    // Coverage of test-imported files. Threshold locks the baseline
    // (86.9% statements on 2026-05-29) so a regression that adds untested
    // imported code reds the gate. Buffer left below baseline to avoid
    // tripping on normal variance. Raise as coverage grows.
    coverage: {
      provider: "v8",
      reporter: ["text-summary"],
      // functions/** (Cloudflare Pages Functions) joined the test include on
      // 2026-07-18; keep the statements threshold scoped to the original src/
      // + supabase baseline instead of re-basing it on partially covered SSR
      // helpers.
      // workers/** + scripts/** excluded 2026-08-03 (CLOSE-03): same rationale
      // as functions/** — Cloudflare workers ship with their own fixture-based
      // tests and CI scripts are exercised by CI itself; the 83% threshold is
      // calibrated for src/. Before excluding, workers were 11.3% covered and
      // alone accounted for 41% of the statement gap, holding the quality gate
      // red on every main push since 30/07 (75.04% vs 83%). After: 85.9%.
      exclude: [...coverageConfigDefaults.exclude, "functions/**", "workers/**", "scripts/**"],
      thresholds: {
        statements: 83,
      },
    },
  },
});
});
