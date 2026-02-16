import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { useI18n } from "@/i18n";
import { useVideo, useVideos, useViewCount } from "@/hooks/useSupabaseData";
import { LikeButton } from "@/components/content/LikeButton";
import { CommentSection } from "@/components/content/CommentSection";
import { ContentCard } from "@/components/content";
import { MuxPlayer, AdaptiveVideoPlayer } from "@/components/video";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef } from "react";
import { ArrowLeft, Eye, Calendar, Clock, Play, BadgeCheck } from "lucide-react";
import { useGeoBlock } from "@/hooks/useGeoBlock";
import { GeoBlockOverlay } from "@/components/video/GeoBlockOverlay";
import { format } from "date-fns";
import { vi as viLocale, enUS } from "date-fns/locale";
import { ShareDialog } from "@/components/share";
import { DynamicMeta } from "@/components/seo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const WatchVideo = () => {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const viewRecorded = useRef(false);
  const { isBlocked } = useGeoBlock();

  const { data: video, isLoading } = useVideo(id!);
  const { data: viewCount = 0 } = useViewCount("video", id!);
  const { data: relatedVideos = [] } = useVideos({ limit: 4 });

  const dateLocale = language === "vi" ? viLocale : enUS;

  // Get video URL for storage-based videos
  const storageVideoUrl = useMemo(() => {
    if (video?.source === "storage" && video?.storage_path) {
      const { data } = supabase.storage.from("videos").getPublicUrl(video.storage_path);
      return data.publicUrl;
    }
    return null;
  }, [video?.source, video?.storage_path]);

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

    // 3s threshold for view counting
    const timer = setTimeout(recordView, 3000);
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
  const hasStorageVideo = video.source === "storage" && !!storageVideoUrl;

  return (
    <MainLayout>
      {/* Dynamic OG tags for sharing */}
      <DynamicMeta
        title={video.title}
        description={video.description ?? `Watch ${video.title} on The Pickle Hub`}
        image={video.thumbnail_url ?? undefined}
        type="video.other"
      />
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
            {/* Video Player - Auto aspect ratio */}
            <div className="bg-black rounded-xl overflow-hidden relative">
              {isBlocked && <GeoBlockOverlay />}
              {hasStorageVideo ? (
                // Storage-based video with adaptive aspect ratio
                <AdaptiveVideoPlayer
                  src={storageVideoUrl!}
                  poster={video.thumbnail_url ?? undefined}
                  className="rounded-xl"
                />
              ) : hasPlayback ? (
                // Mux player fallback
                <div className="aspect-video">
                  <MuxPlayer
                    playbackId={video.mux_playback_id!}
                    title={video.title}
                    poster={video.thumbnail_url ?? undefined}
                    streamType="on-demand"
                    type="video"
                  />
                </div>
              ) : video.thumbnail_url ? (
                <div className="relative aspect-video">
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
                  {/* Duration badge */}
                  {video.duration_seconds && (
                    <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/80 rounded text-white text-sm font-medium">
                      {formatDuration(video.duration_seconds)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video flex items-center justify-center bg-muted">
                  <span className="text-foreground-muted">{t.player.notReady}</span>
                </div>
              )}
            </div>

            {/* Video Info */}
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold text-foreground">{video.title}</h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-foreground-secondary">
                {video.organization && (
                  <Link
                    to={`/org/${video.organization.slug}`}
                    className="font-medium text-primary hover:underline inline-flex items-center gap-2"
                  >
                    <Avatar className="w-6 h-6 border border-primary/20">
                      <AvatarImage 
                        src={video.organization.display_logo ?? video.organization.logo_url ?? undefined} 
                        alt={video.organization.name} 
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {video.organization.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="inline-flex items-center gap-1">
                      {video.organization.name}
                      <BadgeCheck className="w-4 h-4 text-primary" />
                    </span>
                  </Link>
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

              {/* Like & Share Buttons */}
              <div className="flex items-center gap-4 py-2 border-t border-b border-border">
                <LikeButton targetType="video" targetId={video.id} />
                <ShareDialog
                  type="video"
                  id={video.id}
                  title={video.title}
                  thumbnail={video.thumbnail_url ?? undefined}
                />
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
                    organizationSlug={relatedVideo.organization?.slug}
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
