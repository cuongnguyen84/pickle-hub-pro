import { MainLayout } from "@/components/layout";
import { ContentCard, LiveCard, SectionHeader, EmptyState } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useVideos, useReplays } from "@/hooks/useSupabaseData";
import { Play, RotateCcw } from "lucide-react";

const Videos = () => {
  const { t } = useI18n();

  const { data: videos = [], isLoading: videosLoading } = useVideos();
  const { data: replays = [], isLoading: replaysLoading } = useReplays();

  return (
    <MainLayout>
      <div className="container-wide py-8">
        <h1 className="text-2xl font-semibold mb-8">{t.nav.videos}</h1>

        {/* Replays section */}
        {(replaysLoading || replays.length > 0) && (
          <section className="mb-12">
            <SectionHeader title={t.live.replay} />
            {replaysLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-video rounded-xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : replays.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {replays.map((stream) => (
                  <LiveCard
                    key={stream.id}
                    id={stream.id!}
                    title={stream.title ?? ""}
                    organizationName={stream.organization?.name ?? ""}
                    status="ended"
                    thumbnail={stream.thumbnail_url ?? undefined}
                    isReplay
                  />
                ))}
              </div>
            ) : null}
          </section>
        )}

        {/* Videos section */}
        <section className="mb-12">
          <SectionHeader title={t.home.sections.latestVideos} />
          {videosLoading ? (
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
