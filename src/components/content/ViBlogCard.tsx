import { Link } from "react-router-dom";
import { Calendar, ArrowRight } from "lucide-react";
import { normalizeImageUrl } from "@/lib/url-utils";
import { ViewCountBadge } from "@/components/blog/ViewCountBadge";

interface ViBlogCardPost {
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: string | null;
  published_at: string | null;
}

interface ViBlogCardProps {
  post: ViBlogCardPost;
  viewCount?: number;
}

export function ViBlogCard({ post, viewCount }: ViBlogCardProps) {
  return (
    <Link
      to={`/vi/blog/${post.slug}`}
      className="group block rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:shadow-lg"
    >
      {post.cover_image_url && (
        <img
          src={normalizeImageUrl(post.cover_image_url)}
          alt={post.title}
          className="w-full h-40 object-cover rounded-lg mb-4"
          loading="lazy"
        />
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <Calendar className="w-3.5 h-3.5" />
        {post.published_at && (
          <time dateTime={post.published_at}>
            {new Date(post.published_at).toLocaleDateString("vi-VN")}
          </time>
        )}
        {post.category && (
          <span className="bg-muted px-2 py-0.5 rounded text-xs">{post.category}</span>
        )}
        <ViewCountBadge count={viewCount} className="text-xs ml-auto" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
        {post.title}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
        {post.excerpt}
      </p>
      <div className="flex items-center gap-1 text-sm font-medium text-primary">
        Đọc tiếp
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
