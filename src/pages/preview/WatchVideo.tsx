import { Link, useParams } from "react-router-dom";
import { useVideo, useVideos, useTournaments } from "@/hooks/useSupabaseData";
import { MuxPlayer } from "@/components/video";
import { PreviewShell, formatRelative } from "./_shell";

const formatDuration = (seconds: number | null | undefined): string => {
  if (!seconds || seconds < 0) return "";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const WatchVideo = () => {
  const { id = "" } = useParams();
  const { data: video, isLoading } = useVideo(id);
  const { data: related = [] } = useVideos({ limit: 8 });
  const { data: tournaments = [] } = useTournaments();

  const tournament = video?.tournament_id
    ? tournaments.find((t) => t.id === video.tournament_id)
    : null;

  const hasPlayback = !!video?.mux_playback_id;

  // Related videos — prefer same organization, exclude current
  const relatedVideos = video
    ? related
        .filter((v) => v.id !== video.id)
        .sort((a, b) => {
          const aMatch = a.organization_id === video.organization_id ? 1 : 0;
          const bMatch = b.organization_id === video.organization_id ? 1 : 0;
          return bMatch - aMatch;
        })
        .slice(0, 6)
    : [];

  return (
    <PreviewShell title={video?.title ?? "Watch · Preview"} active="live">
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/preview/the-line">Home</Link>
          <span className="sep">/</span>
          <Link to="/preview/the-line/live">Watch</Link>
          <span className="sep">/</span>
          <span className="current">{video?.title?.slice(0, 32) ?? "Video"}</span>
        </nav>

        {isLoading ? (
          <div className="tl-empty" style={{ marginTop: 40 }}>
            <p style={{ fontFamily: "Geist Mono", fontSize: 12, letterSpacing: "0.04em" }}>Loading video…</p>
          </div>
        ) : !video ? (
          <div className="tl-empty" style={{ marginTop: 40 }}>
            <h3>Video not found</h3>
            <p>This video may have been unpublished or the link is incorrect.</p>
            <Link to="/preview/the-line/live" className="tl-btn">Back to broadcasts →</Link>
          </div>
        ) : (
          <div className="tl-watch-grid">
            {/* Main column — video + meta + description */}
            <div>
              {hasPlayback ? (
                <div
                  style={{
                    aspectRatio: "16 / 9",
                    background: "#000",
                    border: "1px solid var(--tl-border)",
                    borderRadius: "var(--tl-radius-lg)",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <MuxPlayer
                    playbackId={video.mux_playback_id!}
                    title={video.title}
                    poster={video.thumbnail_url ?? undefined}
                    streamType="on-demand"
                    type="video"
                    isLive={false}
                  />
                </div>
              ) : (
                <div className="tl-video">
                  <div className="tl-video-court" aria-hidden="true" />
                  <div className="tl-video-net" aria-hidden="true" />
                  <div className="tl-video-overlay">
                    <span style={{ color: "var(--tl-fg-3)" }}>Video unavailable</span>
                  </div>
                </div>
              )}

              <div className="tl-watch-meta">
                <h1>{video.title}</h1>
                <div className="tl-watch-stats">
                  {video.organization?.name && <span>By <b>{video.organization.name}</b></span>}
                  {video.duration_seconds && <span>Duration: <b>{formatDuration(video.duration_seconds)}</b></span>}
                  {video.published_at && <span>Published {formatRelative(video.published_at)}</span>}
                  <span className="tl-mono" style={{ color: "var(--tl-fg-4)" }}>
                    {video.type?.toUpperCase()}
                  </span>
                </div>

                {video.description && (
                  <p style={{ color: "var(--tl-fg-2)", fontSize: 15.5, lineHeight: 1.55, marginTop: 18 }}>
                    {video.description}
                  </p>
                )}

                {video.tags && video.tags.length > 0 && (
                  <div className="tl-tag-row">
                    {video.tags.map((tag) => (
                      <span key={tag} className="tl-tag">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {tournament && (
                <div className="tl-panel" style={{ marginTop: 20 }}>
                  <div className="tl-panel-head">
                    <h3>Tournament</h3>
                    <span className="meta">Context</span>
                  </div>
                  <Link
                    to={`/preview/the-line/tournament/${tournament.slug}`}
                    className="tl-sched-row"
                    style={{ borderBottom: 0 }}
                  >
                    <div className="tl-sched-date">
                      <span className="d">●</span>
                      <span className="m">{tournament.status.slice(0, 4).toUpperCase()}</span>
                    </div>
                    <div className="tl-sched-body">
                      <h4>{tournament.name}</h4>
                      <div className="meta">
                        <span>Status: {tournament.status}</span>
                      </div>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* Side — related videos */}
            <aside className="tl-watch-side">
              <div className="tl-panel">
                <div className="tl-panel-head">
                  <h3>More replays</h3>
                  <span className="meta">{relatedVideos.length}</span>
                </div>
                {relatedVideos.length === 0 ? (
                  <div className="tl-lc-empty" style={{ padding: "28px 20px" }}>No other videos</div>
                ) : (
                  relatedVideos.map((v) => (
                    <Link
                      key={v.id}
                      to={`/preview/the-line/watch/${v.id}`}
                      className="tl-sched-row"
                      style={{ gridTemplateColumns: "auto 1fr" }}
                    >
                      <div
                        style={{
                          width: 64,
                          height: 40,
                          background: "var(--tl-surface-2)",
                          borderRadius: 6,
                          overflow: "hidden",
                          position: "relative",
                          border: "1px solid var(--tl-border)",
                        }}
                      >
                        {v.thumbnail_url ? (
                          <img
                            src={v.thumbnail_url}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            loading="lazy"
                          />
                        ) : null}
                        {v.duration_seconds && (
                          <span
                            className="tl-mono"
                            style={{
                              position: "absolute",
                              bottom: 2,
                              right: 3,
                              background: "rgba(0,0,0,0.7)",
                              color: "#fff",
                              fontSize: 9,
                              padding: "1px 3px",
                              borderRadius: 2,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {formatDuration(v.duration_seconds)}
                          </span>
                        )}
                      </div>
                      <div className="tl-sched-body">
                        <h4 style={{ fontSize: 13.5, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "normal" }}>
                          {v.title}
                        </h4>
                        <div className="meta">
                          <span>{v.organization?.name ?? ""}</span>
                          {v.published_at && (
                            <>
                              <span className="sep">·</span>
                              <span>{formatRelative(v.published_at)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </PreviewShell>
  );
};

export default WatchVideo;
