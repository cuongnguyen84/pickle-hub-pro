/** Shared formatting keeps editorial titles stable before and after JavaScript. */
/** SERP title budget in Unicode code points (not bytes). */
export const SEO_TITLE_MAX_CHARS = 60;

/**
 * Build a page title, truncated to 60 characters with optional suffix.
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
  const maxTotal = SEO_TITLE_MAX_CHARS;
  // Budget in CHARACTERS (code points), matching truncateTitleForSeo — the
  // single place that cuts the final <title>. AUDIT-01 (2026-11-10): the old
  // 60-BYTE budget cut Vietnamese titles at ~40-50 chars ("…Ho Chi…").
  const charLength = (s: string) => Array.from(s).length;
  if (charLength(rawTitle + suffix) <= maxTotal) return rawTitle + suffix;
  // Raw title alone fits: hand it back untouched and let truncateTitleForSeo
  // be the single place that ever ellipsises.
  if (charLength(rawTitle) <= maxTotal) return rawTitle;
  const budget = maxTotal - 1;
  const head = Array.from(rawTitle).slice(0, budget).join("");
  const lastSpace = head.lastIndexOf(" ");
  // Require >=50% of the budget to remain after the break — a tiny
  // break early in the title would orphan most of the headline.
  if (lastSpace > budget * 0.5) {
    return head.slice(0, lastSpace).trimEnd() + "\u2026";
  }
  return head.trim() + "\u2026";
}

/**
 * Clamp a <title> to `charLimit` code points including the "\u2026".
 * Same word-boundary rule as truncateForSeo, but counts characters so
 * Vietnamese diacritics don't eat the budget. Descriptions stay on the
 * byte-budgeted truncateForSeo.
 */
export function truncateTitleForSeo(text: string, charLimit = SEO_TITLE_MAX_CHARS): string {
  if (!text) return text;
  const chars = Array.from(text);
  if (chars.length <= charLimit) return text;
  return cutAtWord(chars.slice(0, charLimit - 1).join(""));
}

function cutAtWord(sliced: string): string {
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
  return cutAtWord(chars.slice(0, charIndex).join(""));
}
