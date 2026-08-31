/**
 * Cloudflare Pages Functions Middleware
 *
 * Handles:
 * 1. Apex → www redirect (thepicklehub.net → www.thepicklehub.net)
 * 2. Bot detection → SSR prerendered HTML with SEO metadata + KV cache
 * 3. Normal users → pass through to SPA (Vite build output)
 */

import { BOT_UA, detectLang, stripLangPrefix } from "./_lib/utils";
import { isKnownSpaPath } from "./_lib/spa-routes";
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
  renderShopCatalog, renderShopCategory, renderShopProduct, renderShopStore,
  renderOrgDetail,
  renderQuickTable, renderTeamMatch, renderDoublesElimination, renderFlexTournament,
  renderTools, renderToolPage, renderToolNewPage,
  renderBlogPost, renderBlog,
  renderViBlogPost, renderViBlogIndex,
  renderLivestreamList, renderRankings, renderPpaRankings, renderPrivacy, renderTerms, renderAdvertise,
  renderAbout, renderContact,
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
  // DUPR account linking. Auth-gated app action, never an indexable content
  // page — same category as /account and /onboarding above.
  //
  // 2026-08-23 (#650) this path was given a 301 to the VI DUPR explainer in
  // section 1b, labelled "Retired /dupr landing", to clear a GSC "Not found
  // (404)" from 2026-07-30. It was not retired: App.tsx still mounts
  // <RequireAuth><DuprConnect /></RequireAuth> on it, eight product surfaces
  // link to it, and two blog posts tell readers to type thepicklehub.net/dupr
  // by hand when the header button does not appear. Section 1b runs BEFORE the
  // `if (!isBot)` branch, so the 301 hit humans too and that typed-URL
  // fallback landed on an article instead of the connect screen.
  //
  // REVIEW: noindex rather than GONE_EXACT (where the closest neighbours,
  // /match/new and /match/confirm, live). GONE_EXACT returns 410, which
  // asserts the resource is permanently gone — false here, it renders for
  // every authenticated user — and the SSR'd blog CTA (ctaPath: "/dupr" in
  // dupr-thepicklehub-user-guide) would then be an internal link to a 410.
  // A crawlable 200 + noindex clears the GSC report just as definitively.
  // Deliberately NOT added to robots.txt: Disallow would stop Google
  // recrawling the URL, so it would never see the noindex it must honour.
  /^\/dupr(?:\/|$)/,
  // Personal pages
  /^\/(?:vi\/)?notifications(?:\/|$)/,
  /^\/(?:vi\/)?thong-bao(?:\/|$)/,
  // Already-disallowed-by-robots-txt routes — defense-in-depth
  /^\/admin(?:\/|$)/,
  /^\/creator(?:\/|$)/,
  // Design prototypes (/proto/shop/*). Never production, never indexable.
  /^\/proto(?:\/|$)/,
  // Seller Center — application data, phone numbers, addresses.
  /^\/(?:vi\/)?seller(?:\/|$)/,
  /^\/(?:vi\/)?shop\/sell(?:\/|$)/,
  // P3 buyer surfaces. NOT in SHOP_PUBLIC_PATTERNS — these stay noindex after
  // the Q4 launch gate opens, because they hold a recipient's name, phone
  // number and home address, which the catalogue pages do not.
  /^\/(?:vi\/)?shop\/cart(?:\/|$)/,
  /^\/(?:vi\/)?shop\/checkout(?:\/|$)/,
  /^\/(?:vi\/)?shop\/order(?:\/|$)/,
  // …and the LIST. `/shop/order(/|$)` does not match `/shop/orders`: the
  // character after "order" is an "s", not a slash or the end of the string.
  // One letter, one uncovered page of somebody's purchase history.
  /^\/(?:vi\/)?shop\/orders(?:\/|$)/,
  // Catalogue SEARCH — permanently noindex, and NOT part of the Q4 launch
  // set below. One result page per query string is thin duplicate content
  // wearing the catalogue's own products; the canonical home for every one
  // of those products is /shop/product/:slug, which now renders for bots.
  // It sat in SHOP_PUBLIC_PATTERNS until the Phase 4 launch, where "open the
  // catalogue" would have silently opened the query-string surface too.
  /^\/(?:vi\/)?shop\/search(?:\/|$)/,
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

// ─── Q4 (2026-08-12): the closed-pilot Shop is NOT indexed ──────────────────
// The buyer catalogue runs for QA and for the pilot sellers, but a marketplace
// with a handful of products invites a thin-content assessment, and the
// Product Owner has not opened a launch gate.
//
// The switch is here, at the edge, and not a <meta> written after hydration:
// a crawler that never executes the bundle would index the page anyway, which
// is the exact failure this is meant to prevent. Flipping SHOP_PUBLIC_INDEXING
// to "1" in the Pages environment is the whole launch action — no redeploy of
// the SPA, no code change, and Seller/Admin stay noindex either way because
// they are matched by their own patterns above.
const SHOP_PUBLIC_PATTERNS: RegExp[] = [
  /^\/(?:vi\/)?shop$/,
  /^\/(?:vi\/)?shop\/category(?:\/|$)/,
  /^\/(?:vi\/)?shop\/product(?:\/|$)/,
  /^\/(?:vi\/)?shop\/store(?:\/|$)/,
];

/**
 * 🔴 Đi CẶP với `SHOP_PUBLIC_OPEN` trong src/lib/shop/shopGate.ts.
 *
 * Cờ này quyết định BOT thấy gì; cờ kia quyết định NGƯỜI thấy gì. Bật cờ này
 * trong khi cờ kia còn `false` nghĩa là Googlebot đọc được trang sản phẩm thật
 * còn người dùng thấy "Chợ đang hoàn thiện" — đó là cloaking, và Google phạt
 * đúng chuyện đó. Mở thì mở cả hai, đóng thì đóng cả hai.
 */
export const shopIndexingEnabled = (env: { SHOP_PUBLIC_INDEXING?: string }) =>
  env.SHOP_PUBLIC_INDEXING === "1";

export const isPilotNoindexShopPath = (pathname: string) =>
  SHOP_PUBLIC_PATTERNS.some((re) => re.test(pathname));

// Cloudflare Pages Functions under functions/api/ must reach `next()` before
// the SPA soft-404 guard runs. They are HTTP endpoints, not client-side routes.
export const isPagesApiPath = (pathname: string) =>
  pathname === "/api" || pathname.startsWith("/api/");

export const isWellKnownPath = (pathname: string) =>
  pathname === "/.well-known" || pathname.startsWith("/.well-known/");

// ─── Static asset passthrough ──────────────────────────────────────────────
// Anything that exists as a real file in public/ (or is emitted into the build
// output) must reach `next()` untouched. A path that misses every rule below
// falls all the way through to the SPA soft-404 guard and is served as an HTML
// 404 — with a 200-looking file sitting in the deploy the whole time.
//
// That is not hypothetical: `/manifest.webmanifest` 404'd in production because
// STATIC_EXACT still listed the pre-vite-plugin-pwa filename `/manifest.json`,
// and `webmanifest` was missing from the extension list. Chrome could not read
// the PWA manifest, so "Add to Home Screen" / install was unavailable sitewide
// — silent, because nothing on the page fails visibly when a manifest 404s.
//
// Note the manifest is NOT in public/ — vite-plugin-pwa emits it into the build
// output, which is exactly why it was easy to miss. So the drift guard in
// `functions/__tests__/static-asset-passthrough.test.ts` covers both: it walks
// public/ AND asserts the build-emitted filenames by name. Add a file type to
// either and the test tells you here, not production months later.
const STATIC_PREFIXES = [
  "/og-images/",
  "/assets/",
  "/images/",
  "/fonts/",
  "/icons/",
  "/static/",
];

const STATIC_EXT_RE =
  /\.(jpg|jpeg|png|webp|gif|svg|ico|avif|css|js|mjs|woff2?|ttf|otf|eot|xml|txt|md|json|webmanifest|pdf|xlsx|xls|csv|docx|doc|pptx|ppt|mp4|webm|mp3|wav|zip|map)$/i;

// `/manifest.json` is the pre-rename filename. `public/_routes.json` excludes
// it from Functions entirely, so this entry is belt-and-braces — it only bites
// if that exclude list is ever trimmed.
const STATIC_EXACT = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/manifest.json",
  "/manifest.webmanifest",
  "/_worker.js",
  "/_redirects",
  "/_headers",
]);

// Site-ownership proof files that platforms fetch at the domain root. Zalo
// (the messenger ~everyone in Vietnam uses) serves its verifier as .html, so
// it looks exactly like an SPA route to every rule above. Matching the shape
// rather than one token means a re-issued verifier keeps working.
//
// The extension is OPTIONAL, and that is the load-bearing part. Cloudflare
// Pages applies `html_handling` to everything its asset handler serves, so a
// request for `/zalo_verifier<token>.html` comes back as a 308 to the
// extensionless `/zalo_verifier<token>`. Match only the `.html` form and the
// redirect lands on a path this list does not recognise, which drops into the
// SPA soft-404 guard and 404s — the redirect target has to be servable too.
// (Both forms verified on preview builds a37fe065 / 37bf339e before this.)
const ROOT_VERIFICATION_RE = /^\/(?:zalo_verifier|google[0-9a-f]{16}|BingSiteAuth|pinterest-)[A-Za-z0-9_-]*(?:\.(?:html|xml))?$/;

export const isStaticAssetPath = (pathname: string): boolean =>
  STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
  STATIC_EXT_RE.test(pathname) ||
  STATIC_EXACT.has(pathname) ||
  ROOT_VERIFICATION_RE.test(pathname);

export const isHtmlSpaFallback = (response: Response) =>
  response.status === 200 &&
  (response.headers.get("content-type") || "").includes("text/html");

export function jsonNotFound(pathname: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  });
  applySecurityHeaders(headers);
  return new Response(JSON.stringify({ error: "not_found", path: pathname }), {
    status: 404,
    headers,
  });
}

export function homepageMarkdown(siteUrl: string, lang: "en" | "vi"): Response {
  const body = lang === "vi"
    ? `# ThePickleHub\n\nThePickleHub là nền tảng pickleball song ngữ tại Việt Nam và châu Á, cung cấp giải đấu, livestream, bảng đấu, bảng xếp hạng, tin tức và công cụ miễn phí cho ban tổ chức.\n\n## Khám phá\n\n- [Giải đấu](${siteUrl}/vi/tournaments)\n- [Trực tiếp](${siteUrl}/vi/live)\n- [Tin tức](${siteUrl}/vi/news)\n- [Hướng dẫn cho AI agent](${siteUrl}/llms.txt)\n- [Đặc tả OpenAPI](${siteUrl}/openapi.json)\n- [Sitemap](${siteUrl}/sitemap.xml)\n`
    : `# ThePickleHub\n\nThePickleHub is a bilingual pickleball platform for Vietnam and Asia, covering tournaments, livestreams, brackets, rankings and news, with free tools for organizers.\n\n## Explore\n\n- [Tournaments](${siteUrl}/tournaments)\n- [Livestreams](${siteUrl}/live)\n- [News](${siteUrl}/news)\n- [AI agent guide](${siteUrl}/llms.txt)\n- [OpenAPI specification](${siteUrl}/openapi.json)\n- [Sitemap](${siteUrl}/sitemap.xml)\n`;

  const headers = new Headers({
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=3600",
    Vary: "Accept",
  });
  applySecurityHeaders(headers);
  return new Response(body, { headers });
}

// ─── GSC "Not found (404)" cleanup 2026-07-30 — 410 Gone for permanently
//     removed URLs. Bots bypass public/_redirects, so a soft 404 here never
//     clears the coverage report; 410 is a definitive removal signal Google
//     drops from the crawl queue faster. Bot-path only — humans keep the SPA
//     in-app 404. Exact deleted entities + one buggy auto-generated slug
//     family (old MLP-Dallas scraper emitted a double "mlp-mlp-" prefix).
const GONE_EXACT = new Set<string>([
  // Test fixtures crawled while public, since removed
  "/nguoi-choi/dinhmai-test", "/nguoi-choi/dohung-test",
  "/nguoi-choi/lecam-test", "/nguoi-choi/lyhoangnam-test",
  "/nguoi-choi/nguyenvana-test", "/nguoi-choi/phamquang-test",
  "/nguoi-choi/tranthib-test", "/nguoi-choi/vothanh-test",
  // 2026-08-27 site audit: "/clb/test" belongs to the same fixture family as
  // the three below (name "test", description "test", archived 2026-07-28) and
  // was the only one still answering 200 to a crawler. Removing it from
  // sitemap-events.xml withdraws the recommendation; this removes the URL.
  "/clb/clb-test", "/clb/test", "/clb/test-3", "/clb/test-5",
  "/tran-dau/nguyenvana-test-vs-lyhoangnam-test-20260504-37e3d1",
  "/tran-dau/nguyenvana-test-vs-tranthib-test-20260504-ad583f",
  "/tran-dau/lyhoangnam-test-vs-phamquang-test-20260507-4371a9",
  // Deleted social events / meetups
  "/social/xe-ve", "/social/xe-ve-cung-coach", "/vi/social/xe-ve-cung-coach",
  "/su-kien/social-thu-2", "/su-kien/social-toi-thu-3",
  "/su-kien/sinh-hoat-dinh-ky-thu-2",
  // Ended / deleted livestreams (last two Google truncated at the dash)
  "/live/612bd532-0751-4623-915b-2a13babc9a4e",
  "/live/81ff3365-0ccf-4ce3-bf19-e7d7829735c3",
  "/live/80b73967", "/live/6277dca2", "/live/10779a7c",
  "/live/80b73967-", "/live/b083fc1f-",
  // Transactional app actions — never indexable content pages
  "/match/new", "/match/confirm",
  // Google-truncated blog URLs (no such slug; full posts live elsewhere)
  "/vi/blog/hop-", "/vi/blog/thuat-",
  // Truncated news slug emitted by an old internal link; no unambiguous post.
  "/vi/news/vi-sao-cu-",
]);
const GONE_PATTERNS: RegExp[] = [
  // Old MLP-Dallas scraper double-"mlp-mlp-" slug bug (matches 001–025);
  // those pages were removed and the current scraper uses single-mlp slugs,
  // so this family is permanently gone.
  /^\/tran-dau\/mlp-mlp-dallas-2026-\d{3}$/,
];
function isGoneUrl(pathname: string): boolean {
  return GONE_EXACT.has(pathname) || GONE_PATTERNS.some((re) => re.test(pathname));
}

// Exported so a test can call it with an env instead of grepping the source:
// an earlier version of shop-pilot-seo.test.ts asserted that this file
// CONTAINS the pilot check, and stayed green when the check was replaced with
// `return false`.
export function shouldNoindex(pathname: string, env?: { SHOP_PUBLIC_INDEXING?: string }): boolean {
  if (NOINDEX_PATTERNS.some((re) => re.test(pathname))) return true;
  // The pilot Shop, unless the launch flag is on.
  return !shopIndexingEnabled(env ?? {}) && isPilotNoindexShopPath(pathname);
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
    // 2026-08-29: Chrome's built-in Translate injects its stylesheet from
    // www.gstatic.com into the main document, so it is subject to our page
    // CSP. Without this the sheet is blocked (49 csp_violation reports / 3w)
    // and Translate renders unstyled — visible to the ~95% Vietnamese
    // audience whenever they translate an EN-only surface instead of using
    // the language toggle. www.gstatic.com is already trusted in script-src
    // above, a strictly higher-privilege directive, and style-src already
    // carries 'unsafe-inline'. Kept in sync with public/_headers.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com; " +
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

// SEO-05 (2026-07-30) — prerender canonical integrity guard.
// A cross-route poisoning incident was observed where unrelated bot routes
// briefly served ONE venue page's full SEO surface (title/canonical/og/
// hreflang all pointing at /vi/san/the-cage-dempsey-singapore). The source was
// localized (via HTTP header fingerprint) to the legacy standalone
// prerender-worker (separate infra — see docs/prerender-worker-poisoning-
// runbook.md), NOT this middleware. This guard is Pages-side defense-in-depth
// so the Pages KV can never itself cache a mis-rendered page.
//
// Rule: the canonical's entity segment (first path segment, /vi stripped) must
// equal the request's. Exception-proof for the VI->EN canonical routes
// (/vi/tournament, /vi/org, /vi/tran-dau, /vi/live) — they keep the SAME first
// segment across the language flip — while a /news route returning a /san
// canonical (the poisoning signature) is correctly rejected.
const PRERENDER_CANON_RE = /<link[^>]+rel="canonical"[^>]*href="([^"]+)"/i;

function prerenderEntitySegment(pathname: string): string {
  const noLang = pathname.replace(/^\/vi(?=\/|$)/, "");
  return noLang.split("/").filter(Boolean)[0] ?? "";
}

function canonicalConsistent(
  html: string,
  pathname: string,
): { ok: boolean; canon: string | null } {
  const m = html.match(PRERENDER_CANON_RE);
  if (!m) return { ok: true, canon: null };
  const canonPath = m[1].replace(/^https?:\/\/[^/]+/, "") || "/";
  return {
    ok: prerenderEntitySegment(canonPath) === prerenderEntitySegment(pathname),
    canon: canonPath,
  };
}

function pathCacheTtl(pathname: string): number {
  const stripped = pathname.replace(/^\/vi(?=\/|$)/, "") || "/";
  if (stripped === "/social" || stripped === "/clubs" || stripped === "/san") {
    return HUB_LIST_TTL_SECONDS;
  }
  // champion-on-event-card D2: tool pages now carry the champion in their
  // description; a score correction after a share must stop serving the stale
  // name within minutes. Zalo/FB keep their own copy forever regardless —
  // OG is a snapshot at share time (accepted, see proposal ADR note).
  if (stripped.startsWith("/tools/")) {
    return HUB_LIST_TTL_SECONDS;
  }
  // Shop: price and availability are inside the rendered HTML AND inside the
  // Offer JSON-LD. At the 6h default, a sold-out product keeps telling Google
  // schema.org/InStock for most of a day — the one kind of stale that gets a
  // rich result demoted rather than merely out of date.
  if (stripped === "/shop" || stripped.startsWith("/shop/")) {
    return HUB_LIST_TTL_SECONDS;
  }
  // World Cup 2026 results pages carry a live table built from wc_pro_matches
  // (functions/_lib/render/wc-results.ts). At the 6h default the bot view would
  // show yesterday's scores on a page whose whole claim is that it is current,
  // and dateModified would be a lie told to the crawler. Both language twins;
  // the /vi prefix is already stripped above.
  if (
    stripped === "/blog/pickleball-world-cup-2026-da-nang-results" ||
    stripped === "/blog/ket-qua-pickleball-world-cup-2026-da-nang"
  ) {
    return HUB_LIST_TTL_SECONDS;
  }
  return DEFAULT_TTL_SECONDS;
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CANONICAL_HOST: string;
  PRERENDER_CACHE?: KVNamespace;
  /** Q4 launch gate. "1" opens the public Shop to crawlers; anything else
   *  (including unset, which is the pilot default) keeps it noindex. */
  SHOP_PUBLIC_INDEXING?: string;
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

  // GSC 2026-08-09: an old, truncated livestream URL is still being crawled.
  // Its surviving recording has the same unique prefix, so preserve the old
  // URL's equity with a single permanent hop instead of returning a soft 404.
  if (url.pathname === "/live/10779a7c") {
    return secureRedirect(
      `https://${url.hostname}/live/10779a7c-46f4-4501-a65e-e852eb2fb565${url.search}`,
      301,
    );
  }

  // ─── 1c-bis. 2026-08-25 site audit — retired duplicate /san slugs.
  //
  //       Running scripts/data-fixes/import-alobo-venues.mjs three times on
  //       2026-08-24 created six venues twice. The "slug already exists" guard
  //       tested only the final slug while the disambiguation step rewrote that
  //       slug on within-batch collisions, so a venue listed once in one export
  //       and twice in the next arrived under two slugs and the guard saw
  //       neither as a repeat. Root cause fixed in resolveNewVenueSlugs().
  //
  //       Each pair was two /san pages with identical titles and identical meta
  //       descriptions, both in sitemap-venues.xml. The duplicate rows are
  //       deleted; these 301s carry whatever equity the retired URLs picked up
  //       in their one day of life, and keep any bot that already saw them off
  //       a 404. The kept slug is the older one — it is also what the importer
  //       generates for a venue listed once, so a future run stays idempotent.
  //
  //       public/_redirects carries the same six rules for humans; bots bypass
  //       _redirects entirely, which is why they are mirrored here.
  const RETIRED_VENUE_SLUGS: Record<string, string> = {
    "lakeside-pickleball-coffe-rua-xe-da-nang": "lakeside-pickleball-coffe-rua-xe",
    "ob-pickleball-quang-ngai": "ob-pickleball",
    "pickleball-yen-hoa-ha-noi": "pickleball-yen-hoa",
    "san-pickleball-quan-doi-tp-hcm": "san-pickleball-quan-doi",
    "the-pickleball-lounge-ha-noi": "the-pickleball-lounge",
    // Same court, listed twice under two names and two phone numbers. The
    // kept row is "Sân Lê Ninh T.A" — the fuller name and the earlier insert.
    "le-ninh-t-a": "san-le-ninh-t-a",
  };
  const sanMatch = url.pathname.match(/^\/(vi\/)?san\/([^/?#]+)$/);
  if (sanMatch) {
    const target = RETIRED_VENUE_SLUGS[sanMatch[2]];
    if (target) {
      return secureRedirect(
        `https://${url.hostname}/${sanMatch[1] ?? ""}san/${target}${url.search}`,
        301,
      );
    }
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
  //
  //       2026-08-25: extended to tran-dau, nguoi-choi and live/:id, which
  //       were the other half of the same problem and had been left behind.
  //       They served 200 with the EN canonical — the exact "hreflang to non
  //       canonical" shape this rule exists to remove. /vi/tran-dau/* and
  //       /vi/nguoi-choi/* were worse than duplicates: the SPA has no route
  //       for either, so a human hard-navigating one got the NotFound page
  //       while bots got a full render. Only the id form is matched, so the
  //       real VI listing pages (/vi/live, /vi/tournaments) are untouched.
  const viOrgMatch = url.pathname.match(
    /^\/vi\/(org|tournament|watch|tran-dau|nguoi-choi|live)\/([^/?#]+)$/,
  );
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

  // GSC 2026-08-25 — news rows were re-ingested under stable UUID-derived
  // slugs after the first URLs had already been crawled. Preserve the accrued
  // signals and send readers to the same surviving story instead of 404ing.
  const NEWS_REDIRECTS: Record<string, string> = {
    "/news/wong-sets-record-with-third-straight-gold-1f1um3": "/news/hong-kit-wong-makes-history-with-third-consecutive-singles-crown-at-singapore-op-58d5a53d",
    "/vi/news/wong-lap-ky-luc-voi-h-hcv-lien-tiep-1f1um3": "/vi/news/hong-kit-wong-lap-ky-luc-voi-huy-chuong-vang-don-nam-lien-tiep-tai-singapore-58d5a53d",
    "/news/the-dink-minor-league-pickleball-format-explained-every-way-to-play-1hfoe4": "/news/understanding-the-dink-minor-league-pickleball-structure-68400027",
    "/vi/news/giai-ma-the-thuc-minor-league-pickleball-san-choi-dong-doi-dinh-cao-1hfoe4": "/vi/news/tim-hieu-cau-truc-giai-dau-pickleball-nghiep-du-68400027",
    "/news/a-summer-to-remember-recapping-the-2026-joola-pops-summer-tour-1fp8r3": "/news/joola-concludes-nationwide-summer-tour-9e811e50",
    "/vi/news/mua-he-dang-nho-nhin-lai-hanh-trinh-joola-pops-summer-tour-2026-1fp8r3": "/vi/news/hanh-trinh-xuyen-quoc-gia-cua-joola-khep-lai-thanh-cong-9e811e50",
  };
  const newsDestination = NEWS_REDIRECTS[url.pathname];
  if (newsDestination) {
    return secureRedirect(`https://${url.hostname}${newsDestination}${url.search}`, 301);
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
    // NB: luat-pickleball + luat-pickleball-2026 moved to VI_BLOG_DIRECT on
    // 2026-07-27 — a real VI rules pillar now exists, so they no longer send
    // Vietnamese searchers to the English article.
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
    // 2026-07-27 — these two used to resolve to the EN rules guide via
    // VI_BLOG_REDIRECTS, on the assumption that no Vietnamese rules pillar
    // existed. One does: /vi/blog/luat-pickleball-co-ban, 13k chars, published
    // and ranking. Two slugs carrying "luật pickleball" intent were handing
    // Vietnamese readers an English page.
    "luat-pickleball": "/vi/blog/luat-pickleball-co-ban",
    "luat-pickleball-2026": "/vi/blog/luat-pickleball-co-ban",
    // GSC "Not found (404)" 2026-07-30 — renamed VI posts, 301 to live VI twin.
    "bang-xep-hang-dupr-viet-nam-ra-mat": "/vi/blog/bang-xep-hang-dupr-viet-nam",
    "dupr-la-gi-he-thong-rating-pickleball-toan-cau": "/vi/blog/dupr-la-gi-huong-dan-cho-nguoi-choi-viet-nam",
    "thuat-toan-dupr-vi-sao-thang-mat-diem": "/vi/blog/thuat-toan-dupr-thang-mat-diem-thua-tang-diem",
    "to-chuc-giai-pickleball": "/vi/blog/cach-to-chuc-giai-pickleball",
    "luat-pickleball-day-du": "/vi/blog/luat-pickleball-co-ban",
  };

  const viBlogMatch = url.pathname.match(/^\/vi\/blog\/([^/?#]+)$/);
  if (viBlogMatch && VI_BLOG_DIRECT[viBlogMatch[1]]) {
    return secureRedirect(
      `https://${url.hostname}${VI_BLOG_DIRECT[viBlogMatch[1]]}${url.search}`,
      301,
    );
  }
  if (viBlogMatch && VI_BLOG_REDIRECTS[viBlogMatch[1]]) {
    // Resolve to the EN slug, then to /tools in ONE hop if it's a tools
    // dedupe target — avoids a /vi/blog → /blog → /tools 301 chain.
    const enSlug = VI_BLOG_REDIRECTS[viBlogMatch[1]];
    const dest = BLOG_TO_TOOLS.has(enSlug) ? "tools" : `blog/${enSlug}`;
    return secureRedirect(`https://${url.hostname}/${dest}${url.search}`, 301);
  }

  const enBlogToTools = url.pathname.match(/^\/blog\/([^/?#]+)$/);
  if (enBlogToTools && BLOG_TO_TOOLS.has(enBlogToTools[1])) {
    return secureRedirect(`https://${url.hostname}/tools${url.search}`, 301);
  }
  if (enBlogToTools && BLOG_MERGED[enBlogToTools[1]]) {
    return secureRedirect(
      `https://${url.hostname}/blog/${BLOG_MERGED[enBlogToTools[1]]}${url.search}`,
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

  // ─── 1h. Markdown content negotiation ────────────────
  // Agents can request a compact, self-contained homepage representation.
  // Human/browser requests continue through the existing HTML/SPA path.
  if (
    request.method === "GET" &&
    (url.pathname === "/" || url.pathname === "/vi") &&
    (request.headers.get("accept") || "").includes("text/markdown")
  ) {
    const siteUrl = env.CANONICAL_HOST || "https://www.thepicklehub.net";
    return homepageMarkdown(siteUrl, url.pathname === "/vi" ? "vi" : "en");
  }

  // ─── 2. Static asset bypass (before bot detection) ───
  const pathname = url.pathname;

  // A missing machine-readable discovery document must not masquerade as a
  // valid JSON endpoint. Preserve real .well-known resources, but turn the
  // SPA rewrite fallback into an honest JSON 404.
  if (isWellKnownPath(pathname)) {
    const discoveryResponse = await next();
    return isHtmlSpaFallback(discoveryResponse)
      ? jsonNotFound(pathname)
      : discoveryResponse;
  }

  if (isStaticAssetPath(pathname)) {
    const assetResponse = await next();
    // Root verification files really ARE text/html — Zalo, Google and Bing all
    // serve their site-ownership proof as an HTML document. The guard below
    // exists for hashed assets that came back as the SPA shell; applying it
    // here would turn a correct 200 into a 404 and break verification, which
    // is the whole reason the file exists.
    if (ROOT_VERIFICATION_RE.test(pathname)) return assetResponse;
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

  // ─── 2b. Pages API bypass ─────────────────────────────
  // Without this, the non-bot soft-404 guard below mistakes every /api/*
  // endpoint for an unknown SPA route and returns 404 before the endpoint's
  // own function can authenticate, validate, and respond.
  if (isPagesApiPath(pathname)) {
    const apiResponse = await next();
    return isHtmlSpaFallback(apiResponse) ? jsonNotFound(pathname) : apiResponse;
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
  const isNoindex = shouldNoindex(pathname, env);
  if (!isBot) {
    if (!isKnownSpaPath(pathname)) {
      const siteUrl = env.CANONICAL_HOST || "https://www.thepicklehub.net";
      const response = render404(pathname, siteUrl, request.headers.get("accept") || "");
      const headers = new Headers(response.headers);
      headers.set("X-Robots-Tag", "noindex, nofollow");
      headers.set("Cache-Control", "no-store");
      applySecurityHeaders(headers);
      return new Response(response.body, { status: 404, headers });
    }
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

  // ─── 4-gone. GSC "Not found (404)" cleanup — permanently removed URLs get a
  //     410 Gone (definitive) instead of the soft 404 the fallback would emit,
  //     so Google drops them from the crawl queue + the coverage report. Bot
  //     path only; humans already fell through to the SPA above.
  if (isGoneUrl(url.pathname)) {
    const goneLang = detectLang(pathname);
    const shell = renderNoindexShell(siteUrl, pathname, goneLang);
    const goneHeaders = new Headers(shell.headers);
    goneHeaders.set("X-Robots-Tag", X_ROBOTS_NOINDEX);
    goneHeaders.set("X-Prerender-Cache", "BYPASS");
    applySecurityHeaders(goneHeaders);
    return new Response(shell.body, { status: 410, headers: goneHeaders });
  }

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
  // v33→v34 (2026-08-06): /rankings SSR body changed (self-referential
  // ?scope=open link replaced with a real anchor to /rankings/ppa-tour).
  // v34→v35 (2026-08-08): homepage purpose copy changed for Google OAuth
  // branding verification; invalidate the cached bot-facing homepage.
  // v35→v36 (2026-08-08): add explicit Google user-data disclosure to the
  // homepage and serve the complete Privacy Policy to verification crawlers.
  // v36→v37 (2026-08-08): expose the exact OAuth app name and purpose together
  // above the fold; purge bot HTML that retained the old homepage heading.
  // v37→v38 (2026-08-08): normalize the homepage title to the exact OAuth
  // application name and invalidate the previously rendered homepage HTML.
  // v38→v39 (2026-08-11): Singapore Open preview updated to post-event state
  // (recap callout + new meta description, EN + VI) and PPA Tour Asia VI guide
  // refreshed with 7-stop results section; purge stale bot HTML for both.
  // v39→v40 (2026-08-11): SEO audit — EN + VI /blog indexes now emit
  // ItemList + BreadcrumbList JSON-LD, and both homepages drop the duplicate
  // auto <h1> (single body H1). Purge stale bot HTML for /, /vi, /blog, /vi/blog.
  // v40→v41 (2026-08-11): venue wiring — venue detail + per-city hub deep-link
  // the 4 evergreen local guides (cost/court-size/rules/how-to) instead of only
  // the blog index. Purge stale bot HTML for /san/* + /san/khu-vuc/*.
  // v41→v42 (2026-08-12): rankings page deep-links the DUPR/WPR explainer guides
  // (§6 wiring). Purge /rankings + /vi/rankings. (If PR #575 lands first at v42,
  // rebase this to v43 — versions must stay monotonic.)
  // v42→v43 (2026-08-14): EN home title enriched ("ThePickleHub – Pickleball
  // Asia: Live & Tournaments") + HCMC recap deep-links the WPR explainer.
  // Purge stale bot HTML for / and /blog/hcmc-open-2026-recap.
  // v43→v44 (2026-08-14): /tournaments upgraded into the 2026 pro tournament
  // calendar hub. Purge stale bot HTML for /tournaments + /vi/tournaments.
  // v44→v45 (2026-08-14): GEO attribution — 2026 tournament-calendar post
  // (EN + VI) names ThePickleHub in the opening paragraph so AI-search
  // citations can attribute the passage when extracted standalone.
  // v45→v46 (2026-08-14): GEO rollout — calendar-post opening now front-loads
  // the full 2026 date list + "last updated" dateline, and 7 evergreen guides
  // (WPR, World Cup Da Nang, PPA Asia guide, pro-tours guide, how-to-watch,
  // players-to-watch, HK Slam) name ThePickleHub in their openings (EN + VI).
  // v46→v47 (2026-08-16): site-audit fix — the 2026 calendar resolved event
  // status against a UTC "today" instead of the VN calendar date (a day
  // behind between 00:00 and 07:00 ICT), and every SportsEvent was published
  // with organizer "PPA Tour Asia" including the Heineken World Cup Da Nang
  // and the HK Slam, which neither of them organises. Purge stale bot HTML
  // for /tournaments + /vi/tournaments.
  // v49 (CTR-01, 2026-08-18): the venue meta-description template changed, so
  // every cached /san/ + /vi/san/ entry holds a stale, mid-word-truncated
  // snippet. Bump invalidates them in one go rather than needing ?nocache=1 on
  // 1,688 URLs.
  // v50 (Phase 4 shop launch, 2026-08-18): /shop, /shop/category/*,
  // /shop/product/*, /shop/store/* previously cached the renderNoindexShell
  // body under the pilot gate. Without a bump, flipping SHOP_PUBLIC_INDEXING
  // would serve that shell — noindex intact — for another six hours, and the
  // launch would look like it silently failed.
  //
  // v51 — SEO-GUARD-01 (2026-08-19): /tools gained HowTo schema + visible
  // steps, tournament detail gained the broadcast section + subEvent graph +
  // per-tournament og:image, venue detail gained amenityFeature. All three
  // change SSR output. Bumped past v50 rather than reusing it: the shop launch
  // had already published entries under that key, so sharing it would serve
  // pre-change HTML for the full TTL on every route this commit touches.
  //
  // v52 — brand cleanup (2026-08-19): the spaced "The Pickle Hub" was replaced
  // with "ThePickleHub" in 35 places across 6 blog posts, 30 places across 8
  // Supabase vi_blog_posts rows, and in blog metadata.ts — which is the SSR
  // truth table for <title> and <meta description>. Cached HTML would keep
  // serving the diluted entity name for the full TTL otherwise.
  //
  // v53 — thông số sản phẩm (2026-08-23): trang /shop/product/:slug nay có
  // khối "Thông số", additionalProperty trong schema Product, và ba thông số
  // đầu nằm trong câu mở đầu. HTML cũ trong KV không có bất kỳ thứ nào.
  //
  // v54 — CTR-02 (2026-08-24): /san titles and meta descriptions now lead with
  // the district ("– Đống Đa, Hà Nội") instead of the city alone. 690 of 760
  // venue rows change their <title> and <meta description>, ×2 for the en/vi
  // pair, so every cached venue page would otherwise serve the old city-only
  // title for the full TTL.
  //
  // v57 — PRICE-01 (2026-08-24): every /san page changes. 108 venues gained a
  // real price + opening hours in <title>, the snippet and JSON-LD; the other
  // 741 gained a labelled regional price line in the body. Cached HTML would
  // serve the price-less version for the full TTL.
  //
  // v58 — NEAR-01 (2026-08-24): the "other courts" block on /san is now ranked
  // by real distance from the venue being viewed instead of a deterministic
  // city-wide query, so the body of every venue page changes again (×2 for the
  // en/vi pair). Cached HTML would keep serving the identical city-wide list —
  // the exact boilerplate this change exists to remove.
  //
  // v59 — THIN-01 (2026-08-24): /live and /rankings both gained standing body
  // copy (/live 59 words -> ~354, /rankings 135 -> ~378) and /live now falls
  // back to replays instead of rendering its own empty state. Four cached URLs
  // (en/vi x 2 routes) would otherwise serve the thin version for the full TTL.
  //
  // v61 — /live query windowing (2026-08-25): live / scheduled / ended each get
  // their own query and limit instead of sharing one 40-row created_at window,
  // and upcoming is ordered by air time. Output is unchanged while nothing is
  // live or scheduled, but the cached copy must not outlive the first stream
  // that is.
  //
  // v62 — GEO-01 (2026-08-24, landed 2026-08-25): the opening paragraph on all
  // /san pages is rewritten to front-load real facts and name ThePickleHub,
  // replacing a template that ended by pointing further down the page. This
  // branch had reserved v60, but /live windowing took v61 to production first,
  // so it moves to v62 — CLAUDE.md's rule is that the number only has to differ
  // from the one already deployed.
  //
  // v63 — CTR-03 + content refresh (2026-08-25). Three separate reasons the
  // cached HTML is now wrong:
  //   1. / and /vi carry new meta descriptions. The VI one was being cut
  //      mid-word at the 160-BYTE budget ("…miễn…") because the string was 148
  //      characters and 186 bytes; both now interpolate the venue count.
  //   2. /blog/hcmc-open-2026-preview and /vi/blog/hcmc-open-2026 now open with
  //      the result (the event finished on 2026-08-09) and carry new titles.
  //   3. /blog/hong-kong-slam-2026-preview and /vi/blog/hong-kong-slam-2026
  //      say registration is open rather than that it opens on August 10.
  // v65 (2026-08-25, LOW sweep, #678) — /about and /vi/about carry new titles
  // and meta descriptions. The old ones were the shortest on the site (18-char
  // title, 49-char description).
  //
  // v66 (2026-08-25, C3, this branch) — every /news/:slug now carries
  // <meta name="robots" content="noindex, follow"> and no hreflang, and every
  // /vi/news/:slug self-references in hreflang instead of pairing with the EN
  // URL. Without a bump, cached HTML would keep serving the indexable EN page
  // and the old EN<->VI cluster for the full TTL.
  //
  // This branch originally took v64. #678 merged first with v65, so it moves
  // to v66 — CLAUDE.md's rule for two open branches bumping the same number:
  // take the higher and move on.
  // v67 (2026-08-25, H1) — blog posts now render their hero image in the bot
  // HTML: <figure><img> after the <h1> on the EN side (from metadata.ts
  // heroImage) and after the content_html <h1> on the VI side (from
  // vi_blog_posts.cover_image_url), both with real width/height. Cached HTML
  // has no <img> at all, so without a bump Google Images keeps seeing the
  // imageless version for the full TTL.
  // v68 (2026-08-25) — the VI live hub links to /live/:id instead of
  // /vi/live/:id, so its cached body would otherwise keep pointing at URLs
  // that now 301.
  // v69 (2026-08-28) — the Aug 20-23 PPA Asia stop is renamed from its
  // placeholder "China Open 2" to the official "Skechers Shenzhen Open" on
  // /tournaments + /vi/tournaments and in two blog bodies, and its status
  // flips Upcoming -> Completed. Cached HTML would keep serving the wrong
  // entity name and a finished event billed as upcoming.
  // v70 (2026-08-28) — every news article changes shape: the related strip
  // becomes prev/next neighbours instead of the same six newest items for all
  // 843 URLs, and the source credit becomes a dateline naming ThePickleHub
  // with a visible date. Cached HTML would keep serving the six-link version
  // that produced the orphans.
  // v72 (2026-08-29): follow-up — the "FPT Play requires a subscription" claim
  // survived in the EN FAQ and both overview bullets; finals times added to the
  // pillar post. v71 (2026-08-29): World Cup T-1 refresh — how-to-watch + schedule + overview
  // now carry the Sep 6 final times, the withdrawn ticket link, current hotel
  // rates and the confirmed 81-nation field. Old HTML would serve the stale
  // "the Open final is not on the schedule" claim for the whole TTL.
  // v74 (2026-08-29): category <title> also goes through fitTitle.
  // v73 (2026-08-29): shop SEO audit — <img> gallery + card covers in bot HTML,
  // price out of product <title>, x-default → VI, EN category names, Brand/sku
  // in Product schema, Shop link in the shared <nav>.
  // v75 (2026-08-30): World Cup opening day — the ticket link is BACK on the
  // organizers' homepage after three days away, so the three posts no longer
  // say it "has gone"; all three openings carry an Aug 30 dateline, and the
  // pillar opening no longer frames the 80-nation target as still open.
  // v76 (2026-08-30): follow-up to v75 — independent verify found three
  // stale-dateline survivors the first pass missed: two "the day before
  // play" lines in how-to-watch (EN+VI) and a VI relative date that the
  // updatedDate bump made wrong ("the day before this page was updated").
  // v77 (2026-08-31): day two. All three World Cup openings said play starts
  // "today, August 30" / "sáng nay bóng lăn" — true yesterday, wrong today, and
  // the opening is the passage AI search extracts. Openings now carry an Aug 31
  // dateline with absolute dates only, plus the first verified day-one outcome:
  // 12 of 69 events already have champions (organizers' own site, amateur draws).
  // v78 (2026-08-31): the Group A article was the one World Cup post the day-two
  // pass missed — still datelined August 20 while the tournament was live. Its
  // opening now leads with the fact readers are actually searching for during
  // the spike: Vietnam has NOT played a Group A match yet: the national-team
  // competition it belongs to runs Sep 3-6, and 0 of its 222 ties were played
  // as of Aug 31. Only the individual tournament is under way (12/69 events
  // decided, all amateur). EN + FAQ updated here; VI body ships via SQL.
  // v79 (2026-08-31): blog listings now order by the LATER of published/
  // updated, so a post refreshed mid-event resurfaces instead of staying
  // buried at its original publish date. Changes the SSR body of /vi,
  // / (VI block) and /vi/blog, so the cached copies must be retired.
  // v80 (2026-08-31): follow-up — /blog (EN) was still emitting the old
  // insertion order to bots while readers got the new sort. Its cached
  // copies and ItemList JSON-LD must be retired with it.
  // v81 (2026-08-31): /live SSR now carries a World Cup livescore block —
  // matches in progress + recent results with players and scores — so bots
  // index real World Cup content on the hub during the tournament.
  // v82 (2026-08-31): "World Cup" everywhere on the /live World Cup surface
  // now reads "Pickleball World Cup" (disambiguation from football + the
  // keyword), and /live title/description lead with it during the event.
  // v83 (2026-08-31): World Cup livescore results now show the full scoreline
  // (all finished games + the last-observed game) instead of a single game, so
  // completed and bo3 matches read as "14-16, 16-14, 13-5" not "16-14".
  const cacheKey = `pr:v83:${url.pathname}`;
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
      routeAndRender(url.pathname, env, siteUrl, request.headers.get("accept") || ""),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("prerender-timeout")), RENDER_BUDGET_MS),
      ),
    ]);

    if (env.PRERENDER_CACHE && response.status === 200) {
      const html = await response.clone().text();
      // SEO-05 integrity guard (see canonicalConsistent above).
      const canon = canonicalConsistent(html, url.pathname);
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
      if (!canon.ok) {
        // Canonical belongs to a different entity than the requested path
        // — poisoned render. Do NOT cache it; record for the existing
        // errors-telegram-alert cron (reuses the #452 client_errors path,
        // no migration). 'prerender-canon:' prefix = distinct fingerprint.
        try {
          const supabase = createSupabaseClient(env);
          context.waitUntil(
            supabase
              .from("client_errors")
              .insert({
                type: "unhandled_rejection",
                message: `prerender-canon: ${url.pathname} -> ${canon.canon}`,
                stack: null,
                url: url.pathname,
                user_agent: request.headers.get("user-agent"),
              })
              .then(
                () => {},
                () => {},
              ),
          );
        } catch {
          // telemetry must never break serving
        }
      } else {
        const ttl = pathCacheTtl(url.pathname);
        context.waitUntil(
          env.PRERENDER_CACHE.put(cacheKey, html, { expirationTtl: ttl }),
        );
      }
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

async function routeAndRender(pathname: string, env: Env, siteUrl: string, accept = ""): Promise<Response> {
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

  // Shop catalogue (Phase 4 public launch). Reached only when
  // SHOP_PUBLIC_INDEXING=1 — otherwise `isNoindex` short-circuits to the
  // noindex shell long before here. /shop/search has no arm on purpose: it
  // is matched by NOINDEX_PATTERNS and never arrives.
  if (path === "/shop") return await renderShopCatalog(supabase, siteUrl, lang, env.SUPABASE_URL);
  match = path.match(/^\/shop\/category\/([^/]+)$/);
  if (match) return await renderShopCategory(supabase, match[1], siteUrl, lang, env.SUPABASE_URL);
  match = path.match(/^\/shop\/store\/([^/]+)$/);
  if (match) return await renderShopStore(supabase, match[1], siteUrl, lang, env.SUPABASE_URL);
  match = path.match(/^\/shop\/product\/([^/]+)$/);
  if (match) return await renderShopProduct(supabase, match[1], siteUrl, lang, env.SUPABASE_URL);

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
  // PPA Tour WPR — separate pathname on purpose: /rankings keeps its DUPR
  // Việt Nam title/default; query-string scopes never reach this renderer
  // (routeAndRender is pathname-only), so a "tab" could never be a landing.
  if (path === "/rankings/ppa-tour") return renderPpaRankings(siteUrl, rawPath, lang);

  // Privacy / Terms
  if (path === "/privacy") return renderPrivacy(siteUrl, rawPath, lang);
  if (path === "/terms") return renderTerms(siteUrl, rawPath, lang);
  if (path === "/advertise") return renderAdvertise(siteUrl, rawPath, lang);
  if (path === "/about") return renderAbout(siteUrl, rawPath, lang);
  if (path === "/contact") return renderContact(siteUrl, rawPath, lang);

  // 404 fallback — unmatched routes get a proper 404 + noindex, not a
  // generic 200 shell that would waste crawl budget and create soft-404s.
  return render404(rawPath, siteUrl, accept);
}
