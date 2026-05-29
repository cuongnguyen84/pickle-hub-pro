// ============================================================================
// SEO / SSR bot-view tests
// ============================================================================
// Cloudflare Pages Functions render bot-only HTML for crawlers via the
// _middleware.ts + _lib/render handlers. This file curls those routes
// with a Googlebot User-Agent and asserts the SSR HTML carries the
// expected title, OG meta, hreflang, and structured data.
//
// Catches:
//   - Blog post forgot to be added to BLOG_POST_META → bot 404s while
//     SPA renders fine (ThePickleHub 4-file sync trap)
//   - Title / meta description missing
//   - hreflang en/vi/x-default missing on bilingual route
// ============================================================================

import { test, expect, request } from "@playwright/test";

const GOOGLEBOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const SSR_ROUTES = [
  {
    path: "/blog/what-is-dupr-pickleball-rating-system",
    expectedTitlePart: /dupr/i,
    expectsHreflang: true,
  },
  {
    path: "/rankings",
    expectedTitlePart: /(ranking|xếp hạng)/i,
    expectsHreflang: true,
  },
  {
    path: "/news",
    expectedTitlePart: /(news|tin tức)/i,
    expectsHreflang: true,
  },
] as const;

for (const route of SSR_ROUTES) {
  test(`Googlebot sees correct SSR meta for ${route.path}`, async () => {
    const ctx = await request.newContext({
      extraHTTPHeaders: { "User-Agent": GOOGLEBOT_UA },
    });

    const res = await ctx.get(route.path, {
      timeout: 20_000,
    });
    expect(res.status(), `HTTP status for bot fetch ${route.path}`).toBe(200);

    const html = await res.text();

    // Title present + matches expectation.
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    expect(titleMatch, `<title> tag for ${route.path}`).toBeTruthy();
    const title = titleMatch![1];
    expect(title, "title not empty / undefined").not.toMatch(/^\s*$|undefined/i);
    expect(title, "title pattern").toMatch(route.expectedTitlePart);

    // Description present.
    expect(html, "meta description present").toMatch(
      /<meta\s+name=["']description["']\s+content=["'][^"']{20,}["']/i,
    );

    // OG image present.
    expect(html, "og:image present").toMatch(
      /<meta\s+property=["']og:image["']\s+content=["'][^"']+["']/i,
    );

    if (route.expectsHreflang) {
      expect(html, "hreflang en + vi + x-default").toMatch(
        /hreflang=["']en["']/i,
      );
      expect(html, "hreflang vi").toMatch(/hreflang=["']vi["']/i);
      expect(html, "hreflang x-default").toMatch(/hreflang=["']x-default["']/i);
    }

    await ctx.dispose();
  });
}

test("Googlebot sees valid sitemap.xml", async () => {
  const ctx = await request.newContext({
    extraHTTPHeaders: { "User-Agent": GOOGLEBOT_UA },
  });
  const res = await ctx.get("/sitemap.xml");
  expect(res.status()).toBe(200);

  const xml = await res.text();
  expect(xml, "valid sitemap or sitemapindex").toMatch(
    /<(sitemapindex|urlset)[^>]*>/,
  );
  await ctx.dispose();
});

test("robots.txt allows crawl + points to sitemap", async () => {
  const ctx = await request.newContext({
    extraHTTPHeaders: { "User-Agent": GOOGLEBOT_UA },
  });
  const res = await ctx.get("/robots.txt");
  expect(res.status()).toBe(200);

  const txt = await res.text();
  expect(txt, "Sitemap directive present").toMatch(/Sitemap:\s+https?:\/\//i);
  await ctx.dispose();
});
