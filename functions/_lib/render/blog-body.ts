// ============================================================================
// EN blog post body → bot-visible HTML + FAQPage schema.
// ----------------------------------------------------------------------------
// Until 2026-07-26 renderBlogPost served Googlebot `breadcrumb + 3 related
// links` and nothing else: ~0.9 KB of <main> per post, versus 8.4 KB for the
// Vietnamese twins (which read content_html straight from Supabase). Measured
// on prod with `curl -A Googlebot`. Every English post's actual content was
// invisible on the SSR path, which is the likeliest reason EN guides rank
// 50–60 with zero informational-query impressions while the same content in
// Vietnamese ranks.
//
// The post bodies already live in src/content/blog/posts/*.ts. This module
// renders the EN half of one to HTML at request time — same
// generate-at-module-load boundary blog-meta.ts already crosses (SEO-02), no
// second copy of the content to keep in sync.
// ============================================================================

import type { BlogPost, BlogPostContent } from "../../../src/content/blog/types";
import { loadBlogPost } from "../../../src/content/blog/posts/all";
import { BLOG_IMAGE_DIMS, blogImageDims } from "../../../src/content/blog/image-dims";
import { escapeHtml } from "../utils";

// Audit 2026-08-25, H1: the bot HTML carried no <img> at all — 132 of 135
// crawled pages, because the prerender ships no app JS and every image on the
// site is mounted by React. An image that never reaches the crawler cannot be
// indexed by Google Images and cannot carry a post into Discover, so the two
// surfaces where we own a real asset (the EN hero from metadata.ts, the VI
// cover from vi_blog_posts.cover_image_url) now render server-side.
//
// width/height come from the generated map, never from a constant: the assets
// range from 1024x1536 to 1731x909 and a wrong ratio is worse than none.

/** `<img>` attributes for a blog asset — dimensions + responsive candidates. */
export function blogImageAttrs(src: string): string {
  const dims = blogImageDims(src);
  const sized = dims ? ` width="${dims[0]}" height="${dims[1]}"` : "";
  const small = src.replace(/\.webp$/, "-768.webp");
  const responsive =
    src !== small && BLOG_IMAGE_DIMS[small]
      ? ` srcset="${escapeHtml(small)} 768w, ${escapeHtml(src)} ${dims ? dims[0] : 1600}w"` +
        ` sizes="(max-width: 900px) 100vw, 832px"`
      : "";
  return `${sized}${responsive}`;
}

/**
 * Hero `<figure>` for the top of an article. `loading="eager"` +
 * `fetchpriority="high"` because this is the LCP candidate on the human path
 * too — the same markup shape the SPA renders.
 */
export function heroFigure(image: { src: string; alt: string } | undefined): string {
  if (!image?.src) return "";
  return (
    `<figure><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}"` +
    `${blogImageAttrs(image.src)} loading="eager" fetchpriority="high" decoding="async"/></figure>`
  );
}

/** A list item is written as "Label — rest"; bold the label like the SPA does. */
function renderListItem(item: string): string {
  const split = item.match(/^(.{1,80}?)\s+—\s+([\s\S]+)$/);
  return split
    ? `<li><strong>${escapeHtml(split[1])}</strong> — ${escapeHtml(split[2])}</li>`
    : `<li>${escapeHtml(item)}</li>`;
}

// An absolute URL in `internalLinks` used to be concatenated onto siteUrl,
// so `https://ticketbox.vn/...` shipped to Googlebot as
// `https://www.thepicklehub.nethttps://ticketbox.vn/...` — a silently broken
// href with no error and no test covering it. The client never had this bug:
// react-router-dom 6.30.4 detects a cross-origin absolute `to` and renders a
// plain <a href> (dist/index.js:744-795), so only the SSR side diverged.
//
// escapeHtml on BOTH branches — the value goes inside an attribute and real
// ticketing URLs carry query strings.
//
// rel="nofollow noopener" on outbound only. Deliberately NOT "sponsored":
// that claims paid placement, which is not true of every external link, and
// this helper cannot tell them apart. A genuinely sponsored link belongs in a
// VI post's hand-written content_html where the rel can be exact.
export function renderSectionLink(siteUrl: string, l: { text: string; path: string }): string {
  const isExternal = /^https?:\/\//i.test(l.path);
  const href = escapeHtml(isExternal ? l.path : `${siteUrl}${l.path}`);
  const rel = isExternal ? ` rel="nofollow noopener"` : "";
  return `<li><a href="${href}"${rel}>${escapeHtml(l.text)}</a></li>`;
}

function renderSections(
  content: BlogPostContent,
  siteUrl: string,
  liveBlocks: Record<string, string> = {},
): string {
  const out: string[] = [];
  for (const s of content.sections) {
    out.push(`<h2>${escapeHtml(s.heading)}</h2>`);
    out.push(`<p>${escapeHtml(s.content)}</p>`);
    if (s.listItems?.length) {
      out.push(`<ul>${s.listItems.map(renderListItem).join("")}</ul>`);
    }
    if (s.orderedList?.length) {
      out.push(`<ol>${s.orderedList.map(renderListItem).join("")}</ol>`);
    }
    if (s.table?.headers?.length) {
      const cap = s.table.caption ? `<caption>${escapeHtml(s.table.caption)}</caption>` : "";
      const head = `<thead><tr>${s.table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>`;
      const rows = s.table.rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("");
      out.push(`<table>${cap}${head}<tbody>${rows}</tbody></table>`);
    }
    if (s.image?.src) {
      out.push(
        `<figure><img src="${escapeHtml(s.image.src)}" alt="${escapeHtml(s.image.alt)}"` +
          `${blogImageAttrs(s.image.src)} loading="lazy" decoding="async"/>` +
          (s.image.caption ? `<figcaption>${escapeHtml(s.image.caption)}</figcaption>` : "") +
          `</figure>`,
      );
    }
    if (s.internalLinks?.length) {
      out.push(
        `<ul>${s.internalLinks.map(renderSectionLink.bind(null, siteUrl)).join("")}</ul>`,
      );
    }
    // A live block is data the post cannot hold: the caller fetches it and
    // passes the HTML in, so this module stays free of Supabase. Missing key
    // (feed empty, or the query failed) renders nothing — the prose around it
    // still stands on its own, which is why the block never carries the only
    // copy of a fact the page claims.
    if (s.liveBlock && liveBlocks[s.liveBlock]) {
      out.push(liveBlocks[s.liveBlock]);
    }
  }
  return out.join("\n");
}

function renderFaq(content: BlogPostContent): string {
  if (!content.faqItems?.length) return "";
  const items = content.faqItems
    .map((f) => `<h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p>`)
    .join("");
  return `<section><h2>Frequently asked questions</h2>${items}</section>`;
}

/**
 * Bot-visible article HTML for an EN post, or "" when the slug has no post
 * module (BLOG_POST_META is generated from metadata.ts, so a metadata entry
 * without a post file would otherwise 500 here — blog-sync.test.ts already
 * fails CI on that combination, this is belt-and-braces).
 */
export async function renderEnBlogBody(
  slug: string,
  siteUrl: string,
  liveBlocks: Record<string, string> = {},
): Promise<string> {
  const post: BlogPost | undefined = await loadBlogPost(slug);
  if (!post) return "";
  const en = post.content.en;
  return (
    `<article><h1>${escapeHtml(en.title)}</h1>${heroFigure(post.heroImage)}` +
    `${renderSections(en, siteUrl, liveBlocks)}${renderFaq(en)}</article>`
  );
}

/** FAQPage node for the @graph, or null when the post has no FAQ. */
export async function enBlogFaqJsonLd(slug: string): Promise<Record<string, unknown> | null> {
  const faq = (await loadBlogPost(slug))?.content.en.faqItems;
  if (!faq?.length) return null;
  return {
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/** HowTo node for the @graph, or null when the post has no howToSteps. */
export async function enBlogHowToJsonLd(slug: string): Promise<Record<string, unknown> | null> {
  const post = await loadBlogPost(slug);
  const steps = post?.content.en.howToSteps;
  if (!steps?.length) return null;
  return {
    "@type": "HowTo",
    name: post.content.en.title,
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}
