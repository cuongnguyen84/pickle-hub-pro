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

import { EN_BLOG_SLUGS } from "../_lib/static-blog-slugs";

interface Env {
  INDEXNOW_KEY: string;
  INDEXNOW_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Constant-time string comparison to avoid leaking the secret via response
// timing (M7). Returns false immediately on length mismatch is acceptable —
// the secret length is not sensitive.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// A single service-only Postgres bucket serializes all authenticated callers.
// Global 10/minute bounds upstream work even when callers rotate IPs. No IP or
// secret is stored. KV read-modify-write is not an enforceable counter.
async function consumeBudget(env: Env): Promise<boolean | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const result = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/consume_indexnow_budget`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: "{}",
      signal: AbortSignal.timeout(3_000),
    });
    if (!result.ok) return null;
    const allowed: unknown = await result.json();
    return typeof allowed === "boolean" ? allowed : null;
  } catch {
    // Never surface credentials, upstream bodies, URLs or exception messages.
    return null;
  }
}

// Error → string without leaking a stack trace into any response body
// (CodeQL js/stack-trace-exposure). Only `message` is ever surfaced.
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
  `https://${HOST}/advertise`,
  `https://${HOST}/vi`,
  `https://${HOST}/vi/blog`,
  `https://${HOST}/vi/advertise`,
  `https://${HOST}/tools/quick-tables`,
  `https://${HOST}/tools/team-match`,
  `https://${HOST}/tools/doubles-elimination`,
  `https://${HOST}/tools/flex-tournament`,
  // /tools/dashboard is deliberately absent: robots.txt Disallows it and
  // NOINDEX_PATTERNS serves it a noindex shell, so announcing it to Bing and
  // Yandex only earns a "Blocked by robots.txt" row on every ping.
];

// EN blog slugs come straight from the generated list, which derives from
// src/content/blog/metadata.ts — the single blog source of truth.
//
// This used to be a hand-copied array with a "keep in sync with metadata.ts"
// comment on top. It drifted three times: 2026-06-10 (4 slugs), 2026-07-11
// (4 slugs), and again by 2026-07-27 (5 slugs — every post published since
// mid-July). Each drift is silent in the worst way: GET /api/indexnow returns
// `submitted: 42` and HTTP 200, so the ping looks successful while the newest
// posts — the ones that actually need discovering — were never sent to Bing or
// Yandex. Nothing failed, nothing logged, and no test covered the array.
//
// Importing the generated list removes the class of bug rather than patching
// its third instance. Same import sitemap-static.xml.ts already uses.

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
  for (const slug of EN_BLOG_SLUGS) {
    urls.push(`https://${HOST}/blog/${slug}`);
  }

  // VI blog posts
  for (const slug of viSlugs) {
    urls.push(`https://${HOST}/vi/blog/${slug}`);
  }

  return urls;
}

// How long we are willing to wait on api.indexnow.org before giving up. The
// upstream ping is a courtesy to Bing/Yandex — it is never worth holding a
// Pages Function open for it.
export const INDEXNOW_TIMEOUT_MS = 10_000;

/**
 * POST the URL list to IndexNow.
 *
 * Contract (2026-08-28): this function NEVER throws. It used to be a bare
 * `await fetch(...)` on the request path with no try/catch and no timeout, so
 * a refused connection, a TLS failure or a hang at api.indexnow.org would
 * escape the handler and let the edge answer with its own "Bad gateway" HTML
 * page — status 502, `content-type: text/html`, no JSON. A caller that parses
 * the response as JSON then gets a syntax error instead of a diagnosis, and
 * nothing in the body says which failure fired. That is the class of outage
 * recorded in docs/defects/2026-08-25-indexnow-endpoint-502.md.
 *
 * Every other outbound call in this file (`getViBlogSlugs`) already degrades
 * instead of throwing. This one now does the same, and reports `status: 0`
 * plus an `error` so the handler can say what went wrong in JSON.
 */
async function submitToIndexNow(
  apiKey: string,
  urls: string[]
): Promise<{ status: number; body: string; error?: string }> {
  const payload = {
    host: HOST,
    key: apiKey,
    keyLocation: `https://${HOST}/${apiKey}.txt`,
    urlList: urls,
  };

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(INDEXNOW_TIMEOUT_MS),
    });

    const body = await res.text();
    return { status: res.status, body };
  } catch (err) {
    const message = errorMessage(err);
    console.error(`[indexnow] upstream ping failed: ${message}`);
    // status 0 = "we never got an HTTP answer", distinct from a real upstream
    // status the handler would otherwise report verbatim.
    return { status: 0, body: "", error: message };
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const secret = url.searchParams.get("key") ?? "";

  // Auth check (constant-time compare)
  if (!env.INDEXNOW_SECRET || !timingSafeEqual(secret, env.INDEXNOW_SECRET)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json", Allow: "GET, POST" },
    });
  }

  const allowed = await consumeBudget(env);
  if (allowed !== true) {
    return new Response(JSON.stringify({ error: allowed === false ? "Rate limited" : "Rate limit unavailable" }), {
      status: allowed === false ? 429 : 503,
      headers: { "Content-Type": "application/json", "Retry-After": "60" },
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
      // Only accept URLs on our own host. IndexNow rejects foreign hosts anyway
      // (key-file ownership check), but filtering here avoids wasting submissions
      // and closes the open-submission surface.
      const allowedPrefix = `https://${HOST}/`;
      urlsToSubmit = body.urls.filter(
        (u) => typeof u === "string" && u.startsWith(allowedPrefix),
      );
      if (urlsToSubmit.length === 0) {
        return new Response(
          JSON.stringify({
            error: `urls must be absolute and start with ${allowedPrefix}`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
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
  const ok = result.status === 200 || result.status === 202;

  // Always a JSON body, including on 502. The two failure modes are now
  // distinguishable by the caller: `indexnow_status` > 0 means IndexNow
  // answered and refused, `indexnow_status` 0 plus `indexnow_error` means we
  // never reached it (timeout / DNS / TLS).
  return new Response(
    JSON.stringify({
      submitted: urlsToSubmit.length,
      urls: urlsToSubmit,
      indexnow_status: result.status,
      indexnow_response: result.body,
      ...(result.error ? { indexnow_error: result.error } : {}),
    }),
    {
      status: ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    }
  );
};
