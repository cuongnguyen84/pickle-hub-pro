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
  renderMatch,
  renderProfile,
  renderFeed,
  renderSocialEvent,
  renderClub,
  renderSocialList,
  renderClubList,
  renderOrgDetail,
  renderQuickTable, renderTeamMatch, renderDoublesElimination, renderFlexTournament,
  renderTools, renderToolPage,
  renderBlogPost, renderBlog,
  renderViBlogPost, renderViBlogIndex,
  renderLivestreamList, renderPrivacy, renderTerms,
  renderNotificationsShell,
  renderNoindexShell,
  renderDefault, render404,
} from "./_lib/render";

// ─── PR72 (SEO Phase 2A I-7) — noindex route patterns ────────
// Private / auth-gated / ephemeral surfaces. We never want these in
// any search-engine index.
//
// Critical: /dang-ky/:token carries a magic_token UUID that is the
// player's only bearer credential. If Google indexed it, anyone could
// search Google + open a stranger's registration page and cancel /
// edit. Same shape for /khoi-phuc-dang-ky after the captcha solve
// (the URL drops the token after redirect but the form itself sees
// the phone number).
//
// We respond with two SEO signals:
//   1. X-Robots-Tag: noindex, nofollow, noarchive — added below for
//      both bot and user paths so the SPA HTML and the prerendered
//      HTML carry the same instruction even before any client meta
//      rehydrates.
//   2. renderNoindexShell (bot path only) — replaces the generic
//      renderDefault fallback so the bot also sees a meta robots
//      noindex tag in the HTML body, not just the header.
const NOINDEX_PATTERNS: RegExp[] = [
  // Magic-link player flows (CRITICAL — token in URL)
  /^\/(?:vi\/)?dang-ky(?:\/|$)/,
  /^\/(?:vi\/)?khoi-phuc-dang-ky(?:\/|$)/,
  // Organizer dashboards (no /vi variant — /clb/* paths are
  // Vietnamese-first and the SPA toggles locale on the same URL).
  /^\/clb\/[^/]+\/quan-ly(?:\/|$)/,
  /^\/clb\/[^/]+\/(?:social|su-kien)\/moi(?:\/|$)/,
  // Per-event organizer + ephemeral surfaces
  /^\/(?:vi\/)?(?:social|su-kien)\/[^/]+\/(?:danh-sach|xep-cap|live)(?:\/|$)/,
  // Create flows
  /^\/(?:vi\/)?clubs\/new(?:\/|$)/,
  // Auth + account
  /^\/login(?:\/|$)/,
  /^\/vi\/login(?:\/|$)/,
  /^\/auth(?:\/|$)/,
  /^\/account(?:\/|$)/,
  /^\/vi\/account(?:\/|$)/,
  /^\/onboarding(?:\/|$)/,
  // Personal pages
  /^\/(?:vi\/)?notifications(?:\/|$)/,
  /^\/(?:vi\/)?thong-bao(?:\/|$)/,
  // Already-disallowed-by-robots-txt routes — defense-in-depth
  /^\/admin(?:\/|$)/,
  /^\/creator(?:\/|$)/,
  /^\/embed(?:\/|$)/,
  /^\/matches(?:\/|$)/,
  /^\/join(?:\/|$)/,
  // Internal tournament scoring + dashboard tools (auth-gated).
  //
  // PR74 Codex P2 follow-up — wrap every /tools/* private pattern with
  // an optional /vi/ prefix. src/App.tsx routes Vietnamese versions of
  // each one through the same component (e.g. /vi/tools/dashboard,
  // /vi/tools/team-match/new, /vi/tools/doubles-elimination/match/:id/
  // score). The earlier patterns only matched the raw EN paths, so a
  // Vietnamese viewer hitting any /vi/tools/* private route bypassed
  // the X-Robots-Tag header and the bot path served the generic
  // renderDefault shell instead of the noindex shell — leaving a gap
  // in the same privacy surface Phase 2A was meant to close.
  /^\/(?:vi\/)?tools\/dashboard(?:\/|$)/,
  /^\/(?:vi\/)?tools\/[^/]+\/new(?:\/|$)/,
  /^\/(?:vi\/)?tools\/[^/]+\/[^/]+\/setup(?:\/|$)/,
  /^\/(?:vi\/)?tools\/doubles-elimination\/match\/[^/]+\/score(?:\/|$)/,
  // Create + search flows migrated in PR 2 (TheLineLayout)
  /^\/(?:vi\/)?forum\/new(?:\/|$)/,
  /^\/(?:vi\/)?search(?:\/|$)/,
];

const X_ROBOTS_NOINDEX = "noindex, nofollow, noarchive";

function shouldNoindex(pathname: string): boolean {
  return NOINDEX_PATTERNS.some((re) => re.test(pathname));
}

// PR73 Phase 2B — per-path KV cache TTL override. Hub list pages
// (/social + /clubs) need a shorter window than the default 6h because a
// freshly-published event/club should appear in the bot view within
// minutes, not hours. Detail pages and blog posts keep the standard 6h
// because their content rarely changes after the initial publish.
const HUB_LIST_TTL_SECONDS = 300; // 5 minutes
const DEFAULT_TTL_SECONDS = 21600; // 6 hours

function pathCacheTtl(pathname: string): number {
  const stripped = pathname.replace(/^\/vi(?=\/|$)/, "") || "/";
  if (stripped === "/social" || stripped === "/clubs") {
    return HUB_LIST_TTL_SECONDS;
  }
  return DEFAULT_TTL_SECONDS;
}

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

  // ─── 1b. PR79 Phase 2F (audit I-8) — /u/* + /vi/u/* → /nguoi-choi/* 301.
  //       public/_redirects already has this rule but CF Pages middleware
  //       runs BEFORE _redirects is consulted, so bots hitting /u/<slug>
  //       were getting renderDefault's generic shell at status 200
  //       instead of the 301 humans see. Mirror the same rule here so
  //       both code paths converge on /nguoi-choi/* as the single
  //       canonical profile URL.
  const uMatch = url.pathname.match(/^\/(?:vi\/)?u\/([^/?#]+)$/);
  if (uMatch) {
    return Response.redirect(
      `https://${url.hostname}/nguoi-choi/${uMatch[1]}${url.search}`,
      301,
    );
  }

  // ─── 2. Static asset bypass (before bot detection) ───
  const pathname = url.pathname;
  const STATIC_PREFIXES = ["/og-images/", "/assets/", "/images/", "/fonts/", "/icons/", "/static/"];
  const STATIC_EXT_RE = /\.(jpg|jpeg|png|webp|gif|svg|ico|avif|css|js|mjs|woff2?|ttf|otf|eot|xml|txt|json|pdf|mp4|webm|mp3|wav|zip|map)$/i;
  const STATIC_EXACT = new Set(["/favicon.ico", "/robots.txt", "/manifest.json", "/_worker.js", "/_redirects", "/_headers"]);
  if (
    STATIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    STATIC_EXT_RE.test(pathname) ||
    STATIC_EXACT.has(pathname)
  ) {
    return next();
  }

  // ─── 3. Bot detection ─────────────────────────────────
  const ua = request.headers.get("user-agent") || "";
  const isBot = BOT_UA.test(ua);

  // ─── 3b. PR72 (SEO Phase 2A I-7): noindex header for private routes.
  //      Applies to BOTH bot and user paths. For users we still want
  //      the header so any HTTP-aware crawler (Twitterbot, FacebookExt,
  //      Slackbot, AhrefsBot tier-2) that doesn't trigger BOT_UA still
  //      sees the noindex signal. Header set BEFORE next() so we can
  //      mutate the response headers without re-buffering body.
  const isNoindex = shouldNoindex(pathname);
  if (!isBot) {
    if (isNoindex) {
      const response = await next();
      const headers = new Headers(response.headers);
      headers.set("X-Robots-Tag", X_ROBOTS_NOINDEX);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    // Normal user, public route → serve SPA
    return next();
  }

  // ─── 4. Bot path: KV cache + SSR render ───────────────
  const siteUrl = env.CANONICAL_HOST || "https://www.thepicklehub.net";

  // PR72 — Bot path noindex shortcut. Skip cache + skip routeAndRender;
  // return a minimal HTML shell with meta robots noindex + X-Robots-Tag
  // header. We don't cache the shell because magic_token URLs are
  // unique per user (would blow KV with single-use entries).
  if (isNoindex) {
    const lang = detectLang(pathname);
    const shell = renderNoindexShell(siteUrl, pathname, lang);
    const headers = new Headers(shell.headers);
    headers.set("X-Robots-Tag", X_ROBOTS_NOINDEX);
    headers.set("X-Prerender-Cache", "BYPASS");
    return new Response(shell.body, {
      status: shell.status,
      headers,
    });
  }
  // Cache key version bumped pr:v3 → pr:v4 on 2026-05-11 (second bump
  // same day) to invalidate cached responses with the broken nested
  // SportsEvent superEvent that produced two Rich Results errors —
  // missing startDate, missing location. New schema uses SportsSeries
  // for the parent (no required dates/location). Same TTL-skip
  // rationale as the previous v2→v3 bump.
  const cacheKey = `pr:v4:${url.pathname}`;
  const noCache = url.searchParams.get("nocache") === "1";

  if (!noCache && env.PRERENDER_CACHE) {
    try {
      const cached = await env.PRERENDER_CACHE.get(cacheKey);
      if (cached) {
        return new Response(cached, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
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
      // 6h TTL (was 1h). Bumped 2026-05-02 after Ahrefs Site Audit
      // flagged 10 URLs at >1s loading — most were cold-cache hits where
      // a fresh prerender (Cloudflare cold start + Tokyo Supabase round
      // trip) totals ~1s. Crawlers don't need fresh-fresh data; humans
      // get the SPA in real time. 6h cache keeps bot view warm across
      // typical crawler revisit cycles without serving stale data to
      // users.
      //
      // PR73 Phase 2B — pathCacheTtl returns 5 minutes for /social +
      // /clubs (hub list pages) so newly-published events/clubs reach
      // the bot view within minutes, not hours.
      const ttl = pathCacheTtl(url.pathname);
      context.waitUntil(
        env.PRERENDER_CACHE.put(cacheKey, html, { expirationTtl: ttl }),
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

  // Match permalink (Sprint 2 Phase 3B.3)
  match = path.match(/^\/tran-dau\/([^/]+)$/);
  if (match && match[1] !== "moi") return await renderMatch(supabase, match[1], siteUrl);

  // PR73 Phase 2B (audit I-1 + I-2) — hub list pages. Previously fell
  // through to renderDefault → generic shell with no upcoming-event
  // schema. Now they render top-20 entries server-side + ItemList
  // JSON-LD + hreflang. KV TTL set to 5 minutes by pathCacheTtl above
  // so a freshly-published event/club is discoverable within minutes.
  if (path === "/social") return await renderSocialList(supabase, siteUrl, lang);
  if (path === "/clubs") return await renderClubList(supabase, siteUrl, lang);

  // Social event detail (Social Events MVP Sprint 1 PR2). Public landing
  // with SportsEvent JSON-LD + Offer (availability). Bots see the
  // pre-rendered shell; SPA path handles real users.
  //
  // PR69 — primary canonical is /social/{slug}; legacy /su-kien/{slug}
  // still matches so external links pointing at the old path keep
  // returning prerendered HTML (Cloudflare _redirects 301s humans, but
  // the prerender path needs to handle the URL inline because some
  // crawlers don't follow redirects to canonical content).
  match = path.match(/^\/(?:social|su-kien)\/([^/]+)$/);
  if (match) return await renderSocialEvent(supabase, match[1], siteUrl);

  // Club landing (Social Events MVP Sprint 1 PR2). Public ItemList of
  // upcoming events.
  match = path.match(/^\/clb\/([^/]+)$/);
  if (match) return await renderClub(supabase, match[1], siteUrl);

  // Player profile (Sprint 4 Phase 4D — Bet #1 social SEO).
  // Single-canonical URL: /nguoi-choi/{username} serves both languages.
  // The path itself is Vietnamese-friendly so there's no /vi/nguoi-choi/*
  // mirror; hreflang en+vi both point at the same canonical.
  match = path.match(/^\/nguoi-choi\/([^/]+)$/);
  if (match) return await renderProfile(supabase, match[1], siteUrl);

  // Feed (Sprint 4 Phase 4D). /feed (en) + /vi/feed (vi) — Phase 4A
  // shipped both routes in src/App.tsx. Canonical drops ?tab=* in the
  // render function so /feed and /feed?tab=trending dedupe.
  if (path === "/feed") return await renderFeed(supabase, siteUrl, lang);

  // Notifications page (Sprint 5 PR-C). User-private surface — bots
  // get a noindex shell so they don't waste crawl budget. Real users
  // bypass this branch (middleware only routes here for bot UAs); the
  // React route in src/App.tsx (/notifications, /vi/notifications,
  // /thong-bao, /vi/thong-bao) renders the actual page for signed-in
  // viewers; anonymous viewers get redirected to /login by the page.
  if (path === "/notifications" || path === "/thong-bao") {
    return renderNotificationsShell(siteUrl, rawPath, lang);
  }

  // Tournaments list
  if (path === "/tournaments") return await renderTournaments(supabase, siteUrl, rawPath, lang);

  // Videos list
  if (path === "/videos") return await renderVideos(supabase, siteUrl, rawPath, lang);

  // News
  if (path === "/news") return await renderNews(supabase, siteUrl, rawPath, lang);

  // Forum
  if (path === "/forum") return await renderForum(supabase, siteUrl, rawPath, lang);

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

  // Tool list pages (must come before catch-all)
  if (path === "/tools/quick-tables") return renderToolPage("quick-tables", siteUrl, rawPath, lang);
  if (path === "/tools/team-match") return renderToolPage("team-match", siteUrl, rawPath, lang);
  if (path === "/tools/doubles-elimination") return renderToolPage("doubles-elimination", siteUrl, rawPath, lang);
  if (path === "/tools/flex-tournament") return renderToolPage("flex-tournament", siteUrl, rawPath, lang);

  // Tools hub
  if (path.startsWith("/tools")) return renderTools(siteUrl, rawPath, lang);

  // Blog post
  match = path.match(/^\/blog\/([^/]+)$/);
  if (match) return await renderBlogPost(supabase, match[1], siteUrl);

  // Blog index
  if (path === "/blog") return renderBlog(siteUrl);

  // Livestream listing
  if (path === "/livestream") return renderLivestreamList(siteUrl, rawPath, lang);

  // Privacy / Terms
  if (path === "/privacy") return renderPrivacy(siteUrl, rawPath, lang);
  if (path === "/terms") return renderTerms(siteUrl, rawPath, lang);

  // 404 fallback — unmatched routes get a proper 404 + noindex, not a
  // generic 200 shell that would waste crawl budget and create soft-404s.
  return render404(rawPath, siteUrl);
}
