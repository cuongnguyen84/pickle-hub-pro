import { useState } from "react";
import { Link } from "react-router-dom";
import { blogMetadata, type BlogPostMetadata } from "@/content/blog";
import { ArrowRight, ChevronRight } from "lucide-react";
import { normalizeImageUrl } from "@/lib/url-utils";

// Tag color palette — same as Blog.tsx
const TAG_COLORS = [
  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  "bg-red-500/15 text-red-400 border-red-500/20",
];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function EnBlogCard({ post }: { post: BlogPostMetadata }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!post.heroImage && !imgFailed;

  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group block rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-primary/30 transition-all duration-200 overflow-hidden"
    >
      {/* Thumbnail */}
      {showImage ? (
        <div className="relative h-36 overflow-hidden">
          <img
            src={normalizeImageUrl(post.heroImage!.src)}
            alt={post.heroImage!.alt}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          {/* Tags overlay */}
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
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
      ) : null}

      <div className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {post.titleEn}
        </h3>

        {/* Excerpt */}
        <p className="text-sm text-foreground-secondary mt-2 line-clamp-2">
          {post.metaDescriptionEn}
        </p>

        {/* Read more */}
        <div className="flex items-center gap-1 text-sm font-medium text-primary mt-3">
          Read more
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

export function EnHomeBlogSection() {
  const posts = [...blogMetadata]
    .sort((a, b) => new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime())
    .slice(0, 3);

  if (posts.length === 0) return null;

  return (
    <section className="container-wide section-spacing">
      <div className="glass-card p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-foreground">Pickleball Blog</h2>
              <p className="text-foreground-secondary text-sm">
                Guides, tips & tournament insights
              </p>
            </div>
          </div>
          <Link
            to="/blog"
            className="hidden sm:flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            View all
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Post cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {posts.map((post) => (
            <EnBlogCard key={post.slug} post={post} />
          ))}
        </div>

        {/* Mobile "View all" */}
        <div className="mt-5 text-center sm:hidden">
          <Link to="/blog" className="text-primary hover:underline font-medium text-sm">
            View all posts →
          </Link>
        </div>
      </div>
    </section>
  );
}
