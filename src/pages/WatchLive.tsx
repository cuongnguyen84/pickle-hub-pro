import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { useI18n } from "@/i18n";
import { useLivestream, useLivestreams, useViewCount } from "@/hooks/useSupabaseData";
import { LikeButton } from "@/components/content/LikeButton";
import { CommentSection } from "@/components/content/CommentSection";
import { LiveCard } from "@/components/content";
import { MuxPlayer } from "@/components/video";
import { ChatPanel } from "@/components/chat";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Radio, Calendar, Users, AlertCircle, MessageCircle, ChevronDown, ChevronUp, BadgeCheck } from "lucide-react";
import { format } from "date-fns";
import { vi as viLocale, enUS } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShareDialog } from "@/components/share";
import { DynamicMeta } from "@/components/seo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const WatchLive = () => {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const viewRecorded = useRef(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);

  const { data: livestream, isLoading } = useLivestream(id!);
  const { data: viewCount = 0 } = useViewCount("livestream", id!);
  const { data: otherLivestreams = [] } = useLivestreams("live");

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

  const hasPlayback = !!livestream.mux_playback_id;
  const isLive = livestream.status === "live";
  const isScheduled = livestream.status === "scheduled";
  const isEnded = livestream.status === "ended";
  
  // Determine stream type: live for active streams, live:dvr for replays
  const streamType = isLive ? "live" : "live:dvr";

  // Generate SEO description from livestream data
  const seoDescription = livestream.description 
    ? `${livestream.description.slice(0, 150)}...` 
    : `Xem livestream ${livestream.title} trên ThePickleHub. ${livestream.organization?.name ? `Được phát bởi ${livestream.organization.name}.` : ''} Theo dõi trực tiếp các giải đấu pickleball hấp dẫn.`;

  return (
    <MainLayout>
      {/* Dynamic SEO tags - auto-generated from livestream data */}
      <DynamicMeta
        title={livestream.title ?? "Livestream"}
        description={seoDescription}
        image={livestream.thumbnail_url ?? undefined}
        type="video.other"
        creator={livestream.organization?.name}
        publishedTime={livestream.scheduled_start_at ?? livestream.created_at}
      />
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
            {hasPlayback ? (
              <MuxPlayer
                playbackId={livestream.mux_playback_id!}
                title={livestream.title}
                poster={livestream.thumbnail_url ?? undefined}
                streamType={streamType}
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player - Desktop only */}
            <div className="hidden lg:block aspect-video bg-surface-elevated rounded-xl overflow-hidden relative">
              {hasPlayback ? (
                <MuxPlayer
                  playbackId={livestream.mux_playback_id!}
                  title={livestream.title}
                  poster={livestream.thumbnail_url ?? undefined}
                  streamType={streamType}
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
