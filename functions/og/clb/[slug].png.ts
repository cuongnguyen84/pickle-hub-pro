/**
 * /og/clb/{slug}.png — public OG image URL for a club landing page.
 *
 * PR79 Phase 2E (audit I-6). Mirrors the og/match/[slug].png proxy.
 */

interface Env {
  SUPABASE_URL: string;
  PRERENDER_CACHE?: KVNamespace;
}

const URL_SAFE_SLUG = /^[a-z0-9-]+$/;
const CACHE_PREFIX = "og:club:v1:";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const onRequest: PagesFunction<Env> = async (context) => {
  const { params, env, request } = context;
  const slug = (params.slug as string | undefined)?.toLowerCase().replace(/\.png$/, "").trim();

  if (!slug || !URL_SAFE_SLUG.test(slug)) {
    return new Response("Invalid slug", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  const cacheKey = `${CACHE_PREFIX}${slug}`;
  const noCache = new URL(request.url).searchParams.get("nocache") === "1";

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
      console.error("og/clb: KV read failed:", err);
    }
  }

  const upstream = `${env.SUPABASE_URL}/functions/v1/og-image-club?slug=${encodeURIComponent(slug)}`;
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, { cf: { cacheTtl: 60 } });
  } catch (err) {
    console.error("og/clb: upstream fetch failed:", err);
    return new Response("Upstream OG generator unreachable", {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (upstreamRes.status === 404) {
    return new Response("Club not found", {
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
