import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { blogPosts } from "@/lib/blog-data";
import { DynamicMeta, BreadcrumbSchema } from "@/components/seo";
import MainLayout from "@/components/layout/MainLayout";
import { Calendar, ArrowRight } from "lucide-react";

const Blog = () => {
  const { language } = useI18n();

  const breadcrumbItems = [
    { name: "Blog", url: "https://www.thepicklehub.net/blog" },
  ];

  return (
    <MainLayout>
      <DynamicMeta
        title={language === "vi" ? "Blog Pickleball — Hướng dẫn & Mẹo tổ chức giải" : "Pickleball Blog — Tournament Guides & Tips"}
        description={language === "vi"
          ? "Hướng dẫn tổ chức giải pickleball, tạo bracket, round robin, và phần mềm giải đấu miễn phí."
          : "Guides on pickleball tournament organization, bracket creation, round robin scheduling, and free tournament software."}
      />
      <BreadcrumbSchema items={breadcrumbItems} />

      <div className="container-wide py-8 md:py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          {language === "vi" ? "Blog Pickleball" : "Pickleball Blog"}
        </h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          {language === "vi"
            ? "Hướng dẫn, mẹo và so sánh công cụ tổ chức giải pickleball."
            : "Guides, tips, and comparisons for pickleball tournament organizers."}
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...blogPosts].sort((a, b) => new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime()).map((post) => {
            const content = language === "vi" ? post.content.vi : post.content.en;
            return (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group block rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:shadow-lg"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <Calendar className="w-3.5 h-3.5" />
                  <time dateTime={post.updatedDate}>{post.updatedDate}</time>
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                  {content.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {content.metaDescription}
                </p>
                <div className="flex items-center gap-1 text-sm font-medium text-primary">
                  {language === "vi" ? "Đọc tiếp" : "Read more"}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
};

export default Blog;
