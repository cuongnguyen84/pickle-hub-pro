import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { blogMetadata } from "@/content/blog";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { formatDate } from "./preview/_shell";

const Blog = () => {
  const { language } = useI18n();
  const [tag, setTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    blogMetadata.forEach((p) => p.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, []);

  const posts = useMemo(() => {
    const sorted = [...blogMetadata].sort((a, b) => {
      return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
    });
    return tag ? sorted.filter((p) => p.tags.includes(tag)) : sorted;
  }, [tag]);

  const featured = posts[0];
  const rest = posts.slice(1);

  const title = (p: typeof posts[number]) => (language === "vi" ? p.titleVi : p.titleEn);
  const summary = (p: typeof posts[number]) => (language === "vi" ? p.metaDescriptionVi : p.metaDescriptionEn);

  return (
    <TheLineLayout
      title={language === "vi" ? "Bài viết" : "Stories"}
      description={language === "vi"
        ? "Bài viết, phân tích và hướng dẫn pickleball — bởi phóng viên có mặt tại sân."
        : "Longform pickleball coverage, analysis, and how-to guides — written by reporters at the court."}
      active="stories"
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/">Home</Link>
          <span className="sep">/</span>
          <span className="current">Stories</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">◆ Reporting from the court</div>
          <h1>
            Stories, <em className="tl-serif">analysis,</em> <br />
            and <span className="dim">the craft</span> <span className="sans">of the game.</span>
          </h1>
          <p>
            Longform coverage written by reporters and coaches — tournament tactics,
            rule changes, player profiles, and how-to guides for organizers.
          </p>
        </header>

        {/* Tag filter */}
        <div className="tl-filters">
          <button
            type="button"
            className={`tl-filter ${tag === null ? "active" : ""}`}
            onClick={() => setTag(null)}
          >
            All<span className="count">{blogMetadata.length}</span>
          </button>
          {allTags.slice(0, 10).map((t) => {
            const count = blogMetadata.filter((p) => p.tags.includes(t)).length;
            return (
              <button
                key={t}
                type="button"
                className={`tl-filter ${tag === t ? "active" : ""}`}
                onClick={() => setTag(t)}
              >
                {t}
                <span className="count">{count}</span>
              </button>
            );
          })}
        </div>

        <div style={{ paddingBottom: 80 }}>
          {posts.length === 0 ? (
            <div className="tl-empty">
              <h3>No stories with that tag.</h3>
              <p>Try a different filter.</p>
            </div>
          ) : (
            <>
              {featured && (
                <article className="tl-blog-hero">
                  <div className="tl-blog-hero-body">
                    <div className="tl-blog-hero-kicker">◆ Featured · {featured.tags[0] ?? "Story"}</div>
                    <h2>
                      <Link to={`/blog/${featured.slug}`}>{title(featured)}</Link>
                    </h2>
                    <p className="summary">{summary(featured)}</p>
                    <div className="meta">
                      <b>{featured.author}</b>
                      <span>·</span>
                      <span>{formatDate(featured.publishedDate).full}</span>
                      <span>·</span>
                      <span>{featured.tags.slice(0, 3).join(" · ")}</span>
                    </div>
                  </div>
                  <div className="tl-blog-hero-visual">
                    <span className="tag">● Featured</span>
                    {featured.heroImage ? (
                      <img
                        src={featured.heroImage.src}
                        alt={featured.heroImage.alt}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                        loading="eager"
                      />
                    ) : (
                      <div className="court" />
                    )}
                  </div>
                </article>
              )}

              {rest.length > 0 && (
                <div className="tl-blog-grid">
                  {rest.map((post) => (
                    <Link key={post.slug} to={`/blog/${post.slug}`} className="tl-blog-card">
                      <div className="kicker">◆ {post.tags[0] ?? "Story"}</div>
                      <h3>{title(post)}</h3>
                      <p>{summary(post)}</p>
                      <div className="foot">
                        <b>{post.author}</b>
                        <span>·</span>
                        <span>{formatDate(post.publishedDate).full}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </TheLineLayout>
  );
};

export default Blog;
