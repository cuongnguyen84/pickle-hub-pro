/**
 * /og/player/{username}.png — public OG image URL for a player profile.
 *
 * Phase B (shareable rating card, CF Pages side).
 *
 * Thin proxy in front of the Supabase og-image-player function. Adds:
 *   - KV cache (PRERENDER_CACHE binding) keyed by username, TTL 7d
 *   - Stable public URL the SPA + bot prerender both use (avoids leaking
 *     /functions/v1/ Supabase URLs into Facebook/Zalo share cards)
 *   - 404 passthrough when the upstream function reports an unknown player
 *
 * Cache key prefix is `og:player:v1:` so we can rev versions later (bump to
 * v2 to invalidate without a manual purge when the layout changes).
 */

interface Env {
  SUPABASE_URL: string;
  PRERENDER_CACHE?: KVNamespace;
}

const URL_SAFE_USERNAME = /^[a-zA-Z0-9_-]{1,64}$/;
// v2 — dark-luxury credential redesign (2026-06-15). Bump invalidates the
// old flat-green cards cached under v1 without a manual KV purge.
const CACHE_PREFIX = "og:player:v2:";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const onRequest: PagesFunction<Env> = async (context) => {
  const { params, env, request } = context;
  const username = (params.username as string | undefined)?.replace(/\.png$/, "").trim();

  if (!username || !URL_SAFE_USERNAME.test(username)) {
    return new Response("Invalid username", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  const cacheKey = `${CACHE_PREFIX}${username}`;
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
      console.error("og/player: KV read failed:", err);
    }
  }

  // ─── 2. Upstream fetch ─────────────────────
  const upstream = `${env.SUPABASE_URL}/functions/v1/og-image-player?username=${encodeURIComponent(username)}`;
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, { cf: { cacheTtl: 60 } });
  } catch (err) {
    console.error("og/player: upstream fetch failed:", err);
    return new Response("Upstream OG generator unreachable", {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (upstreamRes.status === 404) {
    return new Response("Player not found", {
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
