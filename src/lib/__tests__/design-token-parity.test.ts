// ============================================================================
// DS-02 — design-token parity check between the two hand-written token files:
//   web:   src/styles/the-line.css          (--tl-<stem>)
//   swift: apple/.../DesignSystem/TLColor.swift (TLColor.<camelCase(stem)>,
//          radii in TLRadius)
//
// The canonical name list mirrors docs/design-tokens.md. If you add a token:
// meaning row in the doc first, then both files, then this list. The test
// fails on (a) a canonical token missing from either platform, and (b) an
// undocumented extra Swift token — the drift this check exists to catch.
// No codegen by design (decision log 2026-07-14) — parity is asserted, not
// generated.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(
  resolve(__dirname, "../../styles/the-line.css"),
  "utf8",
);
const swift = readFileSync(
  resolve(
    __dirname,
    "../../../apple/ThePickleHub/DesignSystem/TLColor.swift",
  ),
  "utf8",
);

// Canonical color tokens — web stems (docs/design-tokens.md).
const CANONICAL_COLORS = [
  "fg", "fg-2", "fg-3", "fg-4",
  "bg", "bg-elev", "surface", "surface-2",
  "border", "border-2", "hairline",
  "green", "green-dim", "green-glow",
  "live",
  "gold", "gold-glow",
  "blue", "blue-glow",
  "accent-qt", "accent-team", "accent-elim", "accent-flex",
  "dim",
];

// Shape tokens: web --tl-radius[(-lg|-xl)] ↔ Swift TLRadius.sm/lg/xl.
const CANONICAL_RADII = ["radius", "radius-lg", "radius-xl"];

// Swift tokens outside the canonical set, each with a documented reason
// (docs/design-tokens.md "platform-local"). Anything else is drift.
const SWIFT_PLATFORM_LOCAL = [
  "accent", "accentInk", "accentText", "accentDim", // dual-accent system (fill vs text legibility on paper)
  "duprTint", "duprBorder", // DUPR brand chip — Swift-local until web needs them
  "uiBg", "uiFg", "uiFg3", "uiAccent", // UIKit chrome handles (nav/tab bars)
];

const camel = (stem: string) =>
  stem.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

describe("web tokens (the-line.css)", () => {
  it.each(CANONICAL_COLORS.concat(CANONICAL_RADII))(
    "--tl-%s is defined",
    (stem) => {
      expect(css).toMatch(new RegExp(`--tl-${stem}:\\s`));
    },
  );

  it("deleted legacy aliases stay deleted (fg-1, bg-1, bg-2)", () => {
    for (const dead of ["fg-1", "bg-1", "bg-2"]) {
      expect(css).not.toMatch(new RegExp(`--tl-${dead}[:,)]`));
    }
  });
});

describe("swift tokens (TLColor.swift)", () => {
  const swiftColorNames = [...swift.matchAll(/static let (\w+)\s*=/g)]
    .map((m) => m[1])
    // TLRadius shares the file; its members are handled separately below.
    .filter((n) => !["sm", "lg", "xl"].includes(n));

  it.each(CANONICAL_COLORS)("TLColor.%s exists", (stem) => {
    expect(swiftColorNames).toContain(camel(stem));
  });

  it("TLRadius covers radius / radius-lg / radius-xl", () => {
    for (const member of ["sm", "lg", "xl"]) {
      expect(swift).toMatch(new RegExp(`static let ${member}: CGFloat`));
    }
  });

  it("no undocumented Swift tokens outside canonical + platform-local", () => {
    const allowed = new Set([
      ...CANONICAL_COLORS.map(camel),
      ...SWIFT_PLATFORM_LOCAL,
    ]);
    const extras = swiftColorNames.filter((n) => !allowed.has(n));
    expect(extras).toEqual([]);
  });
});
