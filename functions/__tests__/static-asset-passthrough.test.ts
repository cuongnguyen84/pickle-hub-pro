/**
 * Every file that ships in the deploy must reach `next()` in
 * functions/_middleware.ts. A path that matches none of the static-asset rules
 * falls through to the SPA soft-404 guard and is answered with an HTML 404 —
 * while the file itself sits in the build output, perfectly fine, 200-able.
 *
 * `/manifest.webmanifest` failed exactly that way: STATIC_EXACT still carried
 * the pre-vite-plugin-pwa name `/manifest.json`, so Chrome could not read the
 * PWA manifest and install / "Add to Home Screen" was unavailable sitewide.
 * Nothing on the page breaks visibly when a manifest 404s, so it went unseen
 * for months.
 *
 * Two halves, because the failure had two hiding places:
 *  - the walk covers public/, which is most files but NOT the manifest;
 *  - BUILD_EMITTED covers what vite/vite-plugin-pwa write straight into the
 *    build output, which is where this bug actually lived.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { isStaticAssetPath, isWellKnownPath, onRequest } from "../_middleware";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC_DIR = path.join(REPO_ROOT, "public");

/**
 * Files that are deliberately NOT served as static assets.
 *
 * `design-explorations/` is an internal styling prototype: committed so the
 * explorations stay reviewable in the repo, but it has no business being a
 * public URL, and a 404 is the correct answer for it.
 *
 * Dotfiles (`.DS_Store` and friends) are OS/editor droppings. They are already
 * gitignored, so they never reach a Cloudflare build — this only keeps a local
 * `npm run test` from failing on one sitting in a contributor's public/.
 */
const INTENTIONALLY_NOT_SERVED = [/^\/design-explorations\//, /(^|\/)\.[^/]+$/];

/**
 * Written into the build output by vite / vite-plugin-pwa, so a public/ walk
 * cannot see them. Keep in sync with `vite.config.ts` (VitePWA `filename`,
 * the manifest, and the emit-build-id plugin).
 */
const BUILD_EMITTED = [
  "/manifest.webmanifest",
  "/sw-v3.js",
  "/workbox-2da51cb1.js",
  "/build-id.txt",
];

function walk(dir: string, prefix = ""): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const urlPath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) return walk(path.join(dir, entry.name), urlPath);
    return [urlPath];
  });
}

const shippedFiles = walk(PUBLIC_DIR).filter(
  (urlPath) => !INTENTIONALLY_NOT_SERVED.some((re) => re.test(urlPath)),
);

const invoke = (pathname: string, nextResponse: Response) =>
  onRequest({
    request: new Request(`https://www.thepicklehub.net${pathname}`, {
      headers: { Accept: "text/html" },
    }),
    env: {
      CANONICAL_HOST: "https://www.thepicklehub.net",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test",
    },
    next: async () => nextResponse,
  } as never);

const html = (body: string) =>
  new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });

describe("static asset passthrough", () => {
  it("finds files to check (guards against a silently empty walk)", () => {
    expect(shippedFiles.length).toBeGreaterThan(10);
  });

  it.each(shippedFiles)("lets %s through to the asset handler", (urlPath) => {
    // .well-known/* has its own bypass earlier in the middleware.
    expect(isStaticAssetPath(urlPath) || isWellKnownPath(urlPath)).toBe(true);
  });

  it.each(BUILD_EMITTED)("lets build-emitted %s through", (urlPath) => {
    expect(isStaticAssetPath(urlPath)).toBe(true);
  });

  it("serves the PWA manifest under both its current and legacy name", () => {
    expect(isStaticAssetPath("/manifest.webmanifest")).toBe(true);
    expect(isStaticAssetPath("/manifest.json")).toBe(true);
  });

  it("serves root site-ownership verifier files", () => {
    expect(isStaticAssetPath("/zalo_verifierAbC-123_xyz.html")).toBe(true);
    expect(isStaticAssetPath("/BingSiteAuth.xml")).toBe(true);
  });

  it("still treats SPA routes as SPA routes", () => {
    for (const spaPath of [
      "/",
      "/vi",
      "/tournaments",
      "/vi/blog/shenzhen-open-2026-lich-thi-dau-cach-xem",
      "/nguoi-choi/tran-thi-b",
      "/tools/team-match",
      "/san/khu-vuc/ho-chi-minh",
      "/live/6277dca2-b5e5-41b2-9abd-0a7815c829a9",
    ]) {
      expect(isStaticAssetPath(spaPath)).toBe(false);
    }
  });
});

describe("static asset passthrough — end to end through onRequest", () => {
  it("returns the manifest as served, not an HTML 404", async () => {
    const manifest = new Response('{"name":"ThePickleHub"}', {
      headers: { "Content-Type": "application/manifest+json" },
    });
    const res = await invoke("/manifest.webmanifest", manifest);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"name":"ThePickleHub"}');
  });

  /**
   * The regression this test exists for: root verification files are genuinely
   * text/html, and the "asset came back as the SPA shell" guard would happily
   * turn their correct 200 into a 404 — silently un-verifying the domain.
   */
  it("passes an html verification file through despite the html guard", async () => {
    const res = await invoke(
      "/zalo_verifierN8wI0DoU1LuMZTLxa8rSHHI2-M7uz2mvEJGm.html",
      html("zalo-verifier-token"),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("zalo-verifier-token");
  });

  it("still 404s a hashed asset that came back as the SPA shell", async () => {
    const res = await invoke("/assets/Missing-abc123.js", html("<!DOCTYPE html>"));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/plain");
  });
});

describe("_routes.json stays consistent with the middleware", () => {
  const routes = JSON.parse(
    fs.readFileSync(path.join(PUBLIC_DIR, "_routes.json"), "utf8"),
  ) as { exclude: string[] };

  it("excludes the PWA manifest so Pages serves it without a Function hop", () => {
    expect(routes.exclude).toContain("/manifest.webmanifest");
  });

  /**
   * Root .html verifiers must NOT be excluded. Cloudflare Pages' own static
   * handler applies html_handling to anything it serves directly, so an
   * excluded `/foo.html` gets a 308 to the extensionless `/foo` — which is not
   * a static path, falls into the SPA guard, and 404s. Verified on preview
   * a37fe065. They go through the Function, which returns the file as-is.
   */
  it("does not exclude root .html verifiers (Pages would 308 away the .html)", () => {
    for (const excluded of routes.exclude) {
      expect(excluded.endsWith(".html")).toBe(false);
    }
  });

  it("keeps every excluded path servable if the exclude list is ever trimmed", () => {
    for (const excluded of routes.exclude) {
      if (excluded === "/_routes.json") continue; // never served, by design
      expect(isStaticAssetPath(excluded)).toBe(true);
    }
  });
});
