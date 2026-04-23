import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useLivestreams, useTournaments } from "@/hooks/useSupabaseData";
import { useFeaturedNews } from "@/hooks/useFeaturedNews";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import "@/styles/the-line.css";

/* ---------------------------------------------------------------------------
 * Preview route: /preview/the-line
 *
 * Feature-flagged Home page rendered in the new "The Line" aesthetic
 * (Direction IV). Fetches the SAME data as the production Home page so we
 * can evaluate layout, typography and density against real content.
 *
 * Scoped under [data-theme="the-line"] — no production style pollution.
 * ------------------------------------------------------------------------- */

const formatDate = (iso: string | null | undefined): { d: string; m: string } => {
  if (!iso) return { d: "—", m: "—" };
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { d: "—", m: "—" };
  return {
    d: dt.getDate().toString().padStart(2, "0"),
    m: dt.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
  };
};

const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const formatRelative = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const dt = new Date(iso).getTime();
  if (Number.isNaN(dt)) return "";
  const diff = dt - Date.now();
  const absMin = Math.abs(Math.round(diff / 60000));
  if (absMin < 1) return "now";
  if (absMin < 60) return diff > 0 ? `in ${absMin}m` : `${absMin}m ago`;
  const hrs = Math.round(absMin / 60);
  if (hrs < 24) return diff > 0 ? `in ${hrs}h` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return diff > 0 ? `in ${days}d` : `${days}d ago`;
};

const TICKER_FALLBACK = [
  "Waters vs Parenteau · 11–9 · W. Singles Final",
  "Johns / Johnson vs Staksrud / Newman · M. Doubles SF",
  "McGuffin vs Duong · M. Singles R16 · in 22m",
  "Kovalova / Cho vs Irvine / Tereschenko · Mixed D. QF",
];

const TheLine = () => {
  const { t } = useI18n();
  const { data: liveStreams = [], isLoading: liveLoading } = useLivestreams("live");
  const { data: scheduledStreams = [], isLoading: scheduledLoading } = useLivestreams("scheduled");
  const { data: allTournaments = [] } = useTournaments();
  const { data: featuredNews = [], isLoading: newsLoading } = useFeaturedNews(3);

  // Pin data-theme attribute only while mounted, strip on unmount
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "the-line");
    return () => {
      if (prev) root.setAttribute("data-theme", prev);
      else root.removeAttribute("data-theme");
    };
  }, []);

  // Ticker content — derived from live streams if available, else fallback
  const tickerItems = useMemo(() => {
    if (liveStreams.length > 0) {
      const live = liveStreams.slice(0, 6).map((s) => ({
        text: s.title ?? "Live match",
        org: s.organization?.name ?? "",
      }));
      if (scheduledStreams.length > 0) {
        const next = scheduledStreams[0];
        live.push({
          text: `NEXT · ${next.title ?? "Upcoming"} · ${formatRelative(next.scheduled_start_at)}`,
          org: next.organization?.name ?? "",
        });
      }
      return live;
    }
    return TICKER_FALLBACK.map((text) => ({ text, org: "" }));
  }, [liveStreams, scheduledStreams]);

  // Featured match for hero — first live stream, fallback to next scheduled
  const featured = liveStreams[0] ?? scheduledStreams[0] ?? null;

  // Upcoming tournaments — filter to active/upcoming, sort by start_date ascending
  const upcomingTournaments = useMemo(() => {
    const now = Date.now();
    return [...allTournaments]
      .filter((tourn) => {
        if (tourn.status === "ended") return false;
        if (!tourn.start_date) return true;
        const start = new Date(tourn.start_date).getTime();
        const end = tourn.end_date ? new Date(tourn.end_date).getTime() : start + 86400000;
        return end >= now;
      })
      .sort((a, b) => {
        const aD = a.start_date ? new Date(a.start_date).getTime() : Infinity;
        const bD = b.start_date ? new Date(b.start_date).getTime() : Infinity;
        return aD - bD;
      })
      .slice(0, 5);
  }, [allTournaments]);

  const hasLiveData = liveStreams.length > 0;
  const liveCount = liveStreams.length;
  const upcomingCount = scheduledStreams.length;

  return (
    <>
      <DynamicMeta
        title="The Line · Design Preview"
        description="Preview of Direction IV — a proposed redesign of ThePickleHub for global audience."
        noindex
      />

      <div className="tl-preview-banner">
        ◆ Preview · Direction IV · The Line &nbsp;·&nbsp;
        <Link to="/">Back to current design →</Link>
      </div>

      <nav className="tl-nav">
        <Link to="/preview/the-line" className="tl-brand">
          <span className="tl-brand-mark" aria-hidden="true" />
          <span>
            <em>Pickle</em> Hub
          </span>
        </Link>

        <div className="tl-nav-links">
          <a className="active">Live</a>
          <a>Tournaments</a>
          <a>Rankings</a>
          <a>Stories</a>
          <a>Stats</a>
          <a>Shop</a>
        </div>

        <div className="tl-nav-right">
          <button className="tl-nav-search" type="button" aria-label="Search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>Search players, events…</span>
            <kbd>⌘K</kbd>
          </button>
          <Link to="/login" className="tl-nav-btn">
            Sign in
          </Link>
        </div>
      </nav>

      {/* Ticker */}
      <div className="tl-ticker" aria-label="Live scores ticker">
        <div className="tl-ticker-head">
          <span className="dot" aria-hidden="true" />
          Live
        </div>
        <div className="tl-ticker-body">
          <div className="tl-ticker-track">
            {[...tickerItems, ...tickerItems].map((item, idx) => (
              <span key={idx}>
                <b>{item.text}</b>
                {item.org ? (
                  <>
                    <span className="sep"> · </span>
                    {item.org}
                  </>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="tl-hero">
        <div className="tl-shell">
          <div className="tl-hero-grid">
            <div>
              <div className="tl-eyebrow tl-up tl-d1">
                <span className="pip" aria-hidden="true" />
                <span>
                  {hasLiveData
                    ? `Live · ${liveCount} match${liveCount === 1 ? "" : "es"}`
                    : "Broadcast · Next 24h"}
                </span>
                <span className="sep">/</span>
                <span>{upcomingCount} scheduled</span>
              </div>

              <h1 className="tl-hero-title tl-up tl-d2">
                {hasLiveData ? (
                  <>
                    Every court, <br />
                    <span className="dim">every bracket,</span> <br />
                    one screen.
                  </>
                ) : (
                  <>
                    Pickleball, <br />
                    covered <span className="dim">the way</span> <br />
                    serious sport <span className="dim">should be.</span>
                  </>
                )}
              </h1>

              <p className="tl-hero-lede tl-up tl-d3">
                Global coverage of professional pickleball — PPA, APP, MLP, European Open,
                Asia Pacific Series. Real match reports by reporters at the court.
                Live scores that tick in real time. One subscription.
              </p>

              <div className="tl-hero-ctas tl-up tl-d4">
                <Link to="/live" className="tl-btn green">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {hasLiveData ? `Watch live · ${liveCount} court${liveCount === 1 ? "" : "s"}` : "Browse replays"}
                </Link>
                <Link to="/tournaments" className="tl-btn">
                  See schedule →
                </Link>
              </div>
            </div>

            {/* Featured live scoreboard / upcoming card */}
            <div className="tl-livecard tl-up tl-d3">
              <div className="tl-lc-head">
                <span className={featured?.status === "live" ? "live" : ""}>
                  {featured?.status === "live" ? "Live" : featured?.status === "scheduled" ? "Upcoming" : "Featured"}
                </span>
                <span>
                  {featured?.organization?.name ??
                    (featured?.scheduled_start_at ? formatRelative(featured.scheduled_start_at) : "No match")}
                </span>
              </div>

              {featured ? (
                <>
                  <div className="tl-lc-body">
                    <div className="tl-lc-row leader">
                      <span className="tl-lc-seed">●</span>
                      <div className="tl-lc-name">
                        <span className="name-text">{featured.title ?? "Match"}</span>
                      </div>
                      <div className="tl-lc-sets">
                        <span className="tl-lc-set current">
                          {featured.status === "live" ? "LIVE" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="tl-lc-row" style={{ paddingTop: 14, borderTop: "1px solid var(--tl-border)", marginTop: 6 }}>
                      <span className="tl-lc-seed" />
                      <div
                        className="tl-mono"
                        style={{ fontSize: 11, color: "var(--tl-fg-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}
                      >
                        {featured.description
                          ? featured.description.slice(0, 80) + (featured.description.length > 80 ? "…" : "")
                          : featured.scheduled_start_at
                          ? `Scheduled · ${formatTime(featured.scheduled_start_at)}`
                          : "Pickleball match"}
                      </div>
                    </div>
                  </div>
                  <div className="tl-lc-footer">
                    <span className="meta">
                      {featured.tournament_id
                        ? allTournaments.find((tn) => tn.id === featured.tournament_id)?.name ?? "Tournament match"
                        : "Live broadcast"}
                    </span>
                    <Link to={`/live/${featured.id}`} className="watch">
                      Watch →
                    </Link>
                  </div>
                </>
              ) : (
                <div className="tl-lc-empty">
                  {liveLoading || scheduledLoading ? "Loading live data…" : "No live matches right now"}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Live courts */}
      <section className="tl-section">
        <div className="tl-shell">
          <div className="tl-sec-head">
            <h2>
              Live <em className="tl-serif">courts.</em>{" "}
              <span className="sans">
                {liveCount} {liveCount === 1 ? "match" : "matches"}
              </span>
            </h2>
            <p>
              Every match streaming right now, pulled live from the database. Click through to watch with low-delay HLS.
            </p>
          </div>

          {liveLoading ? (
            <div className="tl-match-grid">
              {[0, 1, 2].map((n) => (
                <div key={n} className="tl-match" style={{ opacity: 0.4 }}>
                  <div className="tl-match-head">
                    <span>Loading…</span>
                  </div>
                  <div className="tl-match-title">&nbsp;</div>
                  <div className="tl-match-foot">
                    <span>&nbsp;</span>
                  </div>
                </div>
              ))}
            </div>
          ) : liveStreams.length === 0 ? (
            <div
              className="tl-panel"
              style={{
                padding: "48px 20px",
                textAlign: "center",
                fontFamily: "Geist Mono",
                fontSize: 13,
                color: "var(--tl-fg-3)",
                letterSpacing: "0.04em",
              }}
            >
              <div style={{ marginBottom: 12 }}>No live matches right now.</div>
              <Link to="/live" className="tl-btn" style={{ fontSize: 13 }}>
                Browse all courts →
              </Link>
            </div>
          ) : (
            <div className="tl-match-grid">
              {liveStreams.slice(0, 9).map((stream) => (
                <Link key={stream.id} to={`/live/${stream.id}`} className="tl-match">
                  <div className="tl-match-head">
                    <span className="stat live">Live</span>
                    <span className="ctx">
                      {stream.started_at ? formatTime(stream.started_at) : "On air"}
                    </span>
                  </div>
                  <h3 className="tl-match-title">{stream.title ?? "Untitled match"}</h3>
                  <div className="tl-match-foot">
                    <span className="org">{stream.organization?.name ?? "Broadcast"}</span>
                    <span className="v">Watch →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Schedule */}
      <section className="tl-section">
        <div className="tl-shell">
          <div className="tl-sec-head">
            <h2>
              Coming <em className="tl-serif">up.</em>{" "}
              <span className="sans">
                {upcomingTournaments.length + scheduledStreams.length} events
              </span>
            </h2>
            <p>Tournaments opening registration and scheduled streams from the next 30 days.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 20 }}>
            <div className="tl-panel tl-panel--tournaments">
              <div className="tl-panel-head">
                <h3>Tournaments</h3>
                <span className="meta">{upcomingTournaments.length} upcoming</span>
              </div>
              {upcomingTournaments.length === 0 ? (
                <div className="tl-lc-empty" style={{ padding: "32px 20px" }}>
                  No scheduled tournaments
                </div>
              ) : (
                upcomingTournaments.map((tourn) => {
                  const date = formatDate(tourn.start_date);
                  return (
                    <Link key={tourn.id} to={`/tournament/${tourn.slug}`} className="tl-sched-row">
                      <div className="tl-sched-date">
                        <span className="d">{date.d}</span>
                        <span className="m">{date.m}</span>
                      </div>
                      <div className="tl-sched-body">
                        <h4>{tourn.name}</h4>
                        <div className="meta">
                          <span>Status: {tourn.status}</span>
                          {tourn.end_date && (
                            <>
                              <span className="sep">·</span>
                              <span>Ends {formatDate(tourn.end_date).d} {formatDate(tourn.end_date).m}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="tl-sched-right">
                        <span className={`tag ${tourn.status === "ongoing" ? "live" : tourn.status === "upcoming" ? "active" : ""}`}>
                          {tourn.status}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            <div className="tl-panel">
              <div className="tl-panel-head">
                <h3>Streams</h3>
                <span className="meta">{scheduledStreams.length} scheduled</span>
              </div>
              {scheduledLoading ? (
                <div className="tl-lc-empty" style={{ padding: "32px 20px" }}>
                  Loading…
                </div>
              ) : scheduledStreams.length === 0 ? (
                <div className="tl-lc-empty" style={{ padding: "32px 20px" }}>
                  No scheduled streams
                </div>
              ) : (
                scheduledStreams.slice(0, 5).map((stream) => {
                  const date = formatDate(stream.scheduled_start_at);
                  return (
                    <Link key={stream.id} to={`/live/${stream.id}`} className="tl-sched-row">
                      <div className="tl-sched-date">
                        <span className="d">{date.d}</span>
                        <span className="m">{date.m}</span>
                      </div>
                      <div className="tl-sched-body">
                        <h4>{stream.title ?? "Upcoming stream"}</h4>
                        <div className="meta">
                          <span>{formatTime(stream.scheduled_start_at)}</span>
                          <span className="sep">·</span>
                          <span>{stream.organization?.name ?? "Broadcast"}</span>
                          <span className="sep">·</span>
                          <span>{formatRelative(stream.scheduled_start_at)}</span>
                        </div>
                      </div>
                      <div className="tl-sched-right">
                        <span className="tag">Stream</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* News */}
      <section className="tl-section">
        <div className="tl-shell">
          <div className="tl-sec-head">
            <h2>
              From the <em className="tl-serif">desk.</em>{" "}
              <span className="sans">{featuredNews.length} stories</span>
            </h2>
            <p>Curated coverage from across the pickleball ecosystem. Updated daily.</p>
          </div>

          {newsLoading ? (
            <div className="tl-news-grid">
              {[0, 1, 2].map((n) => (
                <div key={n} className="tl-news-item" style={{ opacity: 0.4 }}>
                  <div className="tl-news-kicker">Loading…</div>
                  <h3 className="tl-news-title">&nbsp;</h3>
                  <p className="tl-news-summary">&nbsp;</p>
                </div>
              ))}
            </div>
          ) : featuredNews.length === 0 ? (
            <div className="tl-lc-empty" style={{ padding: "48px 20px" }}>
              No featured stories
            </div>
          ) : (
            <div className="tl-news-grid">
              {featuredNews.map((item) => (
                <a
                  key={item.id}
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tl-news-item"
                >
                  <div className="tl-news-kicker">◆ {item.source ?? "Story"}</div>
                  <h3 className="tl-news-title">{item.title}</h3>
                  <p className="tl-news-summary">{item.summary}</p>
                  <div className="tl-news-meta">
                    <b>{item.published_at ? formatRelative(item.published_at) : ""}</b>
                    <span>Read original →</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Manifesto */}
      <section className="tl-manifesto">
        <div className="tl-shell">
          <div className="tl-manifesto-inner">
            <div className="num tl-mono">/ 04 — What we believe</div>
            <h2>
              Pickleball deserves <br />
              the same <em className="tl-serif">care</em> <br />
              <span className="dim">we'd give any sport</span> <br />
              <span className="dim">with a century</span> <br />
              <span className="dim">of reporting behind it.</span>
            </h2>

            <div className="grid">
              <div className="item">
                <h3>01 / Real journalism</h3>
                <p>
                  Match reports, player features, and analysis written by reporters who were{" "}
                  <em>at the court.</em> No aggregation. No AI slop.
                </p>
              </div>
              <div className="item">
                <h3>02 / Every tour, one app</h3>
                <p>
                  PPA. APP. MLP. European Open. Asia Pacific Series. Vietnam National.
                  Every bracket, every score, every court — <em>in one place.</em>
                </p>
              </div>
              <div className="item">
                <h3>03 / Built for players</h3>
                <p>
                  Find a partner, book a court, track your DUPR. Everything a player needs —{" "}
                  <em>and nothing they don't.</em>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="tl-footer">
        <div className="tl-shell">
          <div className="tl-foot-grid">
            <div className="tl-foot-brand">
              <h3>
                <em style={{ fontFamily: "inherit" }}>Pickle</em> Hub
              </h3>
              <p>
                Global coverage of professional pickleball. Headquartered in Ho Chi Minh City,
                reporting from Austin, Naples, Barcelona, Singapore and elsewhere.
              </p>
            </div>

            <div className="tl-foot-col">
              <h4>Watch</h4>
              <ul>
                <li><Link to="/live">Live courts</Link></li>
                <li><Link to="/videos">Replays</Link></li>
                <li><Link to="/tournaments">Schedule</Link></li>
              </ul>
            </div>

            <div className="tl-foot-col">
              <h4>Compete</h4>
              <ul>
                <li><Link to="/tournaments">Tournaments</Link></li>
                <li><Link to="/tools">Bracket tools</Link></li>
                <li><Link to="/tools/quick-tables">Quick tables</Link></li>
              </ul>
            </div>

            <div className="tl-foot-col">
              <h4>Read</h4>
              <ul>
                <li><Link to="/blog">Stories</Link></li>
                <li><Link to="/news">News</Link></li>
                <li><Link to="/forum">Forum</Link></li>
              </ul>
            </div>
          </div>

          <div className="tl-foot-bottom">
            <span>© 2026 The Pickle Hub · Ho Chi Minh City</span>
            <span>Preview · Direction IV · Not final design</span>
          </div>
        </div>
      </footer>
    </>
  );
};

export default TheLine;
