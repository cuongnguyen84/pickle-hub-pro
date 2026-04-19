/**
 * IndexNow API endpoint for Bing/Yandex/search engines.
 *
 * GET  /api/indexnow          → submit all key URLs from sitemap
 * POST /api/indexnow          → submit specific URLs in body { urls: string[] }
 *
 * Requires ?key=<INDEXNOW_SECRET> query param for auth.
 *
 * Environment variables:
 *   INDEXNOW_KEY     — the IndexNow API key (matches the .txt file in /public)
 *   INDEXNOW_SECRET  — secret to protect this endpoint from unauthorized calls
 */

interface Env {
  INDEXNOW_KEY: string;
  INDEXNOW_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const HOST = "www.thepicklehub.net";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

// Static routes to always submit
const STATIC_URLS = [
  `https://${HOST}/`,
  `https://${HOST}/tournaments`,
  `https://${HOST}/live`,
  `https://${HOST}/videos`,
  `https://${HOST}/tools`,
  `https://${HOST}/blog`,
  `https://${HOST}/news`,
  `https://${HOST}/forum`,
  `https://${HOST}/vi`,
  `https://${HOST}/vi/blog`,
  `https://${HOST}/tools/quick-tables`,
  `https://${HOST}/tools/team-match`,
  `https://${HOST}/tools/doubles-elimination`,
  `https://${HOST}/tools/flex-tournament`,
  `https://${HOST}/tools/dashboard`,
];

// Blog slugs (EN) — keep in sync with src/lib/blog-data.ts and functions/sitemap.xml.ts
const BLOG_SLUGS = [
  "how-to-watch-ppa-tour-live-2026",
  "ppa-tour-asia-2026-complete-guide",
  "best-pickleball-tournament-software-2026",
  "how-to-create-pickleball-bracket",
  "pickleball-round-robin-generator-guide",
  "pickleball-scoring-rules-guide",
  "how-to-organize-pickleball-tournament",
  "pickleball-doubles-strategy-guide",
  "pickleball-tournament-formats-explained",
  "pickleball-live-streaming-guide",
  "mlp-format-explained",
  "free-pickleball-bracket-generator",
  "pickleball-bracket-templates",
  "pickleball-rules-complete-guide",
];

async function getViBlogSlugs(env: Env): Promise<string[]> {
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/vi_blog_posts?select=slug&status=eq.published`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!res.ok) return [];
    const posts: { slug: string }[] = await res.json();
    return posts.map((p) => p.slug);
  } catch {
    return [];
  }
}

function buildAllUrls(viSlugs: string[]): string[] {
  const urls = [...STATIC_URLS];

  // EN blog posts
  for (const slug of BLOG_SLUGS) {
    urls.push(`https://${HOST}/blog/${slug}`);
  }

  // VI blog posts
  for (const slug of viSlugs) {
    urls.push(`https://${HOST}/vi/blog/${slug}`);
  }

  return urls;
}

async function submitToIndexNow(
  apiKey: string,
  urls: string[]
): Promise<{ status: number; body: string }> {
  const payload = {
    host: HOST,
    key: apiKey,
    keyLocation: `https://${HOST}/${apiKey}.txt`,
    urlList: urls,
  };

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const body = await res.text();
  return { status: res.status, body };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const secret = url.searchParams.get("key");

  // Auth check
  if (!env.INDEXNOW_SECRET || secret !== env.INDEXNOW_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!env.INDEXNOW_KEY) {
    return new Response(
      JSON.stringify({ error: "INDEXNOW_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let urlsToSubmit: string[];

  if (request.method === "POST") {
    // Submit specific URLs
    try {
      const body: { urls?: string[] } = await request.json();
      if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
        return new Response(
          JSON.stringify({ error: "Body must contain { urls: string[] }" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      urlsToSubmit = body.urls;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    // GET — submit all known URLs
    const viSlugs = await getViBlogSlugs(env);
    urlsToSubmit = buildAllUrls(viSlugs);
  }

  const result = await submitToIndexNow(env.INDEXNOW_KEY, urlsToSubmit);

  return new Response(
    JSON.stringify({
      submitted: urlsToSubmit.length,
      urls: urlsToSubmit,
      indexnow_status: result.status,
      indexnow_response: result.body,
    }),
    {
      status: result.status === 200 || result.status === 202 ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    }
  );
};
