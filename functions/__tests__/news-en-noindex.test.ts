import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const source = (p: string) => readFileSync(resolve(root, p), "utf8");

/**
 * C3 (2026-08-25) — the EN news feed is noindex, the VI feed stays indexed.
 *
 * Every row in news_items originates from a third-party article, so the EN
 * page competes head-on with the publisher it came from: same content,
 * published later, less authority. The VI page is a different proposition —
 * a Vietnamese rendering of something that exists only in English.
 *
 * The measurement that decided it (GSC, 2026-05-23..08-22, domain property):
 * the whole /news/ segment earned 48 clicks and 447 impressions from 12 pages
 * out of 1,551 — 3.0% of site clicks and 0.8% of impressions — while /san/
 * alone took 50% of clicks and 75% of impressions. Every attributable page in
 * that news set was a /vi/ one.
 *
 * These are source assertions. The behaviour they guard spans a Pages
 * Function, a sitemap, an SPA route and a pg_cron job, and the failure mode is
 * silent (a page quietly becomes indexable again), so pin each surface.
 */
describe("EN news is noindex on every surface", () => {
  it("the SSR renderer emits noindex,follow for EN and nothing for VI", () => {
    const ssr = source("functions/_lib/render/news.ts");
    expect(ssr).toContain(
      'language === "en" ? `<meta name="robots" content="noindex, follow"/>` : ""',
    );
    // follow, not nofollow: the related-news strip and the /news hub should
    // still pass equity through these pages.
    expect(ssr).not.toContain('content="noindex, nofollow"');
  });

  it("the SSR renderer keeps the noindexed EN URL out of hreflang", () => {
    const ssr = source("functions/_lib/render/news.ts");
    // Google mishandles or drops a whole hreflang cluster when one member is
    // unindexable, so the VI page self-references and EN emits none.
    expect(ssr).toMatch(/hreflang="vi" href="\$\{siteUrl\}\$\{canonicalPath\}"/);
    expect(ssr).toMatch(
      /hreflang="x-default" href="\$\{siteUrl\}\$\{canonicalPath\}"/,
    );
    expect(ssr).not.toContain('hreflang="en"');
  });

  it("the SPA route noindexes only its EN half", () => {
    const page = source("src/pages/NewsArticle.tsx");
    // Covers JS-rendering crawlers that see the SPA rather than the prerender.
    expect(page).toContain(
      'useNoindex({ enabled: language === "en", content: "noindex, follow" })',
    );
    // enPath is what would put the EN URL into the hreflang cluster.
    expect(page).toContain("const enPath = undefined");
  });

  it("useNoindex can be disabled and can emit a follow directive", () => {
    const hook = source("src/hooks/useNoindex.ts");
    // Without both options the news page could not opt its VI half out, and
    // the default private-route policy must stay noindex,nofollow.
    expect(hook).toContain("enabled");
    expect(hook).toContain("content");
    expect(hook).toContain('options?.content ?? "noindex, nofollow"');
  });

  it("sitemap-news emits VI URLs only", () => {
    const sitemap = source("functions/sitemap-news.xml.ts");
    // A sitemap must not advertise URLs carrying a noindex.
    expect(sitemap).toContain('if (vi.language !== "vi" || !vi.slug) continue;');
    expect(sitemap).not.toContain("${siteUrl}/news/${en.slug}");
    expect(sitemap).not.toContain('lang: "en"');
  });

  it("the IndexNow cron announces VI URLs only", () => {
    const migration = source(
      "supabase/migrations/20260825120000_indexnow_news_vi_only.sql",
    );
    // Pushing an EN URL to IndexNow asks a search engine to fetch a page we
    // are telling it not to index.
    expect(migration).toContain("AND language = 'vi'");
    expect(migration).toContain("'https://www.thepicklehub.net/vi/news/' || slug");
    expect(migration).not.toContain("'https://www.thepicklehub.net/news/' || slug");
  });

  it("/news/ stays out of robots.txt so the noindex can be seen", () => {
    const robots = source("public/robots.txt");
    // Disallow would stop Google recrawling, freezing the current indexed
    // state instead of clearing it.
    expect(robots).not.toMatch(/^Disallow: \/news/m);
    expect(robots).not.toMatch(/^Disallow: \/vi\/news/m);
  });
});
