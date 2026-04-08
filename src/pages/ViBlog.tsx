import { usePublishedViBlogPosts } from "@/hooks/useViBlogPosts";
import { DynamicMeta, BreadcrumbSchema } from "@/components/seo";
import MainLayout from "@/components/layout/MainLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { ViBlogCard } from "@/components/content/ViBlogCard";

const ViBlog = () => {
  const { data: posts, isLoading } = usePublishedViBlogPosts();

  const breadcrumbItems = [
    { name: "Trang chủ", url: "https://www.thepicklehub.net/vi" },
    { name: "Blog", url: "https://www.thepicklehub.net/vi/blog" },
  ];

  return (
    <MainLayout>
      <DynamicMeta
        title="Blog Pickleball Việt Nam"
        description="Đọc blog pickleball Việt Nam: luật chơi, kỹ thuật, sân chơi, giải đấu, và mọi điều về cộng đồng pickleball Việt từ ThePickleHub."
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
              <ViBlogCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ViBlog;
