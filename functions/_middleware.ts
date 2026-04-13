/**
 * Cloudflare Pages Functions Middleware
 *
 * Handles:
 * 1. Apex → www redirect (thepicklehub.net → www.thepicklehub.net)
 * 2. Bot detection → SSR prerendered HTML with SEO metadata + KV cache
 * 3. Normal users → pass through to SPA (Vite build output)
 */

import { BOT_UA, detectLang, stripLangPrefix } from "./_lib/utils";
import { createSupabaseClient } from "./_lib/supabase";
import {
  renderHome, renderHomeVi,
  renderLive, renderVideo,
  renderTournamentDetail, renderTournaments,
  renderVideos, renderNews, renderForum, renderForumPost,
  renderOrgDetail,
  renderQuickTable, renderTeamMatch, renderDoublesElimination, renderFlexTournament,
  renderTools,
  renderBlogPost, renderBlog,
  renderViBlogPost, renderViBlogIndex,
  renderLivestreamList, renderPrivacy, renderTerms,
  renderDefault, render404,
} from "./_lib/render";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CANONICAL_HOST: string;
  PRERENDER_CACHE?: KVNamespace;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // ─── 1. Apex → www redirect ───────────────────────────
  if (url.hostname === "thepicklehub.net") {
    return Response.redirect(
      `https://www.thepicklehub.net${url.pathname}${url.search}`,
      301,
    );
  }

  // ─── 2. Bot detection ─────────────────────────────────
  const ua = request.headers.get("user-agent") || "";
  const isBot = BOT_UA.test(ua);

  if (!isBot) {
    // Normal user → serve SPA
    return next();
  }

  // ─── 3. Bot path: KV cache + SSR render ───────────────
  const siteUrl = env.CANONICAL_HOST || "https://www.thepicklehub.net";
  const cacheKey = `pr:v1:${url.pathname}`;
  const noCache = url.searchParams.get("nocache") === "1";

  if (!noCache && env.PRERENDER_CACHE) {
    try {
      const cached = await env.PRERENDER_CACHE.get(cacheKey);
      if (cached) {
        return new Response(cached, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
            "X-Prerender-Cache": "HIT",
            Vary: "User-Agent",
          },
        });
      }
    } catch {
      // KV read failed, continue to render
    }
  }

  try {
    const response = await routeAndRender(url.pathname, env, siteUrl);

    if (env.PRERENDER_CACHE && response.status === 200) {
      const html = await response.clone().text();
      context.waitUntil(
        env.PRERENDER_CACHE.put(cacheKey, html, { expirationTtl: 3600 }),
      );
    }

    const headers = new Headers(response.headers);
    headers.set("X-Prerender-Cache", "MISS");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (err) {
    console.error("Prerender error:", err);
    return next();
  }
};

// ─── Router ───────────────���─────────────────────────────────

async function routeAndRender(pathname: string, env: Env, siteUrl: string): Promise<Response> {
  const rawPath = pathname;
  const lang = detectLang(rawPath);
  const path = stripLangPrefix(rawPath);

  const supabase = createSupabaseClient(env);
  let match: RegExpMatchArray | null;

  // Vietnamese home
  if (lang === "vi" && (path === "/" || path === "")) {
    return await renderHomeVi(supabase, siteUrl);
  }

  // Vietnamese blog
  if (lang === "vi") {
    match = path.match(/^\/blog\/([^/]+)$/);
    if (match) return await renderViBlogPost(supabase, match[1], siteUrl);
    if (path === "/blog") return await renderViBlogIndex(supabase, siteUrl);
  }

  // Home
  if (path === "/" || path === "") return await renderHome(supabase, siteUrl);

  // Livestream detail
  match = path.match(/^\/live\/([^/]+)$/);
  if (match) return await renderLive(supabase, match[1], siteUrl);

  // Video detail
  match = path.match(/^\/watch\/([^/]+)$/);
  if (match) return await renderVideo(supabase, match[1], siteUrl);

  // Tournament detail
  match = path.match(/^\/tournament\/([^/]+)$/);
  if (match) return await renderTournamentDetail(supabase, match[1], siteUrl);

  // Tournaments list
  if (path === "/tournaments") return await renderTournaments(supabase, siteUrl);

  // Videos list
  if (path === "/videos") return await renderVideos(supabase, siteUrl);

  // News
  if (path === "/news") return await renderNews(supabase, siteUrl);

  // Forum
  if (path === "/forum") return await renderForum(supabase, siteUrl);

  // Forum post
  match = path.match(/^\/forum\/post\/([^/]+)$/);
  if (match) return await renderForumPost(supabase, match[1], siteUrl);

  // Organization
  match = path.match(/^\/org\/([^/]+)$/);
  if (match) return await renderOrgDetail(supabase, match[1], siteUrl);

  // Tool instances (noindex)
  match = path.match(/^\/tools\/quick-tables\/([^/]+)$/);
  if (match) return await renderQuickTable(supabase, match[1], siteUrl);

  match = path.match(/^\/tools\/team-match\/([^/]+)$/);
  if (match) return await renderTeamMatch(supabase, match[1], siteUrl);

  match = path.match(/^\/tools\/doubles-elimination\/([^/]+)$/);
  if (match) return await renderDoublesElimination(supabase, match[1], siteUrl);

  match = path.match(/^\/tools\/flex-tournament\/([^/]+)$/);
  if (match) return await renderFlexTournament(supabase, match[1], siteUrl);

  // Tools hub
  if (path.startsWith("/tools")) return renderTools(siteUrl);

  // Blog post
  match = path.match(/^\/blog\/([^/]+)$/);
  if (match) return renderBlogPost(match[1], siteUrl);

  // Blog index
  if (path === "/blog") return renderBlog(siteUrl);

  // Livestream listing
  if (path === "/livestream") return renderLivestreamList(siteUrl, rawPath, lang);

  // Privacy / Terms
  if (path === "/privacy") return renderPrivacy(siteUrl, rawPath, lang);
  if (path === "/terms") return renderTerms(siteUrl, rawPath, lang);

  // Default fallback
  return renderDefault(rawPath, siteUrl, lang);
}
