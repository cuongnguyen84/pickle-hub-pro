import { blogMetadata } from "../../src/content/blog/metadata";
import { byEffectiveDateDesc, pinWorldCupResults } from "../../src/lib/blogOrder";
import { blogHeroSrcSet } from "../../src/lib/image-utils";
import { smartAppBannerContent } from "../../src/lib/smart-app-banner";

/** Progressive HTML for public editorial/marketing routes. React still owns the app. */

const HOME_LCP_SIZES = "(min-width: 1100px) 800px, (min-width: 640px) 50vw, calc(100vw - 32px)";
const BLOG_LCP_SIZES = "(max-width: 900px) 100vw, 832px";

function imagePreload(src: string, sizes: string): string {
  const responsive = blogHeroSrcSet(src);
  if (!responsive) {
    return `<link rel="preload" as="image" href="${src}" fetchpriority="high"/>`;
  }
  return `<link rel="preload" as="image" href="${responsive.small}" imagesrcset="${responsive.srcSet}" imagesizes="${sizes}" fetchpriority="high"/>`;
}

/**
 * Early fetch for the LCP hero on the human HTML path. The image lives in
 * the React tree, so without this the browser only discovers it after JS.
 * /vi heroes come from the database and are not known here. Tool landings
 * have no hero image.
 */
export function lcpPreloadTag(pathname: string): string {
  if (pathname === "/") {
    const first = pinWorldCupResults(
      [...blogMetadata].sort(byEffectiveDateDesc((p) => p.publishedDate, (p) => p.updatedDate)),
      (p) => p.slug,
    ).find((p) => p.heroImage?.src);
    return first?.heroImage?.src ? imagePreload(first.heroImage.src, HOME_LCP_SIZES) : "";
  }
  const blog = pathname.match(/^\/blog\/([^/]+)$/);
  if (!blog) return "";
  const src = blogMetadata.find((p) => p.slug === blog[1])?.heroImage?.src;
  return src ? imagePreload(src, BLOG_LCP_SIZES) : "";
}
export function isPublicContentPath(pathname: string): boolean {
  const path = pathname.replace(/^\/vi(?=\/|$)/, '') || '/';
  return ['/', '/blog', '/tools', '/about', '/contact', '/authors/cuong-nguyen'].includes(path)
    || /^\/blog\/[^/]+$/.test(path)
    || /^\/tools\/(quick-tables|team-match|doubles-elimination|flex-tournament)$/.test(path);
}

/** Extract only SEO nodes; never copy the renderer's global CSS or analytics. */
export function publicPageParts(html: string): { head: string; body: string; lang: string } {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (!body || !/<link\b[^>]*rel=["']canonical["']/i.test(head)) {
    throw new Error('public-page-missing-content-or-canonical');
  }
  const nodes = head.match(/<title\b[^>]*>[\s\S]*?<\/title>|<meta\b[^>]*>|<link\b[^>]*>|<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  const seo = nodes.filter((node) => /^<title|^<script/i.test(node)
    || /^<meta\b/i.test(node) && /(?:name|property)=["'](?:description|robots|og:[^"']+|twitter:[^"']+|article:[^"']+)["']/i.test(node)
    || /^<link\b/i.test(node) && /rel=["'](?:canonical|alternate)["']/i.test(node));
  return {
    head: seo.map((node) => node.replace(/^<(\w+)/, '<$1 data-public-seo')).join('\n'),
    body,
    lang: html.match(/<html\b[^>]*lang=["']([^"']+)["']/i)?.[1] ?? 'en',
  };
}

/**
 * Server-side cache for extracted public-page parts (head SEO nodes + body
 * + lang) — NEVER for the spliced document. The shell is re-read from the
 * current deployment on every request and the parts are spliced into it,
 * so a cached part can never point at chunk hashes a newer deploy removed
 * (the 2026-09-08 stale-shell incident). The render behind these parts is
 * anonymous: routeAndRender receives only pathname/env/siteUrl/accept and
 * never reads cookies or Authorization, and sign-in state lives in the
 * client (Supabase JWT in localStorage) — the parts are byte-identical for
 * every visitor, so sharing them across visitors leaks nothing.
 */
export interface PublicPagePartsCache {
  get(): Promise<string | null>;
  put(value: string): Promise<void>;
}

interface PublicPageParts {
  head: string;
  body: string;
  lang: string;
}

/** HTMLRewriter handler: point the shell's Smart App Banner at this page. */
export function smartAppBannerHandler(canonicalUrl: string) {
  return { element(el: Element) { el.setAttribute('content', smartAppBannerContent(canonicalUrl)); } };
}

/** Human SPA-shell responses: same rewrite, canonical = slashless request path. */
export function withSmartAppBanner(response: Response, siteUrl: string, pathname: string): Response {
  if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) return response;
  // ponytail: Node unit tests drive the middleware without the Workers runtime.
  if (typeof HTMLRewriter === 'undefined') return response;
  const canonical = `${siteUrl}${pathname.replace(/\/+$/, '') || '/'}`;
  return new HTMLRewriter().on('meta[name="apple-itunes-app"]', smartAppBannerHandler(canonical)).transform(response);
}

function spliceParts(shell: Response, parts: PublicPageParts, pathname: string, renderTag: string): Response {
  const headers = new Headers(shell.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Vary', 'User-Agent');
  headers.set('X-Public-Render', renderTag);
  headers.delete('Content-Length');
  headers.delete('ETag');
  const response = new Response(shell.body, { status: shell.status, headers });
  const remove = { element(el: Element) { el.remove(); } };
  const preload = lcpPreloadTag(pathname);
  const canonical = parts.head.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
  return new HTMLRewriter()
    .on('html', { element(el) { el.setAttribute('lang', parts.lang); } })
    .on('title, meta[name="description"], meta[name="robots"], meta[property^="og:"], meta[property^="article:"], meta[name^="twitter:"], link[rel="canonical"], link[hreflang], script[type="application/ld+json"]', remove)
    .on('head', { element(el) {
      el.append(parts.head, { html: true });
      if (preload) el.append(`\n${preload}`, { html: true });
    } })
    .on('meta[name="apple-itunes-app"]', canonical ? smartAppBannerHandler(canonical) : {})
    .on('#root', { element(el) { el.setInnerContent(`<div data-public-content>${parts.body}</div>`, { html: true }); } })
    .transform(response);
}

export async function servePublicPage(
  shell: Response,
  render: () => Promise<Response>,
  budgetMs = 2500,
  pathname = "",
  cache?: PublicPagePartsCache | null,
): Promise<Response> {
  if (shell.status !== 200 || !shell.headers.get('content-type')?.includes('text/html')) return shell;
  if (cache) {
    try {
      const raw = await cache.get();
      if (raw) {
        const parts = JSON.parse(raw) as PublicPageParts;
        if (typeof parts?.head === 'string' && typeof parts?.body === 'string' && typeof parts?.lang === 'string') {
          return spliceParts(shell, parts, pathname, 'content-cache');
        }
      }
    } catch {
      // Cache read/parse/splice failure: fall through to a fresh render.
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const page = await Promise.race([
      render(),
      new Promise<Response>((_, reject) => { timer = setTimeout(() => reject(new Error('public-page-timeout')), budgetMs); }),
    ]);
    // Preserve real missing-article statuses and alternate-slug redirects.
    if (page.status !== 200) return page;
    const parts = publicPageParts(await page.text());
    if (cache) {
      try {
        await cache.put(JSON.stringify(parts));
      } catch {
        // A failed cache write costs an entry, never the response.
      }
    }
    return spliceParts(shell, parts, pathname, 'content');
  } catch (error) {
    // A data outage must not prevent the interactive application from booting.
    console.warn('Public HTML fallback:', error instanceof Error ? error.message : 'render-error');
    const headers = new Headers(shell.headers);
    headers.set('X-Public-Render', 'fallback');
    headers.set('Cache-Control', 'no-store');
    return new Response(shell.body, { status: shell.status, headers });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
