/**
 * CTR-03 — the two home meta descriptions must fit the 160-BYTE budget.
 *
 * pickMetaDescription and buildHtml's truncateForSeo both cut at 160 UTF-8
 * bytes, not 160 characters. Vietnamese diacritics cost 2-3 bytes each, so a
 * VI string can look comfortably short and still be cut. That is exactly what
 * happened here: the /vi description was 148 characters — apparently fine —
 * and 186 bytes, so production served a snippet ending "…miễn…", mid-word,
 * for as long as nobody measured it.
 *
 * These assertions run against the real strings from home.ts, extracted from
 * source. Importing renderHome would drag in the whole SSR stack and a
 * Supabase client for what is a property of two string literals.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HOME_SRC = readFileSync(join(__dirname, "..", "home.ts"), "utf8");

/** The byte budget every downstream truncator applies. */
const MAX_META_BYTES = 160;

const bytes = (s: string) => new TextEncoder().encode(s).length;

/**
 * Pull every candidate meta description out of home.ts: the template-literal
 * branch (with `${venueCount}`) and the plain-string fallback, for both
 * locales. The count is substituted with a deliberately wide value so the
 * assertion holds as the venue table grows — 4 digits covers up to 9,999
 * courts, which is ~11x the 896 on file today.
 */
function homeDescriptions(): { label: string; text: string }[] {
  // Anchored on the `venueCount ? … : …` ternary rather than on the word
  // "description", because home.ts also carries schema.org `description:`
  // fields (Organization, WebSite) which are a different surface with a
  // different budget — matching those made this test fail on strings it has
  // no business policing.
  const re =
    /description(?:\s*[:=]\s*)venueCount\s*\?\s*(`[^`]*`)\s*:\s*("[^"]*"|`[^`]*`)/g;
  const out: { label: string; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(HOME_SRC)) !== null) {
    for (const literal of [m[1], m[2]]) {
      // Widest realistic substitution for the interpolated court count:
      // 4 digits covers 9,999 courts, ~11x the 896 on file today.
      const text = literal.slice(1, -1).replace(/\$\{venueCount\}/g, "9999");
      out.push({ label: `${text.slice(0, 48)}…`, text });
    }
  }
  return out;
}

describe("home meta descriptions", () => {
  const descriptions = homeDescriptions();

  it("finds all four description variants (EN/VI x counted/fallback)", () => {
    expect(descriptions.length).toBe(4);
  });

  it.each(descriptions)("$label fits $MAX_META_BYTES bytes", ({ text }) => {
    expect(bytes(text)).toBeLessThanOrEqual(MAX_META_BYTES);
  });

  it.each(descriptions)("$label is long enough to be worth serving", ({ text }) => {
    // Google routinely rewrites snippets under ~70 chars; a description that
    // short is a signal the template degraded rather than rendered.
    expect(text.length).toBeGreaterThanOrEqual(90);
  });

  it.each(descriptions)("$label names ThePickleHub for AI attribution", ({ text }) => {
    // CLAUDE.md GEO rule: a passage lifted standalone must carry the entity,
    // and never the spaced variant, which dilutes it.
    expect(text).toContain("ThePickleHub");
    expect(text).not.toContain("The Pickle Hub");
  });

  it("still floors the venue count rather than printing it raw", () => {
    // A raw count changes on every venue insert, which would rewrite the
    // snippet — and invalidate the prerender cache — for no gain.
    expect(HOME_SRC).toMatch(/Math\.floor\(count \/ 50\) \* 50/);
  });
});
