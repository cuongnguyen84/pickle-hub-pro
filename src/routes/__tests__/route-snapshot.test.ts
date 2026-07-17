// ============================================================================
// ARCH-05 characterization net — snapshot of every <Route> in src/App.tsx.
// ----------------------------------------------------------------------------
// Locks path + element JSX (component, props, ViLanguageWrapper, auth wrapper)
// for all routes BEFORE the /vi mirror collapse. The refactor PR must keep
// this file green except for its declared, intentional diffs — a silently
// dropped /vi entry falls to the catch-all NotFound while bot prerender stays
// 200, so no other gate catches it (docs/proposals/arch-05-vi-route-mirror).
//
// Regenerate after an INTENTIONAL route change:
//   node -e 'see extractRoutes below — same regex' (or update by hand; the
//   diff review is the point).
// ============================================================================
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import snapshot from "./route-snapshot.json";

interface RouteEntry {
  path: string;
  element: string;
}

function extractRoutes(source: string): RouteEntry[] {
  const re = /<Route\s+path="([^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g;
  const routes: RouteEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    routes.push({ path: m[1], element: m[2].replace(/\s+/g, " ").trim() });
  }
  return routes;
}

describe("App.tsx route table characterization", () => {
  const source = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");
  const actual = extractRoutes(source);

  it("extractor sees every <Route> tag (guards against JSX shape drift)", () => {
    const tagCount = (source.match(/<Route /g) ?? []).length;
    expect(actual.length).toBe(tagCount);
  });

  it("route table matches the checked-in snapshot exactly", () => {
    expect(actual).toEqual(snapshot);
  });

  it("every /vi route keeps its language mechanism or is a redirect", () => {
    const viRoutes = actual.filter((r) => r.path === "/vi" || r.path.startsWith("/vi/"));
    expect(viRoutes.length).toBeGreaterThanOrEqual(63);
    const KNOWN_UNWRAPPED = new Set([
      // Navigate/redirect aliases — no UI, wrapper irrelevant
      "/vi/su-kien",
      "/vi/su-kien/:slug/live",
      "/vi/u/:slug",
      // Historical inconsistencies, tracked in ARCH-05 (Feed/Rankings get the
      // wrapper in the refactor PR; SocialEventLive deferred pending socket audit)
      "/vi/social/:slug/live",
      "/vi/rankings",
      "/vi/feed",
    ]);
    for (const r of viRoutes) {
      if (KNOWN_UNWRAPPED.has(r.path)) continue;
      expect(
        r.element.includes("ViLanguageWrapper"),
        `${r.path} lost its ViLanguageWrapper`,
      ).toBe(true);
    }
  });
});
