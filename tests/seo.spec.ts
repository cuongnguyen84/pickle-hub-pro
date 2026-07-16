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

// ── SEO-03 helpers — canonical + JSON-LD validation ─────────────────────────

function extractCanonical(html: string): string | undefined {
  return (
    html.match(/<link[^>]+rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i)?.[1] ??
    html.match(/<link[^>]+href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']canonical["']/i)?.[1]
  );
}

function extractTitle(html: string): string | undefined {
  return html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
}

// Required fields per schema.org @type, for the types whose data source
// guarantees them (BLOG_POST_META / news_items always carry these). Missing
// fields on these types have broken Google Rich Results before — that is the
// exact failure class this gate exists for. Types not listed are only checked
// for JSON parseability.
const JSONLD_REQUIRED_FIELDS: Record<string, string[]> = {
  BlogPosting: ["headline", "datePublished"],
  NewsArticle: ["headline", "datePublished"],
};

/** Recursively collect every JSON-LD node, walking arrays and nested
 *  @graph containers (Codex P2: a BlogPosting buried in a @graph must not
 *  evade required-field validation). */
function collectJsonLdNodes(
  input: unknown,
  out: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
  if (Array.isArray(input)) {
    for (const item of input) collectJsonLdNodes(item, out);
  } else if (input && typeof input === "object") {
    const node = input as Record<string, unknown>;
    out.push(node);
    if (node["@graph"]) collectJsonLdNodes(node["@graph"], out);
  }
  return out;
}

/** Parse every <script type="application/ld+json"> block; fail on invalid
 *  JSON or on a known @type missing its required fields. */
function assertJsonLd(html: string, label: string): void {
  const blocks = [
    ...html.matchAll(
      // \s before type= so data-type= can't match; \s*=\s* tolerates
      // whitespace around the equals sign (Codex P2).
      /<script[^>]*\stype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].map((m) => m[1]);

  for (const raw of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`invalid JSON-LD on ${label}: ${raw.slice(0, 200)}`);
    }
    for (const node of collectJsonLdNodes(parsed)) {
      // @type may be a string or an array of strings — both are valid JSON-LD.
      const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      for (const type of types) {
        if (typeof type !== "string") continue;
        for (const field of JSONLD_REQUIRED_FIELDS[type] ?? []) {
          expect(
            node[field],
            `JSON-LD ${type} on ${label} requires "${field}"`,
          ).toBeTruthy();
        }
      }
    }
  }
}

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
    const title = extractTitle(html);
    expect(title, `<title> tag for ${route.path}`).toBeTruthy();
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

    // SEO-03: canonical present and points at this path (against the
    // canonical production origin — SSR always emits absolute prod URLs).
    const canonical = extractCanonical(html);
    expect(canonical, `canonical link on ${route.path}`).toBeTruthy();
    expect(new URL(canonical!).pathname, "canonical path matches route").toBe(
      route.path,
    );

    // SEO-03: every JSON-LD block parses and required fields are present.
    assertJsonLd(html, route.path);

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

// Sitemap <loc> values + hreflang hrefs are absolute canonical URLs
// (https://www.thepicklehub.net/...). On a PR run PLAYWRIGHT_BASE_URL points
// at the Cloudflare preview, so we must re-home those absolute URLs onto the
// configured base origin — otherwise the follow-up fetches verify production
// instead of the preview under test (Codex review, PR #181).
const BASE_ORIGIN =
  process.env.PLAYWRIGHT_BASE_URL ?? "https://www.thepicklehub.net";

function onBaseOrigin(absUrl: string): string {
  try {
    const u = new URL(absUrl);
    return new URL(u.pathname + u.search, BASE_ORIGIN).toString();
  } catch {
    return absUrl; // already relative or unparseable — leave as-is
  }
}

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
    const target = onBaseOrigin(url);
    const res = await ctx.get(target);
    expect(res.status(), `child sitemap ${target} status`).toBe(200);
    const xml = await res.text();
    expect(xml, `child sitemap ${target} is a urlset or sitemapindex`).toMatch(
      /<(urlset|sitemapindex)[^>]*>/,
    );
  }
  await ctx.dispose();
});

// ── SEO-03 — sitemap-sampled bot-200 sweep ──────────────────────────────────
// For every child sitemap in the index, fetch its FIRST <loc> URL as
// Googlebot and assert 200 + title + canonical + parseable JSON-LD. This
// covers every SEO surface class (tournaments, matches, news, venues,
// players, orgs, blog EN/VI, …) without hardcoding slugs: the sitemap is
// generated from the same DB the render handlers read, so the first entry
// of each segment must always render for bots. Catches the "SPA renders,
// bot 404s" class for every non-blog surface the slug-parity guard misses.

test("first URL of every sitemap segment renders for Googlebot", async () => {
  test.setTimeout(120_000); // up to ~10 segments × 2 fetches, serial
  const ctx = await request.newContext({
    extraHTTPHeaders: { "User-Agent": GOOGLEBOT_UA },
  });

  const idxXml = await (await ctx.get("/sitemap.xml")).text();
  const childUrls = [...idxXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(
    (m) => m[1],
  );
  expect(childUrls.length).toBeGreaterThan(0);

  // Segments allowed to serve an empty urlset. Currently NONE — all 11 prod
  // segments carry URLs (checked 2026-07-16), and sitemap generators swallow
  // Supabase query errors into an empty 200 urlset (sitemap-news.xml.ts:62),
  // so an unexpected empty segment must fail loud, not skip silently
  // (Codex P1). If a segment becomes legitimately emptiable, add it here.
  const MAY_BE_EMPTY = new Set<string>([]);

  for (const child of childUrls) {
    const childXml = await (await ctx.get(onBaseOrigin(child))).text();
    const segment = new URL(child).pathname.slice(1);
    // First page URL this segment lists (<loc> may be CDATA-wrapped).
    const first = childXml.match(
      /<url[\s>][\s\S]*?<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/,
    )?.[1];
    if (!first) {
      expect(
        MAY_BE_EMPTY.has(segment),
        `${segment} returned an empty urlset — either its generator is ` +
          `broken (query errors degrade to empty 200s) or it is now ` +
          `legitimately emptiable and belongs in MAY_BE_EMPTY`,
      ).toBe(true);
      continue;
    }

    const target = onBaseOrigin(first);
    const res = await ctx.get(target, { timeout: 20_000 });
    expect(res.status(), `bot fetch ${target} (from ${child})`).toBe(200);
    const html = await res.text();

    const title = extractTitle(html);
    expect(title, `<title> on ${target}`).toBeTruthy();
    expect(title!, `title not empty/undefined on ${target}`).not.toMatch(
      /^\s*$|undefined/i,
    );

    // SPA-fallback guard (Codex P1): when SSR fails, _middleware falls
    // through to the SPA shell, which carries the ROOT canonical and no
    // JSON-LD but would otherwise pass a bare "canonical exists" check.
    // Requiring the canonical path to equal the sampled URL's path proves
    // the per-route SSR handler actually rendered this page.
    const canonical = extractCanonical(html);
    expect(canonical, `canonical on ${target}`).toBeTruthy();
    expect(
      new URL(canonical!).pathname,
      `canonical path on ${target} — the SPA fallback shell carries the ` +
        `root canonical, so a mismatch means SSR did not render this page`,
    ).toBe(new URL(target).pathname);

    // Validate whatever JSON-LD the page emits. NOT asserted >0: /clb/:slug
    // org pages legitimately ship zero JSON-LD today (schema gap, not an
    // SSR failure — the canonical check above already proves SSR ran).
    assertJsonLd(html, target);
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

  // Fetch the VI twin (re-homed onto the base origin) and confirm it links
  // back to an EN alternate.
  const viTarget = onBaseOrigin(viHref!);
  const viRes = await ctx.get(viTarget);
  expect(viRes.status(), `vi twin ${viTarget} resolves`).toBe(200);
  const viHtml = await viRes.text();
  expect(viHtml, "vi page has en hreflang back-reference").toMatch(
    /hreflang=["']en["']/i,
  );
  expect(viHtml, "vi page has x-default").toMatch(/hreflang=["']x-default["']/i);
  await ctx.dispose();
});
