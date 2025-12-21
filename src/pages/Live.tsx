import { MainLayout } from "@/components/layout";
import { LiveCard, SectionHeader, EmptyState } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useLivestreams } from "@/hooks/useSupabaseData";
import { Radio } from "lucide-react";

const Live = () => {
  const { t } = useI18n();

  const { data: liveStreams = [], isLoading: liveLoading } = useLivestreams("live");
  const { data: scheduledStreams = [], isLoading: scheduledLoading } = useLivestreams("scheduled");

  return (
    <MainLayout>
      <div className="container-wide py-8">
        <h1 className="text-2xl font-semibold mb-8">{t.nav.live}</h1>

        <section className="mb-12">
          <SectionHeader title={t.home.sections.liveNow} />
          {liveLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : liveStreams.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveStreams.map((stream) => (
                <LiveCard
                  key={stream.id}
                  id={stream.id}
                  title={stream.title}
                  viewerCount={0}
                  organizationName={stream.organization?.name ?? ""}
                  status={stream.status as "live" | "scheduled" | "ended"}
                  thumbnail={stream.thumbnail_url ?? undefined}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={Radio} title={t.home.noLive} />
          )}
        </section>

        {(scheduledLoading || scheduledStreams.length > 0) && (
          <section>
            <SectionHeader title={t.live.scheduled} />
            {scheduledLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2].map((i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-video rounded-xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {scheduledStreams.map((stream) => (
                  <LiveCard
                    key={stream.id}
                    id={stream.id}
                    title={stream.title}
                    organizationName={stream.organization?.name ?? ""}
                    status={stream.status as "live" | "scheduled" | "ended"}
                    thumbnail={stream.thumbnail_url ?? undefined}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </MainLayout>
  );
};

export default Live;
