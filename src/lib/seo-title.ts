/** Shared formatting keeps editorial titles stable before and after JavaScript. */
/**
 * Build a page title, truncated to 60 chars with optional suffix.
 *
 * PR73 Phase 2C (audit I-4) — when the raw title is too long we now
 * break at the last whitespace before the budget instead of a hard
 * char cut, so "175 Định Công" no longer renders as "175 Đị…" in
 * the SERP. We accept a slightly shorter title rather than orphan a
 * partial Vietnamese glyph. Falls back to the hard cut only when the
 * budget leaves no whitespace to break on (or the break would land
 * too early in the title).
 */
export function buildTitle(rawTitle: string, suffix = " | ThePickleHub"): string {
  const maxTotal = 60;
  // Budget in BYTES, not characters: buildHtml's truncateForSeo cuts the final
  // <title> at 60 UTF-8 bytes, and a Vietnamese character costs 2-3 of them.
  // Counting characters here made this function append " | ThePickleHub" to a
  // VI title that already had no room for it — e.g. "Thể thức MLP Pickleball |
  // Luật đồng đội" is 39 chars (fits) but 51 bytes, so the branded version was
  // 66 bytes and prod served "…Luật đồng đội |…". Measured 2026-07-26.
  const byteLength = (s: string) => new TextEncoder().encode(s).length;
  if (byteLength(rawTitle + suffix) <= maxTotal) return rawTitle + suffix;
  // Raw title alone fits the byte budget: hand it back untouched and let
  // truncateForSeo be the single place that ever ellipsises.
  if (byteLength(rawTitle) <= maxTotal) return rawTitle;
  const budget = maxTotal - 1;
  const head = rawTitle.slice(0, budget);
  const lastSpace = head.lastIndexOf(" ");
  // Require >=50% of the budget to remain after the break — a tiny
  // break early in the title would orphan most of the headline.
  if (lastSpace > budget * 0.5) {
    return head.slice(0, lastSpace).trimEnd() + "\u2026";
  }
  return head.trim() + "\u2026";
}

const ELLIPSIS_BYTES = 3; // "\u2026" in UTF-8

const TEXT_ENCODER = new TextEncoder();

function utf8ByteLength(s: string): number {
  return TEXT_ENCODER.encode(s).length;
}

export function truncateForSeo(text: string, byteLimit: number): string {
  if (!text) return text;
  if (utf8ByteLength(text) <= byteLimit) return text;

  // Walk the source one Unicode code point at a time, summing the
  // UTF-8 byte cost. Use Array.from() to iterate full code points so
  // surrogate-pair emoji or rare CJK glyphs aren't sliced in half.
  const target = byteLimit - ELLIPSIS_BYTES;
  const chars = Array.from(text);
  let bytes = 0;
  let charIndex = 0;
  for (let i = 0; i < chars.length; i++) {
    const cost = utf8ByteLength(chars[i]);
    if (bytes + cost > target) break;
    bytes += cost;
    charIndex = i + 1;
  }
  const sliced = chars.slice(0, charIndex).join("");

  // Prefer breaking at the last whitespace within the budget so SERP
  // previews don't slice mid-word. minKept guards against the case
  // where a single early word would leave a useless stub like "PPA…"
  // — for empirical Vietnamese news titles 0.6 of the prefix is the
  // sweet spot.
  const lastSpace = sliced.lastIndexOf(" ");
  const minKept = Math.floor(sliced.length * 0.6);
  const base = lastSpace >= minKept ? sliced.slice(0, lastSpace) : sliced;
  return base.replace(/[\s.,;:\-—–]+$/, "") + "\u2026";
}

