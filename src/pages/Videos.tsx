import { MainLayout } from "@/components/layout";
import { ContentCard, SectionHeader, EmptyState } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useVideos } from "@/hooks/useSupabaseData";
import { Play } from "lucide-react";

const Videos = () => {
  const { t } = useI18n();

  const { data: videos = [], isLoading } = useVideos();

  return (
    <MainLayout>
      <div className="container-wide py-8">
        <h1 className="text-2xl font-semibold mb-8">{t.nav.videos}</h1>

        <section className="mb-12">
          <SectionHeader title={t.home.sections.latestVideos} />
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : videos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {videos.map((video) => (
                <ContentCard
                  key={video.id}
                  id={video.id}
                  title={video.title}
                  duration={video.duration_seconds ?? 0}
                  views={0}
                  organizationName={video.organization?.name ?? ""}
                  thumbnail={video.thumbnail_url ?? undefined}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={Play} title={t.home.noVideos} />
          )}
        </section>
      </div>
    </MainLayout>
  );
};

export default Videos;
