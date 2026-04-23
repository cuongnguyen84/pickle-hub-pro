import { Link, useParams } from "react-router-dom";
import { useLivestream, useTournaments } from "@/hooks/useSupabaseData";
import { useLivePresence } from "@/hooks/useLivePresence";
import { MuxPlayer } from "@/components/video";
import { ChatPanel } from "@/components/chat";
import { PreviewShell, formatTime, formatRelative } from "./_shell";
import { Countdown } from "./_Countdown";

const LiveWatch = () => {
  const { id = "" } = useParams();
  const { data: stream, isLoading } = useLivestream(id);
  const { data: tournaments = [] } = useTournaments();

  const tournament = stream?.tournament_id
    ? tournaments.find((t) => t.id === stream.tournament_id)
    : null;

  const isLive = stream?.status === "live";
  const isScheduled = stream?.status === "scheduled";
  const isEnded = stream?.status === "ended";

  // Real presence tracking — connects to Supabase Realtime
  const { concurrentViewers, isConnected } = useLivePresence(id, isLive);

  // Same playback ID logic as production WatchLive
  const playbackId = isEnded && stream?.mux_asset_playback_id
    ? stream.mux_asset_playback_id
    : stream?.mux_playback_id;
  const hasPlayback = !!playbackId;
  const streamType = isLive ? "live" : "on-demand";

  return (
    <PreviewShell title={stream?.title ?? "Live · Preview"} active="live">
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/preview/the-line">Home</Link>
          <span className="sep">/</span>
          <Link to="/preview/the-line/live">Live</Link>
          <span className="sep">/</span>
          <span className="current">{stream?.title?.slice(0, 32) ?? "Match"}</span>
        </nav>

        {isLoading ? (
          <div className="tl-empty" style={{ marginTop: 40 }}>
            <p style={{ fontFamily: "Geist Mono", fontSize: 12, letterSpacing: "0.04em" }}>Loading match…</p>
          </div>
        ) : !stream ? (
          <div className="tl-empty" style={{ marginTop: 40 }}>
            <h3>Match not found</h3>
            <p>This livestream may have ended or the link is incorrect.</p>
            <Link to="/preview/the-line/live" className="tl-btn">Back to live courts →</Link>
          </div>
        ) : (
          <div className="tl-watch-grid">
            {/* Main column — video + meta */}
            <div>
              {/* Real video player — MuxPlayer for live + replay, placeholder for scheduled */}
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
                    playbackId={playbackId!}
                    title={stream.title ?? undefined}
                    poster={stream.thumbnail_url ?? undefined}
                    streamType={streamType}
                    type="livestream"
                    isLive={isLive}
                  />
                </div>
              ) : (
              <div className="tl-video">
                {isScheduled ? (
                  <>
                    <div className="tl-video-court" aria-hidden="true" />
                    <div className="tl-video-net" aria-hidden="true" />
                    <div className="tl-video-overlay">
                      <span style={{ color: "var(--tl-gold)", fontWeight: 600 }}>
                        ● <Countdown to={stream.scheduled_start_at} pastLabel="Starting now" />
                      </span>
                      {isConnected && isLive && (
                        <span className="viewers">{concurrentViewers.toLocaleString()} watching</span>
                      )}
                    </div>
                    <div className="tl-video-caption">
                      <h3 className="title">Starts {stream.scheduled_start_at ? formatTime(stream.scheduled_start_at) : "soon"}</h3>
                      <div className="meta">Preview will begin shortly before the scheduled time</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="tl-video-court" aria-hidden="true" />
                    <div className="tl-video-net" aria-hidden="true" />
                    <div className="tl-video-overlay">
                      <span style={{ color: "var(--tl-fg-3)" }}>Replay unavailable</span>
                    </div>
                  </>
                )}
              </div>
              )}

              <div className="tl-watch-meta">
                <h1>{stream.title ?? "Match"}</h1>
                <div className="tl-watch-stats">
                  {isLive && (
                    <span style={{ color: "var(--tl-live)", fontWeight: 600 }}>
                      ● {isConnected ? concurrentViewers.toLocaleString() : "—"} watching
                    </span>
                  )}
                  {tournament && <span><b>{tournament.name}</b></span>}
                  {stream.organization?.name && <span>Broadcast: <b>{stream.organization.name}</b></span>}
                  <span>
                    {isLive && stream.started_at ? `Started ${formatTime(stream.started_at)}` : ""}
                    {isScheduled && stream.scheduled_start_at ? (
                      <>Scheduled <Countdown to={stream.scheduled_start_at} pastLabel="now" /></>
                    ) : ""}
                    {isEnded && stream.ended_at ? `Ended ${formatRelative(stream.ended_at)}` : ""}
                  </span>
                </div>

                {stream.description && (
                  <p style={{ color: "var(--tl-fg-2)", fontSize: 15.5, lineHeight: 1.55, marginTop: 18 }}>
                    {stream.description}
                  </p>
                )}
              </div>
            </div>

            {/* Side column — real chat + tournament */}
            <aside className="tl-watch-side">
              {/* Real ChatPanel from production — inherits D4 tokens via HSL overrides */}
              <div style={{ background: "var(--tl-bg)", border: "1px solid var(--tl-border)", borderRadius: "var(--tl-radius-lg)", overflow: "hidden", minHeight: 500 }}>
                <ChatPanel livestreamId={stream.id} className="h-[500px]" />
              </div>

              {tournament && (
                <div className="tl-panel">
                  <div className="tl-panel-head">
                    <h3>Tournament</h3>
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
                        <span>{tournament.status}</span>
                        {tournament.start_date && (
                          <>
                            <span className="sep">·</span>
                            <span>Starts {new Date(tournament.start_date).toLocaleDateString("en-GB")}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </PreviewShell>
  );
};

export default LiveWatch;
