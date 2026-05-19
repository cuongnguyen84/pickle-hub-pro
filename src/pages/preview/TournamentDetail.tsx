import { Link, useParams } from "react-router-dom";
import { useTournamentBySlug, useTournamentContent } from "@/hooks/useSupabaseData";
import { PreviewShell, formatDate, formatTime, formatRelative } from "./_shell";

const TournamentDetail = () => {
  const { slug = "" } = useParams();
  const { data: tournament, isLoading } = useTournamentBySlug(slug);
  const { data: content } = useTournamentContent(tournament?.id ?? "");

  const livestreams = content?.livestreams ?? [];
  const videos = content?.videos ?? [];

  const startDate = formatDate(tournament?.start_date);
  const endDate = formatDate(tournament?.end_date);

  const liveNow = livestreams.filter((l) => l.status === "live");
  const scheduled = livestreams.filter((l) => l.status === "scheduled");
  const ended = livestreams.filter((l) => l.status === "ended");

  return (
    <PreviewShell
      title={tournament?.name ?? "Tournament · Preview"}
      active="tournaments"
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/preview/the-line">Home</Link>
          <span className="sep">/</span>
          <Link to="/preview/the-line/tournaments">Tournaments</Link>
          <span className="sep">/</span>
          <span className="current">{tournament?.name?.slice(0, 42) ?? "Loading"}</span>
        </nav>

        {isLoading ? (
          <div className="tl-empty" style={{ marginTop: 40 }}>
            <p style={{ fontFamily: "Geist Mono", fontSize: 12, letterSpacing: "0.04em" }}>Loading tournament…</p>
          </div>
        ) : !tournament ? (
          <div className="tl-empty" style={{ marginTop: 40 }}>
            <h3>Tournament not found</h3>
            <p>This tournament may have been archived or the URL is incorrect.</p>
            <Link to="/preview/the-line/tournaments" className="tl-btn">Back to index →</Link>
          </div>
        ) : (
          <>
            <section className="tl-trn-hero">
              <div className="tl-eyebrow">
                <span
                  className="pip"
                  style={{
                    background:
                      tournament.status === "ongoing" ? "var(--tl-live)" :
                      tournament.status === "upcoming" ? "var(--tl-green)" :
                      "var(--tl-fg-4)",
                  }}
                />
                <span>{tournament.status === "ongoing" ? "Live now" : tournament.status === "upcoming" ? "Registration open" : "Ended"}</span>
                {tournament.start_date && (
                  <>
                    <span className="sep">/</span>
                    <span>{formatRelative(tournament.start_date)}</span>
                  </>
                )}
              </div>

              <h1>{tournament.name}</h1>

              {tournament.description && (
                <p style={{ fontSize: 17, color: "var(--tl-fg-2)", lineHeight: 1.55, maxWidth: "60ch", margin: 0 }}>
                  {tournament.description}
                </p>
              )}

              <div className="tl-trn-status-bar">
                <div className="tl-trn-stat">
                  <span className="lbl">Status</span>
                  <span className="val">{tournament.status}</span>
                </div>
                <div className="tl-trn-stat">
                  <span className="lbl">Start</span>
                  <span className="val mono">{startDate.full || "—"}</span>
                </div>
                <div className="tl-trn-stat">
                  <span className="lbl">End</span>
                  <span className="val mono">{endDate.full || "—"}</span>
                </div>
                <div className="tl-trn-stat">
                  <span className="lbl">Broadcasts</span>
                  <span className="val mono">{livestreams.length}</span>
                </div>
                <div className="tl-trn-stat">
                  <span className="lbl">Replays</span>
                  <span className="val mono">{videos.length}</span>
                </div>
              </div>

              <div className="tl-hero-ctas" style={{ marginTop: 28 }}>
                {liveNow.length > 0 && (
                  <Link to={`/preview/the-line/live/${liveNow[0].id}`} className="tl-btn green">
                    ● Watch live now
                  </Link>
                )}
                <Link to={`/tournament/${tournament.slug}`} className="tl-btn">Open with real bracket →</Link>
              </div>
            </section>

            {/* Live now */}
            {liveNow.length > 0 && (
              <section className="tl-section">
                <div className="tl-sec-head">
                  <h2>
                    Live <em className="tl-serif">now.</em>{" "}
                    <span className="sans">{liveNow.length} match{liveNow.length === 1 ? "" : "es"}</span>
                  </h2>
                </div>
                <div className="tl-match-grid">
                  {liveNow.map((stream) => (
                    <Link key={stream.id} to={`/preview/the-line/live/${stream.id}`} className="tl-match">
                      <div className="tl-match-head">
                        <span className="stat live">Live</span>
                        <span className="ctx">{stream.started_at ? formatTime(stream.started_at) : "On air"}</span>
                      </div>
                      <h3 className="tl-match-title">{stream.title ?? "Match"}</h3>
                      <div className="tl-match-foot">
                        <span className="org">{stream.organization?.name ?? "Broadcast"}</span>
                        <span className="v">Watch →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Scheduled */}
            {scheduled.length > 0 && (
              <section className="tl-section">
                <div className="tl-sec-head">
                  <h2>
                    Coming <em className="tl-serif">up.</em>{" "}
                    <span className="sans">{scheduled.length}</span>
                  </h2>
                </div>
                <div className="tl-panel">
                  <div className="tl-panel-head">
                    <h3>Scheduled streams</h3>
                    <span className="meta">Next {scheduled.length}</span>
                  </div>
                  {scheduled.slice(0, 10).map((stream) => {
                    const d = formatDate(stream.scheduled_start_at);
                    return (
                      <Link key={stream.id} to={`/preview/the-line/live/${stream.id}`} className="tl-sched-row">
                        <div className="tl-sched-date">
                          <span className="d">{d.d}</span>
                          <span className="m">{d.m}</span>
                        </div>
                        <div className="tl-sched-body">
                          <h4>{stream.title ?? "Upcoming"}</h4>
                          <div className="meta">
                            <span>{formatTime(stream.scheduled_start_at)}</span>
                            <span className="sep">·</span>
                            <span>{formatRelative(stream.scheduled_start_at)}</span>
                            {stream.organization?.name && (
                              <>
                                <span className="sep">·</span>
                                <span>{stream.organization.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="tl-sched-right">
                          <span className="tag active">Notify</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Replays */}
            {ended.length > 0 && (
              <section className="tl-section">
                <div className="tl-sec-head">
                  <h2>
                    Replays <span className="sans">· {ended.length}</span>
                  </h2>
                </div>
                <div className="tl-match-grid">
                  {ended.slice(0, 9).map((stream) => (
                    <Link key={stream.id} to={`/preview/the-line/live/${stream.id}`} className="tl-match">
                      <div className="tl-match-head">
                        <span className="stat final">Replay</span>
                        <span className="ctx">{stream.ended_at ? formatRelative(stream.ended_at) : ""}</span>
                      </div>
                      <h3 className="tl-match-title">{stream.title ?? "Match"}</h3>
                      <div className="tl-match-foot">
                        <span className="org">{stream.organization?.name ?? ""}</span>
                        <span className="v">Replay →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state — no content */}
            {livestreams.length === 0 && videos.length === 0 && (
              <section className="tl-section">
                <div className="tl-empty">
                  <h3>No broadcasts yet.</h3>
                  <p>
                    This tournament hasn't scheduled any livestreams yet.
                    Registration and bracket information will be available closer to the start date.
                  </p>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </PreviewShell>
  );
};

export default TournamentDetail;
