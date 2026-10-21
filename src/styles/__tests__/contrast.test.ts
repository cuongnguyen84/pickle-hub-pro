/**
 * Colour-contrast regression gate — semantic token layer.
 *
 * Why this file exists: axe has `color-contrast` disabled in our Playwright
 * gates (see lighthouse/axe notes), so nothing in CI ever measured a token.
 * The shop prototype shipped five light-mode tokens under 4.5:1 and nobody
 * noticed until a human looked at a screenshot.
 *
 * This reads the CSS instead of the rendered page, so it catches a bad token
 * the moment it is written, in BOTH modes, without a browser.
 *
 * Rules encoded here:
 *   - text tokens (incl. badge / chip / pill text) need 4.5:1 — a badge is not
 *     "large text", so it does not get the 3:1 discount;
 *   - a foreground must clear 4.5:1 against EVERY surface it can legally sit
 *     on, not just the page background;
 *   - "ink on a fill" tokens are measured against their own fill;
 *   - non-text UI boundaries (borders, focus ring) need 3:1.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

/** Grab the declarations of the first rule whose selector matches exactly. */
function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  const body = css.slice(open + 1, close);
  const out: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const m = /^\s*(--[\w-]+)\s*:\s*([^;]+);/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const theLine = read("the-line.css");
const shop = read("shop.css");

const DARK = block(theLine, ':root[data-theme="the-line"]');
const LIGHT_OVERRIDES = block(theLine, '[data-theme="the-line"][data-mode="light"]');
const SHOP = block(shop, ".tl-shop");
const SHOP_LIGHT = block(shop, '[data-theme="the-line"][data-mode="light"] .tl-shop');

const TOKENS = {
  dark: { ...DARK, ...SHOP },
  light: { ...DARK, ...LIGHT_OVERRIDES, ...SHOP, ...SHOP_LIGHT },
} as const;

/** Resolve `var(--x)` chains down to a literal, then parse to RGB. */
function rgb(token: string, mode: keyof typeof TOKENS): [number, number, number] {
  const seen = new Set<string>();
  let value = TOKENS[mode][token] ?? token;
  while (value.startsWith("var(")) {
    const name = /var\(\s*(--[\w-]+)/.exec(value)?.[1];
    if (!name || seen.has(name)) throw new Error(`unresolvable var chain at ${token}`);
    seen.add(name);
    const next = TOKENS[mode][name];
    if (next === undefined) throw new Error(`${token} → ${name} is not defined in ${mode}`);
    value = next.replace(/\s*\/\*.*$/, "").trim();
  }
  value = value.replace(/\s*\/\*.*$/, "").trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (!hex) throw new Error(`${token} resolves to "${value}", which is not a hex colour`);
  const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG 2.1 relative luminance + contrast ratio. */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fg: string, bg: string, mode: keyof typeof TOKENS): number {
  const a = luminance(rgb(fg, mode));
  const b = luminance(rgb(bg, mode));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Surfaces a foreground can legally sit on. Worst case governs. */
const SURFACES = ["--tl-bg", "--tl-bg-elev", "--tl-surface", "--tl-surface-2"];

/** Text tokens: 4.5:1 against every surface. */
const TEXT_TOKENS = [
  "--tl-fg",
  "--tl-fg-2",
  "--tl-fg-3",
  "--tl-fg-4",
  "--tl-dim",
  "--tl-live",
  "--tl-gold",
  "--tl-blue",
  "--tl-accent-qt",
  "--tl-accent-team",
  "--tl-accent-flex",
  "--tl-accent-elim",
  "--tl-green",
  "--tl-green-dim",
  // shop semantics — the layer the prototype actually paints with
  "--shop-price",
  "--shop-price-was",
  "--shop-stock-ok",
  "--shop-stock-low",
  "--shop-stock-out",
  "--shop-verified",
  "--shop-warning",
  "--shop-danger",
  "--shop-used",
];

/** Ink printed ON a filled chip/button, measured against that fill. */
const INK_ON_FILL: Array<[string, string]> = [
  ["--shop-on-accent", "--tl-green"],
  ["--shop-on-gold", "--tl-gold"],
  ["--shop-on-ok", "--shop-stock-ok"],
  ["--shop-on-danger", "--shop-danger-fill"],
  // R3 card-first sub-theme (04-ux-spec-round3 §8.3):
  // the active chip inverts ink↔bg — also covers the card's "→" circle,
  // which paints --tl-bg on --tl-fg.
  ["--shop-chip-active-ink", "--shop-chip-active-bg"],
  // meta text and the verified pill sit on the white card, not the page.
  ["--tl-fg-3", "--shop-card-surface"],
  ["--shop-verified", "--shop-card-surface"],
  // R4 ShopHome hero card: title and sub sit on the gradient's STRONGEST tint
  // (the weak end trends toward --tl-surface, already covered above).
  ["--shop-hero-ink", "--shop-hero-tint-strong"],
  ["--shop-hero-sub-ink", "--shop-hero-tint-strong"],
  // R4: chip ink measured on its own fill (light chip-bg is now a hex literal).
  ["--shop-chip-ink", "--shop-chip-bg"],
];

/**
 * Non-text UI boundary — WCAG 1.4.11, 3:1.
 *
 * Only the focus indicator is gated. --tl-border / --tl-border-2 are
 * decorative dividers (1.4.11 exempts them) and sit at 1.4–1.7:1 by design;
 * raising them would repaint every surface on the site, which is a palette
 * decision, not a contrast fix. Flagged to the Product Owner rather than done
 * silently.
 */
const FOCUS_RING = "--tl-green";

describe.each(["dark", "light"] as const)("contrast — %s mode", (mode) => {
  it.each(TEXT_TOKENS)("%s reads on every surface (AA 4.5:1)", (token) => {
    const worst = SURFACES.map((s) => [s, ratio(token, s, mode)] as const).sort(
      (a, b) => a[1] - b[1],
    )[0];
    expect(
      worst[1],
      `${token} on ${worst[0]} = ${round(worst[1])}:1, needs 4.5`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(INK_ON_FILL)("%s reads on %s (AA 4.5:1)", (ink, fill) => {
    const r = ratio(ink, fill, mode);
    expect(r, `${ink} on ${fill} = ${round(r)}:1, needs 4.5`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SURFACES)(`focus ring ${FOCUS_RING} is visible on %s (1.4.11, 3:1)`, (bg) => {
    const r = ratio(FOCUS_RING, bg, mode);
    expect(r, `${FOCUS_RING} on ${bg} = ${round(r)}:1, needs 3`).toBeGreaterThanOrEqual(3);
  });
});

describe("token hygiene", () => {
  it("every shop semantic token resolves in both modes", () => {
    for (const token of Object.keys(SHOP)) {
      if (!/^--shop-(price|stock|verified|warning|danger|used|on)/.test(token)) continue;
      expect(() => rgb(token, "dark"), `${token} dark`).not.toThrow();
      expect(() => rgb(token, "light"), `${token} light`).not.toThrow();
    }
  });

  it("light mode overrides every accent the shop paints text with", () => {
    // A shop token that aliases a The Line accent with no light-mode override
    // inherits the dark-mode value onto paper — exactly how stock-ok and used
    // ended up at 1.99:1.
    const painted = [
      "--tl-accent-qt",
      "--tl-accent-team",
      "--tl-accent-flex",
      "--tl-accent-elim",
      "--tl-live",
      "--tl-gold",
      "--tl-blue",
    ];
    for (const token of painted) {
      expect(LIGHT_OVERRIDES, `${token} has no light-mode value`).toHaveProperty(token);
    }
  });
});
