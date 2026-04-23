import { Link, useParams } from "react-router-dom";
import { useLivestream, useTournaments } from "@/hooks/useSupabaseData";
import { PreviewShell, formatTime, formatRelative } from "./_shell";

/* Sample chat messages — static placeholder for preview aesthetic */
const CHAT_SAMPLE = [
  { name: "Minh Duc", time: "now", text: "That dink at the kitchen line was absurd 👀" },
  { name: "Sarah K.", time: "1m", text: "Waters is reading every serve before it lands" },
  { name: "@ppa_fan", time: "1m", text: "Set 3 is gonna be wild" },
  { name: "TQuang", time: "2m", text: "hoa hậu trận này là Parenteau đó" },
  { name: "Ashley", time: "3m", text: "ref call on that last rally was tight" },
  { name: "Carlos", time: "4m", text: "What's the rally count at now?" },
];

const LiveWatch = () => {
  const { id = "" } = useParams();
  const { data: stream, isLoading } = useLivestream(id);
  const { data: tournaments = [] } = useTournaments();

  const tournament = stream?.tournament_id
    ? tournaments.find((t) => t.id === stream.tournament_id)
    : null;

  const isLive = stream?.status === "live";
  const isScheduled = stream?.status === "scheduled";

  return (
    <PreviewShell
      title={stream?.title ?? "Live · Preview"}
      active="live"
    >
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
          <>
            <div className="tl-watch-grid">
              {/* Main column — video + meta */}
              <div>
                <div className="tl-video">
                  <div className="tl-video-court" aria-hidden="true" />
                  <div className="tl-video-net" aria-hidden="true" />
                  <button type="button" className="tl-video-play" aria-label="Play">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                  <div className="tl-video-overlay">
                    {isLive ? (
                      <span className="live">Live</span>
                    ) : isScheduled ? (
                      <span style={{ color: "var(--tl-gold)" }}>● {formatRelative(stream.scheduled_start_at)}</span>
                    ) : (
                      <span style={{ color: "var(--tl-fg-3)" }}>Replay</span>
                    )}
                    <span className="viewers">
                      {isLive ? `${Math.floor(Math.random() * 2800 + 200)} watching` : "–"}
                    </span>
                  </div>
                  <div className="tl-video-caption">
                    <h3 className="title">{stream.title ?? "Match"}</h3>
                    <div className="meta">
                      {isLive ? "Now streaming · 1080p · HLS" : isScheduled ? `Begins ${formatTime(stream.scheduled_start_at)}` : "Replay available"}
                    </div>
                  </div>
                </div>

                <div className="tl-watch-meta">
                  <h1>{stream.title ?? "Match"}</h1>
                  <div className="tl-watch-stats">
                    {tournament && <span><b>{tournament.name}</b></span>}
                    {stream.organization?.name && <span>Broadcast: <b>{stream.organization.name}</b></span>}
                    <span>
                      {isLive && stream.started_at ? `Started ${formatTime(stream.started_at)}` : ""}
                      {isScheduled && stream.scheduled_start_at ? `Scheduled ${formatTime(stream.scheduled_start_at)}` : ""}
                      {stream.status === "ended" && stream.ended_at ? `Ended ${formatRelative(stream.ended_at)}` : ""}
                    </span>
                  </div>

                  {stream.description && (
                    <p style={{ color: "var(--tl-fg-2)", fontSize: 15.5, lineHeight: 1.55, marginTop: 18 }}>
                      {stream.description}
                    </p>
                  )}
                </div>

                {/* Live scoreboard card below video */}
                {isLive && (
                  <div className="tl-livecard" style={{ marginTop: 20 }}>
                    <div className="tl-lc-head">
                      <span className="live">Live</span>
                      <span>Current score · Tabular</span>
                    </div>
                    <div className="tl-lc-body">
                      <div className="tl-lc-row leader">
                        <span className="tl-lc-seed">#1</span>
                        <div className="tl-lc-name">
                          <span className="name-text">Team A</span>
                          <span className="tl-lc-flag">VIE</span>
                        </div>
                        <div className="tl-lc-sets">
                          <span className="tl-lc-set won">11</span>
                          <span className="tl-lc-set">9</span>
                          <span className="tl-lc-set current">11</span>
                        </div>
                      </div>
                      <div className="tl-lc-row">
                        <span className="tl-lc-seed">#2</span>
                        <div className="tl-lc-name">
                          <span className="name-text">Team B</span>
                          <span className="tl-lc-flag">VIE</span>
                        </div>
                        <div className="tl-lc-sets">
                          <span className="tl-lc-set">9</span>
                          <span className="tl-lc-set won">11</span>
                          <span className="tl-lc-set current">9</span>
                        </div>
                      </div>
                    </div>
                    <div className="tl-lc-footer">
                      <span className="meta">
                        Scoreboard demo · in production this pulls from live match data
                      </span>
                    </div>
                  </div>
                )}

                {/* Placeholder — watch on original */}
                <div style={{ marginTop: 20, padding: 18, background: "var(--tl-surface)", border: "1px solid var(--tl-border)", borderRadius: "var(--tl-radius-lg)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ color: "var(--tl-fg-3)", fontSize: 13.5, letterSpacing: "-0.005em" }}>
                    Preview mode — video player here is a visual placeholder.
                  </div>
                  <Link to={`/live/${stream.id}`} className="tl-btn green">Open with real player →</Link>
                </div>
              </div>

              {/* Side column — chat */}
              <aside className="tl-watch-side">
                <div className="tl-chat">
                  <div className="tl-chat-head">
                    <span>Live chat</span>
                    <span className="count">{isLive ? "● 284 online" : "closed"}</span>
                  </div>
                  <div className="tl-chat-body">
                    {CHAT_SAMPLE.map((msg, idx) => (
                      <div key={idx} className="tl-chat-msg">
                        <span className="name">{msg.name}</span>
                        <span className="time">{msg.time}</span>
                        <span className="text">{msg.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="tl-chat-foot">
                    <input
                      className="tl-chat-input"
                      placeholder={isLive ? "Say something about this match…" : "Chat is closed"}
                      disabled={!isLive}
                    />
                  </div>
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
          </>
        )}
      </div>
    </PreviewShell>
  );
};

export default LiveWatch;
