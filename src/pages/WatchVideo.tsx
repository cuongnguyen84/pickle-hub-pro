import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { useI18n } from "@/i18n";
import { useVideo, useVideos, useViewCount } from "@/hooks/useSupabaseData";
import { LikeButton } from "@/components/content/LikeButton";
import { CommentSection } from "@/components/content/CommentSection";
import { ContentCard } from "@/components/content";
import { MuxPlayer } from "@/components/video";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef } from "react";
import { ArrowLeft, Eye, Calendar, Clock, Play } from "lucide-react";
import { format } from "date-fns";
import { vi as viLocale, enUS } from "date-fns/locale";

const WatchVideo = () => {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const viewRecorded = useRef(false);

  const { data: video, isLoading } = useVideo(id!);
  const { data: viewCount = 0 } = useViewCount("video", id!);
  const { data: relatedVideos = [] } = useVideos({ limit: 4 });

  const dateLocale = language === "vi" ? viLocale : enUS;

  // Record view event (debounced - only once per session)
  useEffect(() => {
    if (!id || viewRecorded.current) return;

    const recordView = async () => {
      await supabase.from("view_events").insert({
        target_type: "video",
        target_id: id,
        viewer_user_id: user?.id ?? null,
        organization_id: video?.organization_id ?? null,
      });
      viewRecorded.current = true;
    };

    // Delay to ensure user actually watches
    const timer = setTimeout(recordView, 5000);
    return () => clearTimeout(timer);
  }, [id, user?.id, video?.organization_id]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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

  if (!video) {
    return (
      <MainLayout>
        <div className="container-wide section-spacing text-center">
          <h1 className="text-2xl font-semibold">{t.errors.notFound}</h1>
          <Link to="/videos" className="text-primary hover:underline mt-4 inline-block">
            {t.errors.goHome}
          </Link>
        </div>
      </MainLayout>
    );
  }

  const hasPlayback = !!video.mux_playback_id;

  return (
    <MainLayout>
      <div className="container-wide section-spacing">
        {/* Back Button */}
        <Link
          to="/videos"
          className="inline-flex items-center gap-2 text-foreground-secondary hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">{t.nav.videos}</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            <div className="aspect-video bg-surface-elevated rounded-xl overflow-hidden relative">
              {hasPlayback ? (
                <MuxPlayer
                  playbackId={video.mux_playback_id!}
                  title={video.title}
                  poster={video.thumbnail_url ?? undefined}
                  streamType="on-demand"
                  type="video"
                />
              ) : video.thumbnail_url ? (
                <div className="relative w-full h-full">
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-8 h-8 text-foreground fill-foreground ml-1" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <span className="text-foreground-muted">{t.player.notReady}</span>
                </div>
              )}
              
              {/* Duration badge */}
              {video.duration_seconds && !hasPlayback && (
                <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/80 rounded text-white text-sm font-medium">
                  {formatDuration(video.duration_seconds)}
                </div>
              )}
            </div>

            {/* Video Info */}
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold text-foreground">{video.title}</h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-foreground-secondary">
                {video.organization && (
                  <span className="font-medium text-primary">
                    {video.organization.name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {viewCount.toLocaleString()} {t.video.views}
                </span>
                {video.published_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(video.published_at), "dd MMM yyyy", { locale: dateLocale })}
                  </span>
                )}
                {video.duration_seconds && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDuration(video.duration_seconds)}
                  </span>
                )}
              </div>

              {/* Like Button */}
              <div className="flex items-center gap-4 py-2 border-t border-b border-border">
                <LikeButton targetType="video" targetId={video.id} />
              </div>

              {/* Description */}
              {video.description && (
                <div className="bg-surface-elevated rounded-lg p-4">
                  <p className="text-foreground-secondary whitespace-pre-wrap">
                    {video.description}
                  </p>
                </div>
              )}

              {/* Tags */}
              {video.tags && video.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {video.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Comments Section */}
            <CommentSection targetType="video" targetId={video.id} />
          </div>

          {/* Sidebar - Related Videos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t.video.relatedVideos}</h3>
            <div className="space-y-4">
              {relatedVideos
                .filter((v) => v.id !== video.id)
                .slice(0, 4)
                .map((relatedVideo) => (
                  <ContentCard
                    key={relatedVideo.id}
                    id={relatedVideo.id}
                    title={relatedVideo.title}
                    duration={relatedVideo.duration_seconds ?? 0}
                    views={0}
                    organizationName={relatedVideo.organization?.name ?? ""}
                    thumbnail={relatedVideo.thumbnail_url ?? undefined}
                  />
                ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default WatchVideo;
