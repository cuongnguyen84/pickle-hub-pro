import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTournaments } from "@/hooks/useSupabaseData";
import { PreviewShell, formatDate } from "./_shell";

type Filter = "all" | "upcoming" | "ongoing" | "ended";

const TournamentsList = () => {
  const [filter, setFilter] = useState<Filter>("all");
  const { data: tournaments = [], isLoading } = useTournaments();

  const counts = useMemo(() => {
    return {
      all: tournaments.length,
      upcoming: tournaments.filter((t) => t.status === "upcoming").length,
      ongoing: tournaments.filter((t) => t.status === "ongoing").length,
      ended: tournaments.filter((t) => t.status === "ended").length,
    };
  }, [tournaments]);

  const filtered = useMemo(() => {
    const base = filter === "all" ? tournaments : tournaments.filter((t) => t.status === filter);
    return [...base].sort((a, b) => {
      // ongoing first, then upcoming by start date ascending, then ended by end date descending
      const order: Record<string, number> = { ongoing: 0, upcoming: 1, ended: 2 };
      const ao = order[a.status] ?? 3;
      const bo = order[b.status] ?? 3;
      if (ao !== bo) return ao - bo;
      if (a.status === "ended") {
        const ae = a.end_date ? new Date(a.end_date).getTime() : 0;
        const be = b.end_date ? new Date(b.end_date).getTime() : 0;
        return be - ae;
      }
      const as = a.start_date ? new Date(a.start_date).getTime() : Infinity;
      const bs = b.start_date ? new Date(b.start_date).getTime() : Infinity;
      return as - bs;
    });
  }, [tournaments, filter]);

  return (
    <PreviewShell title="Tournaments · Preview" active="tournaments">
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/preview/the-line">Home</Link>
          <span className="sep">/</span>
          <span className="current">Tournaments</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">◆ Every tournament · one index</div>
          <h1>
            Tournaments <em className="tl-serif">worth</em> <br />
            <span className="dim">watching in</span> <span className="sans">2026.</span>
          </h1>
          <p>
            Professional and community tournaments from across the platform.
            Live data — status, start dates, registration — updates in real time.
          </p>
        </header>

        <div className="tl-filters">
          {([
            { key: "all", label: "All" },
            { key: "ongoing", label: "Ongoing" },
            { key: "upcoming", label: "Upcoming" },
            { key: "ended", label: "Ended" },
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
              <p style={{ fontFamily: "Geist Mono", fontSize: 12, letterSpacing: "0.04em" }}>Loading tournaments…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="tl-empty">
              <h3>No tournaments in this view.</h3>
              <p>Try a different filter — or check back when the next season opens.</p>
            </div>
          ) : (
            <div className="tl-list">
              {filtered.map((t) => {
                const date = formatDate(t.start_date);
                const endDate = formatDate(t.end_date);
                return (
                  <Link key={t.id} to={`/preview/the-line/tournament/${t.slug}`} className="tl-list-item">
                    <div className="tl-li-date">
                      <span className="d">{date.d}</span>
                      <span className="m">{date.m}</span>
                    </div>
                    <div className="tl-li-body">
                      <h3>{t.name}</h3>
                      <div className="meta">
                        <span>Status: {t.status}</span>
                        {t.end_date && (
                          <>
                            <span className="sep">·</span>
                            <span>Ends {endDate.d} {endDate.m}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="tl-li-right">
                      <span
                        style={{
                          color:
                            t.status === "ongoing" ? "var(--tl-live)" :
                            t.status === "upcoming" ? "var(--tl-green)" :
                            "var(--tl-fg-3)",
                          fontWeight: 600,
                        }}
                      >
                        {t.status === "ongoing" ? "● Live now" :
                         t.status === "upcoming" ? "Register" :
                         "View results"}
                      </span>
                    </div>
                    <span className="tl-li-arrow">→</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PreviewShell>
  );
};

export default TournamentsList;
