import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { useI18n } from "@/i18n";
import { useLivestream, useLivestreams, useViewCount } from "@/hooks/useSupabaseData";
import { useLivePresence } from "@/hooks/useLivePresence";
import { LikeButton } from "@/components/content/LikeButton";
import { CommentSection } from "@/components/content/CommentSection";
import { LiveCard } from "@/components/content";
import { MuxPlayer } from "@/components/video";
import type { MuxPlayerHandle } from "@/components/video/MuxPlayer";
import { ChatPanel } from "@/components/chat";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, Radio, Calendar, Users, AlertCircle, MessageCircle, ChevronDown, ChevronUp, BadgeCheck, Eye } from "lucide-react";
import { format } from "date-fns";
import { vi as viLocale, enUS } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShareDialog } from "@/components/share";
import { DynamicMeta, EndedLivestreamSEO, VideoSchema } from "@/components/seo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useLivestreamGate } from "@/hooks/useLivestreamGate";
import { PreviewCountdown } from "@/components/video/PreviewCountdown";
import { LivestreamGateOverlay } from "@/components/video/LivestreamGateOverlay";
import { useGeoBlock } from "@/hooks/useGeoBlock";
import { GeoBlockOverlay } from "@/components/video/GeoBlockOverlay";

const WatchLive = () => {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const viewRecorded = useRef(false);
  const { isBlocked } = useGeoBlock();
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const playerRef = useRef<MuxPlayerHandle>(null);

  const { data: livestream, isLoading } = useLivestream(id!);
  const { data: viewCount = 0 } = useViewCount("livestream", id!);
  const { data: otherLivestreams = [] } = useLivestreams("live");
  // For ended streams, also fetch ended streams for related content
  const { data: endedLivestreams = [] } = useLivestreams("ended");
  
  // Real-time concurrent viewers using Supabase Presence
  // Only enabled when livestream is live
  const isLiveStatus = livestream?.status === "live";
  const { concurrentViewers, isConnected } = useLivePresence(id!, isLiveStatus);

  // System settings for livestream gate
  const { data: systemSettings } = useSystemSettings();
  const isLiveStream = livestream?.status === "live";
  const isReplay = livestream?.status === "ended";
  const gateAppliesTo = systemSettings?.livestream_gate_applies_to ?? "all";
  const gateEnabled = !!(
    systemSettings?.require_login_livestream &&
    (gateAppliesTo === "all" ||
      (gateAppliesTo === "live" && isLiveStream) ||
      (gateAppliesTo === "replay" && isReplay))
  );

  const { isGated, secondsRemaining, progress, showCountdown } = useLivestreamGate({
    livestreamId: id!,
    previewSeconds: systemSettings?.livestream_preview_seconds ?? 30,
    isEnabled: gateEnabled,
    isAuthenticated: !!user,
    isPlaying: isVideoPlaying,
  });

  // Pause video when gated
  useEffect(() => {
    if (isGated && playerRef.current) {
      playerRef.current.pause();
    }
  }, [isGated]);

  const handleVideoPlay = useCallback(() => setIsVideoPlaying(true), []);
  const handleVideoPause = useCallback(() => setIsVideoPlaying(false), []);

  const dateLocale = language === "vi" ? viLocale : enUS;

  // Record view event (optimized: wait for livestream data to be ready, debounce)
  useEffect(() => {
    if (!id || viewRecorded.current || !livestream?.organization_id) return;

    const recordView = async () => {
      try {
        await supabase.from("view_events").insert({
          target_type: "livestream",
          target_id: id,
          viewer_user_id: user?.id ?? null,
          organization_id: livestream.organization_id,
        });
        viewRecorded.current = true;
      } catch (err) {
        console.error('[WatchLive] Error recording view:', err);
      }
    };

    // Increased delay to reduce database writes during high traffic
    const timer = setTimeout(recordView, 8000);
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

  const isLive = livestream.status === "live";
  const isScheduled = livestream.status === "scheduled";
  const isEnded = livestream.status === "ended";
  
  // Use asset playback ID for ended streams (replay), otherwise use live playback ID
  const playbackId = isEnded && livestream.mux_asset_playback_id 
    ? livestream.mux_asset_playback_id 
    : livestream.mux_playback_id;
  
  const hasPlayback = !!playbackId;
  
  // Determine stream type: live for active streams, on-demand for replays
  const streamType = isLive ? "live" : "on-demand";

  // Generate SEO-optimized title for ended streams
  // Format: {Title} | Pickleball Replay - ThePickleHub
  const seoTitle = isEnded 
    ? `${livestream.title} | Pickleball Replay`
    : livestream.title ?? "Livestream";

  // Generate SEO description from livestream data
  // For ended streams, focus on replay availability
  const seoDescription = isEnded
    ? (language === 'vi'
        ? `Xem lại đầy đủ ${livestream.title}${livestream.organization?.name ? ` - ${livestream.organization.name}` : ''}. Replay livestream pickleball trên ThePickleHub.`
        : `Watch the full replay of ${livestream.title}${livestream.organization?.name ? ` by ${livestream.organization.name}` : ''}. Pickleball livestream replay on ThePickleHub.`)
    : (livestream.description 
        ? `${livestream.description.slice(0, 150)}...` 
        : `Xem livestream ${livestream.title} trên ThePickleHub. ${livestream.organization?.name ? `Được phát bởi ${livestream.organization.name}.` : ''} Theo dõi trực tiếp các giải đấu pickleball hấp dẫn.`);

  // Related livestreams for ended streams (same org or tournament)
  const relatedStreams = isEnded
    ? endedLivestreams.filter((s) => 
        s.id !== livestream.id && 
        (s.organization_id === livestream.organization_id || s.tournament_id === livestream.tournament_id)
      ).slice(0, 4)
    : [];

  return (
    <MainLayout>
      {/* Dynamic SEO tags - auto-generated from livestream data */}
      {/* Canonical URL points to /livestream/{id} for SEO */}
      <DynamicMeta
        title={seoTitle}
        description={seoDescription}
        image={livestream.thumbnail_url ?? undefined}
        type="video.other"
        creator={livestream.organization?.name}
        publishedTime={livestream.scheduled_start_at ?? livestream.created_at}
        url={`https://thepicklehub.net/livestream/${id}`}
      />
      
      {/* VideoObject Schema for ended streams (helps Google Video indexing) */}
      {isEnded && livestream.mux_asset_playback_id && (
        <VideoSchema
          name={livestream.title || "Pickleball Replay"}
          description={seoDescription}
          thumbnailUrl={livestream.thumbnail_url || "https://thepicklehub.net/og-image.png"}
          uploadDate={livestream.ended_at || livestream.created_at}
          embedUrl={`https://thepicklehub.net/embed/live/${id}`}
        />
      )}
      <div className="container-wide section-spacing">
        {/* Back Button */}
        <Link
          to="/live"
          className="inline-flex items-center gap-2 text-foreground-secondary hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">{t.nav.live}</span>
        </Link>

        {/* Sticky Video Player for Mobile */}
        <div className="lg:hidden sticky top-14 z-40 -mx-4 sm:-mx-6 bg-background">
          <div className="aspect-video bg-surface-elevated overflow-hidden relative">
              {showCountdown && <PreviewCountdown secondsRemaining={secondsRemaining} progress={progress} />}
              {isBlocked && <GeoBlockOverlay />}
              {isGated && <LivestreamGateOverlay livestreamId={id!} />}
            {hasPlayback ? (
              <MuxPlayer
                ref={playerRef}
                playbackId={playbackId!}
                title={livestream.title}
                poster={livestream.thumbnail_url ?? undefined}
                streamType={streamType}
                type="livestream"
                isLive={isLive}
                onPlayStateChange={(playing) => playing ? handleVideoPlay() : handleVideoPause()}
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player - Desktop only */}
            <div className="hidden lg:block aspect-video bg-surface-elevated rounded-xl overflow-hidden relative">
              {showCountdown && <PreviewCountdown secondsRemaining={secondsRemaining} progress={progress} />}
              {isBlocked && <GeoBlockOverlay />}
              {isGated && <LivestreamGateOverlay livestreamId={id!} />}
              {hasPlayback ? (
                <MuxPlayer
                  ref={playerRef}
                  playbackId={playbackId!}
                  title={livestream.title}
                  poster={livestream.thumbnail_url ?? undefined}
                  streamType={streamType}
                  type="livestream"
                  isLive={isLive}
                  onPlayStateChange={(playing) => playing ? handleVideoPlay() : handleVideoPause()}
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

            {/* Mobile Chat Toggle */}
            <div className="lg:hidden">
              <Button
                variant="outline"
                className="w-full flex items-center justify-between"
                onClick={() => setIsChatCollapsed(!isChatCollapsed)}
              >
                <span className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  {t.chat.title}
                </span>
                {isChatCollapsed ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </Button>
              {!isChatCollapsed && (
                <div className="mt-4">
                  <ChatPanel livestreamId={livestream.id} className="h-[400px]" />
                </div>
              )}
            </div>

            {/* Stream Info - H1 for SEO */}
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-2xl font-semibold text-foreground">{livestream.title}</h1>
                <Badge variant={statusVariant[livestream.status]}>
                  {statusText[livestream.status]}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-foreground-secondary">
                {livestream.organization && (
                  <Link
                    to={`/org/${livestream.organization.slug}`}
                    className="font-medium text-primary hover:underline inline-flex items-center gap-2"
                  >
                    <Avatar className="w-6 h-6 border border-primary/20">
                      <AvatarImage 
                        src={livestream.organization.display_logo ?? livestream.organization.logo_url ?? undefined} 
                        alt={livestream.organization.name} 
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {livestream.organization.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="inline-flex items-center gap-1">
                      {livestream.organization.name}
                      <BadgeCheck className="w-4 h-4 text-primary" />
                    </span>
                  </Link>
                )}
                {/* View counts with context-aware labels and tooltips */}
                <TooltipProvider>
                  {isLive ? (
                    // LIVE: Show both concurrent viewers and total views
                    <>
                      {/* Concurrent viewers (real-time) */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1 cursor-help">
                            <Users className="w-4 h-4 text-live" />
                            <span className="text-live font-medium">
                              {isConnected ? concurrentViewers.toLocaleString() : "—"} {t.live.watching}
                            </span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t.live.watchingTooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                      {/* Total views */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1 cursor-help text-foreground-muted">
                            <Eye className="w-4 h-4" />
                            {viewCount.toLocaleString()} {t.live.totalViews}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t.live.totalViewsTooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  ) : (
                    // ENDED/SCHEDULED: Only show total views
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-1 cursor-help">
                          <Eye className="w-4 h-4" />
                          {viewCount.toLocaleString()} {t.live.totalViews}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t.live.totalViewsTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
                {/* Date/time display based on status */}
                {isEnded && livestream.ended_at ? (
                  // Ended: show when it ended
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {t.live.endedAt} {format(new Date(livestream.ended_at), "dd MMM yyyy, HH:mm", {
                      locale: dateLocale,
                    })}
                  </span>
                ) : livestream.scheduled_start_at ? (
                  // Live/Scheduled: show scheduled start time
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(livestream.scheduled_start_at), "dd MMM yyyy, HH:mm", {
                      locale: dateLocale,
                    })}
                  </span>
                ) : null}
              </div>

              {/* Like & Share Buttons */}
              <div className="flex items-center gap-4 py-2 border-t border-b border-border">
                <LikeButton targetType="livestream" targetId={livestream.id} />
                <ShareDialog
                  type="live"
                  id={livestream.id}
                  title={livestream.title ?? "Livestream"}
                  thumbnail={livestream.thumbnail_url ?? undefined}
                />
              </div>

              {/* Description & SEO Content (100-200 words body content) */}
              <div className="bg-surface-elevated rounded-lg p-4 space-y-4">
                {livestream.description && (
                  <p className="text-foreground-secondary whitespace-pre-wrap">
                    {livestream.description}
                  </p>
                )}
                {/* SEO Body Content - Always rendered for search engines */}
                <div className="text-sm text-foreground-muted space-y-2">
                  <p>
                    {language === 'vi' 
                      ? <>Xem trực tiếp <strong>{livestream.title}</strong> trên ThePickleHub - nền tảng pickleball toàn cầu.</>
                      : <>Watch <strong>{livestream.title}</strong> live on ThePickleHub - a global pickleball platform.</>
                    }
                    {livestream.organization?.name && (
                      language === 'vi'
                        ? <> Được phát bởi <strong>{livestream.organization.name}</strong>.</>
                        : <> Streamed by <strong>{livestream.organization.name}</strong>.</>
                    )}
                  </p>
                  <p>
                    {language === 'vi'
                      ? "ThePickleHub mang đến trải nghiệm xem livestream pickleball chất lượng cao với chat trực tiếp, bình luận real-time và replay sau khi buổi phát kết thúc. Theo dõi các giải đấu, trận đấu giao hữu và sự kiện pickleball ngay tại đây."
                      : "ThePickleHub delivers high-quality pickleball livestream experience with live chat, real-time comments, and replay after the stream ends. Follow tournaments, friendly matches, and pickleball events right here."
                    }
                  </p>
                  <p>
                    {isLive && (language === 'vi' ? "🔴 Đang phát trực tiếp - Tham gia ngay để không bỏ lỡ những điểm đánh hay nhất! " : "🔴 Live now - Join now to catch the best rallies! ")}
                    {isScheduled && (language === 'vi' ? "📅 Sắp diễn ra - Đặt lịch nhắc nhở để xem khi buổi phát bắt đầu. " : "📅 Coming soon - Set a reminder to watch when the stream starts. ")}
                    {isEnded && (language === 'vi' ? "📹 Xem lại replay đầy đủ của buổi livestream. " : "📹 Watch the full replay of this livestream. ")}
                    {language === 'vi'
                      ? "Sử dụng tính năng chat để trò chuyện với người xem khác và chia sẻ cảm xúc về trận đấu."
                      : "Use the chat feature to interact with other viewers and share your thoughts about the match."
                    }
                  </p>
                </div>
              </div>

              {/* Enhanced SEO Section for Ended Livestreams */}
              {isEnded && (
                <EndedLivestreamSEO
                  livestream={livestream}
                  viewCount={viewCount}
                  relatedLivestreams={relatedStreams}
                  tournamentSlug={null}
                />
              )}
            </div>

            {/* Comments Section */}
            <CommentSection targetType="livestream" targetId={livestream.id} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Desktop Chat Panel */}
            <div className="hidden lg:block">
              <ChatPanel livestreamId={livestream.id} className="h-[500px]" />
            </div>

            {/* Other Live Streams */}
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
                      organizationSlug={stream.organization?.slug}
                      status={stream.status as "live" | "scheduled" | "ended"}
                      thumbnail={stream.thumbnail_url ?? undefined}
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default WatchLive;
