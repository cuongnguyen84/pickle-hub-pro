import { useState } from "react";
import { Link } from "react-router-dom";
import { usePublishedViBlogPosts, type ViBlogPost } from "@/hooks/useViBlogPosts";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { normalizeImageUrl } from "@/lib/url-utils";

// Category badge config — matches vi_blog_posts.category values
const CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  tournament: { label: "TIN NÓNG", className: "bg-red-500/15 text-red-400 border-red-500/20" },
  rules: { label: "HƯỚNG DẪN", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  local: { label: "ĐỊA ĐIỂM", className: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  beginner: { label: "CHO NGƯỜI MỚI", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  news: { label: "TIN TỨC", className: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  tips: { label: "MẸO HAY", className: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20" },
};

type PostSummary = Pick<
  ViBlogPost,
  "id" | "slug" | "title" | "excerpt" | "cover_image_url" | "category" | "published_at" | "tags"
>;

function ViBlogCard({ post }: { post: PostSummary }) {
  const [imgFailed, setImgFailed] = useState(false);
  const catConfig = post.category ? CATEGORY_CONFIG[post.category] : null;
  const showImage = !!post.cover_image_url && !imgFailed;

  return (
    <Link
      to={`/vi/blog/${post.slug}`}
      hrefLang="vi"
      className="group block rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-primary/30 transition-all duration-200 overflow-hidden"
    >
      {/* Thumbnail */}
      {showImage ? (
        <div className="relative h-36 overflow-hidden">
          <img
            src={normalizeImageUrl(post.cover_image_url!)}
            alt={post.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          {catConfig && (
            <div className="absolute bottom-2 left-2">
              <span
                className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border backdrop-blur-sm ${catConfig.className}`}
              >
                {catConfig.label}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="relative h-36 bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center">
          <span className="text-4xl opacity-20">🇻🇳</span>
          {catConfig && (
            <div className="absolute bottom-2 left-2">
              <span
                className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${catConfig.className}`}
              >
                {catConfig.label}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {post.title}
        </h3>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-sm text-foreground-secondary mt-2 line-clamp-2">
            {post.excerpt}
          </p>
        )}

        {/* Read more */}
        <div className="flex items-center gap-1 text-sm font-medium text-primary mt-3">
          Đọc tiếp
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

export function ViHomeBlogSection() {
  const { data: posts, isLoading } = usePublishedViBlogPosts();
  const { language } = useI18n();

  if (isLoading || !posts || posts.length === 0) return null;

  return (
    <section className="container-wide section-spacing">
      <div className="glass-card p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🇻🇳</span>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-foreground">Pickleball Việt Nam</h2>
              <p className="text-foreground-secondary text-sm">
                {language === 'vi'
                  ? 'Nội dung tiếng Việt từ cộng đồng'
                  : 'Vietnamese pickleball content from our local team'
                }
              </p>
            </div>
          </div>
          <Link
            to="/vi/blog"
            className="hidden sm:flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            {language === 'vi' ? 'Xem tất cả' : 'View all'}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Post cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {posts.slice(0, 3).map((post) => (
            <ViBlogCard key={post.slug} post={post} />
          ))}
        </div>

        {/* Mobile "View all" */}
        <div className="mt-5 text-center sm:hidden">
          <Link to="/vi/blog" className="text-primary hover:underline font-medium text-sm">
            {language === 'vi' ? 'Xem tất cả bài viết →' : 'View all posts →'}
          </Link>
        </div>
      </div>
    </section>
  );
}
