import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLivestreams } from "@/hooks/useSupabaseData";
import { PreviewShell, formatTime, formatRelative } from "./_shell";

type Filter = "all" | "live" | "scheduled" | "ended";

const LiveList = () => {
  const [filter, setFilter] = useState<Filter>("all");

  const { data: live = [], isLoading: liveLoading } = useLivestreams("live");
  const { data: scheduled = [], isLoading: schedLoading } = useLivestreams("scheduled");
  const { data: ended = [], isLoading: endedLoading } = useLivestreams("ended");

  const counts = {
    all: live.length + scheduled.length + ended.length,
    live: live.length,
    scheduled: scheduled.length,
    ended: ended.length,
  };

  const isLoading = liveLoading || schedLoading || endedLoading;

  const items = useMemo(() => {
    switch (filter) {
      case "live": return live;
      case "scheduled": return scheduled;
      case "ended": return ended;
      default: return [...live, ...scheduled, ...ended.slice(0, 12)];
    }
  }, [filter, live, scheduled, ended]);

  const renderMatchHead = (stream: typeof live[number]) => {
    if (stream.status === "live") {
      return (
        <div className="tl-match-head">
          <span className="stat live">Live</span>
          <span className="ctx">{stream.started_at ? formatTime(stream.started_at) : "On air"}</span>
        </div>
      );
    }
    if (stream.status === "scheduled") {
      return (
        <div className="tl-match-head">
          <span className="stat upcoming">● Scheduled</span>
          <span className="ctx">{formatRelative(stream.scheduled_start_at)}</span>
        </div>
      );
    }
    return (
      <div className="tl-match-head">
        <span className="stat final">Replay</span>
        <span className="ctx">{stream.ended_at ? formatRelative(stream.ended_at) : "Ended"}</span>
      </div>
    );
  };

  return (
    <PreviewShell title="Live Courts · Preview" active="live">
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/preview/the-line">Home</Link>
          <span className="sep">/</span>
          <span className="current">Live courts</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">◆ Live broadcast index</div>
          <h1>
            Every court, <br />
            <span className="dim">every bracket,</span> <br />
            <span className="sans">on one screen.</span>
          </h1>
          <p>
            Matches streaming right now, upcoming within the next 24 hours, and replays
            from the past week. Pulled live from the database — no cache.
          </p>
        </header>

        <div className="tl-filters">
          {([
            { key: "all", label: "All" },
            { key: "live", label: "Live" },
            { key: "scheduled", label: "Upcoming" },
            { key: "ended", label: "Replays" },
          ] as const).map((f) => (
            <button
              key={f.key}
              type="button"
              className={`tl-filter ${filter === f.key ? "active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="count">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        <div style={{ paddingBottom: 80 }}>
          {isLoading ? (
            <div className="tl-empty">
              <p style={{ fontFamily: "Geist Mono", fontSize: 12, letterSpacing: "0.04em" }}>Loading live courts…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="tl-empty">
              <h3>No matches in this view.</h3>
              <p>
                Try a different filter. Live courts light up during active tournaments —
                check the schedule for what's coming up.
              </p>
              <Link to="/preview/the-line/tournaments" className="tl-btn">See tournament schedule →</Link>
            </div>
          ) : (
            <div className="tl-match-grid">
              {items.slice(0, 24).map((stream) => (
                <Link key={stream.id} to={`/preview/the-line/live/${stream.id}`} className="tl-match">
                  {renderMatchHead(stream)}
                  <h3 className="tl-match-title">{stream.title ?? "Untitled match"}</h3>
                  <div className="tl-match-foot">
                    <span className="org">{stream.organization?.name ?? "Broadcast"}</span>
                    <span className="v">
                      {stream.status === "live" ? "Watch →" : stream.status === "scheduled" ? "Notify →" : "Replay →"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PreviewShell>
  );
};

export default LiveList;
