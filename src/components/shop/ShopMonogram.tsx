// ============================================================================
// A shop's monogram — the first letter of its name on a deterministic tint.
// ----------------------------------------------------------------------------
// Pure: no data, no dependency. The accent is hashed from the name so the same
// shop always gets the same colour, and the storehead banner reuses the SAME
// hash (monogramAccent) rather than writing a second algorithm.
//
// Every colour goes through a The Line token: the accent travels as a CSS var
// whose VALUE is `var(--tl-…)`, the tint is a color-mix over --tl-surface, and
// the letter is --tl-fg — a 16% tint keeps AA in both modes.
// ============================================================================

import type { CSSProperties } from "react";

const PALETTE = [
  "var(--tl-green)",
  "var(--tl-blue)",
  "var(--tl-gold)",
  "var(--tl-accent-team)",
  "var(--tl-accent-qt)",
] as const;

/** The accent token for a shop name — sum of code points, mod 5. */
export function monogramAccent(name: string): string {
  let sum = 0;
  for (const ch of name) sum += ch.codePointAt(0) ?? 0;
  return PALETTE[sum % PALETTE.length];
}

/** First code point, uppercased — "Đạt" → "Đ", not a broken half of it. */
const initial = (name: string) => [...name.trim()][0]?.toUpperCase() ?? "?";

export function ShopMonogram({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="tl-shop-monogram"
      aria-hidden="true"
      style={
        {
          "--mono-accent": monogramAccent(name),
          width: size,
          height: size,
          fontSize: Math.round(size * 0.42),
        } as CSSProperties
      }
    >
      {initial(name)}
    </span>
  );
}
