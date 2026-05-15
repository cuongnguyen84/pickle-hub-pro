import { useParams, Link } from "react-router-dom";
import { useMemo } from "react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { useI18n } from "@/i18n";
import { useVideo, useVideos, useViewCount } from "@/hooks/useSupabaseData";
import { LikeButton } from "@/components/content/LikeButton";
import { CommentSection } from "@/components/content/CommentSection";
import { MuxPlayer, AdaptiveVideoPlayer } from "@/components/video";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useIntervalViewCounter } from "@/hooks/useIntervalViewCounter";
import { useAuth } from "@/hooks/useAuth";
import { Eye, Calendar, Clock, Play, BadgeCheck } from "lucide-react";
import { useGeoBlock } from "@/hooks/useGeoBlock";
import { GeoBlockOverlay } from "@/components/video/GeoBlockOverlay";
import { format } from "date-fns";
import { vi as viLocale, enUS } from "date-fns/locale";
import { ShareDialog } from "@/components/share";
import { DynamicMeta } from "@/components/seo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * /watch/:id — video detail page.
 *
 * Sprint 7 follow-up to PR #80: moved off the legacy MainLayout onto
 * TheLineLayout so the chrome matches FeedVideoCard / FeedMatchCard from
 * the new timeline. Data hooks (useVideo, useViewCount, view counter
 * interval, geo block, comments, like/share) are unchanged — only the
 * page chrome and meta typography were refactored.
 *
 * Anatomy:
 *   i.   Eyebrow strip — WATCH · video type · organization
 *   ii.  Instrument Serif italic title
 *   iii. Player block (Mux / adaptive storage / poster fallback)
 *   iv.  Meta row (mono caps — published, views, duration)
 *   v.   Engage row (Like + Share) above hairline
 *   vi.  Description + tags
 *   vii. Comments — kept as-is
 *   viii.Sidebar — "More replays" panel
 */
const WatchVideo = () => {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { isBlocked } = useGeoBlock();

  const { data: video, isLoading } = useVideo(id!);
  const { data: viewCount = 0 } = useViewCount("video", id!);
  const { data: relatedVideos = [] } = useVideos({ limit: 8 });

  const dateLocale = language === "vi" ? viLocale : enUS;

  const storageVideoUrl = useMemo(() => {
    if (video?.source === "storage" && video?.storage_path) {
      const { data } = supabase.storage
        .from("videos")
        .getPublicUrl(video.storage_path);
      return data.publicUrl;
    }
    return null;
  }, [video?.source, video?.storage_path]);

  // Record view events every 30s, max 20/session (~10 min). Kept on the
  // page (not gated behind authentication) so anonymous viewers count.
  useIntervalViewCounter({
    targetType: "video",
    targetId: id,
    viewerUserId: user?.id ?? null,
    organizationId: video?.organization_id ?? null,
  });

  // Related — prefer same organization, exclude self, cap at 6 cards.
  const related = useMemo(() => {
    if (!video) return [];
    return relatedVideos
      .filter((v) => v.id !== video.id)
      .sort((a, b) => {
        const aMatch = a.organization_id === video.organization_id ? 1 : 0;
        const bMatch = b.organization_id === video.organization_id ? 1 : 0;
        return bMatch - aMatch;
      })
      .slice(0, 6);
  }, [video, relatedVideos]);

  if (isLoading) {
    return (
      <TheLineLayout title="Watch" active="live">
        <div className="tl-shell" style={{ paddingTop: 32, paddingBottom: 80 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) 340px",
              gap: 24,
            }}
          >
            <div>
              <Skeleton className="aspect-video w-full rounded-xl" />
              <Skeleton className="h-8 w-3/4 mt-6" />
              <Skeleton className="h-4 w-1/2 mt-3" />
            </div>
            <div>
              <Skeleton className="h-24 w-full mb-3" />
              <Skeleton className="h-24 w-full mb-3" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </TheLineLayout>
    );
  }

  if (!video) {
    return (
      <TheLineLayout title={t.errors.notFound ?? "Not found"} active="live">
        <div className="tl-shell" style={{ paddingTop: 64, paddingBottom: 80 }}>
          <div className="tl-empty">
            <h3>{t.errors.notFound}</h3>
            <p>
              {language === "vi"
                ? "Video này có thể đã bị gỡ hoặc đường dẫn không đúng."
                : "This video may have been unpublished or the link is incorrect."}
            </p>
            <Link to="/videos" className="tl-btn">
              {language === "vi" ? "Quay lại Videos →" : "Back to videos →"}
            </Link>
          </div>
        </div>
      </TheLineLayout>
    );
  }

  const hasPlayback = !!video.mux_playback_id;
  const hasStorageVideo = video.source === "storage" && !!storageVideoUrl;
  const videoKindLabel =
    video.type === "short"
      ? language === "vi"
        ? "VIDEO NGẮN"
        : "SHORT"
      : "VIDEO";

  return (
    <TheLineLayout
      title={video.title}
      description={
        video.description ??
        (language === "vi"
          ? `Xem ${video.title} trên ThePickleHub`
          : `Watch ${video.title} on ThePickleHub`)
      }
      active="live"
    >
      {/* Native OG tags for sharing — left in place because TheLineLayout's
          DynamicMeta only emits title+description+canonical, while sharing
          needs the video.other type + thumbnail image specifically. */}
      <DynamicMeta
        title={video.title}
        description={video.description ?? `Watch ${video.title} on The Pickle Hub`}
        image={video.thumbnail_url ?? undefined}
        type="video.other"
      />

      <div className="tl-shell" style={{ paddingBottom: 80 }}>
        {/* Page eyebrow — matches FeedVideoCard's date·duration·badge strip
            but inverted as the page-level kicker. Includes the
            organization name so the source reads first. */}
        <div
          className="tl-eyebrow"
          aria-hidden="true"
          style={{ paddingTop: 32, marginBottom: 16 }}
        >
          <span className="pip" />
          <span>{language === "vi" ? "XEM" : "WATCH"}</span>
          <span className="sep">·</span>
          <span>{videoKindLabel}</span>
          {video.organization?.name && (
            <>
              <span className="sep">·</span>
              <span>{video.organization.name.toUpperCase()}</span>
            </>
          )}
        </div>

        {/* Title — Instrument Serif italic, mirrors FeedVideoCard title
            scale at page level. */}
        <h1
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            fontSize: "clamp(34px, 5vw, 56px)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            margin: "0 0 28px",
            color: "var(--tl-fg)",
            maxWidth: "20ch",
          }}
        >
          {video.title}
        </h1>

        <div className="tl-watch-grid" style={{ padding: "0 0 48px" }}>
          {/* Main column */}
          <div>
            {/* Player block — keep all three source paths (storage, Mux,
                poster fallback) untouched. */}
            <div
              style={{
                aspectRatio: hasStorageVideo ? undefined : "16 / 9",
                background: "#000",
                border: "1px solid var(--tl-border)",
                borderRadius: "var(--tl-radius-lg)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {isBlocked && <GeoBlockOverlay />}
              {hasStorageVideo ? (
                <AdaptiveVideoPlayer
                  src={storageVideoUrl!}
                  poster={video.thumbnail_url ?? undefined}
                  className="rounded-xl"
                />
              ) : hasPlayback ? (
                <MuxPlayer
                  playbackId={video.mux_playback_id!}
                  title={video.title}
                  poster={video.thumbnail_url ?? undefined}
                  streamType="on-demand"
                  type="video"
                />
              ) : video.thumbnail_url ? (
                <div style={{ position: "relative", height: "100%" }}>
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                      background:
                        "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.4) 100%)",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-grid",
                        placeItems: "center",
                        width: 72,
                        height: 72,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.6)",
                        border: "1px solid rgba(255,255,255,0.6)",
                        color: "white",
                      }}
                    >
                      <Play
                        style={{ width: 24, height: 24, marginLeft: 3 }}
                        strokeWidth={1.75}
                        fill="currentColor"
                      />
                    </span>
                  </div>
                  {video.duration_seconds && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 12,
                        right: 12,
                        fontFamily: "'Geist Mono', monospace",
                        fontSize: 11,
                        letterSpacing: "0.06em",
                        color: "white",
                        background: "rgba(0,0,0,0.78)",
                        padding: "4px 8px",
                        borderRadius: 3,
                      }}
                    >
                      {formatDuration(video.duration_seconds)}
                    </span>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--tl-fg-3)",
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 12,
                    letterSpacing: "0.06em",
                  }}
                >
                  {t.player.notReady}
                </div>
              )}
            </div>

            {/* Meta row — published, views, duration. Mono caps to match
                FeedVideoCard's eyebrow strip. */}
            <div
              style={{
                display: "flex",
                gap: 20,
                flexWrap: "wrap",
                alignItems: "center",
                padding: "20px 0",
                borderBottom: "1px solid var(--tl-border)",
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--tl-fg-3)",
              }}
            >
              {video.organization && (
                <Link
                  to={`/org/${video.organization.slug}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--tl-fg-2)",
                    textDecoration: "none",
                    textTransform: "none",
                    letterSpacing: 0,
                    fontFamily: "'Geist', sans-serif",
                    fontSize: 13,
                  }}
                >
                  <Avatar className="w-6 h-6 border border-border">
                    <AvatarImage
                      src={
                        video.organization.display_logo ??
                        video.organization.logo_url ??
                        undefined
                      }
                      alt={video.organization.name}
                    />
                    <AvatarFallback className="text-xs">
                      {video.organization.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {video.organization.name}
                    <BadgeCheck className="w-4 h-4" style={{ color: "var(--tl-green)" }} />
                  </span>
                </Link>
              )}
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Eye className="w-4 h-4" />
                <b style={{ color: "var(--tl-fg)", fontWeight: 500 }}>
                  {viewCount.toLocaleString()}
                </b>
                {t.video.views}
              </span>
              {video.published_at && (
                <span
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Calendar className="w-4 h-4" />
                  {format(new Date(video.published_at), "dd MMM yyyy", {
                    locale: dateLocale,
                  })}
                </span>
              )}
              {video.duration_seconds && (
                <span
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Clock className="w-4 h-4" />
                  {formatDuration(video.duration_seconds)}
                </span>
              )}
            </div>

            {/* Engage row — Like + Share. Hairline below mirrors the
                feed-card foot pattern (KudosButton sits LEFT of meta). */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 0",
                borderBottom: "1px solid var(--tl-border)",
              }}
            >
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
              <p
                style={{
                  margin: "24px 0 0",
                  color: "var(--tl-fg-2)",
                  fontSize: 15.5,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {video.description}
              </p>
            )}

            {/* Tags — mono caps chip style consistent with FeedMatchCard's
                status pills. */}
            {video.tags && video.tags.length > 0 && (
              <div className="tl-tag-row" style={{ marginTop: 18 }}>
                {video.tags.map((tag) => (
                  <span key={tag} className="tl-tag">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Comments — keep logic, wrap with TheLine spacing token. */}
            <div
              style={{
                marginTop: 48,
                paddingTop: 32,
                borderTop: "1px solid var(--tl-border)",
              }}
            >
              <CommentSection targetType="video" targetId={video.id} />
            </div>
          </div>

          {/* Sidebar — More replays. Compact rows so the panel fits 340px
              comfortably. Visual language matches the schedule-row pattern
              used elsewhere in TheLine (thumbnail + title + meta). */}
          <aside className="tl-watch-side">
            <div
              style={{
                border: "1px solid var(--tl-border)",
                borderRadius: "var(--tl-radius-lg)",
                background: "var(--tl-bg)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--tl-border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--tl-fg-3)",
                }}
              >
                <span>{t.video.relatedVideos}</span>
                <span style={{ color: "var(--tl-fg-4)" }}>{related.length}</span>
              </div>
              {related.length === 0 ? (
                <div
                  style={{
                    padding: "28px 20px",
                    color: "var(--tl-fg-3)",
                    fontSize: 13,
                  }}
                >
                  {language === "vi" ? "Không có video khác." : "No other videos."}
                </div>
              ) : (
                related.map((v) => (
                  <Link
                    key={v.id}
                    to={`/watch/${v.id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "112px 1fr",
                      gap: 12,
                      padding: "14px 16px",
                      borderBottom: "1px solid var(--tl-border)",
                      color: "inherit",
                      textDecoration: "none",
                    }}
                  >
                    <div
                      style={{
                        width: 112,
                        aspectRatio: v.type === "short" ? "9 / 16" : "16 / 9",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--tl-border)",
                        borderRadius: 4,
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      {v.thumbnail_url && (
                        <img
                          src={v.thumbnail_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      )}
                      {v.duration_seconds && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: 4,
                            right: 4,
                            fontFamily: "'Geist Mono', monospace",
                            fontSize: 9.5,
                            color: "white",
                            background: "rgba(0,0,0,0.78)",
                            padding: "2px 4px",
                            borderRadius: 2,
                          }}
                        >
                          {formatDuration(v.duration_seconds)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <h4
                        style={{
                          fontFamily: "'Instrument Serif', serif",
                          fontStyle: "italic",
                          fontSize: 16,
                          lineHeight: 1.2,
                          letterSpacing: "-0.01em",
                          margin: 0,
                          color: "var(--tl-fg)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {v.title}
                      </h4>
                      <div
                        style={{
                          fontFamily: "'Geist Mono', monospace",
                          fontSize: 10,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--tl-fg-3)",
                          display: "inline-flex",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        {v.organization?.name && <span>{v.organization.name}</span>}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </TheLineLayout>
  );
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default WatchVideo;
