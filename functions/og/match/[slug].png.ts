/**
 * /og/match/{slug}.png — public OG image URL for a match permalink.
 *
 * Sprint 2 Phase 3B.3 deliverable 3 (CF Pages side).
 *
 * Thin proxy in front of the Supabase og-image-match function. Adds:
 *   - KV cache (PRERENDER_CACHE binding) keyed by slug, TTL 7d
 *   - Stable public URL the SPA + bot prerender both use (avoids leaking
 *     /functions/v1/ Supabase URLs into Twitter/Facebook share cards)
 *   - 404 passthrough when the upstream function reports an unknown match
 *
 * Cache key prefix is `og:match:v1:` so we can rev versions later (e.g.
 * if we change the layout, bump to v2 to invalidate without manual purge).
 */

interface Env {
  SUPABASE_URL: string;
  PRERENDER_CACHE?: KVNamespace;
}

const URL_SAFE_SLUG = /^[a-z0-9-]+$/;
const CACHE_PREFIX = "og:match:v1:";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const onRequest: PagesFunction<Env> = async (context) => {
  const { params, env, request } = context;
  const slug = (params.slug as string | undefined)?.toLowerCase().replace(/\.png$/, "").trim();

  if (!slug || !URL_SAFE_SLUG.test(slug)) {
    return new Response("Invalid slug", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  const cacheKey = `${CACHE_PREFIX}${slug}`;
  const noCache = new URL(request.url).searchParams.get("nocache") === "1";

  // ─── 1. KV hit ─────────────────────────────
  if (!noCache && env.PRERENDER_CACHE) {
    try {
      const cached = await env.PRERENDER_CACHE.get(cacheKey, "arrayBuffer");
      if (cached) {
        return new Response(cached, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=604800, immutable",
            "X-OG-Cache": "HIT",
          },
        });
      }
    } catch (err) {
      console.error("og/match: KV read failed:", err);
    }
  }

  // ─── 2. Upstream fetch ─────────────────────
  const upstream = `${env.SUPABASE_URL}/functions/v1/og-image-match?slug=${encodeURIComponent(slug)}`;
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, { cf: { cacheTtl: 60 } });
  } catch (err) {
    console.error("og/match: upstream fetch failed:", err);
    return new Response("Upstream OG generator unreachable", {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (upstreamRes.status === 404) {
    return new Response("Match not found", {
      status: 404,
      headers: { "Content-Type": "text/plain", "X-OG-Cache": "MISS" },
    });
  }

  if (!upstreamRes.ok) {
    return new Response("Upstream error", {
      status: 502,
      headers: { "Content-Type": "text/plain", "X-OG-Cache": "MISS" },
    });
  }

  const buffer = await upstreamRes.arrayBuffer();

  // ─── 3. Cache write (fire-and-forget) ──────
  if (env.PRERENDER_CACHE) {
    context.waitUntil(
      env.PRERENDER_CACHE.put(cacheKey, buffer, { expirationTtl: CACHE_TTL_SECONDS }),
    );
  }

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=604800, immutable",
      "X-OG-Cache": "MISS",
    },
  });
};
