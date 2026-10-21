// ============================================================================
// A11Y gate — browser zoom must stay possible, and form controls must not need
// a zoom cap to behave.
// ----------------------------------------------------------------------------
// The site shipped `maximum-scale=1.0, user-scalable=no` from the beginning.
// That fails WCAG 1.4.4 on every page, and it was load-bearing for exactly one
// reason: iOS Safari zooms when a focused text control is under 16px. Remove
// the cap without the floor and every form in the product starts jumping on
// focus; add the floor and forget the cap and the violation quietly returns.
//
// So this asserts BOTH halves, in the two files that own them. It is a static
// gate: it cannot see a computed font-size, which is why the route QA scripts
// measure the real thing in a browser as well.
// ============================================================================

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("viewport allows zoom", () => {
  const html = read("index.html");
  const viewport = /<meta\s+name="viewport"\s+content="([^"]+)"/.exec(html)?.[1] ?? "";

  it("declares a viewport at all", () => {
    expect(viewport).toContain("width=device-width");
  });

  it("does not cap the maximum scale", () => {
    expect(viewport).not.toMatch(/maximum-scale/i);
  });

  it("does not disable pinch zoom", () => {
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/i);
  });

  it("does not cap the minimum scale above 1 either", () => {
    // minimum-scale above 1 is the same violation wearing a different name.
    const min = /minimum-scale\s*=\s*([0-9.]+)/i.exec(viewport)?.[1];
    expect(min === undefined || Number(min) <= 1).toBe(true);
  });
});

describe("form controls carry the 16px floor instead", () => {
  const css = read("src/index.css");

  it("floors text-entry controls on touch-sized viewports", () => {
    // The rule the viewport change depends on. Deleting it re-creates the
    // focus-zoom the cap used to hide.
    expect(css).toMatch(/@media \(max-width: 1024px\)[\s\S]{0,400}font-size: max\(16px, 1em\) !important/);
  });

  it("floors input, select and textarea — not just input", () => {
    const rule = /@media \(max-width: 1024px\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/\binput\b/);
    expect(rule).toMatch(/\bselect\b/);
    expect(rule).toMatch(/\btextarea\b/);
  });
});

describe("no stylesheet re-caps the scale", () => {
  it("has no @viewport rule in the app stylesheets", () => {
    // @viewport is the CSS spelling of the same violation. Anything subtler —
    // a touch-action lock, a transform scale — is only visible to a real
    // browser, which is what the route QA scripts are for.
    for (const file of ["src/index.css", "src/styles/the-line.css", "src/styles/shop.css"]) {
      expect(read(file), file).not.toMatch(/@(-ms-)?viewport/i);
    }
  });
});
