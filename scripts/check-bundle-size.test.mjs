// Parser tests for the bundle-budget script (perf-js-gzip). The gate itself
// runs on the real build in CI; these pin the parsing logic that decides
// which chunks count as "initial-load" — the number that catches a lazy
// chunk silently becoming eager.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { staticImports, initialLoadFiles, precachePatterns } from "./check-bundle-size.mjs";

describe("staticImports", () => {
  it("matches static import/export forms and ignores dynamic import()", () => {
    const src =
      'import{a as b}from"./vendor-ui-x.js";import"./side-effect.js";' +
      'export{c}from"./re-export.js";' +
      'const p=import("./lazy-route.js");import(t);';
    expect(staticImports(src)).toEqual([
      "./vendor-ui-x.js",
      "./side-effect.js",
      "./re-export.js",
    ]);
  });

  it("ignores non-js specifiers", () => {
    expect(staticImports('import"./styles.css";import x from"./m.js"')).toEqual(["./m.js"]);
  });
});

describe("initialLoadFiles", () => {
  let dist;
  beforeAll(() => {
    dist = mkdtempSync(join(tmpdir(), "dist-fixture-"));
    mkdirSync(join(dist, "assets"));
    writeFileSync(
      join(dist, "index.html"),
      '<head><link rel="modulepreload" crossorigin href="/assets/vendor-a.js">' +
        '<script type="module" crossorigin src="/assets/index-entry.js"></script></head>',
    );
    // entry statically imports vendor-b (NOT modulepreloaded — the recharts
    // failure mode) and dynamically imports a route chunk.
    writeFileSync(
      join(dist, "assets", "index-entry.js"),
      'import{x}from"./vendor-b.js";const r=()=>import("./Route-lazy.js");',
    );
    writeFileSync(join(dist, "assets", "vendor-a.js"), "export const a=1;");
    writeFileSync(join(dist, "assets", "vendor-b.js"), "export const x=1;");
    writeFileSync(join(dist, "assets", "Route-lazy.js"), "export default 1;");
  });
  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  it("collects entry + modulepreload + recursive static imports, not dynamic ones", () => {
    const files = initialLoadFiles(dist).sort();
    expect(files).toEqual([
      "assets/index-entry.js",
      "assets/vendor-a.js",
      "assets/vendor-b.js",
    ]);
  });
});

describe("precachePatterns", () => {
  it("ignores commented-out patterns (a disabled glob must not count as coverage)", () => {
    const cfg = `globPatterns: [
      "assets/index-*.js",
      // "assets/vendor-react-*.js",
    ]`;
    const patterns = precachePatterns(cfg);
    expect(patterns.some((re) => re.test("assets/index-abc.js"))).toBe(true);
    expect(patterns.some((re) => re.test("assets/vendor-react-abc.js"))).toBe(false);
  });

  it("extracts globPatterns and matches hashed chunk names", () => {
    const cfg = `workbox: { globPatterns: [
      "*.{ico,png,svg}",
      "assets/index-*.js",
      "assets/vendor-react-*.js",
    ], globIgnores: ["**/locale-*"] }`;
    const patterns = precachePatterns(cfg);
    const matches = (f) => patterns.some((re) => re.test(f));
    expect(matches("assets/index-BiMJ-mrp3dg73.js")).toBe(true);
    expect(matches("assets/vendor-react-DY-a3ET9.js")).toBe(true);
    expect(matches("assets/vendor-charts-BfXEjRFr.js")).toBe(false);
    expect(matches("nested/assets/index-x.js")).toBe(false);
  });
});
