/**
 * SSR render handlers — news list + news article pages.
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import {
  escapeHtml,
  buildTitle,
  buildMetaDescription,
  absImage,
  breadcrumb,
  bilingualHreflang,
  DEFAULT_OG_IMAGE,
  sanitizeBlogHtml,
} from "../utils";
import { buildListJsonLd } from "./shared";
import { render404 } from "./static-pages";

export async function renderNews(supabase: SupabaseClient, siteUrl: string, rawPath = "/news", lang: "en" | "vi" = "en"): Promise<Response> {
  const { data: news } = await supabase
    .from("news_items")
    .select("id, title, summary, slug, language")
    .eq("status", "published")
    .eq("language", lang)
    .order("published_at", { ascending: false })
    .limit(20);
  const items = (news || []).map((n) =>
    `<li><a href="${siteUrl}${lang === "en" ? "" : "/vi"}/news/${escapeHtml(n.slug)}">${escapeHtml(n.title)}</a>${
      n.summary ? `: ${escapeHtml(n.summary.slice(0, 80))}` : ""
    }</li>`,
  ).join("");
  const listItems = (news || []).map((n) => ({
    url: `${siteUrl}${lang === "en" ? "" : "/vi"}/news/${n.slug}`,
    name: n.title,
  }));

  const title = lang === "en"
    ? "Pickleball News — Vietnam & Asia | ThePickleHub"
    : "Tin tức Pickleball | ThePickleHub";
  const description = lang === "en"
    ? "Latest pickleball news from Vietnam, PPA Tour Asia, MLP, the Pickleball World Cup, and the regional pro circuit — curated by ThePickleHub."
    : "Tin pickleball mới nhất Việt Nam và thế giới: PPA Tour Asia, World Cup, sự kiện cộng đồng, phân tích chuyên sâu — ThePickleHub.";

  return htmlResponse(buildHtml({
    title,
    description,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    extraMeta: bilingualHreflang(`${siteUrl}/news`, `${siteUrl}/vi/news`),
    jsonLd: buildListJsonLd(title, listItems),
    bodyContent: items ? `<h2>${lang === "en" ? "News" : "Tin tức"}</h2><ul>${items}</ul>` : "",
    lang,
  }));
}

// ─── News article detail (Phase 4 hot-fix 2026-05-19) ─────────
// Bot prerender for /news/:slug + /vi/news/:slug. Codex flagged that the
// SPA routes existed but the middleware fell through to render404, so
// crawlers couldn't see the per-article HTML. We emit NewsArticle JSON-LD
// plus the standard meta + hreflang pair (EN ↔ VI via parent_news_id).

async function renderNewsArticleByLang(
  supabase: SupabaseClient,
  slug: string,
  language: "en" | "vi",
  siteUrl: string
): Promise<Response> {
  const canonicalPath =
    language === "vi" ? `/vi/news/${slug}` : `/news/${slug}`;

  const { data: row } = await supabase
    .from("news_items")
    .select("id, title, summary, source, image_url, language, slug, published_at, updated_at, parent_news_id, ai_translated, content_html")
    .eq("language", language)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!row) return render404(canonicalPath, siteUrl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = row as any;

  let siblingSlug: string | null = null;
  if (language === "en") {
    const { data: vi } = await supabase
      .from("news_items")
      .select("slug")
      .eq("parent_news_id", r.id)
      .eq("language", "vi")
      .eq("status", "published")
      .maybeSingle();
    siblingSlug = (vi as { slug: string } | null)?.slug ?? null;
  } else if (r.parent_news_id) {
    const { data: en } = await supabase
      .from("news_items")
      .select("slug")
      .eq("id", r.parent_news_id)
      .eq("language", "en")
      .eq("status", "published")
      .maybeSingle();
    siblingSlug = (en as { slug: string } | null)?.slug ?? null;
  }

  const enUrl = language === "en"
    ? `${siteUrl}${canonicalPath}`
    : siblingSlug
      ? `${siteUrl}/news/${siblingSlug}`
      : null;
  const viUrl = language === "vi"
    ? `${siteUrl}${canonicalPath}`
    : siblingSlug
      ? `${siteUrl}/vi/news/${siblingSlug}`
      : null;

  const hreflangs: string[] = [];
  if (enUrl) hreflangs.push(`<link rel="alternate" hreflang="en" href="${enUrl}"/>`);
  if (viUrl) hreflangs.push(`<link rel="alternate" hreflang="vi" href="${viUrl}"/>`);
  hreflangs.push(`<link rel="alternate" hreflang="x-default" href="${enUrl ?? `${siteUrl}${canonicalPath}`}"/>`);
  const extraMeta = hreflangs.join("\n");

  const title = buildTitle(r.title, " | ThePickleHub");
  const description = buildMetaDescription(r.summary, { type: "default", title: r.title });
  const image = absImage(r.image_url || "", siteUrl);
  const url = `${siteUrl}${canonicalPath}`;

  const newsListLabel = language === "vi" ? "Tin tức" : "News";
  const homeLabel = language === "vi" ? "Trang chủ" : "Home";
  const bc = breadcrumb([
    { label: homeLabel, href: siteUrl },
    { label: newsListLabel, href: `${siteUrl}${language === "vi" ? "/vi/news" : "/news"}` },
    { label: r.title.length > 60 ? r.title.slice(0, 60) + "…" : r.title },
  ]);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: r.title,
    description: r.summary,
    url,
    datePublished: r.published_at,
    dateModified: r.updated_at,
    image: image || DEFAULT_OG_IMAGE,
    author: { "@type": "Organization", name: "ThePickleHub Editorial", url: siteUrl },
    publisher: {
      "@type": "Organization",
      name: "ThePickleHub",
      url: siteUrl,
      logo: { "@type": "ImageObject", url: DEFAULT_OG_IMAGE },
    },
    inLanguage: language === "vi" ? "vi-VN" : "en-US",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  const sourceLabel = language === "vi" ? "Nguồn" : "Source";
  const sourceAttribution =
    `<p><strong>${sourceLabel}:</strong> ${escapeHtml(r.source || "Wire")}</p>`;
  const articleBody = r.content_html
    ? sanitizeBlogHtml(r.content_html)
    : `<p>${escapeHtml(r.summary)}</p>`;

  // SEO audit 2026-05-28 (batch 8) — Related news strip.
  // News articles ship with only a title + 1-2 sentence summary (auto-
  // translated by news-translate edge fn), which lands the page in
  // SEOnaut's 'Pages with little content' (414 URLs) and 'Orphan pages'
  // (281 URLs, ~100 on /vi/news alone) buckets. Fetching 6 sibling
  // news items in the same language and rendering them as a linked
  // list at the bottom of every news SSR addresses both reports in
  // one place: each article now carries ~600 chars of extra body
  // text and 7 internal links (6 related + 1 hub CTA), which means
  // every news page is both substantial enough to clear the
  // little-content threshold and inbound-linked from up to 6 other
  // news pages.
  const { data: relatedRows } = await supabase
    .from("news_items")
    .select("slug, title, published_at")
    .eq("language", language)
    .eq("status", "published")
    .neq("slug", slug)
    .order("published_at", { ascending: false })
    .limit(6);
  const related = (relatedRows || []) as Array<{ slug: string; title: string; published_at: string }>;
  const newsHub = language === "vi" ? `${siteUrl}/vi/news` : `${siteUrl}/news`;
  const newsBase = language === "vi" ? `${siteUrl}/vi/news/` : `${siteUrl}/news/`;
  const relatedHeading = language === "vi" ? "Tin pickleball mới nhất" : "Latest pickleball news";
  const moreLabel = language === "vi" ? "Xem tất cả tin pickleball" : "See all pickleball news";
  const relatedItems = related
    .map((n) => `<li><a href="${newsBase}${escapeHtml(n.slug)}">${escapeHtml(n.title)}</a></li>`)
    .join("");
  const relatedSection = relatedItems
    ? `<aside><h2>${escapeHtml(relatedHeading)}</h2><ul>${relatedItems}</ul><p><a href="${newsHub}">${escapeHtml(moreLabel)} →</a></p></aside>`
    : "";

  return htmlResponse(buildHtml({
    title,
    description,
    url,
    siteUrl,
    image: image || undefined,
    type: "article",
    extraMeta,
    jsonLd,
    lang: language,
    bodyContent: `${bc}<article><h1>${escapeHtml(r.title)}</h1>${sourceAttribution}${articleBody}</article>${relatedSection}`,
  }));
}

export async function renderNewsPost(supabase: SupabaseClient, slug: string, siteUrl: string): Promise<Response> {
  return renderNewsArticleByLang(supabase, slug, "en", siteUrl);
}

export async function renderViNewsPost(supabase: SupabaseClient, slug: string, siteUrl: string): Promise<Response> {
  return renderNewsArticleByLang(supabase, slug, "vi", siteUrl);
}
