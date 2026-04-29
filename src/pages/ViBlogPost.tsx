import { Link, useParams } from "react-router-dom";
import { useViBlogPostBySlug } from "@/hooks/useViBlogPosts";
import { DynamicMeta, HreflangTags, BreadcrumbSchema, ArticleSchema, FAQSchema } from "@/components/seo";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";
import { normalizeImageUrl, normalizeImagesInHtml } from "@/lib/url-utils";
import { useTrackBlogView } from "@/hooks/useTrackBlogView";
import { useBlogPostViewCount } from "@/hooks/useBlogPostViewCount";
import { ViewCountBadge } from "@/components/blog/ViewCountBadge";

const ViBlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading, error } = useViBlogPostBySlug(slug);
  useTrackBlogView("vi", slug);
  const { data: viewCount } = useBlogPostViewCount("vi", slug);

  if (isLoading) {
    return (
      <TheLineLayout title="Đang tải...">
        <div className="tl-shell" style={{ paddingTop: 32, paddingBottom: 80 }}>
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-4 w-1/2 mb-8" />
          <Skeleton className="h-64 w-full" />
        </div>
      </TheLineLayout>
    );
  }

  if (error || !post) {
    return (
      <TheLineLayout title="Không tìm thấy bài viết">
        <div className="tl-shell" style={{ paddingTop: 64, paddingBottom: 80, textAlign: "center", color: "var(--tl-fg-3)" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>Không tìm thấy bài viết</h1>
          <p>Bài viết này không tồn tại hoặc đã bị xóa.</p>
        </div>
      </TheLineLayout>
    );
  }

  const breadcrumbItems = [
    { name: "Trang chủ", url: "https://www.thepicklehub.net/vi" },
    { name: "Bài viết", url: "https://www.thepicklehub.net/vi/blog" },
    { name: post.title, url: `https://www.thepicklehub.net/vi/blog/${post.slug}` },
  ];

  const faqItems = Array.isArray(post.faq_items) ? post.faq_items : [];

  return (
    <TheLineLayout
      title={post.meta_title.replace(/ \| ThePickleHub$/, "")}
      description={post.meta_description}
      active="stories"
    >
      <DynamicMeta
        title={post.meta_title.replace(/ \| ThePickleHub$/, "")}
        description={post.meta_description}
        image={normalizeImageUrl(post.cover_image_url) || undefined}
        type="article"
      />
      <HreflangTags
        enPath={post.alternate_en_slug ? `/blog/${post.alternate_en_slug}` : undefined}
        viPath={`/vi/blog/${post.slug}`}
      />
      <BreadcrumbSchema items={breadcrumbItems} />
      <ArticleSchema
        headline={post.title}
        datePublished={post.published_at || post.created_at}
        dateModified={post.updated_at}
        author={post.author_name || "ThePickleHub"}
        description={post.meta_description}
        url={`https://www.thepicklehub.net/vi/blog/${post.slug}`}
        inLanguage="vi"
      />
      {faqItems.length > 0 && <FAQSchema items={faqItems} />}

      <div className="tl-shell" style={{ maxWidth: "880px", paddingTop: 24, paddingBottom: 80 }}>
        <nav style={{ marginBottom: "2rem", fontSize: "0.875rem", color: "var(--tl-fg-3)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Link to="/vi" style={{ color: "inherit", textDecoration: "none" }}>Trang chủ</Link>
          <span>/</span>
          <Link to="/vi/blog" style={{ color: "inherit", textDecoration: "none" }}>Bài viết</Link>
          <span>/</span>
          <span style={{ color: "var(--tl-fg-1)" }}>{post.title}</span>
        </nav>

        <article>
          <header className="tl-article-head">
            <div className="kicker">◆ {post.category ?? "Bài viết"}</div>
            <h1 className="tl-article-title" style={{ fontFamily: "var(--tl-font-serif, Georgia, serif)", fontStyle: "italic" }}>
              {post.title}
            </h1>
            <div className="tl-article-meta">
              <Calendar className="w-4 h-4" />
              {post.published_at && (
                <time dateTime={post.published_at}>
                  {new Date(post.published_at).toLocaleDateString("vi-VN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              )}
              {post.author_name && <span>· {post.author_name}</span>}
              <ViewCountBadge count={viewCount} />
            </div>
          </header>

          {post.cover_image_url && (
            <img
              src={normalizeImageUrl(post.cover_image_url)}
              alt={post.title}
              className="w-full h-auto rounded-xl mb-8 border border-border"
              style={{ marginTop: "2rem" }}
            />
          )}

          <div
            className="prose prose-lg dark:prose-invert max-w-none prose-a:text-primary prose-a:underline prose-a:underline-offset-2 hover:prose-a:opacity-80 prose-table:border prose-table:border-border prose-th:bg-muted prose-th:p-3 prose-td:p-3 prose-td:border-t prose-td:border-border prose-h2:mt-12 prose-h2:text-foreground prose-h3:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-tr:even:bg-muted/30"
            dangerouslySetInnerHTML={{ __html: normalizeImagesInHtml(post.content_html) }}
          />

          {faqItems.length > 0 && (
            <section className="mt-12 border-t border-border pt-8">
              <h2 className="text-2xl font-bold text-foreground mb-6">Câu hỏi thường gặp</h2>
              <div className="space-y-4">
                {faqItems.map((item, i) => (
                  <div key={i} className="border border-border rounded-lg p-4">
                    <h3 className="font-semibold text-foreground mb-2">{item.question}</h3>
                    <p className="text-muted-foreground">{item.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </article>
      </div>
    </TheLineLayout>
  );
};

export default ViBlogPost;
