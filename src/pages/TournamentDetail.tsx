import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { ContentCard, LiveCard, EmptyState } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { useTournamentBySlug, useTournamentContent } from "@/hooks/useSupabaseData";
import { TournamentHero, ContentSection, CourtTabs } from "@/components/tournament";
import { Trophy, Radio, Clock, RotateCcw, Play } from "lucide-react";

const TournamentDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useI18n();
  
  const { data: tournament, isLoading: tournamentLoading } = useTournamentBySlug(slug ?? "");
  const { data: content, isLoading: contentLoading } = useTournamentContent(tournament?.id ?? "");

  const [videoFilter, setVideoFilter] = useState<"all" | "short" | "long">("all");

  // Process content
  const { liveStreams, scheduledStreams, replays, videos, filteredVideos } = useMemo(() => {
    const livestreams = content?.livestreams ?? [];
    const allVideos = content?.videos ?? [];

    return {
      liveStreams: livestreams.filter(ls => ls.status === "live"),
      scheduledStreams: livestreams
        .filter(ls => ls.status === "scheduled")
        .sort((a, b) => {
          if (!a.scheduled_start_at || !b.scheduled_start_at) return 0;
          return new Date(a.scheduled_start_at).getTime() - new Date(b.scheduled_start_at).getTime();
        }),
      replays: livestreams
        .filter(ls => ls.status === "ended" && ls.mux_playback_id)
        .sort((a, b) => {
          const aDate = a.ended_at || a.created_at;
          const bDate = b.ended_at || b.created_at;
          if (!aDate || !bDate) return 0;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        }),
      videos: allVideos,
      filteredVideos: videoFilter === "all" 
        ? allVideos 
        : allVideos.filter(v => v.type === videoFilter),
    };
  }, [content, videoFilter]);

  if (tournamentLoading) {
    return (
      <MainLayout>
        <div className="container-wide py-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-12 w-96 mb-4" />
          <Skeleton className="h-6 w-64 mb-8" />
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-7 w-48 mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((j) => (
                    <Skeleton key={j} className="aspect-video rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!tournament) {
    return (
      <MainLayout>
        <div className="container-wide py-16 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-foreground-muted" />
          <h1 className="text-xl font-semibold mb-2">{t.errors.notFound}</h1>
          <p className="text-foreground-muted mb-6">{t.errors.notFoundDesc}</p>
          <Link to="/tournaments" className="text-primary hover:underline">
            {t.nav.tournaments}
          </Link>
        </div>
      </MainLayout>
    );
  }

  const hasAnyContent = liveStreams.length > 0 || scheduledStreams.length > 0 || replays.length > 0 || videos.length > 0;

  return (
    <MainLayout>
      {/* Hero Section */}
      <TournamentHero
        id={tournament.id}
        name={tournament.name}
        description={tournament.description}
        status={tournament.status}
        startDate={tournament.start_date}
        endDate={tournament.end_date}
        slug={tournament.slug}
      />

      <div className="container-wide pb-12">
        {contentLoading ? (
          <div className="space-y-10 pt-4">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-7 w-48 mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((j) => (
                    <Skeleton key={j} className="aspect-video rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : !hasAnyContent ? (
          <div className="py-12">
            <EmptyState
              icon={Play}
              title={t.common.noResults}
              description={t.tournament.checkBackLater}
            />
          </div>
        ) : (
          <div className="space-y-10 pt-4">
            {/* Live Now Section */}
            {(liveStreams.length > 0 || tournament.status === "ongoing") && (
              <ContentSection
                title={t.tournament.liveNow}
                count={liveStreams.length}
                icon={Radio}
                isEmpty={liveStreams.length === 0}
                emptyTitle={t.tournament.noLive}
                horizontal={liveStreams.length > 0}
              >
                {liveStreams.length > 0 && (
                  <CourtTabs
                    items={liveStreams}
                    renderItem={(stream) => (
                      <LiveCard
                        key={stream.id}
                        id={stream.id!}
                        title={stream.title ?? ""}
                        viewerCount={0}
                        organizationName={stream.organization?.name ?? ""}
                        status="live"
                        thumbnail={stream.thumbnail_url ?? undefined}
                      />
                    )}
                  />
                )}
              </ContentSection>
            )}

            {/* Scheduled Section */}
            {(scheduledStreams.length > 0 || tournament.status !== "ended") && (
              <ContentSection
                title={t.tournament.scheduled}
                count={scheduledStreams.length}
                icon={Clock}
                isEmpty={scheduledStreams.length === 0}
                emptyTitle={t.tournament.noScheduled}
              >
                {scheduledStreams.length > 0 && (
                  <CourtTabs
                    items={scheduledStreams}
                    renderItem={(stream) => (
                      <LiveCard
                        key={stream.id}
                        id={stream.id!}
                        title={stream.title ?? ""}
                        organizationName={stream.organization?.name ?? ""}
                        status="scheduled"
                        thumbnail={stream.thumbnail_url ?? undefined}
                        scheduledAt={stream.scheduled_start_at ?? undefined}
                      />
                    )}
                  />
                )}
              </ContentSection>
            )}

            {/* Replays Section */}
            {replays.length > 0 && (
              <ContentSection
                title={t.tournament.replays}
                count={replays.length}
                icon={RotateCcw}
                isEmpty={replays.length === 0}
                emptyTitle={t.tournament.noReplays}
              >
                <CourtTabs
                  items={replays}
                  renderItem={(stream) => (
                    <LiveCard
                      key={stream.id}
                      id={stream.id!}
                      title={stream.title ?? ""}
                      organizationName={stream.organization?.name ?? ""}
                      status="ended"
                      thumbnail={stream.thumbnail_url ?? undefined}
                      isReplay
                    />
                  )}
                />
              </ContentSection>
            )}

            {/* Videos Section */}
            {videos.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg md:text-xl font-semibold text-foreground">
                      {t.tournament.videos}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-foreground-muted text-sm font-medium">
                      {videos.length}
                    </span>
                  </div>

                  {/* Video type filter chips */}
                  <div className="flex gap-1">
                    {(["all", "short", "long"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setVideoFilter(filter)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          videoFilter === filter
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground-muted hover:bg-muted/80"
                        }`}
                      >
                        {filter === "all" && t.tournament.allVideos}
                        {filter === "short" && t.tournament.shortVideos}
                        {filter === "long" && t.tournament.longVideos}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredVideos.length === 0 ? (
                  <EmptyState icon={Play} title={t.common.noResults} />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {filteredVideos.map((video) => (
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
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default TournamentDetail;
