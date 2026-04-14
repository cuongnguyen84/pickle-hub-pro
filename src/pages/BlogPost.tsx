import { useParams, Link, Navigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { getBlogPost, getRelatedPosts } from "@/lib/blog-data";
import { DynamicMeta, HreflangTags, BreadcrumbSchema, ArticleSchema } from "@/components/seo";
import { useViBlogAlternate } from "@/hooks/useViBlogAlternate";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Tag } from "lucide-react";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useI18n();

  const post = slug ? getBlogPost(slug) : undefined;
  const { data: viSlug } = useViBlogAlternate(post?.slug);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const content = language === "vi" ? post.content.vi : post.content.en;
  const postUrl = `https://www.thepicklehub.net/blog/${post.slug}`;
  const relatedPosts = getRelatedPosts(post.slug, 3);

  const breadcrumbItems = [
    { name: "Blog", url: "https://www.thepicklehub.net/blog" },
    { name: content.title, url: postUrl },
  ];

  return (
    <MainLayout>
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
        inLanguage={language === "vi" ? "vi-VN" : "en-US"}
      />

      <article className="container-wide py-8 md:py-12 max-w-3xl">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {language === "vi" ? "Quay lại Blog" : "Back to Blog"}
        </Link>

        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4 leading-tight">
            {content.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <time dateTime={post.updatedDate}>
                {language === "vi" ? "Cập nhật: " : "Updated: "}{post.updatedDate}
              </time>
            </div>
            <div className="flex items-center gap-1.5">
              <Tag className="w-4 h-4" />
              {post.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-full bg-muted text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="prose-custom space-y-8">
          {content.sections.map((section, idx) => (
            <section key={idx}>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
                {section.heading}
              </h2>
              <p className="text-muted-foreground mb-4">{section.content}</p>
              {section.listItems && (
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  {section.listItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
              {section.orderedList && (
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  {section.orderedList.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 p-6 rounded-xl border border-primary/30 bg-primary/5 text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {language === "vi" ? "Sẵn sàng tổ chức giải?" : "Ready to organize your tournament?"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {language === "vi"
              ? "Dùng thử công cụ miễn phí của The Pickle Hub — không cần đăng ký."
              : "Try The Pickle Hub's free tools — no signup required."}
          </p>
          <Button asChild>
            <Link to={post.ctaPath}>
              {language === "vi" ? post.ctaLabel.vi : post.ctaLabel.en}
            </Link>
          </Button>
        </div>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <nav className="mt-12 pt-8 border-t border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {language === "vi" ? "Bài viết liên quan" : "Related Posts"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedPosts.map((related) => {
                const relatedContent = language === "vi" ? related.content.vi : related.content.en;
                return (
                  <Link
                    key={related.slug}
                    to={`/blog/${related.slug}`}
                    className="group p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
                  >
                    <h4 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                      {relatedContent.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {relatedContent.metaDescription}
                    </p>
                    <div className="flex gap-1.5 mt-2">
                      {related.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}

        {/* Internal links */}
        <nav className="mt-12 pt-8 border-t border-border">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {language === "vi" ? "Công cụ liên quan" : "Related Tools"}
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/tools" className="text-primary hover:underline">
                {language === "vi" ? "Tất cả công cụ giải Pickleball" : "All Pickleball Tournament Tools"}
              </Link>
            </li>
            <li>
              <Link to="/tools/quick-tables" className="text-primary hover:underline">
                {language === "vi" ? "Tạo bracket vòng tròn Pickleball" : "Pickleball Bracket Generator"}
              </Link>
            </li>
            <li>
              <Link to="/tools/team-match" className="text-primary hover:underline">
                {language === "vi" ? "Giải đồng đội MLP Pickleball" : "MLP Team Match Format"}
              </Link>
            </li>
            <li>
              <Link to="/tools/doubles-elimination" className="text-primary hover:underline">
                {language === "vi" ? "Giải loại kép Pickleball" : "Double Elimination Bracket"}
              </Link>
            </li>
          </ul>
        </nav>
      </article>
    </MainLayout>
  );
};

export default BlogPost;
