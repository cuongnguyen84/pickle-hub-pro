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
  renderVideos, renderNews, renderNewsPost, renderViNewsPost, renderForum, renderForumPost, renderForumCategory,
  renderMatch,
  renderProfile,
  renderFeed,
  renderSocialEvent,
  renderClub,
  renderSocialList,
  renderClubList,
  renderVenuesList, renderVenueDetail, renderVenuesCity,
  renderOrgDetail,
  renderQuickTable, renderTeamMatch, renderDoublesElimination, renderFlexTournament,
  renderTools, renderToolPage, renderToolNewPage,
  renderBlogPost, renderBlog,
  renderViBlogPost, renderViBlogIndex,
  renderLivestreamList, renderRankings, renderPrivacy, renderTerms,
  renderNotificationsShell,
  renderNoindexShell,
  render404,
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
  /^\/(?:vi\/)?san\/them(?:\/|$)/,
  /^\/(?:vi\/)?tim-ban-choi(?:\/|$)/,
  /^\/(?:vi\/)?tin-nhan(?:\/|$)/,
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
  //
  // W1.1 (2026-05-15) — REMOVED `/^\/(?:vi\/)?tools\/[^/]+\/new(?:\/|$)/`
  // because /tools/doubles-elimination/new, /tools/flex-tournament/new,
  // and /tools/team-match/new are public landing pages with high SEO
  // value (CTAs to sign up + create tournament). They were getting
  // X-Robots-Tag noindex + the renderNoindexShell bot view, which
  // wasted their organic traffic potential. They now route to
  // renderToolNewPage with page-specific metadata. The auth gate
  // is enforced inside the React page (redirect to /login when no
  // user) — that's a UX gate, not a search-indexability concern.
  /^\/(?:vi\/)?tools\/dashboard(?:\/|$)/,
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

// SEO audit 2026-05-28 (batch 2) — bot path constructs each Response
// in code, which bypasses public/_headers entirely. Without this helper
// Googlebot/SEOnaut/etc. were getting prerendered HTML with no
// security headers attached (SEOnaut crawl reported 462 'Missing CSP',
// 464 'Missing HSTS', 462 'Missing X-Content-Type-Options' across all
// SSR'd routes). The values mirror public/_headers exactly so the
// bot view and the user view advertise the same policy.
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; " +
    // AdSense domains (pagead2/tpc googlesyndication, doubleclick, adtrafficquality)
    // added 2026-06-10: the AdSense loader was being blocked by CSP — ads never
    // loaded in production and every page logged a console CSP violation.
    // Funding Choices CMP host (fundingchoicesmessages.google.com) added
    // 2026-07-03: the AdSense consent/messaging loader was still CSP-blocked
    // (34 csp_violation reports / 7d in client_errors). Google requires it in
    // script-src + frame-src. Kept in sync with public/_headers.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com https://*.supabase.co https://www.gstatic.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://ep2.adtrafficquality.google https://fundingchoicesmessages.google.com https://analytics.ahrefs.com https://challenges.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' data: https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https:; " +
    "media-src 'self' data: blob: https:; " +
    "connect-src 'self' https: wss:; " +
    // instagram.com added 2026-07-04: /feed renders IG reels via the official
    // /embed/ iframe endpoint (FeedEmbedCard).
    // dashboard.dupr.com + uat.dupr.gg added 2026-07-22: they were in
    // public/_headers all along but missing here despite the "kept in sync"
    // claim — bot-path CSP drift found during the QA-04 DUPR SSO
    // investigation (PR #432). Parity is now locked by
    // src/__tests__/csp-parity.test.ts.
    // challenges.cloudflare.com added 2026-07-26: Turnstile CAPTCHA on the
    // social-event registration modal (phone-otp-send gate) was CSP-blocked so
    // api.js never ran, window.turnstile stayed undefined, and the 20s watchdog
    // showed "verification is taking too long". Allowed in the script + frame +
    // child directives (run the loader, render the challenge iframe).
    "frame-src 'self' https://stream.mux.com https://www.youtube.com https://www.youtube-nocookie.com https://dashboard.dupr.com https://uat.dupr.gg https://www.openstreetmap.org https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://ep2.adtrafficquality.google https://fundingchoicesmessages.google.com https://www.instagram.com https://challenges.cloudflare.com; " +
    "worker-src 'self' blob:; " +
    "child-src 'self' blob: https://stream.mux.com https://www.youtube.com https://dashboard.dupr.com https://uat.dupr.gg https://www.openstreetmap.org https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.instagram.com https://challenges.cloudflare.com; " +
    "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'",
};

function applySecurityHeaders(headers: Headers): void {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }
}

// SEO audit 2026-05-28 (batch 6) — Response.redirect() ships a fresh
// Response with only a `location` header. Crawlers that crawl the
// redirect itself (SEOnaut does — it reports "Missing HSTS",
// "Incorrect media type", and "Slow Time to First Byte" on the 301
// hop, not on the destination) consequently flagged every middleware
// redirect added by batch 4/5. Build the redirect manually so we can
// attach HSTS + the rest of SECURITY_HEADERS.
function secureRedirect(location: string, status: 301 | 302 = 301): Response {
  const headers = new Headers({ Location: location });
  applySecurityHeaders(headers);
  return new Response(null, { status, headers });
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
  if (stripped === "/social" || stripped === "/clubs" || stripped === "/san") {
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
    return secureRedirect(`https://www.thepicklehub.net${url.pathname}${url.search}`, 301);
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
    return secureRedirect(`https://${url.hostname}/nguoi-choi/${uMatch[1]}${url.search}`, 301);
  }

  // ─── 1d. SEO audit batch 5 — collapse /vi/org/* + /vi/tournament/*
  //       to the EN canonical. renderOrgDetail() and
  //       renderTournamentDetail() always emit url:/org/<slug> and
  //       url:/tournament/<slug> as the canonical regardless of the
  //       requesting path, so /vi/org/<slug> was always advertising
  //       the EN URL as canonical while its own hreflang pointed back
  //       at /vi/org/<slug>. SEOnaut flagged this as 'Hreflang to non
  //       canonical' (6 org + 2 tournament URLs) and 'Mismatching
  //       language' (the served HTML carries the EN copy, not a
  //       Vietnamese rendering). Until those handlers grow a real
  //       VI rendering path the safer signal is a permanent redirect
  //       to the EN canonical — readers stay on one URL per entity
  //       and SEOnaut sees one indexable surface per organization.
  const viOrgMatch = url.pathname.match(/^\/vi\/(org|tournament|watch)\/([^/?#]+)$/);
  if (viOrgMatch) {
    return secureRedirect(`https://${url.hostname}/${viOrgMatch[1]}/${viOrgMatch[2]}${url.search}`, 301);
  }

  // ─── 1c. SEO audit batch 4 — /livestream → /live (plus /vi mirror)
  //       /livestream is a legacy alias kept for backlink equity; the
  //       canonical live-listing path is /live. public/_redirects has
  //       the 301 rule but it only fires for non-bot traffic because
  //       the middleware short-circuits to SSR before CF consults
  //       _redirects. Without this branch, bots got the SSR shell at
  //       200 with the same title + meta description as /live and the
  //       crawler flagged 'Duplicated title' / 'Duplicated meta
  //       description' / 'Pages missing the hreflang' on both /livestream
  //       and /vi/livestream. Same fix shape as the /u/* rule above.
  const livestreamMatch = url.pathname.match(/^\/(vi\/)?livestream(\/.*)?$/);
  if (livestreamMatch) {
    const viPrefix = livestreamMatch[1] || "";
    const tail = livestreamMatch[2] || "";
    return secureRedirect(`https://${url.hostname}/${viPrefix}live${tail}${url.search}`, 301);
  }

  // ─── 1e. SEO audit batch 8 — /vi/blog/{slug} → /blog/{en-slug} 301.
  //       public/_redirects has 13 of these mappings already, but the
  //       middleware bot path bypasses _redirects so SEOnaut keeps
  //       hitting the VI URLs and reporting 404. Same fix pattern as
  //       the /livestream / /u/* / /vi/org redirects: mirror the
  //       mapping in the middleware so bot + user paths agree.
  //
  //       Every slug here was surfaced by SEOnaut crawl 7 as a 404.
  //       When a VI translation is eventually written it can be
  //       removed from this map (the actual page at /vi/blog/{slug}
  //       will take precedence).
  const VI_BLOG_REDIRECTS: Record<string, string> = {
    // Already in public/_redirects — mirrored here for bots.
    "luat-pickleball": "pickleball-rules-complete-guide",
    "luat-pickleball-2026": "pickleball-rules-complete-guide",
    "luat-cham-diem-pickleball": "pickleball-scoring-rules-guide",
    "tao-bracket-pickleball-mien-phi": "free-pickleball-bracket-generator",
    "tao-vong-tron-pickleball": "pickleball-round-robin-generator-guide",
    "phan-mem-to-chuc-giai-pickleball-tot-nhat": "best-pickleball-tournament-software-2026",
    "chien-thuat-pickleball-doi": "pickleball-doubles-strategy-guide",
    "truc-tiep-pickleball": "pickleball-live-streaming-guide",
    "cach-xem-ppa-tour-truc-tiep": "how-to-watch-ppa-tour-live-2026",
    "ppa-tour-asia-2026": "ppa-tour-asia-2026-complete-guide",
    // New batch 8 — VI slugs SEOnaut crawl 7 still flagged as 404.
    "cac-giai-pickleball-pro-asia-2026": "professional-pickleball-tours-guide-2026",
    "the-thuc-mlp-giai-thich": "mlp-format-explained",
    "huong-dan-day-du-ppa-tour-asia-2026": "ppa-tour-asia-2026-complete-guide",
    // Guard-0 parity fix: these two were in public/_redirects but NOT here, so
    // bots (which bypass _redirects) hit /vi/blog/<slug> with no redirect and
    // 404'd. Mirrored to close the drift the redirect-parity test now enforces.
    "the-thuc-mlp": "mlp-format-explained",
    "ppa-tour-asia-2026-complete-guide": "ppa-tour-asia-2026-complete-guide",
  };
  // ─── 1e2. Transactional EN blog slugs deduped INTO the /tools money page.
  //       These posts were pure "bracket generator" transactional intent
  //       that cannibalized /tools in SERPs (GSC 28d: /tools hub + the blog
  //       post both ranking for "pickleball bracket generator", splitting
  //       clicks). 301 the EN blog URL — and its VI alias — straight to
  //       /tools. A slug listed here MUST also be removed from metadata.ts /
  //       sitemap / rss / indexnow / related-posts so it isn't both a 301
  //       and a 200 in the sitemap (SEOnaut 'redirect in sitemap').
  const BLOG_TO_TOOLS = new Set<string>(["free-pickleball-bracket-generator"]);

  // ─── 1e3. Blog posts merged INTO another post (same intent, thin page).
  //       Sprint 1 step 2 of docs/seo-tools-cluster-intent-map.md. Same
  //       audit-safety rule as 1e2: a slug here MUST be gone from
  //       metadata.ts / sitemap / rss / indexnow / related-posts. EN maps
  //       EN→EN, VI maps VI→VI so Vietnamese readers keep a VI page.
  //       The 2025→2026 software rename was in _redirects only, so bots kept
  //       404ing on the old URL (GSC still shows impressions for it) — the
  //       parity test now covers the EN side too and caught it.
  const BLOG_MERGED: Record<string, string> = {
    "pickleball-bracket-templates": "how-to-create-pickleball-bracket",
    "best-pickleball-tournament-software-2025": "best-pickleball-tournament-software-2026",
  };
  //       VI_BLOG_DIRECT maps a VI slug straight to the absolute VI path it
  //       was folded into — a VI twin (merged post) or /vi/tools (transactional
  //       dupe of the money page, the VI half of the step-1 dedupe).
  const VI_BLOG_DIRECT: Record<string, string> = {
    "mau-bracket-pickleball": "/vi/blog/cach-tao-bracket-pickleball",
    "cong-cu-tao-bracket-pickleball-mien-phi-2026": "/vi/tools",
  };

  const viBlogMatch = url.pathname.match(/^\/vi\/blog\/([^/?#]+)$/);
  if (viBlogMatch && VI_BLOG_DIRECT[viBlogMatch[1]]) {
    return secureRedirect(
      `https://${url.hostname}${VI_BLOG_DIRECT[viBlogMatch[1]]}`,
      301,
    );
  }
  if (viBlogMatch && VI_BLOG_REDIRECTS[viBlogMatch[1]]) {
    // Resolve to the EN slug, then to /tools in ONE hop if it's a tools
    // dedupe target — avoids a /vi/blog → /blog → /tools 301 chain.
    const enSlug = VI_BLOG_REDIRECTS[viBlogMatch[1]];
    const dest = BLOG_TO_TOOLS.has(enSlug) ? "tools" : `blog/${enSlug}`;
    return secureRedirect(`https://${url.hostname}/${dest}`, 301);
  }

  const enBlogToTools = url.pathname.match(/^\/blog\/([^/?#]+)$/);
  if (enBlogToTools && BLOG_TO_TOOLS.has(enBlogToTools[1])) {
    return secureRedirect(`https://${url.hostname}/tools`, 301);
  }
  if (enBlogToTools && BLOG_MERGED[enBlogToTools[1]]) {
    return secureRedirect(
      `https://${url.hostname}/blog/${BLOG_MERGED[enBlogToTools[1]]}`,
      301,
    );
  }

  // ─── 1f. (batch 9 follow-up) /feed?tab=* redirect REMOVED.
  //       Batch 8 redirected /feed?tab=trending → /feed to silence
  //       SEOnaut's 'Non-canonical in sitemap' (2 URLs). After the
  //       Ahrefs auto-crawl revealed the redirect was breaking SPA
  //       deep-linking for tab state (useFeedTab.ts uses
  //       useSearchParams to read ?tab= on cold load), we removed
  //       it. The canonical that renderFeed() emits is /feed without
  //       the query, which is enough for Google — the SEOnaut
  //       warning was a false positive on a feature that's expected
  //       to deep-link.

  // ─── 1g. SEO audit batch 8 — /vi/ trailing slash collapses to /vi.
  //       renderHomeVi() emits canonical=/vi (no trailing slash) and
  //       sitemap-static lists /vi (no slash); SEOnaut found /vi/
  //       linked from somewhere and flagged it as non-canonical and
  //       missing self-reference. Trailing-slash normalize so both
  //       resolve to one indexable surface.
  if (url.pathname === "/vi/") {
    return secureRedirect(`https://${url.hostname}/vi${url.search}`, 301);
  }

  // ─── 2. Static asset bypass (before bot detection) ───
  const pathname = url.pathname;
  const STATIC_PREFIXES = ["/og-images/", "/assets/", "/images/", "/fonts/", "/icons/", "/static/"];
  const STATIC_EXT_RE = /\.(jpg|jpeg|png|webp|gif|svg|ico|avif|css|js|mjs|woff2?|ttf|otf|eot|xml|txt|json|pdf|xlsx|xls|csv|docx|doc|pptx|ppt|mp4|webm|mp3|wav|zip|map)$/i;
  const STATIC_EXACT = new Set(["/favicon.ico", "/robots.txt", "/manifest.json", "/_worker.js", "/_redirects", "/_headers"]);
  if (
    STATIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    STATIC_EXT_RE.test(pathname) ||
    STATIC_EXACT.has(pathname)
  ) {
    const assetResponse = await next();
    // A hashed asset that no longer exists — a stale index.html (cached up to
    // 5 min) still pointing at a chunk the latest deploy replaced, a scanner,
    // or a half-propagated edge — otherwise falls through to the SPA rule
    // (`/* /index.html 200`) and is served AS index.html: status 200,
    // content-type text/html, AND the `/assets/*` `immutable, max-age=1yr`
    // header. A CDN edge then PINS that broken "HTML-as-JS" response for a
    // year, turning a momentary miss into a persistent outage — the root cause
    // of the 2026-07-11 "Loading…" incident. Real assets are js/css/img/font
    // (never text/html), so a text/html body here means the asset is missing:
    // return a real, uncacheable 404 instead. The browser's dynamic import
    // then rejects cleanly and ChunkErrorBoundary reloads to the fresh shell.
    // (Function response headers win over _headers here — verified: the bot
    // prerender path's no-store survives the `/` max-age rule.)
    if (
      assetResponse.status === 200 &&
      (assetResponse.headers.get("content-type") || "").includes("text/html")
    ) {
      return new Response("Not Found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
    return assetResponse;
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
    applySecurityHeaders(headers);
    return new Response(shell.body, {
      status: shell.status,
      headers,
    });
  }
  // Prerender cache-key version. Full bump-by-bump changelog moved to
  // docs/prerender-cache-log.md (SEO-04) — append there on every bump.
  // Current: v29 (2026-07-17 — SEO-02: BLOG_POST_META generated from
  // metadata.ts; 28 EN blog <title>s switch to metaTitleEn).
  const cacheKey = `pr:v30:${url.pathname}`;
  const noCache = url.searchParams.get("nocache") === "1";

  if (!noCache && env.PRERENDER_CACHE) {
    try {
      const cached = await env.PRERENDER_CACHE.get(cacheKey);
      if (cached) {
        const cacheHeaders = new Headers({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Prerender-Cache": "HIT",
          Vary: "User-Agent",
        });
        applySecurityHeaders(cacheHeaders);
        return new Response(cached, { headers: cacheHeaders });
      }
    } catch {
      // KV read failed, continue to render
    }
  }

  try {
    // Time-box the prerender. On a cache MISS this awaits a chain of Supabase
    // queries (Tokyo region); if Supabase is slow/hung the bot would otherwise
    // wait until Cloudflare's ~30s wall-clock kill and get a 5xx, burning crawl
    // budget. Race against an 8s budget and fall through to next() (SPA shell)
    // — a served shell is far better for the crawler than a hung 5xx.
    const RENDER_BUDGET_MS = 8000;
    const response = await Promise.race([
      routeAndRender(url.pathname, env, siteUrl),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("prerender-timeout")), RENDER_BUDGET_MS),
      ),
    ]);

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
    applySecurityHeaders(headers);

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (err) {
    console.error("Prerender error:", err);
    // Guard-0: on a render error/timeout the bot falls through to next() — the
    // empty SPA shell. That path was SILENT (console.error only), so a
    // render-budget blowout could de-index pages for weeks unnoticed. Record it
    // into client_errors so the existing errors-telegram-alert cron (10-min,
    // spike ≥3 of the same fingerprint) surfaces it. Fire-and-forget via
    // waitUntil — telemetry must NEVER block or break the bot fallback.
    try {
      const supabase = createSupabaseClient(env);
      context.waitUntil(
        supabase
          .from("client_errors")
          // type MUST be one of the CHECK-whitelisted values
          // ('js_error','unhandled_rejection','csp_violation') — a prerender
          // timeout is literally a caught Promise.race rejection, so
          // 'unhandled_rejection' fits and needs no migration (keeps this GREEN).
          .insert({
            type: "unhandled_rejection",
            // "prerender:" prefix so the Telegram alert is unambiguous and all
            // timeouts share one fingerprint (message "prerender: prerender-
            // timeout") to trip the spike threshold together.
            message: `prerender: ${err instanceof Error ? err.message : String(err)}`,
            stack: err instanceof Error ? err.stack ?? null : null,
            url: url.pathname,
            user_agent: request.headers.get("user-agent"),
          })
          .then(
            () => {},
            () => {},
          ),
      );
    } catch {
      // never let telemetry break the fallback
    }
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
    // VI news article — Phase 4 hot-fix 2026-05-19. `path` already had the
    // /vi prefix stripped by stripLangPrefix above, so /vi/news/foo arrives
    // as /news/foo with lang="vi".
    match = path.match(/^\/news\/([^/]+)$/);
    if (match) return await renderViNewsPost(supabase, match[1], siteUrl);
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

  if (path === "/san") return await renderVenuesList(supabase, siteUrl, lang);
  match = path.match(/^\/san\/khu-vuc\/([^/]+)$/);
  if (match) return await renderVenuesCity(supabase, match[1], siteUrl, lang);
  match = path.match(/^\/san\/([^/]+)$/);
  if (match && match[1] !== "them") return await renderVenueDetail(supabase, match[1], siteUrl, lang);

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
  if (match) return await renderSocialEvent(supabase, match[1], siteUrl, lang);

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

  // News article — Phase 4 hot-fix 2026-05-19. Mirrors /blog/:slug pattern.
  // VI variant is handled inside the lang === "vi" branch above; this is
  // the default (EN) match.
  match = path.match(/^\/news\/([^/]+)$/);
  if (match) return await renderNewsPost(supabase, match[1], siteUrl);

  // Forum
  if (path === "/forum") return await renderForum(supabase, siteUrl, rawPath, lang);

  // Forum post
  match = path.match(/^\/forum\/post\/([^/]+)$/);
  if (match) return await renderForumPost(supabase, match[1], siteUrl);

  // SEO-1.3 (2026-05-28) — forum category hub. Previously fell through
  // to render404 even though the SPA route exists. Pattern excludes
  // /forum/post/* (matched above) and /forum/new (caught by NOINDEX_PATTERNS).
  match = path.match(/^\/(?:vi\/)?forum\/([^/]+)$/);
  if (match && match[1] !== "post" && match[1] !== "new") {
    return await renderForumCategory(supabase, match[1], siteUrl, lang);
  }

  // Organization
  match = path.match(/^\/org\/([^/]+)$/);
  if (match) return await renderOrgDetail(supabase, match[1], siteUrl);

  // W1.1 (2026-05-15) — Setup pages /tools/{tool}/new are public
  // landing pages with create-flow CTAs. They MUST be matched here
  // BEFORE the tool-instance pattern below because that pattern's
  // [^/]+ shareId capture would otherwise treat "new" as a tournament
  // shareId and try to fetch a row that doesn't exist. Quick Tables
  // has no /new variant — its list page IS the create flow.
  if (path === "/tools/doubles-elimination/new") return renderToolNewPage("doubles-elimination", siteUrl, rawPath, lang);
  if (path === "/tools/flex-tournament/new") return renderToolNewPage("flex-tournament", siteUrl, rawPath, lang);
  if (path === "/tools/team-match/new") return renderToolNewPage("team-match", siteUrl, rawPath, lang);

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
  if (path === "/livestream") return await renderLivestreamList(supabase, siteUrl, rawPath, lang);
  // PR (2026-05-18 Ahrefs Site Audit fix) — /live (+ /vi/live) is the
  // livestream landing page, distinct from /live/:id (single stream
  // handled at line ~312). React Route at App.tsx line 482. Without
  // this handler, bots got 404 and Ahrefs flagged it as a broken
  // internal link from homepage `/` + 8 other source pages.
  // NOTE: `path` has already had its /vi prefix stripped (stripLangPrefix), so it
  // can never equal "/vi/live"; the "/live" branch (with lang==="vi") already
  // serves the Vietnamese route. Redundant /vi/* clause removed 2026-06-10.
  if (path === "/live") return await renderLivestreamList(supabase, siteUrl, rawPath, lang);
  // /rankings DUPR table — React Route at App.tsx line 572 with /vi alias.
  // Sprint A10 (2026-05-27) — renderRankings is now async and reads
  // dupr_leaderboard_vietnam RPC for bot-crawlable Vietnam top-25 +
  // ItemList JSON-LD. Static global/continental scopes remain in the
  // SPA only (low SEO priority).
  if (path === "/rankings") return await renderRankings(supabase, siteUrl, rawPath, lang);

  // Privacy / Terms
  if (path === "/privacy") return renderPrivacy(siteUrl, rawPath, lang);
  if (path === "/terms") return renderTerms(siteUrl, rawPath, lang);

  // 404 fallback — unmatched routes get a proper 404 + noindex, not a
  // generic 200 shell that would waste crawl budget and create soft-404s.
  return render404(rawPath, siteUrl);
}
