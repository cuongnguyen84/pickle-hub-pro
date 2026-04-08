import { Link } from "react-router-dom";
import { usePublishedViBlogPosts } from "@/hooks/useViBlogPosts";
import { ViBlogCard } from "./ViBlogCard";


export function ViHomeBlogSection() {
  const { data: posts, isLoading } = usePublishedViBlogPosts();

  if (isLoading || !posts || posts.length === 0) return null;

  return (
    <section className="container-wide section-spacing">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bài viết mới nhất</h2>
          <p className="text-foreground-secondary mt-1">
            Hướng dẫn, mẹo và kiến thức pickleball cho người Việt
          </p>
        </div>
        <Link
          to="/vi/blog"
          className="text-primary hover:underline font-medium hidden sm:block"
        >
          Xem tất cả →
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.slice(0, 6).map((post) => (
          <ViBlogCard key={post.slug} post={post} />
        ))}
      </div>

      <div className="mt-6 text-center sm:hidden">
        <Link to="/vi/blog" className="text-primary hover:underline font-medium">
          Xem tất cả bài viết →
        </Link>
      </div>
    </section>
  );
}
