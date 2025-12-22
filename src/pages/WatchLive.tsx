import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { useI18n } from "@/i18n";
import { useLivestream, useLivestreams, useViewCount } from "@/hooks/useSupabaseData";
import { LikeButton } from "@/components/content/LikeButton";
import { CommentSection } from "@/components/content/CommentSection";
import { LiveCard } from "@/components/content";
import { MuxPlayer } from "@/components/video";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef } from "react";
import { ArrowLeft, Radio, Calendar, Users, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { vi as viLocale, enUS } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

const WatchLive = () => {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const viewRecorded = useRef(false);

  const { data: livestream, isLoading } = useLivestream(id!);
  const { data: viewCount = 0 } = useViewCount("livestream", id!);
  const { data: otherLivestreams = [] } = useLivestreams("live");

  const dateLocale = language === "vi" ? viLocale : enUS;

  // Record view event
  useEffect(() => {
    if (!id || viewRecorded.current) return;

    const recordView = async () => {
      await supabase.from("view_events").insert({
        target_type: "livestream",
        target_id: id,
        viewer_user_id: user?.id ?? null,
        organization_id: livestream?.organization_id ?? null,
      });
      viewRecorded.current = true;
    };

    const timer = setTimeout(recordView, 5000);
    return () => clearTimeout(timer);
  }, [id, user?.id, livestream?.organization_id]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container-wide section-spacing">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="aspect-video rounded-xl" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!livestream) {
    return (
      <MainLayout>
        <div className="container-wide section-spacing text-center">
          <h1 className="text-2xl font-semibold">{t.errors.notFound}</h1>
          <Link to="/live" className="text-primary hover:underline mt-4 inline-block">
            {t.errors.goHome}
          </Link>
        </div>
      </MainLayout>
    );
  }

  const statusVariant = {
    live: "destructive" as const,
    scheduled: "secondary" as const,
    ended: "outline" as const,
  };

  const statusText = {
    live: t.live.live,
    scheduled: t.live.scheduled,
    ended: t.live.ended,
  };

  const hasPlayback = !!livestream.mux_playback_id;
  const isLive = livestream.status === "live";
  const isScheduled = livestream.status === "scheduled";

  return (
    <MainLayout>
      <div className="container-wide section-spacing">
        {/* Back Button */}
        <Link
          to="/live"
          className="inline-flex items-center gap-2 text-foreground-secondary hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">{t.nav.live}</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            <div className="aspect-video bg-surface-elevated rounded-xl overflow-hidden relative">
              {hasPlayback ? (
                <MuxPlayer
                  playbackId={livestream.mux_playback_id!}
                  title={livestream.title}
                  poster={livestream.thumbnail_url ?? undefined}
                  streamType={isLive ? "live" : "on-demand"}
                  type="livestream"
                  isLive={isLive}
                />
              ) : isScheduled ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted gap-4">
                  <Radio className="w-12 h-12 text-foreground-muted" />
                  <p className="text-foreground-secondary text-center px-4">
                    {t.live.scheduled} - {livestream.scheduled_start_at && format(
                      new Date(livestream.scheduled_start_at),
                      "dd MMM yyyy, HH:mm",
                      { locale: dateLocale }
                    )}
                  </p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted gap-4">
                  {livestream.thumbnail_url ? (
                    <img
                      src={livestream.thumbnail_url}
                      alt={livestream.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <AlertCircle className="w-12 h-12 text-foreground-muted" />
                      <p className="text-foreground-secondary">{t.player.notReady}</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Stream Info */}
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-2xl font-semibold text-foreground">{livestream.title}</h1>
                <Badge variant={statusVariant[livestream.status]}>
                  {statusText[livestream.status]}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-foreground-secondary">
                {livestream.organization && (
                  <span className="font-medium text-primary">
                    {livestream.organization.name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {viewCount.toLocaleString()} {t.live.watching}
                </span>
                {livestream.scheduled_start_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(livestream.scheduled_start_at), "dd MMM yyyy, HH:mm", {
                      locale: dateLocale,
                    })}
                  </span>
                )}
              </div>

              {/* Like Button */}
              <div className="flex items-center gap-4 py-2 border-t border-b border-border">
                <LikeButton targetType="livestream" targetId={livestream.id} />
              </div>

              {/* Description */}
              {livestream.description && (
                <div className="bg-surface-elevated rounded-lg p-4">
                  <p className="text-foreground-secondary whitespace-pre-wrap">
                    {livestream.description}
                  </p>
                </div>
              )}
            </div>

            {/* Comments Section */}
            <CommentSection targetType="livestream" targetId={livestream.id} />
          </div>

          {/* Sidebar - Other Live Streams */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t.home.sections.liveNow}</h3>
            <div className="space-y-4">
              {otherLivestreams
                .filter((s) => s.id !== livestream.id)
                .slice(0, 4)
                .map((stream) => (
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
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default WatchLive;
