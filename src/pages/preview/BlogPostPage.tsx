import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { getBlogPost, getRelatedPosts, type BlogPost } from "@/content/blog";
import { PreviewShell, formatDate } from "./_shell";

const BlogPostPage = () => {
  const { slug = "" } = useParams();
  const { language } = useI18n();
  const [post, setPost] = useState<BlogPost | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBlogPost(slug).then((p) => {
      if (!cancelled) {
        setPost(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const related = post ? getRelatedPosts(slug, 3) : [];

  const content = post?.content[language === "vi" ? "vi" : "en"];
  const pubDate = formatDate(post?.publishedDate);
  const updatedDate = formatDate(post?.updatedDate);

  return (
    <PreviewShell
      title={content?.title ?? "Story · Preview"}
      description={content?.metaDescription}
      active="stories"
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/preview/the-line">Home</Link>
          <span className="sep">/</span>
          <Link to="/preview/the-line/blog">Stories</Link>
          <span className="sep">/</span>
          <span className="current">{content?.title?.slice(0, 44) ?? "Loading"}</span>
        </nav>

        {loading ? (
          <div className="tl-empty" style={{ marginTop: 40 }}>
            <p style={{ fontFamily: "Geist Mono", fontSize: 12, letterSpacing: "0.04em" }}>Loading story…</p>
          </div>
        ) : !post || !content ? (
          <div className="tl-empty" style={{ marginTop: 40 }}>
            <h3>Story not found</h3>
            <p>This post may have been moved or unpublished.</p>
            <Link to="/preview/the-line/blog" className="tl-btn">Back to stories →</Link>
          </div>
        ) : (
          <>
            <header className="tl-article-head">
              <div className="kicker">◆ {post.tags[0] ?? "Story"} · {post.tags.slice(1, 3).join(" · ")}</div>
              <h1>{content.title}</h1>
              <p className="lede">{content.metaDescription}</p>
              <div className="tl-article-meta">
                <span><b>{post.author}</b></span>
                <span>Published {pubDate.full}</span>
                {post.updatedDate !== post.publishedDate && (
                  <span>Updated {updatedDate.full}</span>
                )}
                <span>{post.tags.length} tags</span>
              </div>
            </header>

            {post.heroImage && (
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
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  loading="eager"
                />
              </figure>
            )}

            <article className="tl-longform">
              {content.sections.map((section, idx) => (
                <section key={idx}>
                  {section.heading && <h2>{section.heading}</h2>}
                  <p>{section.content}</p>
                  {section.listItems && section.listItems.length > 0 && (
                    <ul>
                      {section.listItems.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  )}
                  {section.orderedList && section.orderedList.length > 0 && (
                    <ol>
                      {section.orderedList.map((item, i) => <li key={i}>{item}</li>)}
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

              {/* How-to steps */}
              {content.howToSteps && content.howToSteps.length > 0 && (
                <section>
                  <h2>Steps</h2>
                  <ol>
                    {content.howToSteps.map((step, i) => (
                      <li key={i}>
                        <strong style={{ color: "var(--tl-fg)" }}>{step.name}</strong> — {step.text}
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* FAQ */}
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

              {/* Tags */}
              <div className="tl-tag-row">
                {post.tags.map((t) => <span key={t} className="tl-tag">#{t}</span>)}
              </div>

              {/* CTA */}
              <div style={{ marginTop: 36, padding: 24, background: "var(--tl-surface)", border: "1px solid var(--tl-border)", borderRadius: "var(--tl-radius-lg)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div className="tl-mono" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--tl-fg-3)", marginBottom: 6 }}>
                    Try it on ThePickleHub
                  </div>
                  <div style={{ fontSize: 16, color: "var(--tl-fg)", letterSpacing: "-0.005em" }}>
                    {post.ctaLabel[language === "vi" ? "vi" : "en"]}
                  </div>
                </div>
                <Link to={post.ctaPath} className="tl-btn green">Open →</Link>
              </div>

              <div className="tl-article-foot">
                <span>{post.author} · {pubDate.full}</span>
                <Link to={`/blog/${post.slug}`} style={{ color: "var(--tl-fg-2)" }}>
                  View on production site →
                </Link>
              </div>
            </article>

            {/* Related */}
            {related.length > 0 && (
              <section style={{ marginTop: 72, paddingTop: 48, borderTop: "1px solid var(--tl-border)", paddingBottom: 80 }}>
                <div className="tl-sec-head">
                  <h2>
                    More <em className="tl-serif">from</em> Stories.
                  </h2>
                </div>
                <div className="tl-blog-grid">
                  {related.map((r) => (
                    <Link key={r.slug} to={`/preview/the-line/blog/${r.slug}`} className="tl-blog-card">
                      <div className="kicker">◆ {r.tags[0] ?? "Story"}</div>
                      <h3>{language === "vi" ? r.titleVi : r.titleEn}</h3>
                      <p>{language === "vi" ? r.metaDescriptionVi : r.metaDescriptionEn}</p>
                      <div className="foot">
                        <b>{r.author}</b>
                        <span>·</span>
                        <span>{formatDate(r.publishedDate).full}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </PreviewShell>
  );
};

export default BlogPostPage;
