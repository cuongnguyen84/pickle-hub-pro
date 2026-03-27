import { MainLayout } from "@/components/layout";
import { useNewsItems } from "@/hooks/useNewsItems";
import { NewsCard } from "@/components/news/NewsCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper } from "lucide-react";
import { useI18n } from "@/i18n";
import { DynamicMeta } from "@/components/seo";

export default function News() {
  const { t } = useI18n();
  const { data: news = [], isLoading } = useNewsItems({ limit: 30 });

  return (
    <MainLayout>
      <div className="container-wide py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Newspaper className="w-6 h-6" />
            {t.news.title}
          </h1>
          <p className="text-foreground-secondary mt-2">{t.news.subtitle}</p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
            ))}
          </div>
        ) : news.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {news.map((item) => (
              <NewsCard
                key={item.id}
                title={item.title}
                summary={item.summary}
                source={item.source}
                sourceUrl={item.source_url}
                publishedAt={item.published_at}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Newspaper className="w-12 h-12 mx-auto text-foreground-muted mb-4" />
            <p className="text-foreground-muted">{t.news.noNews}</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
