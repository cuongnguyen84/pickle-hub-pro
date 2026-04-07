import { Link } from "react-router-dom";
import { usePublishedViBlogPosts } from "@/hooks/useViBlogPosts";
import { DynamicMeta, BreadcrumbSchema } from "@/components/seo";
import MainLayout from "@/components/layout/MainLayout";
import { Calendar, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ViBlog = () => {
  const { data: posts, isLoading } = usePublishedViBlogPosts();

  const breadcrumbItems = [
    { name: "Trang chủ", url: "https://www.thepicklehub.net/vi" },
    { name: "Blog", url: "https://www.thepicklehub.net/vi/blog" },
  ];

  return (
    <MainLayout>
      <DynamicMeta
        title="Blog Pickleball Việt Nam | ThePickleHub"
        description="Đọc blog pickleball Việt Nam: luật chơi, kỹ thuật, sân chơi, giải đấu, và mọi điều về cộng đồng pickleball Việt từ ThePickleHub."
        lang="vi"
      />
      <BreadcrumbSchema items={breadcrumbItems} />

      <div className="container-wide py-8 md:py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Blog Pickleball Việt Nam
        </h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Hướng dẫn, mẹo và kiến thức pickleball cho người Việt Nam.
        </p>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : !posts || posts.length === 0 ? (
          <p className="text-muted-foreground">Chưa có bài viết nào.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.slug}
                to={`/vi/blog/${post.slug}`}
                className="group block rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:shadow-lg"
              >
                {post.cover_image_url && (
                  <img
                    src={post.cover_image_url}
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
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                  {post.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {post.excerpt}
                </p>
                <div className="flex items-center gap-1 text-sm font-medium text-primary">
                  Đọc tiếp
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ViBlog;
