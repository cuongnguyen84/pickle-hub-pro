import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import {
  getBlogPost,
  getRelatedPosts,
  type BlogPost as BlogPostType,
} from "@/content/blog";
import {
  DynamicMeta,
  HreflangTags,
  BreadcrumbSchema,
  ArticleSchema,
  FAQSchema,
  HowToSchema,
} from "@/components/seo";
import { useViBlogAlternate } from "@/hooks/useViBlogAlternate";
import { useTrackBlogView } from "@/hooks/useTrackBlogView";
import { useBlogPostViewCount } from "@/hooks/useBlogPostViewCount";
import { ViewCountBadge } from "@/components/blog/ViewCountBadge";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { AdSlot } from "@/components/monetization/AdSlot";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * /blog/:slug — English long-form article page.
 *
 * Sprint 7 follow-up to PR #80: moved off the legacy MainLayout onto
 * TheLineLayout so the chrome matches FeedBlogCard from the new timeline.
 * Data fetching (getBlogPost lazy chunk, view tracking, VI alternate
 * lookup) and SEO emission (Article / FAQ / HowTo / Breadcrumb schema,
 * DynamicMeta, hreflang) are unchanged — only the page chrome and prose
 * typography were refactored.
 *
 * Anatomy:
 *   i.   tl-article-head — kicker (◆ category · subtags) + Instrument Serif
 *        italic h1 + lede + author/date/views meta strip with hairline.
 *   ii.  Hero figure with hairline border.
 *   iii. tl-longform body — section h2/h3 + paragraph + lists + images +
 *        internal links chain. The first-letter drop cap rule is provided
 *        by the-line.css so the opening paragraph stands out automatically.
 *   iv.  tl-faq accordion when the post has faq_items.
 *   v.   Tag row.
 *   vi.  CTA block — same affordance as the preview shell's "Open" button.
 *   vii. Related Posts — three-up FeedBlogCard-style cards.
 *   viii.Related Tools — utility footer nav.
 */
const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { setLanguageFromUrl } = useI18n();
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // Post loads asynchronously (per-post chunks from src/content/blog/posts/).
  const [post, setPost] = useState<BlogPostType | undefined | null>(null);

  // EN blog is always English — override any persisted "vi" language state
  // so TheLineLayout's nav switcher reflects the article's actual language.
  useEffect(() => {
    setLanguageFromUrl("en");
  }, [setLanguageFromUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setPost(undefined);
      return;
    }
    setPost(null);
    getBlogPost(slug).then((p) => {
      if (!cancelled) setPost(p);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const { data: viSlug } = useViBlogAlternate(post?.slug);
  useTrackBlogView("en", post?.slug);
  const { data: viewCount } = useBlogPostViewCount("en", post?.slug);

  if (post === null) {
    return (
      <TheLineLayout title="Loading…" active="stories">
        <div
          className="tl-shell"
          style={{ maxWidth: 880, paddingTop: 32, paddingBottom: 80 }}
        >
          <Skeleton className="h-6 w-24 mb-6" />
          <Skeleton className="h-12 w-full mb-3" />
          <Skeleton className="h-12 w-3/4 mb-6" />
          <Skeleton className="h-4 w-1/2 mb-10" />
          <Skeleton className="h-72 w-full mb-10 rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </TheLineLayout>
    );
  }

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  // EN route always serves English content regardless of i18n context.
  const content = post.content.en;
  const postUrl = `https://www.thepicklehub.net/blog/${post.slug}`;
  const relatedPosts = getRelatedPosts(post.slug, 3);

  const breadcrumbItems = [
    { name: "Blog", url: "https://www.thepicklehub.net/blog" },
    { name: content.title, url: postUrl },
  ];

  const publishedFull = formatLongDate(post.publishedDate);
  const updatedFull = formatLongDate(post.updatedDate);
  const showUpdated = post.updatedDate !== post.publishedDate;

  return (
    <TheLineLayout
      title={content.metaTitle.replace(/ \| ThePickleHub$/, "")}
      description={content.metaDescription}
      active="stories"
    >
      <DynamicMeta title={content.metaTitle} description={content.metaDescription} />
      <HreflangTags
        enPath={`/blog/${post.slug}`}
        viPath={viSlug ? `/vi/blog/${viSlug}` : undefined}
      />
      <BreadcrumbSchema items={breadcrumbItems} />
      <ArticleSchema
        headline={content.title}
        datePublished={post.publishedDate}
        dateModified={post.updatedDate}
        author={post.author}
        description={content.metaDescription}
        url={postUrl}
        inLanguage="en-US"
        image={post.heroImage?.src}
      />
      {content.faqItems && <FAQSchema items={content.faqItems} />}
      {content.howToSteps && (
        <HowToSchema
          name={content.title}
          description={content.metaDescription}
          steps={content.howToSteps}
        />
      )}

      <div
        className="tl-shell"
        style={{ maxWidth: 880, paddingTop: 24, paddingBottom: 80 }}
      >
        {/* Breadcrumb — single mono row, consistent with other TheLine
            detail pages (matches /tran-dau/<slug>'s pattern). */}
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
          <Link to="/" style={{ color: "inherit", textDecoration: "none" }}>
            Home
          </Link>
          <span>/</span>
          <Link to="/blog" style={{ color: "inherit", textDecoration: "none" }}>
            Stories
          </Link>
          <span>/</span>
          <span
            style={{
              color: "var(--tl-fg-2)",
              textTransform: "none",
              letterSpacing: 0,
              fontFamily: "'Geist', sans-serif",
              fontSize: 12,
            }}
          >
            {content.title}
          </span>
        </nav>

        <article>
          <header className="tl-article-head">
            <div className="kicker">
              ◆ {post.tags[0] ?? "Story"}
              {post.tags.length > 1 && (
                <span> · {post.tags.slice(1, 3).join(" · ")}</span>
              )}
            </div>
            <h1>{content.title}</h1>
            <p className="lede">{content.metaDescription}</p>
            <div className="tl-article-meta">
              <span>
                <b>{post.author}</b>
              </span>
              <span>Published {publishedFull}</span>
              {showUpdated && <span>Updated {updatedFull}</span>}
              <ViewCountBadge count={viewCount} />
              {viSlug && (
                <Link
                  to={`/vi/blog/${viSlug}`}
                  style={{
                    color: "var(--tl-green)",
                    textDecoration: "none",
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  Đọc bản tiếng Việt →
                </Link>
              )}
            </div>
          </header>

          {post.heroImage && !heroImgFailed && (
            <figure
              style={{
                aspectRatio: "16 / 9",
                borderRadius: "var(--tl-radius-lg)",
                overflow: "hidden",
                margin: "0 0 48px",
                border: "1px solid var(--tl-border)",
              }}
            >
              <img
                src={post.heroImage.src}
                alt={post.heroImage.alt}
                fetchPriority="high"
                decoding="async"
                onError={() => setHeroImgFailed(true)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </figure>
          )}

          <AdSlot slot="blogInArticle" minHeight={120} className="my-6" />
          <div className="tl-longform">
            {content.sections.map((section, idx) => (
              <section key={idx}>
                {section.heading && <h2>{section.heading}</h2>}
                {section.image && (
                  <figure style={{ margin: "0 0 22px" }}>
                    <img
                      src={section.image.src}
                      alt={section.image.alt}
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: "100%",
                        borderRadius: "var(--tl-radius-lg)",
                        border: "1px solid var(--tl-border)",
                        display: "block",
                      }}
                    />
                    {section.image.caption && (
                      <figcaption
                        style={{
                          marginTop: 8,
                          fontFamily: "'Geist Mono', monospace",
                          fontSize: 11,
                          color: "var(--tl-fg-3)",
                          letterSpacing: "0.04em",
                          textAlign: "center",
                        }}
                      >
                        {section.image.caption}
                      </figcaption>
                    )}
                  </figure>
                )}
                <p>{section.content}</p>
                {section.listItems && section.listItems.length > 0 && (
                  <ul>
                    {section.listItems.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
                {section.orderedList && section.orderedList.length > 0 && (
                  <ol>
                    {section.orderedList.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ol>
                )}
                {section.internalLinks && section.internalLinks.length > 0 && (
                  <p>
                    See also:{" "}
                    {section.internalLinks.map((link, i) => (
                      <span key={i}>
                        <Link to={link.path}>{link.text}</Link>
                        {i < section.internalLinks!.length - 1 && " · "}
                      </span>
                    ))}
                  </p>
                )}
              </section>
            ))}

            {content.howToSteps && content.howToSteps.length > 0 && (
              <section>
                <h2>Steps</h2>
                <ol>
                  {content.howToSteps.map((step, i) => (
                    <li key={i}>
                      <strong style={{ color: "var(--tl-fg)" }}>
                        {step.name}
                      </strong>
                      {" — "}
                      {step.text}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {content.faqItems && content.faqItems.length > 0 && (
              <section className="tl-faq">
                <h2 style={{ marginBottom: 8 }}>Frequently asked</h2>
                {content.faqItems.map((item, i) => (
                  <details key={i}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </section>
            )}

            {post.tags.length > 0 && (
              <div className="tl-tag-row" style={{ marginTop: 32 }}>
                {post.tags.map((tag) => (
                  <span key={tag} className="tl-tag">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* CTA — single-line block in tl-surface with green action. */}
            <div
              style={{
                marginTop: 40,
                padding: 24,
                background: "var(--tl-surface)",
                border: "1px solid var(--tl-border)",
                borderRadius: "var(--tl-radius-lg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--tl-fg-3)",
                    marginBottom: 6,
                  }}
                >
                  Try it on ThePickleHub
                </div>
                <div style={{ fontSize: 16, color: "var(--tl-fg)" }}>
                  Ready to organize your tournament? Free tools, no signup.
                </div>
              </div>
              <Link to={post.ctaPath} className="tl-btn green">
                {post.ctaLabel.en} →
              </Link>
            </div>

            <div className="tl-article-foot">
              <span>
                {post.author} · {publishedFull}
              </span>
              <Link to="/blog" style={{ color: "var(--tl-fg-2)" }}>
                Back to stories →
              </Link>
            </div>
          </div>

          {/* Related Posts — three-up grid, FeedBlogCard-style chrome
              (eyebrow strip + Instrument Serif title + excerpt). */}
          {relatedPosts.length > 0 && (
            <section
              style={{
                marginTop: 72,
                paddingTop: 48,
                borderTop: "1px solid var(--tl-border)",
              }}
            >
              <div
                style={{
                  marginBottom: 28,
                  fontFamily: "'Instrument Serif', serif",
                  fontStyle: "italic",
                  fontSize: 32,
                  letterSpacing: "-0.02em",
                  color: "var(--tl-fg)",
                }}
              >
                More <em>from</em> Stories.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 24,
                }}
              >
                {relatedPosts.map((related) => (
                  <Link
                    key={related.slug}
                    to={`/blog/${related.slug}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      padding: "20px 0",
                      borderTop: "1px solid var(--tl-border)",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Geist Mono', monospace",
                        fontSize: 10.5,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--tl-fg-3)",
                      }}
                    >
                      ◆ {related.tags[0] ?? "Story"}
                    </div>
                    <h3
                      style={{
                        fontFamily: "'Instrument Serif', serif",
                        fontStyle: "italic",
                        fontSize: 22,
                        lineHeight: 1.15,
                        letterSpacing: "-0.015em",
                        color: "var(--tl-fg)",
                        margin: 0,
                      }}
                    >
                      {related.titleEn}
                    </h3>
                    <p
                      style={{
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: "var(--tl-fg-2)",
                        margin: 0,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {related.metaDescriptionEn}
                    </p>
                    <div
                      style={{
                        fontFamily: "'Geist Mono', monospace",
                        fontSize: 10.5,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--tl-fg-3)",
                        display: "inline-flex",
                        gap: 6,
                        marginTop: 4,
                      }}
                    >
                      <b style={{ color: "var(--tl-fg-2)", fontWeight: 500 }}>
                        {related.author}
                      </b>
                      <span style={{ color: "var(--tl-fg-4)" }}>·</span>
                      <span>{formatLongDate(related.publishedDate)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Internal links — utility nav (kept from prior layout for SEO
              link equity to tools surfaces). */}
          <nav
            style={{
              marginTop: 64,
              paddingTop: 32,
              borderTop: "1px solid var(--tl-border)",
            }}
            aria-label="Related tools"
          >
            <h3
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--tl-fg-3)",
                margin: "0 0 16px",
              }}
            >
              Related Tools
            </h3>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <li>
                <Link
                  to="/tools"
                  style={{ color: "var(--tl-green)", textDecoration: "none" }}
                >
                  All Pickleball Tournament Tools →
                </Link>
              </li>
              <li>
                <Link
                  to="/tools/quick-tables"
                  style={{ color: "var(--tl-green)", textDecoration: "none" }}
                >
                  Pickleball Bracket Generator →
                </Link>
              </li>
              <li>
                <Link
                  to="/tools/team-match"
                  style={{ color: "var(--tl-green)", textDecoration: "none" }}
                >
                  MLP Team Match Format →
                </Link>
              </li>
              <li>
                <Link
                  to="/tools/doubles-elimination"
                  style={{ color: "var(--tl-green)", textDecoration: "none" }}
                >
                  Double Elimination Bracket →
                </Link>
              </li>
            </ul>
          </nav>
        </article>
      </div>
    </TheLineLayout>
  );
};

function formatLongDate(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default BlogPost;
