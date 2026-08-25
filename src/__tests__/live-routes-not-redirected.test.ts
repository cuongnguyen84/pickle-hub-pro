// ============================================================================
// A live React route must never also be an edge redirect source.
// ----------------------------------------------------------------------------
// Cloudflare Pages runs functions/_middleware.ts, then public/_redirects, and
// only then falls through to the SPA shell. So a 301 declared for a path that
// App.tsx still renders a component on does not "clean up an old URL" — it
// deletes the page for every human who loads that URL directly (typed,
// bookmarked, shared, hard-refreshed). In-app <Link> navigation keeps working,
// which is exactly why the breakage is easy to miss in manual testing.
//
// Regression: 2026-08-23 (#650) added
//   /dupr -> /vi/blog/dupr-la-gi-huong-dan-cho-nguoi-choi-viet-nam  301
// to both files, labelled "Retired /dupr landing", to clear a GSC
// "Not found (404)". /dupr was not retired: it is
// <RequireAuth><DuprConnect /></RequireAuth>, the DUPR account-linking screen,
// linked from eight product surfaces — and two blog posts instruct readers to
// type thepicklehub.net/dupr by hand when the header button does not appear.
// That documented fallback landed on an explainer article for 2 days.
// Caught by the nightly Playwright auth suite, not by any unit test.
//
// The fix for a route that should not be indexed is NOINDEX_PATTERNS (bot-side,
// after the `if (!isBot)` branch) or GONE_EXACT — never a redirect that also
// runs for users.
//
// Exempt: routes whose element is <Navigate to=... />. There the SPA redirects
// too, so the edge rule and the client agree (/livestream, /su-kien).
//
// Paths are compared verbatim, NOT trailing-slash-normalised: "/vi/" -> "/vi"
// is a canonicalisation redirect that must stay legal even though "/vi"
// renders the homepage. Collapsing the two would make it look like a clash.
// ============================================================================

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import routeSnapshot from "../routes/__tests__/route-snapshot.json";

const redirectsFile = readFileSync("public/_redirects", "utf8");
const middlewareSource = readFileSync("functions/_middleware.ts", "utf8");

const isLiteral = (p: string): boolean =>
  p.startsWith("/") && !p.includes(":") && !p.includes("*");

/** Every App.tsx route that renders a component, keyed by path. */
function renderingRoutes(): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node === null || typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    const path = rec.path;
    const element = typeof rec.element === "string" ? rec.element : "";
    // <Navigate to="..."/> is a client-side redirect, not a rendering page.
    if (typeof path === "string" && isLiteral(path) && !/^<Navigate\b/.test(element.trim())) {
      out.set(path, element);
    }
    Object.values(rec).forEach(walk);
  };
  walk(routeSnapshot);
  return out;
}

/** Literal redirect sources declared in public/_redirects. */
function redirectSourcesFromFile(): string[] {
  const out: string[] = [];
  for (const line of redirectsFile.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const [from, , status] = t.split(/\s+/);
    if (!from || !isLiteral(from)) continue;
    // The SPA fallback (/* 200) and any rewrite are not redirects.
    if (!/^3\d\d$/.test(status ?? "")) continue;
    out.push(from);
  }
  return out;
}

/**
 * Literal redirect sources in the middleware: `url.pathname === "X"` whose
 * block immediately returns secureRedirect(). Scoped this tightly on purpose —
 * the same comparison also guards non-redirect branches (the `/` and `/vi`
 * markdown views), which must not trip this test.
 */
function redirectSourcesFromMiddleware(): string[] {
  const out: string[] = [];
  const guarded = /url\.pathname === "([^"]+)"\)\s*\{\s*return secureRedirect\(/g;
  for (const m of middlewareSource.matchAll(guarded)) {
    if (isLiteral(m[1])) out.push(m[1]);
  }
  return out;
}

describe("live React routes are not shadowed by an edge redirect", () => {
  const routes = renderingRoutes();

  it("route snapshot loaded", () => {
    expect(routes.size).toBeGreaterThan(50);
  });

  it.each([
    ["public/_redirects", redirectSourcesFromFile],
    ["functions/_middleware.ts", redirectSourcesFromMiddleware],
  ])("%s redirects no path that App.tsx renders", (_label, collect) => {
    const clashes = collect()
      .filter((p) => routes.has(p))
      .map((p) => `${p} -> renders ${routes.get(p)}`);
    expect(clashes).toEqual([]);
  });
});
