import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { preloadViBlogPostBySlug, useViBlogPostBySlug } from "@/hooks/useViBlogPosts";
import { ErrorState } from "@/components/states/PageStates";
import { DynamicMeta, HreflangTags, BreadcrumbSchema, ArticleSchema, FAQSchema } from "@/components/seo";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { AdSlot } from "@/components/monetization/AdSlot";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";
import { normalizeImageUrl, normalizeImagesInHtml } from "@/lib/url-utils";
import DOMPurify from "isomorphic-dompurify";
import { useTrackBlogView } from "@/hooks/useTrackBlogView";
import { useBlogPostViewCount } from "@/hooks/useBlogPostViewCount";
import { ViewCountBadge } from "@/components/blog/ViewCountBadge";
import { cmsHeroImageSources } from "@/lib/image-utils";

// App.tsx starts this route chunk during cold deep-link bootstrap. Begin the
// public CMS read as soon as the module evaluates so React Query can consume
// it on mount instead of creating a later request waterfall.
if (typeof window !== "undefined") {
  const match = window.location.pathname.match(/^\/vi\/blog\/([a-z0-9-]+)\/?$/);
  preloadViBlogPostBySlug(match?.[1]);
}

const ViBlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading, error, refetch } = useViBlogPostBySlug(slug);
  useTrackBlogView("vi", slug);
  const { data: viewCount } = useBlogPostViewCount("vi", slug);

  // Deep links carrying a #fragment (glossary anchors, cross-links into a
  // specific section) never scrolled: content_html only enters the DOM after
  // react-query resolves, long after the browser gave up looking for the id.
  // Measured on prod 2026-07-27 with a real mobile Chromium — cold deep link
  // and F5 both left scrollTop at 0 with the target heading 3379px down.
  //
  // scrollIntoView(), NOT window.scrollTo(): the page does not scroll on the
  // document. TheLineLayout scrolls inside div.tl-scroll, so
  // document.scrollingElement.scrollHeight equals the viewport height and
  // window.scrollY is permanently 0 — a window.scrollTo() fix runs clean and
  // does nothing at all. scrollIntoView walks up to the real scroll ancestor.
  //
  // focus() as well as scroll: without it a keyboard or screen-reader user is
  // moved visually but left at the top of the document (WCAG 2.4.3).
  // preventScroll stops focus from fighting the scroll we just did.
  useEffect(() => {
    if (!post) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    // rAF so the effect runs after the sanitized HTML has been painted.
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.setAttribute("tabindex", "-1");
      el.scrollIntoView();
      (el as HTMLElement).focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [post]);

  if (isLoading) {
    return (
      <TheLineLayout title="Đang tải...">
        <div className="tl-shell" style={{ maxWidth: 880, paddingTop: 24, paddingBottom: 80 }} aria-busy="true">
          <Skeleton className="h-4 w-2/3 mb-8" />
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-12 w-full mb-3" />
          <Skeleton className="h-12 w-3/4 mb-6" />
          <Skeleton className="h-4 w-1/2 mb-8" />
          <Skeleton className="aspect-[3/2] w-full rounded-xl mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
            <Skeleton className="h-5 w-full" />
          </div>
        </div>
      </TheLineLayout>
    );
  }

  // A failed fetch is not a missing article. Merging the two told anyone on
  // flaky 4G that the post had been deleted, and gave them no way to retry —
  // on the pages we are actively driving traffic to.
  if (error) {
    return (
      <TheLineLayout title="Lỗi kết nối">
        <div className="tl-shell" style={{ paddingTop: 64, paddingBottom: 80 }}>
          <ErrorState onRetry={() => void refetch()} />
        </div>
      </TheLineLayout>
    );
  }

  if (!post) {
    return (
      <TheLineLayout title="Không tìm thấy bài viết">
        <div className="tl-shell" style={{ paddingTop: 64, paddingBottom: 80, textAlign: "center", color: "var(--tl-fg-3)" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>Không tìm thấy bài viết</h1>
          <p>Không tìm thấy bài viết này. Có thể link đã cũ.</p>
          <p style={{ marginTop: "1.5rem" }}>
            <Link to="/vi/blog" style={{ color: "var(--tl-accent, inherit)" }}>Xem tất cả bài viết →</Link>
          </p>
        </div>
      </TheLineLayout>
    );
  }

  // Matched via alternate_en_slug (someone followed /vi/blog/<EN-slug>).
  // Send them to the canonical VI URL so the address bar, the canonical tag
  // and any share from this page all agree. See useViBlogPostBySlug.
  if (post.slug !== slug) {
    return <Navigate to={`/vi/blog/${post.slug}${window.location.hash}`} replace />;
  }

  const breadcrumbItems = [
    { name: "Trang chủ", url: "https://www.thepicklehub.net/vi" },
    { name: "Bài viết", url: "https://www.thepicklehub.net/vi/blog" },
    { name: post.title, url: `https://www.thepicklehub.net/vi/blog/${post.slug}` },
  ];

  const faqItems = Array.isArray(post.faq_items) ? post.faq_items : [];
  const coverImage = cmsHeroImageSources(post.cover_image_url);

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
          <span style={{ color: "var(--tl-fg)" }}>{post.title}</span>
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

          {coverImage && (
            <img
              src={coverImage.src}
              srcSet={coverImage.srcSet}
              sizes="(max-width: 912px) calc(100vw - 32px), 832px"
              alt={post.title}
              width={1200}
              height={630}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="w-full rounded-xl mb-8 border border-border"
              style={{ marginTop: "2rem", aspectRatio: "1200 / 630", objectFit: "cover" }}
            />
          )}

          <AdSlot slot="blogInArticle" minHeight={120} className="my-6" />
          <div
            className="prose prose-lg dark:prose-invert max-w-none prose-a:text-primary prose-a:underline prose-a:underline-offset-2 hover:prose-a:opacity-80 prose-table:border prose-table:border-border prose-th:bg-muted prose-th:p-3 prose-td:p-3 prose-td:border-t prose-td:border-border prose-h2:mt-12 prose-h2:text-foreground prose-h3:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-tr:even:bg-muted/30"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(normalizeImagesInHtml(post.content_html)) }}
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
