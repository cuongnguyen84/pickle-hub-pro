/**
 * SSR render handlers — news list + news article pages.
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import {
  escapeHtml,
  buildTitle,
  SITE_NAME,
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
    .select(
      "id, title, summary, source, category, image_url, language, slug, published_at, updated_at, parent_news_id, ai_translated, content_html"
    )
    .eq("language", language)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!row) return render404(canonicalPath, siteUrl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = row as any;

  // C3 (2026-08-25) — the EN news feed is noindex; the VI feed is kept.
  //
  // Every article in this table is a third-party piece the fetcher pulled in,
  // so an EN page competes head-on with the publisher it was taken from: same
  // content, published later, far less authority. The VI page is a different
  // proposition — a Vietnamese rendering of something that exists only in
  // English is a real service to a ~95%-Vietnamese audience.
  //
  // GSC, 2026-05-23..08-22: the whole /news/ segment earned 48 clicks and 447
  // impressions from 12 pages out of 1,551, and every page in that set we
  // could attribute was a /vi/ one. So this costs no measured traffic while
  // removing 746 duplicate URLs — 19% of the index — from the scaled-content
  // exposure. Full workings in thepicklehub.net-audit/ACTION-PLAN.md (C3).
  //
  // noindex,follow rather than nofollow: the related-news strip and the /news
  // hub should still pass equity, and Google has to keep crawling these to
  // keep seeing the directive — which is also why /news/ must stay OUT of
  // robots.txt. Disallow would freeze the current indexed state instead.
  const robotsMeta =
    language === "en" ? `<meta name="robots" content="noindex, follow"/>` : "";

  // A noindexed URL must not sit in an hreflang cluster: Google mishandles or
  // drops the whole cluster when one member is unindexable. The VI page
  // therefore self-references, and the EN page emits no hreflang at all. This
  // also removes the sibling lookup that used to run on every news render —
  // one fewer Supabase round trip per page.
  const hreflangs =
    language === "vi"
      ? [
          `<link rel="alternate" hreflang="vi" href="${siteUrl}${canonicalPath}"/>`,
          `<link rel="alternate" hreflang="x-default" href="${siteUrl}${canonicalPath}"/>`,
        ]
      : [];
  const extraMeta = [robotsMeta, ...hreflangs].filter(Boolean).join("\n");

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

  const publishedIso = typeof r.published_at === "string" ? r.published_at : "";
  const publishedLabel = formatNewsDate(publishedIso, language);

  // GEO dateline (CLAUDE.md, rule since 2026-08-14). Two jobs:
  //
  //   1. Names ThePickleHub inside the opening passage. AI search cites
  //      PASSAGES, not pages — a snippet lifted from the top of this article
  //      previously carried no attributable brand, so an assistant quoting it
  //      had nothing to credit. One mention, not stuffed.
  //   2. Emits a visible, machine-readable date. dateModified already ships in
  //      JSON-LD; a human-visible dateline is what freshness heuristics and
  //      the reader both look for.
  //
  // The source stays PLAIN TEXT on purpose. The origin link is a private
  // column, never selected on a public surface — see
  // src/lib/__tests__/news-editorial-surfaces.test.ts, which pins both that
  // and the no-outbound-CTA rule across the client and SSR surfaces. These
  // articles are original rewrites, not syndicated copies, so they credit the
  // publisher by name without shipping readers back out to it.
  const sourceLabel = language === "vi" ? "Nguồn" : "Source";
  const sourceName = escapeHtml(r.source || "Wire");
  const dateline =
    `<p class="dateline">${escapeHtml(SITE_NAME)}` +
    (publishedLabel ? ` · <time datetime="${escapeHtml(publishedIso)}">${escapeHtml(publishedLabel)}</time>` : "") +
    ` · ${sourceLabel}: ${sourceName}</p>`;
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
  // text plus a hub CTA and a handful of sibling links.
  //
  // The inbound-link half of that claim did NOT hold as originally written —
  // see below.
  // 2026-08-28 — this strip used to be a bare `order(published_at desc)
  // .limit(6)`, which meant EVERY article linked to the SAME six newest
  // items. 843 VI articles pointed at six URLs; the other 837 received no
  // inbound link at all, and Ahrefs reported 823 of them as orphans. Worse,
  // it self-renewed: publishing anything demoted yesterday's six straight
  // back into orphanhood, so the set could never accumulate.
  //
  // The fix is to make the neighbours RELATIVE to this article instead of
  // absolute. prev/next by published_at chain every article to the ones
  // either side of it, so each item is inbound-linked by its neighbours and
  // no position in the timeline is ever stranded. Category matches add
  // topical relevance, and a small freshness tail keeps the newest items
  // reachable from anywhere. Everything is deduped against the current slug.
  type NewsNeighbour = { slug: string; title: string; published_at: string };
  const neighbourCols = "slug, title, published_at";
  const baseQuery = () =>
    supabase
      .from("news_items")
      .select(neighbourCols)
      .eq("language", language)
      .eq("status", "published")
      .neq("slug", slug);

  // Every bucket except `latest` is anchored to THIS article's position, and
  // `latest` is capped at one. That cap matters: a freshness tail of three
  // reintroduced the original failure in miniature — three of the eight slots
  // on all 843 pages pointed at the same three URLs — which the "different
  // neighbours" test catches by measuring the overlap between two articles
  // far apart in the timeline. Category matches are drawn from BEFORE this
  // article rather than from the global newest, for the same reason.
  const [prevRes, nextRes, catRes, latestRes] = await Promise.all([
    baseQuery().lt("published_at", r.published_at).order("published_at", { ascending: false }).limit(3),
    baseQuery().gt("published_at", r.published_at).order("published_at", { ascending: true }).limit(3),
    r.category
      ? baseQuery()
          .eq("category", r.category)
          .lt("published_at", r.published_at)
          .order("published_at", { ascending: false })
          .limit(2)
      : Promise.resolve({ data: [] as NewsNeighbour[] }),
    baseQuery().order("published_at", { ascending: false }).limit(1),
  ]);

  const seen = new Set<string>([slug]);
  const related: NewsNeighbour[] = [];
  // Order matters: the prev/next chain is what actually removes orphans, so
  // it is picked before the topical and freshness fillers compete for slots.
  for (const bucket of [prevRes?.data, nextRes?.data, catRes?.data, latestRes?.data]) {
    for (const row of (bucket || []) as NewsNeighbour[]) {
      if (!row?.slug || seen.has(row.slug)) continue;
      seen.add(row.slug);
      related.push(row);
      if (related.length >= 8) break;
    }
    if (related.length >= 8) break;
  }
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
    bodyContent: `${bc}<article><h1>${escapeHtml(r.title)}</h1>${dateline}${articleBody}</article>${relatedSection}`,
    // The body already opens with its own <h1>; without this the shared
    // auto-header adds a second one titled "<title> | ThePickleHub".
    omitAutoHeader: true,
  }));
}

export async function renderNewsPost(supabase: SupabaseClient, slug: string, siteUrl: string): Promise<Response> {
  return renderNewsArticleByLang(supabase, slug, "en", siteUrl);
}

export async function renderViNewsPost(supabase: SupabaseClient, slug: string, siteUrl: string): Promise<Response> {
  return renderNewsArticleByLang(supabase, slug, "vi", siteUrl);
}

/**
 * Visible dateline text. Deliberately not Intl: the prerender runs in a
 * Workers isolate whose ICU data we do not control, and a dateline that
 * silently renders differently there than in tests is worse than a plain one.
 */
const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatNewsDate(iso: string, language: "en" | "vi"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getUTCDate();
  const month = d.getUTCMonth();
  const year = d.getUTCFullYear();
  return language === "vi"
    ? `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`
    : `${EN_MONTHS[month]} ${day}, ${year}`;
}
