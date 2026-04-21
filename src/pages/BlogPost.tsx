import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { getBlogPost, getRelatedPosts, type BlogPost as BlogPostType } from "@/content/blog";
import { DynamicMeta, HreflangTags, BreadcrumbSchema, ArticleSchema, FAQSchema, HowToSchema } from "@/components/seo";
import { useViBlogAlternate } from "@/hooks/useViBlogAlternate";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Tag } from "lucide-react";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { setLanguageFromUrl } = useI18n();

  // Post loads asynchronously (per-post chunks from src/content/blog/posts/)
  const [post, setPost] = useState<BlogPostType | undefined | null>(null);

  // EN blog is always English — override any persisted "vi" language state.
  useEffect(() => {
    setLanguageFromUrl("en");
  }, [setLanguageFromUrl]);

  // Load post whenever slug changes
  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setPost(undefined);
      return;
    }
    setPost(null); // loading
    getBlogPost(slug).then((p) => {
      if (!cancelled) setPost(p);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const { data: viSlug } = useViBlogAlternate(post?.slug);

  // Loading state — show skeleton while post chunk downloads
  if (post === null) {
    return (
      <MainLayout>
        <article className="container-wide py-8 md:py-12 max-w-3xl">
          <Skeleton className="h-6 w-24 mb-6" />
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-10 w-3/4 mb-6" />
          <Skeleton className="h-4 w-48 mb-8" />
          <Skeleton className="h-64 w-full mb-8 rounded-lg" />
          <div className="space-y-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
          </div>
        </article>
      </MainLayout>
    );
  }

  // Not found after load — redirect
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

      <article className="container-wide py-8 md:py-12 max-w-3xl">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4 leading-tight">
            {content.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <time dateTime={post.updatedDate}>
                Updated: {post.updatedDate}
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

        {post.heroImage && (
          <img
            src={post.heroImage.src}
            alt={post.heroImage.alt}
            className="w-full rounded-lg mb-8"
            fetchPriority="high"
            decoding="async"
          />
        )}

        <div className="prose-custom space-y-8">
          {content.sections.map((section, idx) => (
            <section key={idx}>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
                {section.heading}
              </h2>
              {section.image && (
                <figure className="my-4">
                  <img
                    src={section.image.src}
                    alt={section.image.alt}
                    className="w-full rounded-lg"
                    loading="lazy"
                    decoding="async"
                  />
                  {section.image.caption && (
                    <figcaption className="text-xs text-muted-foreground mt-2 text-center italic">
                      {section.image.caption}
                    </figcaption>
                  )}
                </figure>
              )}
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
              {section.internalLinks && (
                <ul className="space-y-2 mt-4">
                  {section.internalLinks.map((link, i) => (
                    <li key={i}>
                      <Link to={link.path} className="text-primary hover:underline">
                        {link.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* FAQ Section */}
        {content.faqItems && (
          <section className="mt-12 pt-8 border-t border-border">
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              {content.faqItems.map((item, idx) => (
                <div key={idx}>
                  <h3 className="font-semibold text-foreground mb-2">{item.question}</h3>
                  <p className="text-muted-foreground text-sm">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="mt-12 p-6 rounded-xl border border-primary/30 bg-primary/5 text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Ready to organize your tournament?
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Try The Pickle Hub's free tools — no signup required.
          </p>
          <Button asChild>
            <Link to={post.ctaPath}>
              {post.ctaLabel.en}
            </Link>
          </Button>
        </div>

        {/* Related Posts — uses lightweight metadata */}
        {relatedPosts.length > 0 && (
          <nav className="mt-12 pt-8 border-t border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Related Posts
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  to={`/blog/${related.slug}`}
                  className="group p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  <h4 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                    {related.titleEn}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {related.metaDescriptionEn}
                  </p>
                  <div className="flex gap-1.5 mt-2">
                    {related.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </nav>
        )}

        {/* Internal links */}
        <nav className="mt-12 pt-8 border-t border-border">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Related Tools
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/tools" className="text-primary hover:underline">
                All Pickleball Tournament Tools
              </Link>
            </li>
            <li>
              <Link to="/tools/quick-tables" className="text-primary hover:underline">
                Pickleball Bracket Generator
              </Link>
            </li>
            <li>
              <Link to="/tools/team-match" className="text-primary hover:underline">
                MLP Team Match Format
              </Link>
            </li>
            <li>
              <Link to="/tools/doubles-elimination" className="text-primary hover:underline">
                Double Elimination Bracket
              </Link>
            </li>
          </ul>
        </nav>
      </article>
    </MainLayout>
  );
};

export default BlogPost;
