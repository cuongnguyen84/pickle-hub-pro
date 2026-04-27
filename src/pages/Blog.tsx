import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { blogMetadata, type BlogPostMetadata } from "@/content/blog";
import { DynamicMeta, HreflangTags, BreadcrumbSchema } from "@/components/seo";
import MainLayout from "@/components/layout/MainLayout";
import { Calendar, ArrowRight, Tag } from "lucide-react";
import { normalizeImageUrl } from "@/lib/url-utils";
import { useBlogPostViewCountsBatch, pairKey } from "@/hooks/useBlogPostViewCountsBatch";
import { ViewCountBadge } from "@/components/blog/ViewCountBadge";

// Tag color palette
const TAG_COLORS = [
  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  "bg-red-500/15 text-red-400 border-red-500/20",
  "bg-pink-500/15 text-pink-400 border-pink-500/20",
];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function OtherBlogCard({ post, language, viewCount }: { post: BlogPostMetadata; language: string; viewCount?: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const title = language === "vi" ? post.titleVi : post.titleEn;
  const description = language === "vi" ? post.metaDescriptionVi : post.metaDescriptionEn;
  const showImage = !!post.heroImage && !imgFailed;

  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group block glass-card overflow-hidden"
    >
      {/* Thumbnail */}
      {showImage ? (
        <div className="relative h-44 overflow-hidden">
          <img
            src={normalizeImageUrl(post.heroImage!.src)}
            alt={post.heroImage!.alt}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {/* Tags overlay */}
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            {post.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border backdrop-blur-sm ${getTagColor(tag)}`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="h-44 bg-gradient-to-br from-primary/10 to-emerald-500/5 flex items-center justify-center relative">
          <span className="text-4xl opacity-20">📝</span>
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            {post.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getTagColor(tag)}`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Content */}
      <div className="p-5">
        <div className="flex items-center gap-2 text-xs text-foreground-secondary mb-2.5">
          <Calendar className="w-3.5 h-3.5" />
          <time dateTime={post.updatedDate}>
            {new Date(post.updatedDate).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", {
              year: "numeric", month: "short", day: "numeric"
            })}
          </time>
          <ViewCountBadge count={viewCount} className="text-xs ml-auto" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {title}
        </h2>
        <p className="text-sm text-foreground-secondary mb-4 line-clamp-2">
          {description}
        </p>
        <div className="flex items-center gap-1 text-sm font-medium text-primary">
          {language === "vi" ? "Đọc tiếp" : "Read more"}
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

const Blog = () => {
  const { language } = useI18n();
  const [featuredImgFailed, setFeaturedImgFailed] = useState(false);

  const breadcrumbItems = [
    { name: "Blog", url: "https://www.thepicklehub.net/blog" },
  ];

  const sortedPosts = [...blogMetadata].sort(
    (a, b) => new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime()
  );

  // First post is featured
  const [featuredPost, ...otherPosts] = sortedPosts;

  const enPairs = sortedPosts.map((p) => ({ lang: "en" as const, slug: p.slug }));
  const viewCounts = useBlogPostViewCountsBatch(enPairs);
  const featuredTitle = featuredPost
    ? (language === "vi" ? featuredPost.titleVi : featuredPost.titleEn)
    : null;
  const featuredDesc = featuredPost
    ? (language === "vi" ? featuredPost.metaDescriptionVi : featuredPost.metaDescriptionEn)
    : null;

  const showFeaturedImage = !!featuredPost?.heroImage && !featuredImgFailed;

  return (
    <MainLayout>
      <DynamicMeta
        title={language === "vi" ? "Blog Pickleball — Hướng dẫn & Mẹo tổ chức giải" : "Pickleball Blog — Tournament Guides & Tips"}
        description={language === "vi"
          ? "Hướng dẫn tổ chức giải pickleball, tạo bracket, round robin, và phần mềm giải đấu miễn phí."
          : "Guides on pickleball tournament organization, bracket creation, round robin scheduling, and free tournament software."}
      />
      <HreflangTags enPath="/blog" viPath="/vi/blog" />
      <BreadcrumbSchema items={breadcrumbItems} />

      <div className="container-wide py-8 md:py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gradient-brand mb-2">
          {language === "vi" ? "Blog Pickleball" : "Pickleball Blog"}
        </h1>
        <p className="text-foreground-secondary mb-8 max-w-2xl">
          {language === "vi"
            ? "Hướng dẫn, mẹo và so sánh công cụ tổ chức giải pickleball."
            : "Guides, tips, and comparisons for pickleball tournament organizers."}
        </p>

        {/* Featured post — large card */}
        {featuredPost && featuredTitle && (
          <Link
            to={`/blog/${featuredPost.slug}`}
            className="group block glass-card overflow-hidden mb-8"
          >
            <div className="grid md:grid-cols-2 gap-0">
              {/* Hero image */}
              {showFeaturedImage ? (
                <div className="relative h-56 md:h-full min-h-[240px] overflow-hidden">
                  <img
                    src={normalizeImageUrl(featuredPost.heroImage!.src)}
                    alt={featuredPost.heroImage!.alt}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="eager"
                    onError={() => setFeaturedImgFailed(true)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/40" />
                </div>
              ) : (
                <div className="h-56 md:h-full min-h-[240px] bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center">
                  <span className="text-6xl opacity-30">📝</span>
                </div>
              )}
              {/* Content */}
              <div className="p-6 md:p-8 flex flex-col justify-center">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-primary/15 text-primary border-primary/20">
                    {language === "vi" ? "Nổi bật" : "Featured"}
                  </span>
                  {featuredPost.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getTagColor(tag)}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors line-clamp-2">
                  {featuredTitle}
                </h2>
                <p className="text-foreground-secondary mb-4 line-clamp-3">
                  {featuredDesc}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                    <Calendar className="w-3.5 h-3.5" />
                    <time dateTime={featuredPost.updatedDate}>
                      {new Date(featuredPost.updatedDate).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", {
                        year: "numeric", month: "short", day: "numeric"
                      })}
                    </time>
                    <ViewCountBadge count={viewCounts[pairKey("en", featuredPost.slug)]} className="text-xs" />
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium text-primary">
                    {language === "vi" ? "Đọc tiếp" : "Read more"}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Other posts grid */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {otherPosts.map((post) => (
            <OtherBlogCard
              key={post.slug}
              post={post}
              language={language}
              viewCount={viewCounts[pairKey("en", post.slug)]}
            />
          ))}
        </div>
      </div>
    </MainLayout>
  );
};

export default Blog;
