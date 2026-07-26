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
import { escapeHtml } from "../utils";

/** A list item is written as "Label — rest"; bold the label like the SPA does. */
function renderListItem(item: string): string {
  const split = item.match(/^(.{1,80}?)\s+—\s+([\s\S]+)$/);
  return split
    ? `<li><strong>${escapeHtml(split[1])}</strong> — ${escapeHtml(split[2])}</li>`
    : `<li>${escapeHtml(item)}</li>`;
}

function renderSections(content: BlogPostContent, siteUrl: string): string {
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
    if (s.image?.src) {
      out.push(
        `<figure><img src="${escapeHtml(s.image.src)}" alt="${escapeHtml(s.image.alt)}" loading="lazy"/>` +
          (s.image.caption ? `<figcaption>${escapeHtml(s.image.caption)}</figcaption>` : "") +
          `</figure>`,
      );
    }
    if (s.internalLinks?.length) {
      out.push(
        `<ul>${s.internalLinks
          .map((l) => `<li><a href="${siteUrl}${escapeHtml(l.path)}">${escapeHtml(l.text)}</a></li>`)
          .join("")}</ul>`,
      );
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
export async function renderEnBlogBody(slug: string, siteUrl: string): Promise<string> {
  const post: BlogPost | undefined = await loadBlogPost(slug);
  if (!post) return "";
  const en = post.content.en;
  return `<article>${renderSections(en, siteUrl)}${renderFaq(en)}</article>`;
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
