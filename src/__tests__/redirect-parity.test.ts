// ============================================================================
// Redirect parity: public/_redirects (user path) ↔ functions/_middleware.ts
// VI_BLOG_REDIRECTS + BLOG_TO_TOOLS (bot path).
// ----------------------------------------------------------------------------
// Cloudflare Pages runs the middleware BEFORE consulting _redirects, so a bot
// only gets a /vi/blog/<slug> redirect if the middleware mirrors it. A rule
// added to one file and not the other means users 301 but Googlebot 404s (or
// vice-versa) — the exact class that let /vi/blog/the-thuc-mlp + /vi/blog/
// ppa-tour-asia-2026-complete-guide 404 for bots until Guard-0. This test locks
// the two lists together for the /vi/blog/* block.
//
// Scoped to the VI-blog block on purpose: those redirects have a uniform
// `/vi/blog/<slug> -> <target>` shape on both sides. The ad-hoc regex redirects
// (/u/*, /vi/org/*, /vi/live) are per-shape and out of scope here.
// ============================================================================

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const redirectsFile = readFileSync("public/_redirects", "utf8");
const middlewareSource = readFileSync("functions/_middleware.ts", "utf8");

// ─── Parse public/_redirects: every `/vi/blog/<slug>  <target>  301` line ───
// → map of vi-slug → resolved final destination ("/tools" or "/blog/<en>").
function parseRedirectsViBlog(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of redirectsFile.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^\/vi\/blog\/(\S+)\s+(\S+)\s+301\b/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

// ─── Parse the VI_BLOG_REDIRECTS dict literal from the middleware source ───
function parseMiddlewareViBlog(): Record<string, string> {
  const block = middlewareSource.match(
    /VI_BLOG_REDIRECTS:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\};/,
  );
  if (!block) throw new Error("VI_BLOG_REDIRECTS dict not found in _middleware.ts");
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/"([^"]+)":\s*"([^"]+)"/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

// ─── Parse BLOG_TO_TOOLS set literal ───
function parseBlogToTools(): Set<string> {
  const m = middlewareSource.match(/BLOG_TO_TOOLS\s*=\s*new Set<string>\(\[([\s\S]*?)\]\)/);
  if (!m) throw new Error("BLOG_TO_TOOLS set not found in _middleware.ts");
  return new Set([...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
}

// ─── Parse a `const <NAME>: Record<string, string> = { ... }` dict literal ───
function parseDict(name: string): Record<string, string> {
  const block = middlewareSource.match(
    new RegExp(`${name}:\\s*Record<string,\\s*string>\\s*=\\s*\\{([\\s\\S]*?)\\};`),
  );
  if (!block) throw new Error(`${name} dict not found in _middleware.ts`);
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/"([^"]+)":\s*"([^"]+)"/g)) out[m[1]] = m[2];
  return out;
}

// ─── Parse public/_redirects: every `/blog/<slug>  <target>  301` line ───
function parseRedirectsEnBlog(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of redirectsFile.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^\/blog\/(\S+)\s+(\S+)\s+301\b/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

// Resolve what the middleware sends a given vi-slug to, mirroring the runtime
// logic: VI_BLOG_DIRECT[vi] -> that absolute path (checked first), else
// VI_BLOG_REDIRECTS[vi] -> enSlug; /tools if enSlug ∈ BLOG_TO_TOOLS, else
// /blog/<enSlug>.
function middlewareDest(
  vi: string,
  dict: Record<string, string>,
  tools: Set<string>,
  direct: Record<string, string>,
): string {
  if (direct[vi] !== undefined) return direct[vi];
  const en = dict[vi];
  if (en === undefined) return "";
  return tools.has(en) ? "/tools" : `/blog/${en}`;
}

describe("redirect parity: /vi/blog/* between _redirects and _middleware.ts", () => {
  const redirects = parseRedirectsViBlog();
  const dict = parseMiddlewareViBlog();
  const tools = parseBlogToTools();
  const viDirect = parseDict("VI_BLOG_DIRECT");

  it("parsed a non-trivial number of rules from both files", () => {
    expect(Object.keys(redirects).length).toBeGreaterThan(5);
    expect(Object.keys(dict).length).toBeGreaterThan(5);
  });

  it("every _redirects /vi/blog rule is mirrored in the middleware (else bots 404)", () => {
    const missing: string[] = [];
    for (const [vi, target] of Object.entries(redirects)) {
      const dest = middlewareDest(vi, dict, tools, viDirect);
      if (dest !== target) {
        missing.push(`${vi} → _redirects:${target} vs middleware:${dest || "(none)"}`);
      }
    }
    expect(missing, `VI-blog rules in _redirects not matched by middleware:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every middleware VI-blog redirect has a matching _redirects rule (no bot-only redirect)", () => {
    const extra: string[] = [];
    for (const vi of [...Object.keys(dict), ...Object.keys(viDirect)]) {
      if (!(vi in redirects)) extra.push(vi);
    }
    expect(extra, `middleware VI-blog redirects with no _redirects rule (users won't get them):\n${extra.join("\n")}`).toEqual([]);
  });

  it("no /vi/blog redirect chains to another redirect (single hop to a 200 target)", () => {
    // A /vi/blog/* target is allowed only when it is a real VI page — i.e. it
    // is not itself the source of another redirect (that would be a 301 chain).
    for (const [source, target] of Object.entries(redirects)) {
      const viTarget = target.match(/^\/vi\/blog\/(.+)$/)?.[1];
      if (viTarget === undefined) continue;
      expect(
        viTarget in redirects,
        `chained redirect: /vi/blog/${source} → ${target}, which itself redirects`,
      ).toBe(false);
    }
  });
});

describe("_redirects rule ordering", () => {
  // Cloudflare Pages evaluates _redirects top-down, first match wins. The SPA
  // fallback `/* /index.html 200` matches EVERYTHING, so any rule appended
  // after it is dead code — no parse error, no warning, it just never fires.
  // The parity tests above read the file as a set and cannot catch this.
  it("SPA fallback is the LAST non-comment rule — anything after it is dead", () => {
    const rules = redirectsFile
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    expect(
      rules[rules.length - 1],
      "rules after `/* /index.html 200` never fire (first match wins) — move them above the SPA fallback",
    ).toMatch(/^\/\*\s+\/index\.html\s+200$/);
  });

  it("the SPA fallback appears exactly once", () => {
    const count = redirectsFile
      .split("\n")
      .filter((l) => /^\/\*\s+\/index\.html\s+200$/.test(l.trim())).length;
    expect(count).toBe(1);
  });
});

describe("redirect parity: merged /blog/* posts between _redirects and _middleware.ts", () => {
  const redirects = parseRedirectsEnBlog();
  const merged = parseDict("BLOG_MERGED");
  const tools = parseBlogToTools();

  it("every merged-post rule in _redirects is mirrored in the middleware", () => {
    const missing: string[] = [];
    for (const [en, target] of Object.entries(redirects)) {
      // /tools dedupes are covered by BLOG_TO_TOOLS, not BLOG_MERGED.
      const dest = tools.has(en) ? "/tools" : merged[en] ? `/blog/${merged[en]}` : "";
      if (dest !== target) missing.push(`${en} → _redirects:${target} vs middleware:${dest || "(none)"}`);
    }
    expect(missing, `EN-blog rules in _redirects not matched by middleware:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every BLOG_MERGED entry has a matching _redirects rule (no bot-only redirect)", () => {
    const extra = Object.keys(merged).filter((en) => !(en in redirects));
    expect(extra, `middleware BLOG_MERGED entries with no _redirects rule:\n${extra.join("\n")}`).toEqual([]);
  });

  it("no merged post redirects to another merged post (single hop)", () => {
    for (const [source, target] of Object.entries(merged)) {
      expect(target in merged, `chained merge: ${source} → ${target}, which itself redirects`).toBe(false);
    }
  });
});

// ============================================================================
// Retired duplicate /san slugs — same parity rule, different block.
// ----------------------------------------------------------------------------
// 2026-08-25 site audit: the alobo importer ran three times on 2026-08-24 and
// created six venues twice, each pair a set of /san pages with identical titles
// and identical meta descriptions, both in sitemap-venues.xml. The duplicate
// rows are deleted and the retired URLs 301 to the surviving slug.
//
// Both files must carry every rule, and _redirects must carry the /vi twin as
// well: the middleware handles the `/vi/` prefix with one regex, while
// _redirects has no wildcard for it and needs the pair spelled out. A rule
// present on only one side means users 301 and Googlebot 404s.
// ============================================================================
function parseMiddlewareRetiredVenues(): Record<string, string> {
  const block = middlewareSource.match(
    /RETIRED_VENUE_SLUGS:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\};/,
  );
  if (!block) throw new Error("RETIRED_VENUE_SLUGS dict not found in _middleware.ts");
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/"([^"]+)":\s*"([^"]+)"/g)) out[m[1]] = m[2];
  return out;
}

function parseRedirectsSan(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of redirectsFile.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^(\/(?:vi\/)?san\/\S+)\s+(\S+)\s+301\b/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

describe("retired /san slugs: _redirects ↔ RETIRED_VENUE_SLUGS", () => {
  const mw = parseMiddlewareRetiredVenues();
  const file = parseRedirectsSan();

  it("has at least the six venues the 2026-08-24 import duplicated", () => {
    expect(Object.keys(mw).length).toBeGreaterThanOrEqual(6);
  });

  it("carries every middleware rule in _redirects, EN and VI", () => {
    for (const [from, to] of Object.entries(mw)) {
      expect(file[`/san/${from}`]).toBe(`/san/${to}`);
      expect(file[`/vi/san/${from}`]).toBe(`/vi/san/${to}`);
    }
  });

  it("carries every _redirects rule in the middleware", () => {
    for (const from of Object.keys(file)) {
      const slug = from.replace(/^\/(?:vi\/)?san\//, "");
      expect(mw).toHaveProperty(slug);
    }
  });

  it("never points a retired slug at another retired slug", () => {
    // A chained 301 costs a hop and Google only follows so many. The target
    // must be a slug that survives.
    for (const to of Object.values(mw)) expect(mw).not.toHaveProperty(to);
  });

  it("never redirects a slug to itself", () => {
    for (const [from, to] of Object.entries(mw)) expect(from).not.toBe(to);
  });
});
