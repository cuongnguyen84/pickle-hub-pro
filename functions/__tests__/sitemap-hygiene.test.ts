import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EN_BLOG_ENTRIES, EN_BLOG_SLUGS } from "../_lib/static-blog-slugs";

const root = resolve(import.meta.dirname, "../..");
const source = (p: string) => readFileSync(resolve(root, p), "utf8");

/**
 * Housekeeping from the 2026-08-25 audit. Each of these was measured on the
 * live sitemaps, and each fails silently — nothing errors, the signal just
 * gets quietly worse.
 */
describe("sitemap hygiene", () => {
  it("every EN blog URL carries a real modification date", () => {
    // Measured: sitemap-static.xml had 102 <loc> but only 43 <lastmod>. All 58
    // EN blog entries were built without one.
    expect(EN_BLOG_ENTRIES.length).toBe(EN_BLOG_SLUGS.length);
    expect(EN_BLOG_ENTRIES.length).toBeGreaterThan(50);
    for (const e of EN_BLOG_ENTRIES) {
      expect(e.lastmod, e.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(source("functions/sitemap-static.xml.ts")).toContain(
      "buildUrlEntry({ loc: `${siteUrl}/blog/${slug}`, lastmod,",
    );
  });

  it("blog lastmod comes from the post, never from today's date", () => {
    // A sitemap where every URL claims it changed today teaches Google the
    // field is noise, which costs the recrawl priority it exists to earn.
    const today = new Date().toISOString().slice(0, 10);
    const allToday = EN_BLOG_ENTRIES.every((e) => e.lastmod === today);
    expect(allToday).toBe(false);
    expect(source("functions/_lib/static-blog-slugs.ts")).toContain(
      "p.updatedDate ?? p.publishedDate",
    );
  });

  it("/rss.xml is not listed as a page", () => {
    // It is a feed: no title, no canonical, no H1 — the only crawled URL on
    // the site with none of them. Discovery belongs to <link rel=alternate>.
    const sitemap = source("functions/sitemap-static.xml.ts");
    expect(sitemap).not.toContain('loc: "/rss.xml"');
  });

  it("the shop segment is listed only once it can contain URLs", () => {
    const index = source("functions/sitemap.xml.ts");
    // The original constraint still holds: never 404 a referenced segment.
    // Omitting an entry is not serving a 404 — /sitemap-shop.xml still
    // answers 200 with an empty urlset when requested directly.
    expect(index).toContain('context.env.SHOP_PUBLIC_INDEXING === "1"');
    expect(index).toContain("SHOP_SEGMENT_PATH");
    expect(source("functions/sitemap-shop.xml.ts")).toContain(
      'context.env.SHOP_PUBLIC_INDEXING !== "1"',
    );
  });
});

describe("/about carries its own entity in meta", () => {
  const ssr = source("functions/_lib/render/static-pages.ts");
  const spa = source("src/pages/About.tsx");

  // buildHtml truncates on UTF-8 BYTES (SEO_TITLE_MAX_BYTES 60,
  // SEO_DESCRIPTION_MAX_BYTES 160) and a Vietnamese diacritic costs 2-3 bytes,
  // so these are measured rather than eyeballed.
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  const EN_T = "About ThePickleHub — Bilingual Pickleball Platform";
  const VI_T = "Về ThePickleHub — Nền tảng pickleball song ngữ";
  const EN_D =
    "ThePickleHub is Vietnam's bilingual pickleball platform: free tournament software, livestreams, DUPR rankings, a court directory and news. Based in HCMC.";
  const VI_D =
    "ThePickleHub — nền tảng pickleball song ngữ Việt–Anh: phần mềm giải đấu miễn phí, livestream, xếp hạng DUPR, danh bạ sân.";

  it("fits the byte budgets buildHtml enforces", () => {
    expect(bytes(EN_T)).toBeLessThanOrEqual(60);
    expect(bytes(VI_T)).toBeLessThanOrEqual(60);
    expect(bytes(EN_D)).toBeLessThanOrEqual(160);
    expect(bytes(VI_D)).toBeLessThanOrEqual(160);
  });

  it("replaces the 18-char title and 49-char description the audit found", () => {
    for (const file of [ssr, spa]) {
      expect(file).toContain(EN_T);
      expect(file).toContain(VI_T);
      expect(file).toContain(EN_D);
      expect(file).toContain(VI_D);
      // The old strings were too short to carry the entity at all.
      expect(file).not.toContain("A bilingual pickleball platform built in Vietnam.");
    }
  });
});
