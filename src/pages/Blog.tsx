import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { blogMetadata } from "@/content/blog";
import { usePublishedViBlogPosts } from "@/hooks/useViBlogPosts";
import { useBlogPostViewCountsBatch, pairKey } from "@/hooks/useBlogPostViewCountsBatch";
import { ViewCountBadge } from "@/components/blog/ViewCountBadge";
import { normalizeImageUrl } from "@/lib/url-utils";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { formatDate } from "./preview/_shell";

/* Normalized post shape so EN (static metadata) and VI (Supabase
   vi_blog_posts) can share a single render path. */
interface UnifiedPost {
  id: string;
  slug: string;
  lang: "en" | "vi";
  title: string;
  summary: string;
  coverImageUrl: string | null;
  category: string;
  publishedAt: string;
  author: string;
  href: string;
}

const Blog = () => {
  const { language } = useI18n();
  const [filter, setFilter] = useState<string | null>(null);

  const { data: viPosts = [] } = usePublishedViBlogPosts();

  const posts: UnifiedPost[] = useMemo(() => {
    if (language === "vi") {
      return [...viPosts]
        .sort((a, b) => {
          const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
          const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
          return tb - ta;
        })
        .map((p) => ({
          id: `vi-${p.slug}`,
          slug: p.slug,
          lang: "vi" as const,
          title: p.title,
          summary: p.excerpt ?? "",
          coverImageUrl: p.cover_image_url ? normalizeImageUrl(p.cover_image_url) : null,
          category: p.category ?? (p.tags?.[0] ?? "story"),
          publishedAt: p.published_at ?? "",
          author: "The PickleHub",
          href: `/vi/blog/${p.slug}`,
        }));
    }
    return [...blogMetadata]
      .sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime())
      .map((m) => ({
        id: `en-${m.slug}`,
        slug: m.slug,
        lang: "en" as const,
        title: m.titleEn,
        summary: m.metaDescriptionEn,
        coverImageUrl: m.heroImage?.src ?? null,
        category: m.tags[0] ?? "story",
        publishedAt: m.publishedDate,
        author: m.author,
        href: `/blog/${m.slug}`,
      }));
  }, [language, viPosts]);

  // Filter pill set — categories (VI) or tags (EN), top 10 by frequency
  const allCategories = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((p) => {
      if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cat, count]) => ({ cat, count }));
  }, [posts]);

  const visiblePosts = useMemo(() => {
    return filter ? posts.filter((p) => p.category === filter) : posts;
  }, [posts, filter]);

  const featured = visiblePosts[0];
  const rest = visiblePosts.slice(1);

  // Batch fetch view counts for all visible posts in one query
  const viewCounts = useBlogPostViewCountsBatch(
    visiblePosts.map((p) => ({ lang: p.lang, slug: p.slug })),
  );

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
          <Link to={language === "vi" ? "/vi" : "/"}>{language === "vi" ? "Trang chủ" : "Home"}</Link>
          <span className="sep">/</span>
          <span className="current">{language === "vi" ? "Bài viết" : "Stories"}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">◆ {language === "vi" ? "Đưa tin từ sân" : "Reporting from the court"}</div>
          <h1>
            {language === "vi" ? (
              <>
                Bài viết, <em className="tl-serif">phân tích,</em> <br />
                <span className="dim">và</span> <span className="sans">tinh thần của trận đấu.</span>
              </>
            ) : (
              <>
                Stories, <em className="tl-serif">analysis,</em> <br />
                and <span className="dim">the craft</span> <span className="sans">of the game.</span>
              </>
            )}
          </h1>
          <p>
            {language === "vi"
              ? "Phóng sự dài, chiến thuật, đánh giá luật, chân dung VĐV và hướng dẫn cho ban tổ chức."
              : "Longform coverage written by reporters and coaches — tournament tactics, rule changes, player profiles, and how-to guides for organizers."}
          </p>
        </header>

        {/* Category / tag filter pills */}
        {allCategories.length > 1 && (
          <div className="tl-filters">
            <button
              type="button"
              className={`tl-filter ${filter === null ? "active" : ""}`}
              onClick={() => setFilter(null)}
            >
              {language === "vi" ? "Tất cả" : "All"}
              <span className="count">{posts.length}</span>
            </button>
            {allCategories.map(({ cat, count }) => (
              <button
                key={cat}
                type="button"
                className={`tl-filter ${filter === cat ? "active" : ""}`}
                onClick={() => setFilter(cat)}
              >
                {cat}
                <span className="count">{count}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ paddingBottom: 80 }}>
          {visiblePosts.length === 0 ? (
            <div className="tl-empty">
              <h3>{language === "vi" ? "Chưa có bài viết." : "No stories yet."}</h3>
              <p>
                {language === "vi"
                  ? "Quay lại sau hoặc thử bộ lọc khác."
                  : "Try a different filter or check back soon."}
              </p>
            </div>
          ) : (
            <>
              {featured && (
                <article className="tl-blog-hero">
                  <div className="tl-blog-hero-body">
                    <div className="tl-blog-hero-kicker">
                      ◆ {language === "vi" ? "Nổi bật" : "Featured"} · {featured.category}
                    </div>
                    <h2>
                      <Link to={featured.href}>{featured.title}</Link>
                    </h2>
                    <p className="summary">{featured.summary}</p>
                    <div className="meta">
                      <b>{featured.author}</b>
                      <span>·</span>
                      <span>{formatDate(featured.publishedAt).full}</span>
                      {viewCounts[pairKey(featured.lang, featured.slug)] !== undefined && (
                        <>
                          <span>·</span>
                          <ViewCountBadge
                            count={viewCounts[pairKey(featured.lang, featured.slug)] ?? 0}
                            className="text-xs"
                          />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="tl-blog-hero-visual">
                    <span className="tag">● {language === "vi" ? "Nổi bật" : "Featured"}</span>
                    <FeaturedImage src={featured.coverImageUrl} alt={featured.title} />
                  </div>
                </article>
              )}

              {rest.length > 0 && (
                <div className="tl-blog-grid">
                  {rest.map((post) => (
                    <BlogCard
                      key={post.id}
                      post={post}
                      viewCount={viewCounts[pairKey(post.lang, post.slug)] ?? 0}
                    />
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

/* Inner FeaturedImage and BlogCard — each owns its own onError state
   so a single broken cover image doesn't take down the whole grid. */

const FeaturedImage = ({ src, alt }: { src: string | null; alt: string }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="court" />;
  return (
    <img
      src={src}
      alt={alt}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      loading="eager"
      onError={() => setFailed(true)}
    />
  );
};

const BlogCard = ({ post, viewCount }: { post: UnifiedPost; viewCount: number }) => {
  const [failed, setFailed] = useState(false);
  const showImg = post.coverImageUrl && !failed;
  return (
    <Link to={post.href} className="tl-blog-card">
      <div className="tl-blog-card-img">
        {showImg ? (
          <img
            src={post.coverImageUrl!}
            alt={post.title}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="tl-blog-card-img-placeholder" aria-hidden="true" />
        )}
      </div>
      <div className="tl-blog-card-body">
        <div className="kicker">◆ {post.category}</div>
        <h3>{post.title}</h3>
        <p>{post.summary}</p>
        <div className="foot">
          <b>{post.author}</b>
          <span>·</span>
          <span>{formatDate(post.publishedAt).full}</span>
          {viewCount > 0 && (
            <>
              <span>·</span>
              <ViewCountBadge count={viewCount} className="text-xs" />
            </>
          )}
        </div>
      </div>
    </Link>
  );
};

export default Blog;
