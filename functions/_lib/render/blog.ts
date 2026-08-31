/**
 * SSR render handlers — EN static blog + VI database blog pages.
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import { byEffectiveDateDesc } from "../../../src/lib/blogOrder";
import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import { BLOG_POST_META } from "./blog-meta";
import { renderEnBlogBody, enBlogFaqJsonLd, enBlogHowToJsonLd } from "./blog-body";
import {
  escapeHtml,
  escapeJsonLd,
  buildTitle,
  absImage,
  normalizeImageUrl,
  normalizeImagesInHtml,
  sanitizeBlogHtml,
  breadcrumb,
  relatedBlogLinks,
  bilingualHreflang,
  buildBreadcrumbJsonLd,
  DEFAULT_OG_IMAGE,
} from "../utils";
import { blogImageDims } from "../../../src/content/blog/image-dims";
import { render404 } from "./static-pages";

// ─── Blog ─────────────────────��───────────────────────────

// Prerender metadata for bot-rendered EN blog posts. MUST stay in sync with
// src/content/blog/posts/*.ts + src/content/blog/metadata.ts — if a slug is
// missing here, Googlebot/Bingbot get a 404 even though the React app renders
// fine for humans, and the URL cannot be indexed (verified 2026-04-23 with
// the world-cup-pickleball-2026-da-nang post).

export async function renderBlogPost(supabase: SupabaseClient, slug: string, siteUrl: string): Promise<Response> {
  const meta = BLOG_POST_META[slug];
  if (!meta) return render404(`/blog/${slug}`, siteUrl);

  // Look up Vietnamese alternate (returns null if no VI translation exists).
  // Required for reciprocal hreflang — Ahrefs Site Audit 2026-04-24 flagged
  // "Missing reciprocal hreflang (no return-tag)" because EN page wasn't
  // emitting <link hreflang="vi"> back to its VI counterpart even when one
  // existed. The VI side already emits hreflang en correctly via renderViBlogPost.
  const { data: viPost } = await supabase
    .from("vi_blog_posts")
    .select("slug")
    .eq("alternate_en_slug", slug)
    .eq("status", "published")
    .maybeSingle();

  const enUrl = `${siteUrl}/blog/${slug}`;
  const viSlug = (viPost as { slug: string } | null)?.slug;
  const extraMeta = viSlug
    ? `<link rel="alternate" hreflang="en" href="${enUrl}"/>\n<link rel="alternate" hreflang="vi" href="${siteUrl}/vi/blog/${viSlug}"/>\n<link rel="alternate" hreflang="x-default" href="${enUrl}"/>`
    : `<link rel="alternate" hreflang="en" href="${enUrl}"/>\n<link rel="alternate" hreflang="x-default" href="${enUrl}"/>`;

  const title = buildTitle(meta.title, " | ThePickleHub");
  const crumbs = [{ label: "Home", href: siteUrl }, { label: "Blog", href: `${siteUrl}/blog` }, { label: meta.title }];
  const bc = breadcrumb(crumbs);

  // PR79 Phase 2G (audit I-9 + I-10 + I-17) — bring the EN BlogPosting
  // schema to parity with the VI side (renderViBlogPost). Previously
  // emitted only { headline, description, url, publisher } so EN posts
  // were ineligible for the Article rich card (Google requires
  // datePublished + image + author + publisher.logo for the snippet).
  //
  // VI parity adds:
  //   image           — absolute heroImage URL (DEFAULT_OG_IMAGE fallback)
  //   datePublished   — from BLOG_POST_META (mirrored from src/content/
  //                     blog/posts/<slug>.ts.publishedDate)
  //   dateModified    — same as datePublished for now; we don't track
  //                     the EN updatedDate separately in BLOG_POST_META.
  //                     VI side reads vi_blog_posts.updated_at; can add
  //                     when EN edits start landing.
  //   author          — Organization (matches VI; future per-post bylines
  //                     can override when needed)
  //   publisher.logo  — promote the existing string `logo` field to a
  //                     proper ImageObject so Google's Article validator
  //                     stops flagging "logo must be ImageObject"
  //   inLanguage      — "en-US"
  const blogImage = absImage(meta.image ?? "", siteUrl);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: meta.description,
    image: blogImage,
    url: enUrl,
    author: { "@type": "Person", name: "Cuong Nguyen", url: siteUrl },
    publisher: {
      "@type": "Organization",
      name: "ThePickleHub",
      url: siteUrl,
      logo: { "@type": "ImageObject", url: DEFAULT_OG_IMAGE },
    },
    inLanguage: "en-US",
  };
  if (meta.datePublished) {
    jsonLd.datePublished = meta.datePublished;
    jsonLd.dateModified = meta.dateModified ?? meta.datePublished;
  }

  // SEO-3.1 — wrap BlogPosting + BreadcrumbList in a single @graph.
  // 2026-07-26: FAQPage + HowTo join it when the post declares faqItems /
  // howToSteps. Those answers are now rendered in the body below, which is
  // what Google requires before the markup is eligible.
  const graph: Record<string, unknown>[] = [jsonLd, buildBreadcrumbJsonLd(crumbs)];
  const [body, faqNode, howToNode] = await Promise.all([
    renderEnBlogBody(slug, siteUrl),
    enBlogFaqJsonLd(slug),
    enBlogHowToJsonLd(slug),
  ]);
  if (faqNode) graph.push(faqNode);
  if (howToNode) graph.push(howToNode);
  const blogGraph = { "@context": "https://schema.org", "@graph": graph };

  return htmlResponse(buildHtml({
    title,
    description: meta.description,
    url: enUrl,
    siteUrl,
    image: blogImage,
    type: "article",
    extraMeta,
    omitAutoHeader: true,
    jsonLd: blogGraph,
    // The post's own sections — see blog-body.ts for why this was missing.
    bodyContent: `${bc}${body}${relatedBlogLinks(slug, siteUrl)}`,
  }));
}

export function renderBlog(siteUrl: string): Response {
  // Ordered by the LATER of datePublished/dateModified so a refreshed post
  // resurfaces, matching what Blog.tsx renders for readers. Relying on
  // BLOG_POST_META's insertion order (metadata.ts prepends new entries) used to
  // be equivalent to a publishedDate sort, but that is exactly the ordering the
  // 2026-08-31 change moved away from — leaving it here would have shown
  // Googlebot a different /blog order than readers get. dateModified is absent
  // when it equals datePublished, and effectiveDateMs treats that as 0, so such
  // posts fall back to their publish date. See src/lib/blogOrder.
  const entries = Object.entries(BLOG_POST_META).sort(
    byEffectiveDateDesc(
      ([, m]) => m.datePublished,
      ([, m]) => m.dateModified,
    ),
  );
  const blogLinks = entries.map(([slug, m]) => `<li><a href="${siteUrl}/blog/${slug}">${escapeHtml(m.title)}</a></li>`).join("");

  // SEO audit 2026-08-11 — the EN blog index emitted zero JSON-LD. Add an
  // ItemList of the posts + a BreadcrumbList so the index carries entity
  // context (matches the ItemList convention used by social-list / venues).
  const crumbs = [{ label: "Home", href: siteUrl }, { label: "Blog" }];
  const blogIndexJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: "Pickleball Blog – Tips & Guides",
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: entries.length,
        itemListElement: entries.map(([slug, m], i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${siteUrl}/blog/${slug}`,
          name: m.title,
        })),
      },
      buildBreadcrumbJsonLd(crumbs),
    ],
  };

  return htmlResponse(buildHtml({
    title: "Pickleball Blog – Tips & Guides | ThePickleHub",
    description: "Read the latest pickleball articles: tournament tips, software reviews, strategy guides and community stories on ThePickleHub.",
    url: `${siteUrl}/blog`,
    siteUrl,
    // SEO-1.2 — emit hreflang to /vi/blog (Vietnamese index)
    extraMeta: bilingualHreflang(`${siteUrl}/blog`, `${siteUrl}/vi/blog`),
    jsonLd: blogIndexJsonLd,
    bodyContent: `<h2>Blog Posts</h2><ul>${blogLinks}</ul>`,
  }));
}

// ─── Vietnamese Blog (database) ───────────────────────────

// Audit 2026-08-25, H1 — the VI article body reached Googlebot with no <img>
// at all. 57 of 66 published posts carry a cover_image_url that until now only
// fed og:image and the BlogPosting schema, neither of which puts the asset in
// the indexable HTML.
//
// Placed after the <h1> that lives inside content_html (falls back to the top
// of the article when a post has none) and skipped entirely when the editor
// already embedded that same image, so re-running the translation pipeline
// cannot double it up.
export function withViCoverImage(
  contentHtml: string,
  coverImageUrl: string | null | undefined,
  title: string,
): string {
  if (!coverImageUrl) return contentHtml;
  const src = normalizeImageUrl(coverImageUrl);
  if (!src || contentHtml.includes(src)) return contentHtml;
  const dims = blogImageDims(src);
  const sized = dims ? ` width="${dims[0]}" height="${dims[1]}"` : "";
  const figure =
    `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(title)}"${sized}` +
    ` loading="eager" fetchpriority="high" decoding="async"/></figure>`;
  const afterH1 = contentHtml.indexOf("</h1>");
  return afterH1 === -1
    ? `${figure}${contentHtml}`
    : `${contentHtml.slice(0, afterH1 + 5)}${figure}${contentHtml.slice(afterH1 + 5)}`;
}

export async function renderViBlogPost(supabase: SupabaseClient, slug: string, siteUrl: string): Promise<Response> {
  // Fire post + related queries in parallel — `related` doesn't depend on
  // post data (filters by slug !== current), so waiting for post first is
  // wasted latency. Saves ~200-300ms for bot-prerender on cold cache.
  const [postRes, relatedRes] = await Promise.all([
    supabase
      .from("vi_blog_posts")
      .select("title, meta_title, meta_description, content_html, cover_image_url, faq_items, alternate_en_slug, published_at, updated_at")
      .eq("slug", slug)
      .eq("status", "published")
      .single(),
    supabase
      .from("vi_blog_posts")
      .select("slug, title")
      .eq("status", "published")
      .neq("slug", slug)
      .limit(3),
  ]);
  const post = postRes.data;

  // C1 (2026-07-27) — /vi/blog/<EN-slug> was a hard 404 for bots and a soft
  // 404 for humans. src/pages/Index.tsx built every VI story href from the EN
  // metadata slug (`/vi/blog/${p.slug}`), so ALL SIX homepage cards on /vi
  // pointed at dead URLs. Verified on prod: /vi/blog/hcmc-open-2026-preview
  // → 404 while /vi/blog/hcmc-open-2026 → 200.
  //
  // Fixed here rather than at each link site because the broken hrefs are
  // already indexed and already shared; a caller-side fix leaves every old
  // link dead. This also removes the need to keep appending self-mapping
  // entries to VI_BLOG_REDIRECTS in _middleware.ts by hand.
  //
  // Redirect target order matters: a Vietnamese reader who asked for a VI URL
  // should land on the VI article, not the English one. Only fall back to the
  // EN post when no translation exists.
  //
  // Safe to key on the EN slug: verified 2026-07-27 that 0 of 53 published
  // vi_blog_posts slugs collide with any of the 47 EN slugs, so this branch
  // can never shadow a real VI post. The extra query only runs on the miss
  // path (a request that was going to 404 anyway).
  if (!post) {
    const { data: twin } = await supabase
      .from("vi_blog_posts")
      .select("slug")
      .eq("alternate_en_slug", slug)
      .eq("status", "published")
      .limit(1)
      .maybeSingle();

    // Plain Response, not _middleware's secureRedirect(): that helper is
    // module-private there, and the middleware already copies our headers and
    // runs applySecurityHeaders() over them before returning (see the MISS
    // branch). Non-200 is never written to the KV prerender cache.
    if (twin?.slug) {
      return new Response(null, {
        status: 301,
        headers: { Location: `${siteUrl}/vi/blog/${twin.slug}` },
      });
    }
    if (BLOG_POST_META[slug]) {
      return new Response(null, {
        status: 301,
        headers: { Location: `${siteUrl}/blog/${slug}` },
      });
    }
    return render404(`/vi/blog/${slug}`, siteUrl);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = post as any;
  const url = `${siteUrl}/vi/blog/${slug}`;

  // VI-first posts (no EN counterpart) still need a self-referencing hreflang
  // set, mirroring the EN-side fallback in renderBlogPost. Without it, VI-first
  // pages (/vi/blog/san-pickleball-tphcm, .../san-pickleball-da-nang) emitted
  // canonical only (zero hreflang), flagged 2026-07-01.
  let extraMeta = p.alternate_en_slug
    ? `<link rel="alternate" hreflang="en" href="${siteUrl}/blog/${p.alternate_en_slug}"/>\n<link rel="alternate" hreflang="vi" href="${url}"/>\n<link rel="alternate" hreflang="x-default" href="${siteUrl}/blog/${p.alternate_en_slug}"/>`
    : `<link rel="alternate" hreflang="vi" href="${url}"/>\n<link rel="alternate" hreflang="x-default" href="${url}"/>`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.meta_description,
    image: absImage(p.cover_image_url, siteUrl),
    datePublished: p.published_at,
    dateModified: p.updated_at,
    author: { "@type": "Person", name: "Cuong Nguyen", url: siteUrl },
    publisher: { "@type": "Organization", name: "ThePickleHub", logo: { "@type": "ImageObject", url: DEFAULT_OG_IMAGE } },
    inLanguage: "vi-VN",
  };
  extraMeta += `\n<script type="application/ld+json">${escapeJsonLd(JSON.stringify(articleSchema))}</script>`;

  if (p.faq_items && Array.isArray(p.faq_items) && p.faq_items.length > 0) {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.faq_items.map((item: { question: string; answer: string }) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    };
    extraMeta += `\n<script type="application/ld+json">${escapeJsonLd(JSON.stringify(faqSchema))}</script>`;
  }

  const bc = breadcrumb([{ label: "Trang chủ", href: `${siteUrl}/vi` }, { label: "Blog", href: `${siteUrl}/vi/blog` }, { label: p.title }]);

  const relatedItems = (relatedRes.data || []) as { slug: string; title: string }[];
  const relatedSection = relatedItems.length > 0
    ? `<section><h2>Bài viết liên quan</h2><ul>${relatedItems.map((r) => `<li><a href="${siteUrl}/vi/blog/${r.slug}">${escapeHtml(r.title)}</a></li>`).join("")}</ul></section>`
    : "";

  return htmlResponse(buildHtml({
    title: buildTitle(p.meta_title.replace(/ \| ThePickleHub$/, "")),
    description: p.meta_description,
    url,
    siteUrl,
    image: absImage(p.cover_image_url, siteUrl),
    type: "article",
    lang: "vi",
    extraMeta,
    bodyContent: `${bc}<article>${withViCoverImage(sanitizeBlogHtml(normalizeImagesInHtml(p.content_html)), p.cover_image_url, p.title)}</article>${relatedSection}`,
  }));
}

export async function renderViBlogIndex(supabase: SupabaseClient, siteUrl: string): Promise<Response> {
  // Ordered by the LATER of published/updated so a refreshed post resurfaces
  // here the same way it does for readers. See src/lib/blogOrder.
  const { data: posts } = await supabase.from("vi_blog_posts").select("slug, title, excerpt, published_at, updated_at").eq("status", "published").order("published_at", { ascending: false }).limit(60);
  const rows = ((posts || []) as {
    slug: string;
    title: string;
    excerpt: string | null;
    published_at: string | null;
    updated_at: string | null;
  }[])
    .sort(byEffectiveDateDesc((p) => p.published_at, (p) => p.updated_at))
    .slice(0, 20);
  const items = rows.map((p) => `<li><a href="${siteUrl}/vi/blog/${p.slug}">${escapeHtml(p.title)}</a><p>${escapeHtml(p.excerpt || "")}</p></li>`).join("");

  // SEO audit 2026-08-11 — mirror the EN /blog fix: emit an ItemList of the
  // VI posts + BreadcrumbList so /vi/blog carries entity context.
  const viCrumbs = [{ label: "Trang chủ", href: `${siteUrl}/vi` }, { label: "Blog" }];
  const viBlogIndexJsonLd = rows.length > 0
    ? {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "ItemList",
            name: "Blog Pickleball Việt Nam",
            itemListOrder: "https://schema.org/ItemListOrderDescending",
            numberOfItems: rows.length,
            itemListElement: rows.map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${siteUrl}/vi/blog/${p.slug}`,
              name: p.title,
            })),
          },
          buildBreadcrumbJsonLd(viCrumbs),
        ],
      }
    : undefined;

  return htmlResponse(buildHtml({
    title: "Blog Pickleball Việt Nam | ThePickleHub",
    description: "Đọc blog pickleball Việt Nam: luật chơi, kỹ thuật, sân chơi, giải đấu, và mọi điều về cộng đồng pickleball Việt từ ThePickleHub.",
    url: `${siteUrl}/vi/blog`,
    siteUrl,
    lang: "vi",
    // SEO-1.2 — reciprocal hreflang back to EN /blog (mirror of renderBlog).
    // Without this the VI index emitted zero hreflang while /blog already
    // pointed here, so Google dropped the one-way signal.
    extraMeta: bilingualHreflang(`${siteUrl}/blog`, `${siteUrl}/vi/blog`),
    jsonLd: viBlogIndexJsonLd,
    bodyContent: items ? `<ul>${items}</ul>` : "",
  }));
}
