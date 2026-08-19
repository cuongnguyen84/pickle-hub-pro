import { useEffect } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { AdSlot } from "@/components/monetization/AdSlot";
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
import { formatRelative } from "@/lib/format-datetime";
import DOMPurify from "isomorphic-dompurify";

/**
 * /news/:slug + /vi/news/:slug — News article detail page.
 *
 * News items are independently rewritten ThePickleHub articles. The page renders:
 *   - ThePickleHub-owned default/category image
 *   - Full sanitized editorial body (or summary for legacy briefs)
 *   - Plain-text source attribution without an external link
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
        dateModified={article.updated_at}
        author="ThePickleHub Editorial"
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
              ◆ {language === "vi" ? "Nguồn" : "Source"}: {article.source ?? "Wire"}
              {article.category && <span> · {article.category}</span>}
            </div>
            <h1>{article.title}</h1>
            <div className="tl-article-meta">
              <span>{formatRelative(article.published_at, language)}</span>
              {!article.content_html && (
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
                      ? "Bản tin ngắn được biên tập từ dữ kiện nguồn"
                      : "Short brief edited from source facts"
                  }
                >
                  ◆ {language === "vi" ? "Tin ngắn" : "Brief"}
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
                border: "1px solid var(--tl-border)",
                borderRadius: 8,
                overflow: "hidden",
                background: "var(--tl-bg-elev)",
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

          <AdSlot slot="blogInArticle" minHeight={120} className="my-6" />
          {article.content_html ? (
            <div
              className="tl-longform"
              style={{ fontSize: 18, lineHeight: 1.7, marginBottom: 32 }}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(article.content_html, {
                  ALLOWED_TAGS: ["h2", "p"],
                  ALLOWED_ATTR: [],
                }),
              }}
            />
          ) : (
            <div
              className="tl-longform"
              style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 32 }}
            >
              <p>{article.summary}</p>
            </div>
          )}
        </article>
      </div>
    </TheLineLayout>
  );
};

export default NewsArticle;
// kick rebuild
