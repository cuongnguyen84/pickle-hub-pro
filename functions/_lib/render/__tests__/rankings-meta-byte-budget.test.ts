/**
 * CTR-01 — the rankings cluster must not ship a truncated <title> or
 * <meta name="description">, and the SSR strings must match the ones the
 * hydrated SPA writes over them.
 *
 * Two separate failures were live on 2026-08-27, both invisible to every
 * check the repo already had:
 *
 * 1. buildHtml() clamps title to 60 UTF-8 BYTES and description to 160
 *    (functions/_lib/html.ts). A Vietnamese diacritic costs 2 bytes and an
 *    em dash 3, so a VI string that looks comfortably short in an editor
 *    goes over. `/vi/rankings` was 61 bytes and Google was served
 *    "Bảng xếp hạng DUPR Pickleball Việt Nam |…" — brand gone, dangling
 *    pipe. `/vi/rankings/ppa-tour`'s description was 164 and cut mid-phrase.
 *    Nothing failed: truncateForSeo() is doing exactly its job, quietly.
 *
 * 2. src/pages/Rankings.tsx passed a DIFFERENT title to TheLineLayout than
 *    the SSR renderer emitted, so a bot saw "Vietnam DUPR Pickleball
 *    Rankings" and a real browser rewrote the tab to "DUPR Rankings" one
 *    frame after hydration. One URL, two titles, and the SEO scripts only
 *    ever curl the bot version.
 *
 * The byte assertions are deliberately written against the RENDERED html
 * rather than the string constants: the constants are what a future edit
 * changes, but the clamp is what Google sees, and only the second one is
 * the bug. A test that re-declared the expected strings would pass while
 * the page shipped an ellipsis.
 *
 * The parity assertions read src/pages/*.tsx as text. Importing the pages
 * would drag React, the i18n provider and the Supabase client into a node
 * test for the sake of two string literals.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderRankings } from "../rankings";
import { renderPpaRankings } from "../ppa-rankings";
import type { SupabaseClient } from "../../supabase";

const SITE = "https://www.thepicklehub.net";

const TITLE_MAX_BYTES = 60;
const DESCRIPTION_MAX_BYTES = 160;

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** Decode the handful of entities buildHtml escapes, so byte counts are
 *  measured on the text Google renders rather than on "&amp;". */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTitle(html: string): string {
  const m = html.match(/<title>([\s\S]*?)<\/title>/);
  if (!m) throw new Error("no <title> in rendered html");
  return decodeEntities(m[1]);
}

function extractDescription(html: string): string {
  const m = html.match(/<meta name="description" content="([\s\S]*?)"\s*\/?>/);
  if (!m) throw new Error("no meta description in rendered html");
  return decodeEntities(m[1]);
}

/** renderRankings only reads one RPC and treats any failure as "render the
 *  shell anyway", so an empty result is a legitimate production state (it is
 *  what every request saw before the first DUPR link) and the cheapest stub. */
const supabaseStub = {
  rpc: async () => ({ data: [], error: null }),
} as unknown as SupabaseClient;

type Case = {
  name: string;
  render: () => Promise<Response> | Response;
};

const cases: Case[] = [
  {
    name: "/rankings",
    render: () => renderRankings(supabaseStub, SITE, "/rankings", "en"),
  },
  {
    name: "/vi/rankings",
    render: () => renderRankings(supabaseStub, SITE, "/vi/rankings", "vi"),
  },
  {
    name: "/rankings/ppa-tour",
    render: () => renderPpaRankings(SITE, "/rankings/ppa-tour", "en"),
  },
  {
    name: "/vi/rankings/ppa-tour",
    render: () => renderPpaRankings(SITE, "/vi/rankings/ppa-tour", "vi"),
  },
];

describe("rankings SSR meta fits the SERP byte budget", () => {
  for (const c of cases) {
    it(`${c.name} emits a whole title and description`, async () => {
      const html = await (await c.render()).text();
      const title = extractTitle(html);
      const description = extractDescription(html);

      // The ellipsis is the tell: truncateForSeo appends "…" and only
      // ever appends it when it has cut something off.
      expect(title, `${c.name} title was truncated: ${title}`).not.toContain("…");
      expect(
        description,
        `${c.name} description was truncated: ${description}`,
      ).not.toContain("…");

      expect(
        bytes(title),
        `${c.name} title is ${bytes(title)} bytes: ${title}`,
      ).toBeLessThanOrEqual(TITLE_MAX_BYTES);
      expect(
        bytes(description),
        `${c.name} description is ${bytes(description)} bytes: ${description}`,
      ).toBeLessThanOrEqual(DESCRIPTION_MAX_BYTES);

      // A title that survives the clamp but lost its brand to an earlier
      // edit is the same lost click, so assert the suffix explicitly.
      expect(title.endsWith("| ThePickleHub"), `${c.name} title lost the brand: ${title}`)
        .toBe(true);
    });
  }
});

describe("SPA titles match the SSR titles they overwrite", () => {
  const pageSource = (file: string) =>
    readFileSync(join(__dirname, "..", "..", "..", "..", "src", "pages", file), "utf8");

  /** DynamicMeta appends " | ThePickleHub" unless the title already starts
   *  with the brand, so the page source carries the bare string. */
  const BRAND = " | ThePickleHub";

  it("Rankings.tsx passes the SSR strings minus the brand suffix", async () => {
    const src = pageSource("Rankings.tsx");

    for (const [rawPath, lang] of [["/rankings", "en"], ["/vi/rankings", "vi"]] as const) {
      const html = await (await renderRankings(supabaseStub, SITE, rawPath, lang)).text();
      const ssrTitle = extractTitle(html);
      const ssrDescription = extractDescription(html);

      expect(ssrTitle.endsWith(BRAND)).toBe(true);
      const bare = ssrTitle.slice(0, -BRAND.length);

      expect(src, `Rankings.tsx is missing the ${lang} SSR title ${bare}`).toContain(bare);
      expect(
        src,
        `Rankings.tsx is missing the ${lang} SSR description`,
      ).toContain(ssrDescription);
    }
  });

  it("PpaRankings.tsx passes the SSR strings minus the brand suffix", async () => {
    const src = pageSource("PpaRankings.tsx");

    for (const [rawPath, lang] of [
      ["/rankings/ppa-tour", "en"],
      ["/vi/rankings/ppa-tour", "vi"],
    ] as const) {
      const html = await (await renderPpaRankings(SITE, rawPath, lang)).text();
      const ssrTitle = extractTitle(html);
      const ssrDescription = extractDescription(html);

      expect(ssrTitle.endsWith(BRAND)).toBe(true);
      const bare = ssrTitle.slice(0, -BRAND.length);

      expect(src, `PpaRankings.tsx is missing the ${lang} SSR title ${bare}`).toContain(bare);
      expect(
        src,
        `PpaRankings.tsx is missing the ${lang} SSR description`,
      ).toContain(ssrDescription);
    }
  });
});
