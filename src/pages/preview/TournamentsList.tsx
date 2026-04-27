import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useTournaments,
  useLivestreams,
  useOpenRegistrationTables,
  useActivePublicQuickTables,
  useCompletedPublicQuickTables,
  useActiveDoublesElimination,
  useCompletedDoublesElimination,
  useActiveFlexTournaments,
  useCompletedFlexTournaments,
  useOpenTeamMatchTournaments,
  useCompletedTeamMatchTournaments,
} from "@/hooks/useSupabaseData";
import { useUserRegisteredTournaments, useUserCompletedTournaments } from "@/hooks/useInteractionData";
import { useAuth } from "@/hooks/useAuth";
import { PreviewShell, formatDate, formatRelative } from "./_shell";

type Tab = "watch" | "community";
type Fmt = "quick-tables" | "doubles-elim" | "flex" | "team-match";

const STATUS_LABEL: Record<string, { cls: "active" | "setup" | "completed" | "registration"; label: string }> = {
  setup: { cls: "setup", label: "Setup" },
  registration: { cls: "registration", label: "Registering" },
  group_stage: { cls: "active", label: "Group stage" },
  playoff: { cls: "active", label: "Playoffs" },
  ongoing: { cls: "active", label: "Live" },
  active: { cls: "active", label: "Live" },
  completed: { cls: "completed", label: "Completed" },
};

const TournamentsList = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("watch");

  // Pro (Watch) data
  const { data: tournaments = [], isLoading: tournamentsLoading } = useTournaments();
  const { data: liveStreams = [] } = useLivestreams("live");

  // Community data — all 4 formats, active + completed
  const { data: openRegTables = [] } = useOpenRegistrationTables({ limit: 20 });
  const { data: activeQuickTables = [] } = useActivePublicQuickTables({ limit: 20 });
  const { data: completedQuickTables = [] } = useCompletedPublicQuickTables({ limit: 10 });

  const { data: openTeamMatches = [] } = useOpenTeamMatchTournaments({ limit: 20 });
  const { data: completedTeamMatches = [] } = useCompletedTeamMatchTournaments({ limit: 10 });

  const { data: activeDoublesElim = [] } = useActiveDoublesElimination({ limit: 20 });
  const { data: completedDoublesElim = [] } = useCompletedDoublesElimination({ limit: 10 });

  const { data: activeFlex = [] } = useActiveFlexTournaments({ limit: 20 });
  const { data: completedFlex = [] } = useCompletedFlexTournaments({ limit: 10 });

  // User's brackets
  const { data: userRegistered = [] } = useUserRegisteredTournaments(user?.id);
  const { data: userCompleted = [] } = useUserCompletedTournaments(user?.id);

  const liveProCount = useMemo(
    () => new Set(liveStreams.map((s) => s.tournament_id).filter(Boolean)).size,
    [liveStreams],
  );

  const communityCount =
    activeQuickTables.length + openRegTables.length +
    openTeamMatches.length +
    activeDoublesElim.length +
    activeFlex.length;

  const sortedPro = useMemo(() => {
    return [...tournaments].sort((a, b) => {
      const order: Record<string, number> = { ongoing: 0, upcoming: 1, ended: 2 };
      const ao = order[a.status] ?? 3;
      const bo = order[b.status] ?? 3;
      if (ao !== bo) return ao - bo;
      const as = a.start_date ? new Date(a.start_date).getTime() : Infinity;
      const bs = b.start_date ? new Date(b.start_date).getTime() : Infinity;
      return a.status === "ended" ? bs - as : as - bs;
    });
  }, [tournaments]);

  const userBrackets = [...userRegistered, ...userCompleted];

  return (
    <PreviewShell title="Tournaments · Preview" active="tournaments">
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/preview/the-line">Home</Link>
          <span className="sep">/</span>
          <span className="current">Tournaments</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">◆ Watch or play — your call</div>
          <h1>
            Tournaments <em className="tl-serif">worth</em> <br />
            <span className="dim">watching,</span> <span className="sans">or running.</span>
          </h1>
          <p>
            Professional broadcasts from PPA, APP, MLP and regional tours — and
            community brackets you or anyone can spin up in under a minute.
          </p>
        </header>

        {/* 2 hero cards — Watch / Play */}
        <div className="tl-hub-cards">
          <Link to="#" className="tl-hub-card" onClick={(e) => { e.preventDefault(); setTab("watch"); }}>
            <div className="tl-hub-kicker">
              <span className="dot" />
              <span>Watch the pros</span>
            </div>
            <h2 className="tl-hub-title">
              Every tour, <span className="sans">one feed.</span>
            </h2>
            <p className="tl-hub-desc">
              Live broadcasts, brackets and replays from the world's pickleball tours.
              One subscription, 4K on flagship courts.
            </p>
            <div className="tl-hub-stats">
              <div>
                <span className="n">{tournaments.length}</span>
                tournaments
              </div>
              <div>
                <span className="n">{liveProCount}</span>
                {liveProCount === 1 ? "live now" : "live now"}
              </div>
              <div>
                <span className="n">{liveStreams.length}</span>
                broadcasts
              </div>
            </div>
            <span className="tl-hub-arrow">Browse pro tours →</span>
          </Link>

          <Link to="/preview/the-line/tools" className="tl-hub-card accent">
            <div className="tl-hub-kicker">
              <span className="dot" />
              <span>Run your own</span>
            </div>
            <h2 className="tl-hub-title">
              60 seconds <span className="sans">to a bracket.</span>
            </h2>
            <p className="tl-hub-desc">
              Quick Tables, Doubles Elim, Flex, Team Match. Free. No signup for viewers.
              Scoreboard, shareable link, printable bracket.
            </p>
            <div className="tl-hub-stats">
              <div>
                <span className="n">{communityCount}</span>
                active now
              </div>
              <div>
                <span className="n">4</span>
                formats
              </div>
              <div>
                <span className="n">60s</span>
                setup
              </div>
            </div>
            <span className="tl-hub-arrow">Open Bracket Lab →</span>
          </Link>
        </div>

        {/* Tabs */}
        <div className="tl-tabs">
          <button
            type="button"
            className={`tl-tab ${tab === "watch" ? "active" : ""}`}
            onClick={() => setTab("watch")}
          >
            Watch<span className="count">{tournaments.length}</span>
          </button>
          <button
            type="button"
            className={`tl-tab ${tab === "community" ? "active" : ""}`}
            onClick={() => setTab("community")}
          >
            Community<span className="count">{communityCount}</span>
          </button>
        </div>

        {/* Tab panels */}
        <div style={{ paddingBottom: 80 }}>
          {tab === "watch" ? (
            tournamentsLoading ? (
              <div className="tl-empty">
                <p style={{ fontFamily: "Geist Mono", fontSize: 12, letterSpacing: "0.04em" }}>Loading tournaments…</p>
              </div>
            ) : sortedPro.length === 0 ? (
              <div className="tl-empty">
                <h3>No pro tournaments yet.</h3>
                <p>Creators haven't scheduled any broadcasts in this window. Check back soon.</p>
              </div>
            ) : (
              <div className="tl-list">
                {sortedPro.map((t) => {
                  const date = formatDate(t.start_date);
                  const endDate = formatDate(t.end_date);
                  const hasLive = liveStreams.some((s) => s.tournament_id === t.id);
                  return (
                    <Link key={t.id} to={`/preview/the-line/tournament/${t.slug}`} className="tl-list-item">
                      <div className="tl-li-date">
                        <span className="d">{date.d}</span>
                        <span className="m">{date.m}</span>
                      </div>
                      <div className="tl-li-body">
                        <h3>{t.name}</h3>
                        <div className="meta">
                          <span>{t.status}</span>
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
                            color: hasLive ? "var(--tl-live)" :
                              t.status === "ongoing" ? "var(--tl-live)" :
                              t.status === "upcoming" ? "var(--tl-green)" :
                              "var(--tl-fg-3)",
                            fontWeight: 600,
                          }}
                        >
                          {hasLive ? "● Live now" :
                           t.status === "ongoing" ? "● Ongoing" :
                           t.status === "upcoming" ? "Register" :
                           "View results"}
                        </span>
                      </div>
                      <span className="tl-li-arrow">→</span>
                    </Link>
                  );
                })}
              </div>
            )
          ) : (
            // Community tab
            <>
              {/* Your brackets */}
              {user && userBrackets.length > 0 && (
                <section className="tl-format-section">
                  <div className="tl-format-section-head">
                    <div>
                      <h3>Your brackets</h3>
                      <p className="desc">Tournaments you've registered for or completed.</p>
                    </div>
                    <div className="right">
                      <span className="count-pill">{userBrackets.length}</span>
                    </div>
                  </div>
                  <div className="tl-list" style={{ ["--fc-accent" as string]: "#00b96b" } as React.CSSProperties}>
                    {userBrackets.slice(0, 8).map((b) => {
                      const status = STATUS_LABEL[b.status] ?? { cls: "active", label: b.status };
                      return (
                        <Link
                          key={b.id}
                          to={`/tools/quick-tables/${b.share_id}`}
                          className="tl-bracket-row"
                          style={{ ["--fc-accent" as string]: "#00b96b" } as React.CSSProperties}
                        >
                          <div className="tl-br-fmt" />
                          <div className="tl-br-body">
                            <h4 className="tl-br-name">{b.name}</h4>
                            <div className="tl-br-meta">
                              <span>Quick Table</span>
                              <span className="sep">·</span>
                              <span>{b.is_doubles ? "Doubles" : "Singles"}</span>
                              <span className="sep">·</span>
                              <span>{b.player_count} players</span>
                            </div>
                          </div>
                          <div className="tl-br-creator">
                            {b.creator_display_name ?? "—"}
                          </div>
                          <span className={`tl-br-status ${status.cls}`}>{status.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Quick Tables */}
              <FormatSection
                fmt="quick-tables"
                title="Quick Tables"
                desc="Round robin groups with auto playoffs. 4 to 32 players. Most popular format."
                count={activeQuickTables.length + openRegTables.length}
                active={[...openRegTables, ...activeQuickTables]}
                completed={completedQuickTables}
                renderMeta={(t: any) => `${t.is_doubles ? "Doubles" : "Singles"} · ${t.player_count} players · ${t.format ?? "Round robin"}`}
                linkBase="/tools/quick-tables"
                createLink="/tools/quick-tables"
              />

              {/* Doubles Elimination */}
              <FormatSection
                fmt="doubles-elim"
                title="Doubles Elimination"
                desc="Double elimination bracket — lose once, fall to losers bracket, fight back to the final."
                count={activeDoublesElim.length}
                active={activeDoublesElim}
                completed={completedDoublesElim}
                renderMeta={(t: any) => `${t.team_count} teams · Double elim`}
                linkBase="/tools/doubles-elimination"
                createLink="/tools/doubles-elimination/new"
              />

              {/* Flex */}
              <FormatSection
                fmt="flex"
                title="Flex Format"
                desc="Custom bracket — define rounds, pools, seeding rules. For non-standard events."
                count={activeFlex.length}
                active={activeFlex}
                completed={completedFlex}
                renderMeta={(_t: any) => "Flex · Custom format"}
                linkBase="/tools/flex-tournament"
                createLink="/tools/flex-tournament/new"
              />

              {/* Team Match */}
              <FormatSection
                fmt="team-match"
                title="Team Match"
                desc="MLP-style team competitions — Dreambreaker tiebreaker included."
                count={openTeamMatches.length}
                active={openTeamMatches}
                completed={completedTeamMatches}
                renderMeta={(t: any) => `${t.team_count} teams · ${t.team_roster_size}/team`}
                linkBase="/tools/team-match"
                createLink="/tools/team-match/new"
                useIdLink
              />

              {/* Empty state */}
              {communityCount === 0 && (
                <div className="tl-empty">
                  <h3>No community brackets running right now.</h3>
                  <p>Be the first. Spin up a bracket in under a minute.</p>
                  <Link to="/preview/the-line/tools" className="tl-btn green">
                    Open Bracket Lab →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PreviewShell>
  );
};

/* ---- Shared format-section component (community) ---- */
interface FormatSectionProps {
  fmt: Fmt;
  title: string;
  desc: string;
  count: number;
  active: Array<any>;
  completed: Array<any>;
  renderMeta: (t: any) => string;
  linkBase: string;
  createLink: string;
  useIdLink?: boolean;
}

const FormatSection = ({
  fmt,
  title,
  desc,
  count,
  active,
  completed,
  renderMeta,
  linkBase,
  createLink,
  useIdLink,
}: FormatSectionProps) => {
  const display = [...active, ...completed].slice(0, 8);
  if (display.length === 0) return null;

  const accentVar = `--fc-accent-${fmt}`;
  const accent =
    fmt === "quick-tables" ? "#00b96b" :
    fmt === "doubles-elim" ? "#e9b649" :
    fmt === "flex" ? "#4f9bff" :
    "#ff7a4d";

  return (
    <section className="tl-format-section">
      <div className="tl-format-section-head">
        <div>
          <h3>{title}</h3>
          <p className="desc">{desc}</p>
        </div>
        <div className="right">
          <span className="count-pill">{count} active</span>
          <Link to={createLink} className="create">Create →</Link>
        </div>
      </div>

      <div className="tl-list">
        {display.map((t) => {
          const status = STATUS_LABEL[t.status] ?? { cls: "active" as const, label: t.status };
          const href = useIdLink ? `${linkBase}/${t.id}` : `${linkBase}/${t.share_id}`;
          return (
            <Link
              key={t.id}
              to={href}
              className="tl-bracket-row"
              style={{ ["--fc-accent" as string]: accent } as React.CSSProperties}
            >
              <div className="tl-br-fmt" />
              <div className="tl-br-body">
                <h4 className="tl-br-name">{t.name}</h4>
                <div className="tl-br-meta">
                  <span>{renderMeta(t)}</span>
                  <span className="sep">·</span>
                  <span>{formatRelative(t.created_at)}</span>
                </div>
              </div>
              <div className="tl-br-creator">
                {t.creator_display_name ?? "—"}
              </div>
              <span className={`tl-br-status ${status.cls}`}>{status.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default TournamentsList;
