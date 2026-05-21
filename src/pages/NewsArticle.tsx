import { useEffect } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DynamicMeta,
  HreflangTags,
  BreadcrumbSchema,
  ArticleSchema,
} from "@/components/seo";
import {
  useNewsItemBySlug,
  useNewsItemSibling,
} from "@/hooks/useNewsItemBySlug";
import { formatRelative } from "./preview/_shell";

/**
 * /news/:slug + /vi/news/:slug — News article detail page.
 *
 * News items are *aggregated headlines* (snippet + link out) — we do not
 * republish full article bodies for copyright reasons. The page renders:
 *   - Hero image (from the source's OG tag, stored verbatim in image_url)
 *   - Title + summary (≤ 300 chars per Phase 1 schema)
 *   - Big "Read full article at {source}" CTA → out to source_url
 *   - hreflang link to the EN↔VI sibling (parent_news_id pivot)
 *   - Schema.org NewsArticle JSON-LD
 *
 * Routes are wired in src/App.tsx:
 *   /news/:slug      → <NewsArticle language="en">
 *   /vi/news/:slug   → <NewsArticle language="vi">
 *
 * Note on EN/VI selection: rather than forcing a prop, we infer the
 * language from the URL pathname so the same component handles both.
 */
type Props = { language: "en" | "vi" };

const NewsArticle = ({ language }: Props) => {
  const { slug } = useParams<{ slug: string }>();
  const { setLanguageFromUrl } = useI18n();

  useEffect(() => {
    setLanguageFromUrl(language);
  }, [language, setLanguageFromUrl]);

  const { data: article, isLoading } = useNewsItemBySlug(slug, language);
  const { data: siblingSlug } = useNewsItemSibling(
    article?.id,
    language,
    article?.parent_news_id ?? null
  );

  if (isLoading) {
    return (
      <TheLineLayout
        title={language === "vi" ? "Đang tải…" : "Loading…"}
        active="news"
      >
        <div
          className="tl-shell"
          style={{ maxWidth: 880, paddingTop: 32, paddingBottom: 80 }}
        >
          <Skeleton className="h-6 w-24 mb-6" />
          <Skeleton className="h-12 w-full mb-3" />
          <Skeleton className="h-12 w-3/4 mb-6" />
          <Skeleton className="h-72 w-full mb-10 rounded-xl" />
        </div>
      </TheLineLayout>
    );
  }

  if (!article) {
    return <Navigate to={language === "vi" ? "/vi/news" : "/news"} replace />;
  }

  const homePath = language === "vi" ? "/vi" : "/";
  const newsListPath = language === "vi" ? "/vi/news" : "/news";
  const canonicalPath =
    language === "vi" ? `/vi/news/${article.slug}` : `/news/${article.slug}`;
  const canonicalUrl = `https://www.thepicklehub.net${canonicalPath}`;

  const enPath =
    language === "en"
      ? canonicalPath
      : siblingSlug
        ? `/news/${siblingSlug}`
        : undefined;
  const viPath =
    language === "vi"
      ? canonicalPath
      : siblingSlug
        ? `/vi/news/${siblingSlug}`
        : undefined;

  const breadcrumbItems = [
    {
      name: language === "vi" ? "Tin tức" : "News",
      url: `https://www.thepicklehub.net${newsListPath}`,
    },
    { name: article.title, url: canonicalUrl },
  ];

  const sourceLabel = article.source ?? "the source";
  const cta =
    language === "vi"
      ? `Đọc toàn bộ bài viết tại ${sourceLabel}`
      : `Read the full article at ${sourceLabel}`;

  return (
    <TheLineLayout
      title={article.title}
      description={article.summary}
      active="news"
    >
      <DynamicMeta
        title={`${article.title} | ThePickleHub`}
        description={article.summary}
      />
      <HreflangTags enPath={enPath} viPath={viPath} />
      <BreadcrumbSchema items={breadcrumbItems} />
      <ArticleSchema
        headline={article.title}
        datePublished={article.published_at}
        dateModified={article.published_at}
        author={article.source ?? "ThePickleHub"}
        description={article.summary}
        url={canonicalUrl}
        inLanguage={language === "vi" ? "vi-VN" : "en-US"}
        image={article.image_url ?? undefined}
      />

      <div
        className="tl-shell"
        style={{ maxWidth: 880, paddingTop: 24, paddingBottom: 80 }}
      >
        {/* Breadcrumb — mono row, consistent with /blog/:slug */}
        <nav
          aria-label="Breadcrumb"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--tl-fg-3)",
            marginBottom: 24,
          }}
        >
          <Link to={homePath} style={{ color: "inherit", textDecoration: "none" }}>
            {language === "vi" ? "Trang chủ" : "Home"}
          </Link>
          <span>/</span>
          <Link
            to={newsListPath}
            style={{ color: "inherit", textDecoration: "none" }}
          >
            {language === "vi" ? "Tin tức" : "News"}
          </Link>
          <span>/</span>
          <span
            style={{
              color: "var(--tl-fg-2)",
              textTransform: "none",
              letterSpacing: 0,
              fontFamily: "'Geist', sans-serif",
              fontSize: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 320,
            }}
          >
            {article.title}
          </span>
        </nav>

        <article>
          <header className="tl-article-head">
            <div className="kicker">
              ◆ {article.source ?? "Wire"}
              {article.category && <span> · {article.category}</span>}
            </div>
            <h1>{article.title}</h1>
            <div className="tl-article-meta">
              <span>{formatRelative(article.published_at)}</span>
              {article.ai_translated && (
                <span
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--tl-fg-3)",
                  }}
                  title={
                    language === "vi"
                      ? "Bản tiếng Việt được AI dịch lại có biên tập"
                      : "AI-translated Vietnamese edition"
                  }
                >
                  ◆ {language === "vi" ? "AI dịch" : "AI translated"}
                </span>
              )}
              {siblingSlug && (
                <Link
                  to={
                    language === "vi"
                      ? `/news/${siblingSlug}`
                      : `/vi/news/${siblingSlug}`
                  }
                  style={{
                    color: "var(--tl-green)",
                    textDecoration: "none",
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {language === "vi" ? "Read in English →" : "Đọc tiếng Việt →"}
                </Link>
              )}
            </div>
          </header>

          {article.image_url && (
            <figure
              style={{
                margin: "24px 0 32px",
                border: "1px solid var(--tl-hairline)",
                borderRadius: 8,
                overflow: "hidden",
                background: "var(--tl-bg-2)",
              }}
            >
              <img
                src={article.image_url}
                alt={article.title}
                loading="lazy"
                referrerPolicy="no-referrer"
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  maxHeight: 480,
                  objectFit: "cover",
                }}
                onError={(e) => {
                  // Source CDN may block referrer or 404 — hide gracefully.
                  (e.currentTarget.parentElement as HTMLElement).style.display =
                    "none";
                }}
              />
            </figure>
          )}

          <div
            className="tl-longform"
            style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 32 }}
          >
            <p>{article.summary}</p>
          </div>

          {/* Out-link CTA — KEY for fair use / copyright safety. We're an
              aggregator, not a republisher. Make it big and obvious. */}
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "16px 24px",
              border: "1px solid var(--tl-fg-1)",
              background: "var(--tl-fg-1)",
              color: "var(--tl-bg-1)",
              textDecoration: "none",
              fontFamily: "'Geist Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              borderRadius: 4,
            }}
          >
            {cta} →
          </a>

          {article.ai_translated && (
            <p
              style={{
                marginTop: 32,
                fontSize: 13,
                color: "var(--tl-fg-3)",
                fontStyle: "italic",
              }}
            >
              {language === "vi"
                ? "Tóm tắt tiếng Việt được AI dịch lại có biên tập từ bản gốc tiếng Anh. Để đọc nguyên văn, nhấn nút phía trên."
                : "Vietnamese summary was AI-translated and edited from the original English. Read the full article at the source above."}
            </p>
          )}
        </article>
      </div>
    </TheLineLayout>
  );
};

export default NewsArticle;
// kick rebuild
