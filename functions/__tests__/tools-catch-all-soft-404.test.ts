import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { isKnownSpaPath } from "../_lib/spa-routes";

/**
 * routeAndRender used to end its /tools block with a bare
 *
 *   if (path.startsWith("/tools")) return renderTools(...)
 *
 * which handed a 200 copy of the tools hub to EVERY /tools-prefixed path.
 * Verified on production 2026-09-04 with a Googlebot UA:
 *
 *   /tools/pickleball-bracket-generator  bot 200 / human 404
 *   /tools/foo/bar                       bot 200 / human 404
 *   /toolsPhone                          bot 200 / human 404
 *   /vi/tools/anything                   bot 200 / human 404
 *
 * The human column is the correct one — the user path 404s anything that
 * fails isKnownSpaPath. So this was a soft 404: unlimited crawler-invented
 * URLs each served a duplicate of the hub, the /tools/* ones cached in KV
 * (canonicalConsistent passes, both sides sit in the `tools` segment), and
 * the /tools<x> ones writing a `prerender-canon:` row into client_errors on
 * every hit, which feeds the errors-telegram-alert spike cron. Two rows for
 * /toolsPhone already existed, i.e. it was generating false alerts.
 *
 * The guard below is the contract: /tools resolves to the hub, the /tools/*
 * routes the SPA genuinely owns still resolve to the hub (so bot and human
 * keep agreeing), and everything else falls through to render404.
 */

const MIDDLEWARE = readFileSync(
  resolve(import.meta.dirname, "../_middleware.ts"),
  "utf8",
);

describe("/tools catch-all no longer soft-404s", () => {
  it("matches the tools hub exactly, never by prefix", () => {
    expect(MIDDLEWARE).toContain(
      'if (path === "/tools") return renderTools(siteUrl, rawPath, lang);',
    );
    // The regression, verbatim. If this string ever comes back, so does the bug.
    expect(MIDDLEWARE).not.toContain('if (path.startsWith("/tools")) return renderTools');
  });

  it("keeps serving the SPA-owned /tools/* routes that have no renderer", () => {
    expect(MIDDLEWARE).toContain(
      'if (path.startsWith("/tools/") && isKnownSpaPath(path)) {',
    );
    // These reach the guard because no arm above them matches; they are real
    // routes and humans get 200, so bots must not get a 404.
    for (const path of [
      "/tools/quick-tables/parent/abc",
      "/tools/quick-tables/abc/setup",
      "/tools/quick-tables/referee/abc",
      "/tools/team-match/match/abc/score",
      "/tools/doubles-elimination/match/abc/score",
    ]) {
      expect(isKnownSpaPath(path)).toBe(true);
    }
  });

  it("rejects the invented paths that were being served the hub", () => {
    for (const path of [
      "/tools/pickleball-bracket-generator",
      "/tools/foo/bar",
      "/tools/not-a-real-tool",
      "/vi/tools/anything",
    ]) {
      expect(isKnownSpaPath(path)).toBe(false);
    }
    // /toolsPhone never even enters the block: it is not "/tools" and does
    // not start with "/tools/". Same two conditions the guard uses.
    const entersToolsBlock = (p: string) => p === "/tools" || p.startsWith("/tools/");
    expect(entersToolsBlock("/toolsPhone")).toBe(false);
    expect(entersToolsBlock("/toolsets")).toBe(false);
    expect(entersToolsBlock("/tools")).toBe(true);
  });

  it("bumps the prerender cache key so the cached duplicates expire", () => {
    const match = MIDDLEWARE.match(/const cacheKey = `pr:v(\d+):/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(90);
  });
});

describe("IndexNow does not announce robots-disallowed URLs", () => {
  const INDEXNOW = readFileSync(
    resolve(import.meta.dirname, "../api/indexnow.ts"),
    "utf8",
  );
  const ROBOTS = readFileSync(
    resolve(import.meta.dirname, "../../public/robots.txt"),
    "utf8",
  );

  it("drops /tools/dashboard, which robots.txt Disallows", () => {
    expect(ROBOTS).toContain("Disallow: /tools/dashboard");
    expect(INDEXNOW).not.toContain("${HOST}/tools/dashboard`");
  });
});
