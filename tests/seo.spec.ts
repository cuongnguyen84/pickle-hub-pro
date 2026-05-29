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
    // Rankings page is currently EN-only; no /vi/rankings twin shipped
    // yet. Flip to true once the VI variant + hreflang tags exist.
    expectsHreflang: false,
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

// ── Phase 3D — sitemap index integrity + hreflang reciprocity ──────────────

test("every child sitemap referenced by the index resolves to a valid urlset", async () => {
  const ctx = await request.newContext({
    extraHTTPHeaders: { "User-Agent": GOOGLEBOT_UA },
  });

  const idxRes = await ctx.get("/sitemap.xml");
  expect(idxRes.status()).toBe(200);
  const idxXml = await idxRes.text();
  expect(idxXml, "root is a sitemapindex").toMatch(/<sitemapindex[^>]*>/);

  // Pull the child sitemap URLs the index actually references (don't hardcode
  // — players/venues are intentionally disabled per CLAUDE.md).
  const childUrls = [...idxXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(
    (m) => m[1],
  );
  expect(childUrls.length, "index references at least one child sitemap").toBeGreaterThan(0);

  for (const url of childUrls) {
    const res = await ctx.get(url);
    expect(res.status(), `child sitemap ${url} status`).toBe(200);
    const xml = await res.text();
    expect(xml, `child sitemap ${url} is a urlset or sitemapindex`).toMatch(
      /<(urlset|sitemapindex)[^>]*>/,
    );
  }
  await ctx.dispose();
});

test("bilingual blog post has reciprocal en↔vi hreflang", async () => {
  const ctx = await request.newContext({
    extraHTTPHeaders: { "User-Agent": GOOGLEBOT_UA },
  });

  const enPath = "/blog/what-is-dupr-pickleball-rating-system";
  const enRes = await ctx.get(enPath);
  expect(enRes.status()).toBe(200);
  const enHtml = await enRes.text();

  // Extract the VI alternate the EN page advertises.
  const viHref = enHtml.match(
    /<link[^>]+hreflang=["']vi["'][^>]+href=["']([^"']+)["']/i,
  )?.[1] ?? enHtml.match(
    /<link[^>]+href=["']([^"']+)["'][^>]+hreflang=["']vi["']/i,
  )?.[1];
  expect(viHref, "EN page advertises a vi hreflang alternate").toBeTruthy();
  expect(viHref!, "vi alternate points at a /vi/ path").toMatch(/\/vi\//);

  // Fetch the VI twin and confirm it links back to an EN alternate.
  const viRes = await ctx.get(viHref!);
  expect(viRes.status(), `vi twin ${viHref} resolves`).toBe(200);
  const viHtml = await viRes.text();
  expect(viHtml, "vi page has en hreflang back-reference").toMatch(
    /hreflang=["']en["']/i,
  );
  expect(viHtml, "vi page has x-default").toMatch(/hreflang=["']x-default["']/i);
  await ctx.dispose();
});
