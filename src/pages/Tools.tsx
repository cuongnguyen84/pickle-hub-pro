import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import {
  useActivePublicQuickTables,
  useActiveDoublesElimination,
  useActiveFlexTournaments,
  useOpenTeamMatchTournaments,
  useOpenRegistrationTables,
  useCompletedPublicQuickTables,
} from "@/hooks/useSupabaseData";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { formatRelative } from "./preview/_shell";

const Tools = () => {
  const { language } = useI18n();
  const { data: activeQuickTables = [] } = useActivePublicQuickTables({ limit: 20 });
  const { data: openRegTables = [] } = useOpenRegistrationTables({ limit: 20 });
  const { data: completedQuickTables = [] } = useCompletedPublicQuickTables({ limit: 20 });

  const { data: activeDoublesElim = [] } = useActiveDoublesElimination({ limit: 20 });
  const { data: activeFlex = [] } = useActiveFlexTournaments({ limit: 20 });
  const { data: openTeamMatches = [] } = useOpenTeamMatchTournaments({ limit: 20 });

  // Social proof stats
  const activeCount =
    activeQuickTables.length +
    openRegTables.length +
    activeDoublesElim.length +
    activeFlex.length +
    openTeamMatches.length;

  const createdThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400_000;
    const all = [...activeQuickTables, ...activeDoublesElim, ...activeFlex, ...openTeamMatches, ...completedQuickTables, ...openRegTables];
    return all.filter((t) => t.created_at && new Date(t.created_at).getTime() > weekAgo).length;
  }, [activeQuickTables, openRegTables, activeDoublesElim, activeFlex, openTeamMatches, completedQuickTables]);

  // Combined recent activity (newest first)
  const recentActivity = useMemo(() => {
    type Row = {
      id: string;
      name: string;
      fmt: "quick-tables" | "doubles-elim" | "flex" | "team-match";
      fmtLabel: string;
      meta: string;
      creator?: string;
      href: string;
      status: string;
      created_at: string | null;
    };

    const rows: Row[] = [];

    [...openRegTables, ...activeQuickTables].forEach((t) => {
      rows.push({
        id: `qt-${t.id}`,
        name: t.name,
        fmt: "quick-tables",
        fmtLabel: "Quick Table",
        meta: `${t.is_doubles ? "Doubles" : "Singles"} · ${t.player_count} players`,
        creator: t.creator_display_name,
        href: `/tools/quick-tables/${t.share_id}`,
        status: t.status,
        created_at: t.created_at,
      });
    });

    activeDoublesElim.forEach((t) => {
      rows.push({
        id: `de-${t.id}`,
        name: t.name,
        fmt: "doubles-elim",
        fmtLabel: "Doubles Elim",
        meta: `${t.team_count} teams`,
        creator: t.creator_display_name,
        href: `/tools/doubles-elimination/${t.share_id}`,
        status: t.status,
        created_at: t.created_at,
      });
    });

    activeFlex.forEach((t) => {
      rows.push({
        id: `fx-${t.id}`,
        name: t.name,
        fmt: "flex",
        fmtLabel: "Flex",
        meta: "Custom format",
        creator: t.creator_display_name,
        href: `/tools/flex-tournament/${t.share_id}`,
        status: t.status,
        created_at: t.created_at,
      });
    });

    openTeamMatches.forEach((t) => {
      rows.push({
        id: `tm-${t.id}`,
        name: t.name,
        fmt: "team-match",
        fmtLabel: "Team Match",
        meta: `${t.team_count} teams · ${t.team_roster_size}/team`,
        creator: t.creator_display_name,
        href: `/tools/team-match/${t.id}`,
        status: t.status,
        created_at: t.created_at,
      });
    });

    return rows
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 12);
  }, [activeQuickTables, openRegTables, activeDoublesElim, activeFlex, openTeamMatches]);

  const formatAccent = (fmt: string) =>
    fmt === "quick-tables" ? "#00b96b" :
    fmt === "doubles-elim" ? "#e9b649" :
    fmt === "flex" ? "#4f9bff" :
    fmt === "team-match" ? "#ff7a4d" :
    "#00b96b";

  const statusClass = (status: string): "active" | "setup" | "completed" | "registration" => {
    if (status === "setup") return "setup";
    if (status === "registration") return "registration";
    if (status === "completed") return "completed";
    return "active";
  };

  return (
    <TheLineLayout
      title={language === "vi" ? "Bracket Lab" : "Bracket Lab"}
      description={language === "vi"
        ? "Công cụ tổ chức giải đấu pickleball miễn phí — round robin, single/double elimination, MLP team match, Flex format. Không cần đăng ký."
        : "Free pickleball tournament tools — round robin, single/double elimination, MLP team match, Flex format. No signup. Shareable scoreboard."}
      active="lab"
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/">Home</Link>
          <span className="sep">/</span>
          <span className="current">Bracket Lab</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">◆ The killer feature · Free · No signup</div>
          <h1>
            60 seconds <span className="dim">to a</span> <br />
            <em className="tl-serif">pickleball</em> <span className="sans">bracket.</span>
          </h1>
          <p>
            Run a round-robin, double-elim, flex or team match in the browser.
            Live scoring on your phone. Shareable link for viewers. Printable bracket. No apps, no signup, no catch.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
            <Link to="/tools/quick-tables" className="tl-btn green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Start a Quick Table →
            </Link>
            <Link to="/tools/doubles-elimination/new" className="tl-btn">Or Double Elimination</Link>
          </div>
        </header>

        {/* Social proof stats */}
        <section className="tl-stats-row" style={{ marginTop: 40 }}>
          <div className="tl-stat-box">
            <div className="lbl">Active right now</div>
            <div className="val"><span className="green">{activeCount}</span></div>
            <div className="sub">Brackets in progress</div>
          </div>
          <div className="tl-stat-box">
            <div className="lbl">Created this week</div>
            <div className="val">{createdThisWeek}</div>
            <div className="sub">Last 7 days</div>
          </div>
          <div className="tl-stat-box">
            <div className="lbl">Formats</div>
            <div className="val">4</div>
            <div className="sub">Round robin · Elim · Flex · Team</div>
          </div>
          <div className="tl-stat-box">
            <div className="lbl">Setup time</div>
            <div className="val">~60s</div>
            <div className="sub">From click to first match</div>
          </div>
        </section>

        {/* Format cards */}
        <section style={{ marginBottom: 48 }}>
          <div className="tl-sec-head">
            <h2>
              Pick a <em className="tl-serif">format.</em>{" "}
              <span className="sans">Four ways to bracket.</span>
            </h2>
            <p>Every format is free and runs in the browser. Start setup, share link, start scoring.</p>
          </div>

          <div className="tl-format-grid">
            <Link to="/tools/quick-tables" className="tl-format-card" data-fmt="quick-tables">
              <div className="tl-format-head">
                <div className="tl-format-kicker">◆ Round robin · 4-32 players</div>
                <span className="tl-format-badge">Most popular</span>
              </div>
              <h3 className="tl-format-title">Quick Tables</h3>
              <p className="tl-format-desc">
                Group stage → auto playoffs. Singles or doubles. The workhorse format
                for club events, weekend tournaments and practice sessions.
              </p>
              <div className="tl-format-foot">
                <span>{activeQuickTables.length + openRegTables.length} running</span>
                <span className="cta">Start a table →</span>
              </div>
            </Link>

            <Link to="/tools/doubles-elimination/new" className="tl-format-card" data-fmt="doubles-elim">
              <div className="tl-format-head">
                <div className="tl-format-kicker">◆ Double elim · 4-32 teams</div>
                <span className="tl-format-badge">Best of</span>
              </div>
              <h3 className="tl-format-title">Doubles Elimination</h3>
              <p className="tl-format-desc">
                Lose once, drop to losers bracket. Fight back to the final.
                Perfect for a Saturday with 16 teams and stakes on the line.
              </p>
              <div className="tl-format-foot">
                <span>{activeDoublesElim.length} running</span>
                <span className="cta">Create bracket →</span>
              </div>
            </Link>

            <Link to="/tools/flex-tournament/new" className="tl-format-card" data-fmt="flex">
              <div className="tl-format-head">
                <div className="tl-format-kicker">◆ Custom rules · Any size</div>
                <span className="tl-format-badge">Advanced</span>
              </div>
              <h3 className="tl-format-title">Flex Format</h3>
              <p className="tl-format-desc">
                Define your own rounds, pools and seeding rules. For non-standard events
                like king of the court, ladder challenge, or multi-day festivals.
              </p>
              <div className="tl-format-foot">
                <span>{activeFlex.length} running</span>
                <span className="cta">Open flex builder →</span>
              </div>
            </Link>

            <Link to="/tools/team-match/new" className="tl-format-card" data-fmt="team-match">
              <div className="tl-format-head">
                <div className="tl-format-kicker">◆ MLP format · 2 teams</div>
                <span className="tl-format-badge">Pro-level</span>
              </div>
              <h3 className="tl-format-title">Team Match</h3>
              <p className="tl-format-desc">
                MLP-style team vs team with Dreambreaker tiebreaker. Women's doubles,
                men's doubles, mixed x2 — exactly how Major League Pickleball runs it.
              </p>
              <div className="tl-format-foot">
                <span>{openTeamMatches.length} running</span>
                <span className="cta">Set up match →</span>
              </div>
            </Link>
          </div>
        </section>

        {/* Extra tools / utilities */}
        <section style={{ marginBottom: 56 }}>
          <div className="tl-sec-head">
            <h2>
              Plus <em className="tl-serif">utilities.</em>{" "}
            </h2>
          </div>
          <div className="tl-format-grid">
            <Link to="/tools/dashboard" className="tl-format-card" data-fmt="dashboard">
              <div className="tl-format-head">
                <div className="tl-format-kicker">◆ Analytics · Any tournament</div>
              </div>
              <h3 className="tl-format-title">Dashboard</h3>
              <p className="tl-format-desc">
                Real-time stats view for any bracket — pin it on a laptop at the scoring table
                for organizers. Match queue, court assignments, player standings.
              </p>
              <div className="tl-format-foot">
                <span>For organizers</span>
                <span className="cta">Open dashboard →</span>
              </div>
            </Link>

            <Link to="/matches/new" className="tl-format-card" data-fmt="scoring">
              <div className="tl-format-head">
                <div className="tl-format-kicker">◆ Single match · No bracket</div>
              </div>
              <h3 className="tl-format-title">Match Scoring</h3>
              <p className="tl-format-desc">
                Just need to score one match? Open a scoreboard on your phone,
                track points to 11 or 15, save the result or share.
              </p>
              <div className="tl-format-foot">
                <span>Standalone</span>
                <span className="cta">Score a match →</span>
              </div>
            </Link>
          </div>
        </section>

        {/* Live activity feed */}
        <section style={{ marginBottom: 80 }}>
          <div className="tl-sec-head">
            <h2>
              Running <em className="tl-serif">right now.</em>{" "}
              <span className="sans">{recentActivity.length}</span>
            </h2>
            <p>Latest community brackets — real people, running real tournaments, right this minute.</p>
          </div>

          {recentActivity.length === 0 ? (
            <div className="tl-empty">
              <h3>No public brackets running at the moment.</h3>
              <p>Be the first. Spin up a Quick Table — setup takes about a minute.</p>
              <Link to="/tools/quick-tables" className="tl-btn green">Start a Quick Table →</Link>
            </div>
          ) : (
            <div className="tl-list">
              {recentActivity.map((row) => (
                <Link
                  key={row.id}
                  to={row.href}
                  className="tl-bracket-row"
                  style={{ ["--fc-accent" as string]: formatAccent(row.fmt) } as React.CSSProperties}
                >
                  <div className="tl-br-fmt" />
                  <div className="tl-br-body">
                    <h4 className="tl-br-name">{row.name}</h4>
                    <div className="tl-br-meta">
                      <span>{row.fmtLabel}</span>
                      <span className="sep">·</span>
                      <span>{row.meta}</span>
                      <span className="sep">·</span>
                      <span>{formatRelative(row.created_at)}</span>
                    </div>
                  </div>
                  <div className="tl-br-creator">{row.creator ?? "—"}</div>
                  <span className={`tl-br-status ${statusClass(row.status)}`}>{row.status}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Bottom CTA */}
        <section
          style={{
            padding: "48px 36px",
            background: "var(--tl-surface)",
            border: "1px solid var(--tl-border)",
            borderRadius: "var(--tl-radius-lg)",
            textAlign: "center",
            marginBottom: 80,
          }}
        >
          <div
            className="tl-mono"
            style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--tl-green)", marginBottom: 12 }}
          >
            ◆ One more thing
          </div>
          <h3
            style={{
              fontFamily: "Instrument Serif",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "clamp(28px, 3.4vw, 44px)",
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              margin: "0 0 16px",
            }}
          >
            Your bracket, on your phone. Your scoreboard, on a TV.
          </h3>
          <p style={{ fontSize: 15.5, color: "var(--tl-fg-2)", maxWidth: "52ch", margin: "0 auto 24px", lineHeight: 1.55 }}>
            Every bracket auto-generates a read-only scoreboard URL perfect for casting to a TV
            at the venue. Players score on phones, spectators watch on screens.
          </p>
          <Link to="/tools/quick-tables" className="tl-btn green">
            Try it free →
          </Link>
        </section>
      </div>
    </TheLineLayout>
  );
};

export default Tools;
