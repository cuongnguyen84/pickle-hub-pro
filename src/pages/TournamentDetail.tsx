import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { ContentCard, LiveCard, SectionHeader, EmptyState } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { useTournamentBySlug, useTournamentContent } from "@/hooks/useSupabaseData";
import { Trophy, Calendar, Radio, Play, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const TournamentDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useI18n();
  
  const { data: tournament, isLoading: tournamentLoading } = useTournamentBySlug(slug ?? "");
  const { data: content, isLoading: contentLoading } = useTournamentContent(tournament?.id ?? "");

  const isLoading = tournamentLoading || contentLoading;

  if (tournamentLoading) {
    return (
      <MainLayout>
        <div className="container-wide py-8">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-48 mb-8" />
          <div className="grid gap-6">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
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
            {t.errors.goHome}
          </Link>
        </div>
      </MainLayout>
    );
  }

  const statusColors = {
    ongoing: "bg-live text-foreground",
    upcoming: "bg-primary text-primary-foreground",
    ended: "bg-muted text-foreground-muted",
  };

  const statusText = {
    ongoing: t.tournament.ongoing,
    upcoming: t.tournament.upcoming,
    ended: t.tournament.ended,
  };

  const liveStreams = content?.livestreams.filter(ls => ls.status === "live") ?? [];
  const scheduledStreams = content?.livestreams.filter(ls => ls.status === "scheduled") ?? [];
  const replays = content?.livestreams.filter(ls => ls.status === "ended" && ls.mux_playback_id) ?? [];
  const videos = content?.videos ?? [];

  return (
    <MainLayout>
      <div className="container-wide py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{tournament.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={cn("text-xs", statusColors[tournament.status])}>
                  {statusText[tournament.status]}
                </Badge>
                {tournament.start_date && (
                  <span className="text-sm text-foreground-muted flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(tournament.start_date), "dd/MM/yyyy")}
                    {tournament.end_date && ` - ${format(new Date(tournament.end_date), "dd/MM/yyyy")}`}
                  </span>
                )}
              </div>
            </div>
          </div>
          {tournament.description && (
            <p className="text-foreground-muted mt-4">{tournament.description}</p>
          )}
        </div>

        {contentLoading ? (
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-6 w-48 mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((j) => (
                    <Skeleton key={j} className="aspect-video rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            {/* Live Now */}
            {liveStreams.length > 0 && (
              <section>
                <SectionHeader title={t.home.sections.liveNow} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {liveStreams.map((stream) => (
                    <LiveCard
                      key={stream.id}
                      id={stream.id!}
                      title={stream.title ?? ""}
                      viewerCount={0}
                      organizationName={stream.organization?.name ?? ""}
                      status="live"
                      thumbnail={stream.thumbnail_url ?? undefined}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Scheduled */}
            {scheduledStreams.length > 0 && (
              <section>
                <SectionHeader title={t.live.scheduled} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {scheduledStreams.map((stream) => (
                    <LiveCard
                      key={stream.id}
                      id={stream.id!}
                      title={stream.title ?? ""}
                      organizationName={stream.organization?.name ?? ""}
                      status="scheduled"
                      thumbnail={stream.thumbnail_url ?? undefined}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Replays */}
            {replays.length > 0 && (
              <section>
                <SectionHeader title={t.live.replay} />
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
              </section>
            )}

            {/* Videos */}
            {videos.length > 0 && (
              <section>
                <SectionHeader title={t.organization.videos} />
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
              </section>
            )}

            {/* Empty state if nothing */}
            {liveStreams.length === 0 && scheduledStreams.length === 0 && replays.length === 0 && videos.length === 0 && (
              <EmptyState icon={Play} title={t.common.noResults} />
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default TournamentDetail;
