// ============================================================================
// ARCH-05 characterization net — full route table vs checked-in snapshot.
// ----------------------------------------------------------------------------
// The snapshot was captured from the PRE-refactor App.tsx (192 literal
// <Route> lines) and then amended with exactly the three intended ARCH-05
// changes: /vi/feed + /vi/rankings gain ViLanguageWrapper, /vi/* catch-all
// added. This test statically expands the post-refactor App.tsx (literal
// routes + the MIRRORED double-map) and requires content equality — a
// silently dropped /vi entry falls to catch-all NotFound while bot prerender
// stays 200, so no other gate catches it.
//
// MIRRORED entries MUST stay single-line — the parser here depends on it
// (and asserts it caught every entry, so drift fails loudly).
// ============================================================================
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import snapshot from "./route-snapshot.json";

interface RouteEntry {
  path: string;
  element: string;
}

function extractLiteralRoutes(source: string): RouteEntry[] {
  const re = /<Route\s+path="([^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g;
  const routes: RouteEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    routes.push({ path: m[1], element: m[2].replace(/\s+/g, " ").trim() });
  }
  return routes;
}

interface MirroredEntry {
  path: string;
  element: string;
  viElement?: string;
  viSkipWrapper?: boolean;
}

function parseMirrored(source: string): MirroredEntry[] {
  const block = source.match(/const MIRRORED: MirroredRoute\[\] = \[\n([\s\S]*?)\n\];/);
  if (!block) throw new Error("MIRRORED array not found in App.tsx");
  const entries: MirroredEntry[] = [];
  const lines = block[1].split("\n").filter((l) => l.trim().length > 0);
  for (const raw of lines) {
    const line = raw.trim().replace(/,$/, "");
    const m = line.match(/^\{ path: "([^"]+)", (.*) \}$/);
    if (!m) throw new Error(`unparseable MIRRORED entry: ${raw}`);
    const entry: MirroredEntry = { path: m[1], element: "" };
    let rest = m[2];
    if (rest.endsWith(", viSkipWrapper: true")) {
      entry.viSkipWrapper = true;
      rest = rest.slice(0, -", viSkipWrapper: true".length);
    }
    const viIdx = rest.indexOf(", viElement: ");
    if (viIdx >= 0) {
      entry.viElement = rest.slice(viIdx + ", viElement: ".length);
      rest = rest.slice(0, viIdx);
    }
    if (!rest.startsWith("element: ")) throw new Error(`unparseable MIRRORED entry: ${raw}`);
    entry.element = rest.slice("element: ".length);
    entries.push(entry);
  }
  return entries;
}

/** Expand MIRRORED exactly the way App.tsx's two .map() calls render it. */
function expandMirrored(entries: MirroredEntry[]): RouteEntry[] {
  const out: RouteEntry[] = [];
  for (const e of entries) out.push({ path: e.path, element: e.element });
  for (const e of entries) {
    const el = e.viElement ?? e.element;
    out.push({
      path: e.path === "/" ? "/vi" : `/vi${e.path}`,
      element: e.viSkipWrapper ? el : `<ViLanguageWrapper>${el}</ViLanguageWrapper>`,
    });
  }
  return out;
}

describe("App.tsx route table characterization", () => {
  const source = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");
  const literal = extractLiteralRoutes(source);
  const mirrored = parseMirrored(source);
  const actual = [...literal, ...expandMirrored(mirrored)];

  it("extractor sees every literal <Route> tag (guards against JSX shape drift)", () => {
    // 2 of the <Route tags are the .map() templates themselves, not literals.
    const tagCount = (source.match(/<Route\s/g) ?? []).length - 2;
    expect(literal.length).toBe(tagCount);
  });

  it("MIRRORED parser sees every entry (guards against format drift)", () => {
    const braceCount = (source.match(/^\s*\{ path: "/gm) ?? []).length;
    expect(mirrored.length).toBe(braceCount);
    expect(mirrored.length).toBe(63);
  });

  it("route table matches the checked-in snapshot exactly", () => {
    // Order-insensitive: React Router v6 ranks by path specificity, not
    // source order, so ordering is non-behavioral. Content must be exact.
    const byPath = (list: RouteEntry[]) => [...list].sort((a, b) => a.path.localeCompare(b.path));
    expect(byPath(actual)).toEqual(byPath(snapshot as RouteEntry[]));
  });

  it("every /vi route keeps its language mechanism or is a redirect", () => {
    const viRoutes = actual.filter((r) => r.path === "/vi" || r.path.startsWith("/vi/"));
    expect(viRoutes.length).toBeGreaterThanOrEqual(63);
    const KNOWN_UNWRAPPED = new Set([
      // Navigate/redirect aliases — no UI, wrapper irrelevant
      "/vi/su-kien",
      "/vi/su-kien/:slug/live",
      "/vi/u/:slug",
      // Deferred pending socket audit (ARCH-05 D2): court-side live scoring
      "/vi/social/:slug/live",
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
