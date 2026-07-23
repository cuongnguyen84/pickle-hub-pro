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

// Resolve what the middleware sends a given vi-slug to, mirroring the runtime
// logic: VI_BLOG_REDIRECTS[vi] -> enSlug; /tools if enSlug ∈ BLOG_TO_TOOLS,
// else /blog/<enSlug>.
function middlewareDest(vi: string, dict: Record<string, string>, tools: Set<string>): string {
  const en = dict[vi];
  if (en === undefined) return "";
  return tools.has(en) ? "/tools" : `/blog/${en}`;
}

describe("redirect parity: /vi/blog/* between _redirects and _middleware.ts", () => {
  const redirects = parseRedirectsViBlog();
  const dict = parseMiddlewareViBlog();
  const tools = parseBlogToTools();

  it("parsed a non-trivial number of rules from both files", () => {
    expect(Object.keys(redirects).length).toBeGreaterThan(5);
    expect(Object.keys(dict).length).toBeGreaterThan(5);
  });

  it("every _redirects /vi/blog rule is mirrored in the middleware (else bots 404)", () => {
    const missing: string[] = [];
    for (const [vi, target] of Object.entries(redirects)) {
      if (middlewareDest(vi, dict, tools) !== target) {
        missing.push(`${vi} → _redirects:${target} vs middleware:${middlewareDest(vi, dict, tools) || "(none)"}`);
      }
    }
    expect(missing, `VI-blog rules in _redirects not matched by middleware:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every middleware VI_BLOG_REDIRECTS entry has a matching _redirects rule (no bot-only redirect)", () => {
    const extra: string[] = [];
    for (const vi of Object.keys(dict)) {
      if (!(vi in redirects)) extra.push(vi);
    }
    expect(extra, `middleware VI-blog redirects with no _redirects rule (users won't get them):\n${extra.join("\n")}`).toEqual([]);
  });

  it("no /vi/blog redirect chains to another redirect (single hop to a 200 target)", () => {
    // Targets must be a terminal path, never another /vi/blog/* that itself redirects.
    for (const target of Object.values(redirects)) {
      expect(target.startsWith("/vi/blog/"), `chained redirect target ${target}`).toBe(false);
    }
  });
});
