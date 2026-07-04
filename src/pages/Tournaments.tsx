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
import { useI18n } from "@/i18n";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { formatDate, formatRelative } from "./preview/_shell";
import { useQueryClient } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";

type Tab = "watch" | "community";
type Fmt = "quick-tables" | "doubles-elim" | "flex" | "team-match";
type FmtStatus = "ongoing" | "ended";

const STATUS_LABEL: Record<string, { cls: "active" | "setup" | "completed" | "registration"; en: string; vi: string }> = {
  setup: { cls: "setup", en: "Setup", vi: "Chuẩn bị" },
  registration: { cls: "registration", en: "Registering", vi: "Đang mở đăng ký" },
  group_stage: { cls: "active", en: "Group stage", vi: "Vòng bảng" },
  playoff: { cls: "active", en: "Playoffs", vi: "Playoff" },
  ongoing: { cls: "active", en: "Live", vi: "Đang diễn ra" },
  active: { cls: "active", en: "Live", vi: "Đang diễn ra" },
  completed: { cls: "completed", en: "Completed", vi: "Đã kết thúc" },
};

// Minimal shared shape across the 4 community bracket types (QuickTablePublic, DoublesEliminationPublic, …)
interface CommunityBracket {
  id: string;
  name: string;
  share_id: string;
  status: string;
  created_at: string;
  creator_display_name?: string | null;
  is_doubles?: boolean;
  player_count?: number;
  format?: string | null;
  team_count?: number;
  team_roster_size?: number;
}

interface FormatDef {
  fmt: Fmt;
  title: string;
  desc: { en: string; vi: string };
  accent: string;
  linkBase: string;
  createLink: string;
  renderMeta: (t: CommunityBracket, vi: boolean) => string;
}

const FORMATS: FormatDef[] = [
  {
    fmt: "quick-tables",
    title: "Quick Tables",
    desc: {
      en: "Round robin groups with auto playoffs. 4 to 32 players. Most popular format.",
      vi: "Vòng tròn chia bảng, tự động playoff. 4–32 người chơi. Thể thức phổ biến nhất.",
    },
    accent: "#00b96b",
    linkBase: "/tools/quick-tables",
    createLink: "/tools/quick-tables",
    renderMeta: (t, vi) =>
      `${t.is_doubles ? (vi ? "Đôi" : "Doubles") : (vi ? "Đơn" : "Singles")} · ${t.player_count} ${vi ? "người chơi" : "players"} · ${t.format ?? "Round robin"}`,
  },
  {
    fmt: "doubles-elim",
    title: "Doubles Elimination",
    desc: {
      en: "Double elimination bracket — lose once, fall to losers bracket, fight back to the final.",
      vi: "Nhánh thắng nhánh thua — thua một trận rơi xuống nhánh thua, vẫn còn cơ hội vào chung kết.",
    },
    accent: "#e9b649",
    linkBase: "/tools/doubles-elimination",
    createLink: "/tools/doubles-elimination/new",
    renderMeta: (t, vi) => `${t.team_count} ${vi ? "đội" : "teams"} · Double elim`,
  },
  {
    fmt: "flex",
    title: "Flex Format",
    desc: {
      en: "Custom bracket — define rounds, pools, seeding rules. For non-standard events.",
      vi: "Bracket tùy biến — tự định nghĩa vòng đấu, bảng, luật xếp hạt giống. Cho các giải không theo chuẩn.",
    },
    accent: "#4f9bff",
    linkBase: "/tools/flex-tournament",
    createLink: "/tools/flex-tournament/new",
    renderMeta: (_t, vi) => (vi ? "Flex · Thể thức tùy biến" : "Flex · Custom format"),
  },
  {
    fmt: "team-match",
    title: "Team Match",
    desc: {
      en: "MLP-style team competitions — Dreambreaker tiebreaker included.",
      vi: "Thi đấu đồng đội kiểu MLP — có Dreambreaker phân định thắng thua.",
    },
    accent: "#ff7a4d",
    linkBase: "/tools/team-match",
    createLink: "/tools/team-match/new",
    renderMeta: (t, vi) => `${t.team_count} ${vi ? "đội" : "teams"} · ${t.team_roster_size}/${vi ? "đội" : "team"}`,
  },
];

const Tournaments = () => {
  const { user } = useAuth();
  const { language } = useI18n();
  const vi = language === "vi";
  const [userTab, setUserTab] = useState<Tab | null>(null);
  const [fmtTab, setFmtTab] = useState<Fmt>("quick-tables");
  const [fmtStatus, setFmtStatus] = useState<FmtStatus>("ongoing");

  // Pro (Watch) data
  const { data: tournaments = [], isLoading: tournamentsLoading } = useTournaments();
  const { data: liveStreams = [] } = useLivestreams("live");

  const hasWatchContent = tournaments.length > 0 || liveStreams.length > 0;
  const tab: Tab = userTab ?? (hasWatchContent ? "watch" : "community");

  // Community data — all 4 formats, active + completed
  // "Ended" has its own tab now — limit 100 so the list is actually complete (86 QT completed as of 2026-07)
  const { data: openRegTables = [] } = useOpenRegistrationTables({ limit: 20 });
  const { data: activeQuickTables = [] } = useActivePublicQuickTables({ limit: 20 });
  const { data: completedQuickTables = [] } = useCompletedPublicQuickTables({ limit: 100 });

  const { data: openTeamMatches = [] } = useOpenTeamMatchTournaments({ limit: 20 });
  const { data: completedTeamMatches = [] } = useCompletedTeamMatchTournaments({ limit: 100 });

  const { data: activeDoublesElim = [] } = useActiveDoublesElimination({ limit: 20 });
  const { data: completedDoublesElim = [] } = useCompletedDoublesElimination({ limit: 100 });

  const { data: activeFlex = [] } = useActiveFlexTournaments({ limit: 20 });
  const { data: completedFlex = [] } = useCompletedFlexTournaments({ limit: 100 });

  // User's brackets
  const { data: userRegistered = [] } = useUserRegisteredTournaments(user?.id);
  const { data: userCompleted = [] } = useUserCompletedTournaments(user?.id);

  const queryClient = useQueryClient();
  const ptrState = usePullToRefresh(async () => {
    await queryClient.invalidateQueries();
  });

  const liveProCount = useMemo(
    () => new Set(liveStreams.map((s) => s.tournament_id).filter(Boolean)).size,
    [liveStreams],
  );

  // Setup tables with open registration match BOTH quick-table hooks — dedupe by id
  const quickTablesOngoing = [
    ...openRegTables,
    ...activeQuickTables.filter((t) => !openRegTables.some((o) => o.id === t.id)),
  ];

  const formatData: Record<Fmt, { ongoing: CommunityBracket[]; ended: CommunityBracket[] }> = {
    "quick-tables": { ongoing: quickTablesOngoing, ended: completedQuickTables },
    "doubles-elim": { ongoing: activeDoublesElim, ended: completedDoublesElim },
    "flex": { ongoing: activeFlex, ended: completedFlex },
    "team-match": { ongoing: openTeamMatches, ended: completedTeamMatches },
  };

  const communityCount =
    formatData["quick-tables"].ongoing.length +
    formatData["doubles-elim"].ongoing.length +
    formatData["flex"].ongoing.length +
    formatData["team-match"].ongoing.length;

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

  const currentFormat = FORMATS.find((f) => f.fmt === fmtTab)!;
  const currentList = formatData[fmtTab][fmtStatus];

  return (
    <TheLineLayout
      title={vi ? "Giải đấu" : "Tournaments"}
      description={vi
        ? "Giải đấu pickleball chuyên nghiệp PPA, APP, MLP và cộng đồng — bracket miễn phí cho ban tổ chức và người chơi."
        : "Professional and community pickleball tournaments — PPA, APP, MLP, and free brackets for organizers."}
      active="tournaments"
    >
      <PullToRefreshIndicator state={ptrState} />
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/">Home</Link>
          <span className="sep">/</span>
          <span className="current">{vi ? "Giải đấu" : "Tournaments"}</span>
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
          <Link to="#" className="tl-hub-card" onClick={(e) => { e.preventDefault(); setUserTab("watch"); }}>
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

          <Link to="/tools" className="tl-hub-card accent">
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
            onClick={() => setUserTab("watch")}
          >
            {vi ? "Xem Pro" : "Watch"}<span className="count">{tournaments.length}</span>
          </button>
          <button
            type="button"
            className={`tl-tab ${tab === "community" ? "active" : ""}`}
            onClick={() => setUserTab("community")}
          >
            {vi ? "Cộng đồng" : "Community"}<span className="count">{communityCount}</span>
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
                <h3>{vi ? "Chưa có giải pro nào." : "No pro tournaments yet."}</h3>
                <p>{vi
                  ? "Chưa có lịch phát sóng nào trong thời gian này. Quay lại sau nhé."
                  : "Creators haven't scheduled any broadcasts in this window. Check back soon."}</p>
              </div>
            ) : (
              <div className="tl-list">
                {sortedPro.map((t) => {
                  const date = formatDate(t.start_date);
                  const endDate = formatDate(t.end_date);
                  const hasLive = liveStreams.some((s) => s.tournament_id === t.id);
                  return (
                    <Link key={t.id} to={`/tournament/${t.slug}`} className="tl-list-item">
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
                          {hasLive ? (vi ? "● Đang live" : "● Live now") :
                           t.status === "ongoing" ? (vi ? "● Đang diễn ra" : "● Ongoing") :
                           t.status === "upcoming" ? (vi ? "Đăng ký" : "Register") :
                           (vi ? "Xem kết quả" : "View results")}
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
                      <h3>{vi ? "Giải của bạn" : "Your brackets"}</h3>
                      <p className="desc">{vi
                        ? "Các giải bạn đã đăng ký hoặc đã hoàn thành."
                        : "Tournaments you've registered for or completed."}</p>
                    </div>
                    <div className="right">
                      <span className="count-pill">{userBrackets.length}</span>
                    </div>
                  </div>
                  <div className="tl-list" style={{ ["--fc-accent" as string]: "#00b96b" } as React.CSSProperties}>
                    {userBrackets.slice(0, 8).map((b) => {
                      const status = STATUS_LABEL[b.status] ?? { cls: "active" as const, en: b.status, vi: b.status };
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
                              <span>{b.is_doubles ? (vi ? "Đôi" : "Doubles") : (vi ? "Đơn" : "Singles")}</span>
                              <span className="sep">·</span>
                              <span>{b.player_count} {vi ? "người chơi" : "players"}</span>
                            </div>
                          </div>
                          <div className="tl-br-creator">
                            {b.creator_display_name ?? "—"}
                          </div>
                          <span className={`tl-br-status ${status.cls}`}>{vi ? status.vi : status.en}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Format tabs */}
              <div className="tl-subtabs" role="tablist" aria-label={vi ? "Thể thức" : "Format"}>
                {FORMATS.map((f) => (
                  <button
                    key={f.fmt}
                    type="button"
                    role="tab"
                    aria-selected={fmtTab === f.fmt}
                    className={`tl-subtab ${fmtTab === f.fmt ? "active" : ""}`}
                    style={{ ["--fc-accent" as string]: f.accent } as React.CSSProperties}
                    onClick={() => setFmtTab(f.fmt)}
                  >
                    {f.title}
                    <span className="count">{formatData[f.fmt].ongoing.length}</span>
                  </button>
                ))}
              </div>

              {/* Status tabs within the selected format */}
              <div className="tl-subtabs status" role="tablist" aria-label={vi ? "Trạng thái" : "Status"}>
                {(["ongoing", "ended"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={fmtStatus === s}
                    className={`tl-subtab ${fmtStatus === s ? "active" : ""}`}
                    style={{ ["--fc-accent" as string]: currentFormat.accent } as React.CSSProperties}
                    onClick={() => setFmtStatus(s)}
                  >
                    {s === "ongoing" ? (vi ? "Đang diễn ra" : "Ongoing") : (vi ? "Đã kết thúc" : "Ended")}
                    <span className="count">{formatData[fmtTab][s].length}</span>
                  </button>
                ))}
              </div>

              {/* Selected format panel */}
              <section className="tl-format-section">
                <div className="tl-format-section-head">
                  <div>
                    <h3>{currentFormat.title}</h3>
                    <p className="desc">{vi ? currentFormat.desc.vi : currentFormat.desc.en}</p>
                  </div>
                  <div className="right">
                    <span className="count-pill">
                      {formatData[fmtTab].ongoing.length} {vi ? "đang diễn ra" : "active"}
                    </span>
                    <Link to={currentFormat.createLink} className="create">{vi ? "Tạo giải →" : "Create →"}</Link>
                  </div>
                </div>

                {currentList.length === 0 ? (
                  <div className="tl-empty">
                    <h3>{fmtStatus === "ongoing"
                      ? (vi ? "Chưa có giải nào đang diễn ra." : "No tournaments running right now.")
                      : (vi ? "Chưa có giải nào đã kết thúc." : "No finished tournaments yet.")}</h3>
                    <p>{vi ? "Tạo giải mới chỉ trong một phút." : "Spin up a bracket in under a minute."}</p>
                    <Link to={currentFormat.createLink} className="tl-btn green">
                      {vi ? "Tạo giải →" : "Create one →"}
                    </Link>
                  </div>
                ) : (
                  <div className="tl-list">
                    {currentList.map((t) => {
                      const status = STATUS_LABEL[t.status] ?? { cls: "active" as const, en: t.status, vi: t.status };
                      return (
                        <Link
                          key={t.id}
                          to={`${currentFormat.linkBase}/${t.share_id}`}
                          className="tl-bracket-row"
                          style={{ ["--fc-accent" as string]: currentFormat.accent } as React.CSSProperties}
                        >
                          <div className="tl-br-fmt" />
                          <div className="tl-br-body">
                            <h4 className="tl-br-name">{t.name}</h4>
                            <div className="tl-br-meta">
                              <span>{currentFormat.renderMeta(t, vi)}</span>
                              <span className="sep">·</span>
                              <span>{formatRelative(t.created_at)}</span>
                            </div>
                          </div>
                          <div className="tl-br-creator">
                            {t.creator_display_name ?? "—"}
                          </div>
                          <span className={`tl-br-status ${status.cls}`}>{vi ? status.vi : status.en}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </TheLineLayout>
  );
};

export default Tournaments;
