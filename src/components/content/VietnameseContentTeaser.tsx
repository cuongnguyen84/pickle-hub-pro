import { Link } from "react-router-dom";
import { usePublishedViBlogPosts } from "@/hooks/useViBlogPosts";

export function VietnameseContentTeaser() {
  const { data: posts } = usePublishedViBlogPosts();

  if (!posts || posts.length === 0) return null;

  return (
    <section className="container-wide section-spacing">
      <div className="glass-card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">🇻🇳</span>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Pickleball in Vietnam</h2>
            <p className="text-foreground-secondary text-sm">
              Vietnamese pickleball content from our local team
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {posts.slice(0, 3).map((post) => (
            <Link
              key={post.slug}
              to={`/vi/blog/${post.slug}`}
              hrefLang="vi"
              className="block p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-primary/30 transition-all duration-200"
            >
              <h3 className="font-semibold text-foreground line-clamp-2">{post.title}</h3>
              {post.excerpt && (
                <p className="text-sm text-foreground-secondary mt-2 line-clamp-2">
                  {post.excerpt}
                </p>
              )}
              <span className="text-xs text-primary mt-2 inline-block">
                Đọc bằng tiếng Việt →
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/vi"
            hrefLang="vi"
            className="text-primary hover:underline font-medium"
          >
            Visit Vietnamese site →
          </Link>
        </div>
      </div>
    </section>
  );
}
