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
  // \s before rel/href so data-rel=/data-href= can't satisfy the match.
  return (
    html.match(/<link[^>]*\srel\s*=\s*["']canonical["'][^>]*\shref\s*=\s*["']([^"']+)["']/i)?.[1] ??
    html.match(/<link[^>]*\shref\s*=\s*["']([^"']+)["'][^>]*\srel\s*=\s*["']canonical["']/i)?.[1]
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

// SSR canonicals are built from CANONICAL_HOST (functions/_middleware.ts:377)
// on prod AND preview alike — asserting this origin catches a misconfigured
// canonical host, which controls which origin Google indexes (Codex round 3).
const PROD_ORIGIN = "https://www.thepicklehub.net";

/** Parse every <script type="application/ld+json"> block; fail on invalid
 *  JSON or on a known @type missing its required fields. Returns the block
 *  count and every @type seen — callers assert expected types so a page
 *  that silently DROPS its article schema still fails (Codex round 3). */
function assertJsonLd(
  html: string,
  label: string,
): { count: number; types: Set<string> } {
  const blocks = [
    ...html.matchAll(
      // \s before type= so data-type= can't match; \s*=\s* tolerates
      // whitespace around the equals sign (Codex P2).
      /<script[^>]*\stype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].map((m) => m[1]);

  const seenTypes = new Set<string>();
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
        seenTypes.add(type);
        for (const field of JSONLD_REQUIRED_FIELDS[type] ?? []) {
          expect(
            node[field],
            `JSON-LD ${type} on ${label} requires "${field}"`,
          ).toBeTruthy();
        }
      }
    }
  }
  return { count: blocks.length, types: seenTypes };
}

/** Canonical must exist, live on the production origin, and (for non-root
 *  paths) point at the given path. */
function assertCanonical(html: string, path: string, label: string): void {
  const canonical = extractCanonical(html);
  expect(canonical, `canonical link on ${label}`).toBeTruthy();
  const url = new URL(canonical!);
  expect(
    url.origin,
    `canonical origin on ${label} — SSR canonicals must point at the ` +
      `production origin (CANONICAL_HOST misconfiguration would deindex it)`,
  ).toBe(PROD_ORIGIN);
  expect(
    url.pathname,
    `canonical path on ${label} — the SPA fallback shell carries the root ` +
      `canonical, so a mismatch means SSR did not render this page`,
  ).toBe(path);
}

const SSR_ROUTES = [
  {
    path: "/blog/what-is-dupr-pickleball-rating-system",
    expectedTitlePart: /dupr/i,
    expectsHreflang: true,
    expectsJsonLdType: "BlogPosting",
  },
  {
    path: "/rankings",
    expectedTitlePart: /(ranking|xếp hạng)/i,
    // renderRankings emits the en/vi/x-default triplet (rankings.ts:103) —
    // comment previously said "no /vi twin" long after the twin shipped.
    expectsHreflang: true,
  },
  {
    path: "/rankings/ppa-tour",
    expectedTitlePart: /(ppa tour|wpr)/i,
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

    // SEO-03: canonical on the prod origin, pointing at this path.
    assertCanonical(html, route.path, route.path);

    // SEO-03: every JSON-LD block parses and required fields are present.
    // Routes that declare an expected @type fail if that schema disappears
    // entirely (required-fields alone can't catch a dropped block).
    const { types } = assertJsonLd(html, route.path);
    if ("expectsJsonLdType" in route) {
      expect(
        types.has(route.expectsJsonLdType),
        `JSON-LD @type ${route.expectsJsonLdType} present on ${route.path} (saw: ${[...types].join(", ") || "none"})`,
      ).toBe(true);
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
  test.setTimeout(240_000); // ~10 segments × 2 fetches + 3 floored segments × 2 extra samples, serial
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

  // Segments whose detail pages must carry a specific article schema.
  // (sitemap-blog.xml lists /vi/blog/* pages; both blog handlers emit
  // BlogPosting. sitemap-news.xml lists news details → NewsArticle.)
  const SEGMENT_JSONLD_TYPE: Record<string, string> = {
    "sitemap-blog.xml": "BlogPosting",
    "sitemap-news.xml": "NewsArticle",
  };

  // Inventory floors for the segments that carry the site's organic traffic
  // (venues = 56% of clicks / 83% of impressions per GSC 2026-08-01). A
  // predicate change that silently shrinks a sitemap must fail HERE, in CI,
  // not 4 weeks later in a GSC chart: sitemap-venues collapsing 1688 → 40
  // URLs passed every gate on 2026-08-02 because this sweep only asserted
  // "urlset is not empty". Counts on 2026-08-02: venues 1688 · news 1000 ·
  // matches 246. Floors are ~10-20% below that — inventory naturally grows,
  // so a floor breach means deliberate pruning (update the floor in the same
  // PR, with the before/after counts) or a broken generator.
  const SEGMENT_MIN_URLS: Record<string, number> = {
    "sitemap-venues.xml": 1500,
    "sitemap-news.xml": 700,
    "sitemap-matches.xml": 200,
  };

  // A title that ends in a separator + ellipsis ("… – Hà Nội |…") is the
  // byte-truncation bug shape: a pre-check counted CHARS, truncateForSeo cut
  // BYTES. Vietnamese diacritics are 2-3 bytes, so titles that "fit" get
  // chopped mid-brand. Legit truncation ends mid-word ("word…"), never in a
  // dangling separator.
  const CUT_TITLE_TAIL = /[|–-]\s*…$/;
  // No exemptions: the venues char-vs-byte pre-check that shipped cut titles
  // was removed (same PR as this line). Prerender cache holds old titles for
  // up to 6h after that deploy — if this assert reds on a venue URL right
  // after a deploy, warm that path once with ?nocache=1 before diagnosing.
  const CUT_TITLE_EXEMPT = new Set<string>([]);

  for (const child of childUrls) {
    const childXml = await (await ctx.get(onBaseOrigin(child))).text();
    const segment = new URL(child).pathname.slice(1);
    // Every page URL this segment lists (<loc> may be CDATA-wrapped).
    const allLocs = [
      ...childXml.matchAll(
        /<url[\s>][\s\S]*?<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/g,
      ),
    ].map((m) => m[1]);
    const first = allLocs[0];
    if (!first) {
      expect(
        MAY_BE_EMPTY.has(segment),
        `${segment} returned an empty urlset — either its generator is ` +
          `broken (query errors degrade to empty 200s) or it is now ` +
          `legitimately emptiable and belongs in MAY_BE_EMPTY`,
      ).toBe(true);
      continue;
    }

    const floor = SEGMENT_MIN_URLS[segment];
    if (floor) {
      expect(
        allLocs.length,
        `${segment} lists ${allLocs.length} URLs — below its committed floor ` +
          `of ${floor}. If this shrink is deliberate, raise/adjust the floor ` +
          `in this same PR with before/after counts; otherwise the generator ` +
          `or its predicate just silently pruned live inventory.`,
      ).toBeGreaterThanOrEqual(floor);
    }

    // Segments ORDER BY updated_at/published_at DESC, so the first <loc> is
    // always the freshest, best-maintained row — sampling only it means the
    // gate never sees the old cohort. For floored (traffic-bearing) segments
    // also fetch the LAST and MIDDLE entries.
    const samples = floor
      ? [
          ...new Set([
            first,
            allLocs[Math.floor(allLocs.length / 2)],
            allLocs[allLocs.length - 1],
          ]),
        ]
      : [first];

    for (const pageUrl of samples) {
    const target = onBaseOrigin(pageUrl);
    const res = await ctx.get(target, { timeout: 20_000 });
    expect(res.status(), `bot fetch ${target} (from ${child})`).toBe(200);
    const html = await res.text();

    const title = extractTitle(html);
    expect(title, `<title> on ${target}`).toBeTruthy();
    expect(title!, `title not empty/undefined on ${target}`).not.toMatch(
      /^\s*$|undefined/i,
    );
    if (!CUT_TITLE_EXEMPT.has(segment)) {
      expect(
        title!,
        `title on ${target} ends in a dangling separator + ellipsis — ` +
          `char-count-vs-byte-cut truncation (see buildTitle / #468)`,
      ).not.toMatch(CUT_TITLE_TAIL);
    }

    // SPA-fallback guard (Codex P1): when SSR fails, _middleware falls
    // through to the SPA shell, which carries the ROOT canonical and no
    // JSON-LD but would otherwise pass a bare "canonical exists" check.
    // Canonical-path equality proves the per-route SSR handler rendered
    // this page; the origin check catches CANONICAL_HOST misconfiguration.
    assertCanonical(html, new URL(target).pathname, target);

    // Validate whatever JSON-LD the page emits. NOT asserted >0 in general:
    // /clb/:slug org pages legitimately ship zero JSON-LD today (schema gap,
    // not an SSR failure — the canonical check above already proves SSR ran).
    const { count, types } = assertJsonLd(html, target);

    // Segments whose pages must carry a specific article schema — a page
    // that silently drops its BlogPosting/NewsArticle block must fail even
    // though required-field checks have nothing to run on (Codex round 3).
    const expectedType = SEGMENT_JSONLD_TYPE[segment];
    if (expectedType) {
      expect(
        types.has(expectedType),
        `JSON-LD @type ${expectedType} on ${target} (from ${segment}; saw: ${[...types].join(", ") || "none"})`,
      ).toBe(true);
    }

    // On "/": the static segment lists the homepage first, and the SPA
    // shell ALSO carries the root canonical, so canonical equality is
    // vacuous there (Codex round-2 P1). The SSR home handler always emits
    // Organization/WebSite JSON-LD; the shell emits none — that is the
    // discriminator.
    if (new URL(target).pathname === "/") {
      expect(
        count,
        `JSON-LD on ${target} — zero blocks on the root path means the ` +
          `SPA fallback shell was served instead of the SSR home render`,
      ).toBeGreaterThan(0);
    }
    }
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
