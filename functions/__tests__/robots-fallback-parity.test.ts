import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * public/robots.txt is the static fallback; functions/robots.txt.ts is what
 * production actually serves (the Pages Function wins because _routes.json
 * includes "/*" and does not exclude /robots.txt).
 *
 * The two drifted silently and were found apart on 2026-08-20. The fallback
 * was missing sixteen rules:
 *   - the ten closed-pilot Shop Disallow rules (/shop$, /shop/category,
 *     /shop/product, /shop/store, /shop/search + the /vi mirrors), so a serve
 *     that fell back would have invited crawlers into the pilot catalogue;
 *   - the six Allow rules for the /tools/<tool>/new landing pages, so the same
 *     serve would have blocked three URLs that sitemap-static.xml submits —
 *     "Submitted URL blocked by robots.txt" in Search Console.
 *
 * Nothing in production read the stale copy, which is exactly why nobody
 * noticed. A fallback that is only consulted once something else has broken
 * has to be verified by the build, not by traffic.
 *
 * This asserts RULE PARITY, not byte equality: comments, blank lines and rule
 * ORDER may differ (the fallback carries an extra header block), but every
 * Allow/Disallow rule and every Sitemap line must match, per user-agent group.
 */

const FUNCTION_SOURCE = readFileSync(
  resolve(import.meta.dirname, "../robots.txt.ts"),
  "utf8",
);
const STATIC_FALLBACK = readFileSync(
  resolve(import.meta.dirname, "../../public/robots.txt"),
  "utf8",
);

/** The Shop block the Function emits when SHOP_PUBLIC_INDEXING !== "1". */
const SHOP_PILOT_CLOSED = `
Disallow: /shop$
Disallow: /shop/category
Disallow: /shop/product
Disallow: /shop/store
Disallow: /vi/shop$
Disallow: /vi/shop/category
Disallow: /vi/shop/product
Disallow: /vi/shop/store`;

/**
 * Render the Function's template literal in its DEFAULT (pilot closed) state.
 * The fallback must mirror that state: it is the conservative one, and a
 * fallback that opens the catalogue is the failure worth preventing.
 */
function renderFunctionBody(): string {
  const match = FUNCTION_SOURCE.match(/const body = `([\s\S]*?)`;/);
  if (!match) throw new Error("functions/robots.txt.ts: `const body = ...` template not found");
  const body = match[1]
    .replaceAll("${shopPilotDisallow}", SHOP_PILOT_CLOSED)
    .replaceAll("${siteUrl}", "https://www.thepicklehub.net");
  const leftovers = body.match(/\$\{[^}]+\}/g);
  if (leftovers) {
    throw new Error(
      `functions/robots.txt.ts has placeholders this test cannot render: ${leftovers.join(", ")}`,
    );
  }
  return body;
}

interface RobotsPolicy {
  /** user-agent (lowercased) -> set of "allow:/path" / "disallow:/path" */
  groups: Map<string, Set<string>>;
  sitemaps: Set<string>;
}

function parseRobots(text: string): RobotsPolicy {
  const groups = new Map<string, Set<string>>();
  const sitemaps = new Set<string>();
  // Consecutive User-agent lines share one group of rules (RFC 9309 s2.2.1).
  let pending: string[] = [];
  let current: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      pending.push(value.toLowerCase());
      current = pending;
      for (const agent of pending) if (!groups.has(agent)) groups.set(agent, new Set());
      continue;
    }
    if (field === "allow" || field === "disallow") {
      pending = [];
      for (const agent of current) groups.get(agent)!.add(`${field}:${value}`);
      continue;
    }
    if (field === "sitemap") {
      pending = [];
      sitemaps.add(value);
    }
  }
  return { groups, sitemaps };
}

describe("public/robots.txt mirrors functions/robots.txt.ts", () => {
  const fromFunction = parseRobots(renderFunctionBody());
  const fromFallback = parseRobots(STATIC_FALLBACK);

  it("covers the same user-agent groups", () => {
    expect([...fromFallback.groups.keys()].sort()).toEqual(
      [...fromFunction.groups.keys()].sort(),
    );
  });

  it("declares the same Allow/Disallow rules in every group", () => {
    for (const [agent, expected] of fromFunction.groups) {
      const actual = fromFallback.groups.get(agent) ?? new Set<string>();
      expect(
        [...actual].sort(),
        `user-agent: ${agent} - public/robots.txt is out of sync with functions/robots.txt.ts`,
      ).toEqual([...expected].sort());
    }
  });

  it("points at the same sitemap", () => {
    expect([...fromFallback.sitemaps].sort()).toEqual([...fromFunction.sitemaps].sort());
  });

  it("keeps the tool landing pages crawlable in BOTH copies", () => {
    // sitemap-static.xml submits these three; the parent Disallow on the
    // user-generated session prefix must stay beaten by the longer Allow.
    for (const rule of [
      "allow:/tools/flex-tournament/new$",
      "allow:/tools/doubles-elimination/new$",
      "allow:/tools/team-match/new$",
    ]) {
      expect(fromFunction.groups.get("*")).toContain(rule);
      expect(fromFallback.groups.get("*")).toContain(rule);
    }
  });

  it("keeps the closed-pilot Shop catalogue out of BOTH copies", () => {
    for (const rule of [
      "disallow:/shop$",
      "disallow:/shop/category",
      "disallow:/shop/product",
      "disallow:/shop/store",
      "disallow:/shop/search",
    ]) {
      expect(fromFunction.groups.get("*")).toContain(rule);
      expect(fromFallback.groups.get("*")).toContain(rule);
    }
  });
});
