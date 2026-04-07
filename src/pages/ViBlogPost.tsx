import { useParams } from "react-router-dom";
import { useViBlogPostBySlug } from "@/hooks/useViBlogPosts";
import { DynamicMeta, BreadcrumbSchema, ArticleSchema, FAQSchema } from "@/components/seo";
import MainLayout from "@/components/layout/MainLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";

const ViBlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading, error } = useViBlogPostBySlug(slug);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container-wide py-8 max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (error || !post) {
    return (
      <MainLayout>
        <div className="container-wide py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Không tìm thấy bài viết</h1>
          <p className="text-muted-foreground">Bài viết này không tồn tại hoặc đã bị xóa.</p>
        </div>
      </MainLayout>
    );
  }

  const alternateEnUrl = post.alternate_en_slug
    ? `https://www.thepicklehub.net/blog/${post.alternate_en_slug}`
    : undefined;

  const breadcrumbItems = [
    { name: "Trang chủ", url: "https://www.thepicklehub.net/vi" },
    { name: "Blog", url: "https://www.thepicklehub.net/vi/blog" },
    { name: post.title, url: `https://www.thepicklehub.net/vi/blog/${post.slug}` },
  ];

  const faqItems = Array.isArray(post.faq_items) ? post.faq_items : [];

  return (
    <MainLayout>
      <DynamicMeta
        title={post.meta_title.replace(/ \| ThePickleHub$/, "")}
        description={post.meta_description}
        image={post.cover_image_url || undefined}
        type="article"
        enableHreflang={!!alternateEnUrl}
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

      <article className="container-wide py-8 max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          {post.title}
        </h1>

        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-6">
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
          {post.author_name && <span>• {post.author_name}</span>}
        </div>

        {post.cover_image_url && (
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full h-auto rounded-xl mb-8 border border-border"
          />
        )}

        <div
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
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
    </MainLayout>
  );
};

export default ViBlogPost;
