import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { trackEvent } from "@/utils/ga";
import { REG_BADGE_MIN, regBadgeCount } from "@/lib/regBadge";
import { displayChampionName } from "@/lib/championDisplay";
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
import { formatDate, formatRelative } from "@/lib/format-datetime";
import { useQueryClient } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import ParentTournamentCard from "@/components/quicktable/ParentTournamentCard";
import { useFeaturedParentTournaments } from "@/hooks/useFeaturedParentTournaments";
import { Layers3, Sparkles, Trophy } from "lucide-react";

type Tab = "featured" | "watch" | "community";
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
  requires_registration?: boolean;
  /** Live approved-registration count (open-reg QuickTable + registration-open
   *  Team Match only). Undefined = no data / count query degraded. */
  registered_count?: number;
  /** Denormalized playoff-final winner (QuickTable only for now). */
  champion_name?: string | null;
}

interface FormatDef {
  fmt: Fmt;
  title: string;
  /** VI suffix appended to `title`. The format names are product nouns we keep
   *  in English, but a Vietnamese player reading "Doubles Elimination" cold has
   *  no idea whether it is the bracket their friend invited them to. */
  titleVi: string;
  desc: { en: string; vi: string };
  accent: string;
  linkBase: string;
  createLink: string;
  renderMeta: (t: CommunityBracket, vi: boolean) => React.ReactNode;
}

/** Social-proof token — REPLACES the quota token when a row is registration-open
 *  and has ≥ REG_BADGE_MIN approved. Never shown alongside quota (avoids the
 *  "which number is which" trap). */
const regBadge = (n: number, doubles: boolean, vi: boolean) => (
  <span className="tl-br-reg">
    {doubles
      ? (vi ? `${n} đội đã đăng ký` : `${n} teams registered`)
      : (vi ? `${n} người đã đăng ký` : `${n} players registered`)}
  </span>
);

const FORMATS: FormatDef[] = [
  {
    fmt: "quick-tables",
    title: "Quick Tables",
    titleVi: "Chia bảng",
    desc: {
      en: "Round robin groups with auto playoffs. 4 to 32 players. Most popular format.",
      vi: "Vòng tròn chia bảng, tự động playoff. 4–32 người chơi. Thể thức phổ biến nhất.",
    },
    accent: "var(--tl-accent-qt)",
    linkBase: "/tools/quick-tables",
    createLink: "/tools/quick-tables",
    renderMeta: (t, vi) => {
      const unit = t.is_doubles ? (vi ? "Đôi" : "Doubles") : (vi ? "Đơn" : "Singles");
      const fmt = t.format === "round_robin"
        ? (vi ? "Vòng tròn" : "Round robin")
        : t.format === "large_playoff"
          ? "Playoff"
          : (t.format ?? "Round robin");
      const n = regBadgeCount(t, "quick-tables");
      if (n !== null) {
        return <>{unit} · {regBadge(n, !!t.is_doubles, vi)} · {fmt}</>;
      }
      return `${unit} · ${t.player_count} ${vi ? "người chơi" : "players"} · ${fmt}`;
    },
  },
  {
    fmt: "doubles-elim",
    title: "Doubles Elimination",
    titleVi: "Loại kép",
    desc: {
      en: "Double elimination bracket — lose once, fall to losers bracket, fight back to the final.",
      vi: "Nhánh thắng nhánh thua — thua một trận rơi xuống nhánh thua, vẫn còn cơ hội vào chung kết.",
    },
    accent: "var(--tl-accent-elim)",
    linkBase: "/tools/doubles-elimination",
    createLink: "/tools/doubles-elimination/new",
    renderMeta: (t, vi) => `${t.team_count} ${vi ? "đội" : "teams"} · Double elim`,
  },
  {
    fmt: "flex",
    title: "Flex Format",
    titleVi: "Tùy chỉnh",
    desc: {
      en: "Custom bracket — define rounds, pools, seeding rules. For non-standard events.",
      vi: "Bracket tùy biến — tự định nghĩa vòng đấu, bảng, luật xếp hạt giống. Cho các giải không theo chuẩn.",
    },
    accent: "var(--tl-accent-flex)",
    linkBase: "/tools/flex-tournament",
    createLink: "/tools/flex-tournament/new",
    renderMeta: (_t, vi) => (vi ? "Flex · Thể thức tùy biến" : "Flex · Custom format"),
  },
  {
    fmt: "team-match",
    title: "Team Match",
    titleVi: "Đồng đội",
    desc: {
      en: "MLP-style team competitions — Dreambreaker tiebreaker included.",
      vi: "Thi đấu đồng đội kiểu MLP — có Dreambreaker phân định thắng thua.",
    },
    accent: "var(--tl-accent-team)",
    linkBase: "/tools/team-match",
    createLink: "/tools/team-match/new",
    renderMeta: (t, vi) => {
      const roster = `${t.team_roster_size}/${vi ? "đội" : "team"}`;
      const n = regBadgeCount(t, "team-match");
      if (n !== null) {
        return <>{regBadge(n, true, vi)} · {roster}</>;
      }
      return `${t.team_count} ${vi ? "đội" : "teams"} · ${roster}`;
    },
  },
];

const Tournaments = () => {
  const { user } = useAuth();
  const { language } = useI18n();
  const vi = language === "vi";
  // Tabs are URL-controlled (?tab= / ?fmt=) so they deep-link and survive
  // refresh — same pattern as /feed. replace:true keeps back-button sane.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const userTab: Tab | null =
    tabParam === "featured" || tabParam === "watch" || tabParam === "community"
      ? tabParam
      : null;
  const fmtParam = searchParams.get("fmt");
  const fmtTab: Fmt = FORMATS.some((f) => f.fmt === fmtParam)
    ? (fmtParam as Fmt)
    : "quick-tables";
  const setUserTab = (t: Tab) =>
    setSearchParams((prev) => { prev.set("tab", t); return prev; }, { replace: true });
  const setFmtTab = (f: Fmt) =>
    setSearchParams((prev) => { prev.set("fmt", f); return prev; }, { replace: true });
  // UX-08 — ongoing/ended sub-tab joins the same URL-controlled pattern.
  const statusParam = searchParams.get("status");
  const fmtStatus: FmtStatus = statusParam === "ended" ? "ended" : "ongoing";
  const setFmtStatus = (s: FmtStatus) =>
    setSearchParams((prev) => { prev.set("status", s); return prev; }, { replace: true });

  // Pro (Watch) data
  const { data: tournaments = [], isLoading: tournamentsLoading } = useTournaments();
  const { data: liveStreams = [] } = useLivestreams("live");
  const {
    data: featuredParents = [],
    isLoading: featuredLoading,
    isError: featuredError,
  } = useFeaturedParentTournaments();

  // Featured multi-event tournaments lead the public discovery page. The
  // previous Community default remains one click away and direct links keep
  // their URL-controlled tab selection.
  const tab: Tab = userTab ?? "featured";

  // Community data — all 4 formats, active + completed
  // "Ended" has its own tab now — limit 100 so the list is actually complete (86 QT completed as of 2026-07)
  const { data: openRegTables = [] } = useOpenRegistrationTables({ limit: 20 });
  const { data: activeQuickTables = [], isLoading: activeQuickTablesLoading } = useActivePublicQuickTables({ limit: 20 });
  const { data: completedQuickTables = [] } = useCompletedPublicQuickTables({ limit: 100 });

  const { data: openTeamMatches = [], isLoading: teamMatchesLoading } = useOpenTeamMatchTournaments({ limit: 20 });
  const { data: completedTeamMatches = [] } = useCompletedTeamMatchTournaments({ limit: 100 });

  const { data: activeDoublesElim = [], isLoading: doublesElimLoading } = useActiveDoublesElimination({ limit: 20 });
  const { data: completedDoublesElim = [] } = useCompletedDoublesElimination({ limit: 100 });

  const { data: activeFlex = [], isLoading: flexLoading } = useActiveFlexTournaments({ limit: 20 });
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
  const featuredEventCount = featuredParents.reduce(
    (total, parent) => total + parent.subEventCount,
    0,
  );
  // These are standalone community tournaments that have actually started.
  // Keep them separate from featuredParents: they are not multi-event parents
  // and must never be presented as part of the curated multi-event collection.
  const liveCommunityTournaments = FORMATS.flatMap((format) => {
    const liveStatuses = format.fmt === "quick-tables"
      ? new Set(["group_stage", "playoff"])
      : format.fmt === "team-match"
        ? new Set(["ongoing"])
        : new Set(["active", "ongoing"]);
    return formatData[format.fmt].ongoing
      .filter((t) => liveStatuses.has(t.status))
      .map((t) => ({ tournament: t, format }));
  }).sort(
    (a, b) => Date.parse(b.tournament.created_at) - Date.parse(a.tournament.created_at),
  );
  const liveCommunityLoading =
    activeQuickTablesLoading || teamMatchesLoading || doublesElimLoading || flexLoading;

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

  // D3 telemetry — is the social-proof badge actually earning its keep, or is it
  // invisible because QuickTable registrations sit unapproved/sparse? Emit one
  // impression per format view: how many eligible rows COULD show a badge
  // (count≥1) vs actually DO (count≥threshold). Keyed on the stable query arrays
  // (not currentList, which is a fresh array each render) so it fires per
  // view/data-change, not per render.
  useEffect(() => {
    if (tab !== "community" || fmtStatus !== "ongoing") return;
    let eligible: { registered_count?: number }[];
    if (fmtTab === "quick-tables") eligible = openRegTables;
    else if (fmtTab === "team-match") eligible = openTeamMatches.filter((t) => t.status === "registration");
    else return;
    if (eligible.length === 0) return;
    trackEvent("reg_count_badge_impression", {
      fmt: fmtTab,
      eligible: eligible.length,
      with_data: eligible.filter((t) => (t.registered_count ?? 0) >= 1).length,
      shown: eligible.filter((t) => (t.registered_count ?? 0) >= REG_BADGE_MIN).length,
      threshold: REG_BADGE_MIN,
    });
  }, [tab, fmtTab, fmtStatus, openRegTables, openTeamMatches]);

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
          <Link to="/">{vi ? "Trang chủ" : "Home"}</Link>
          <span className="sep">/</span>
          <span className="current">{vi ? "Giải đấu" : "Tournaments"}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">◆ {vi ? "Xem hoặc thi đấu — tùy bạn" : "Watch or play — your call"}</div>
          <h1>
            {vi ? (
              <>
                Giải đấu <em className="tl-serif">đáng</em> <br />
                <span className="dim">xem,</span> <span className="sans">hoặc tự tổ chức.</span>
              </>
            ) : (
              <>
                Tournaments <em className="tl-serif">worth</em> <br />
                <span className="dim">watching,</span> <span className="sans">or running.</span>
              </>
            )}
          </h1>
          <p>
            {vi
              ? "Sóng trực tiếp từ PPA, APP, MLP và các tour khu vực — cùng bracket cộng đồng ai cũng có thể tạo trong chưa đầy một phút."
              : "Professional broadcasts from PPA, APP, MLP and regional tours — and community brackets you or anyone can spin up in under a minute."}
          </p>
        </header>

        {/* 2 hero cards — Watch / Play */}
        <div className="tl-hub-cards">
          {/* a11y: in-page tab switch is a <button>, not a <Link to="#"> */}
          <button
            type="button"
            className="tl-hub-card"
            style={{ font: "inherit", textAlign: "left", border: 0, cursor: "pointer" }}
            onClick={() => setUserTab("watch")}
          >
            <div className="tl-hub-kicker">
              <span className="dot" />
              <span>{vi ? "Xem giải pro" : "Watch the pros"}</span>
            </div>
            <h2 className="tl-hub-title">
              {vi ? (
                <>Mọi tour đấu, <span className="sans">một nguồn xem.</span></>
              ) : (
                <>Every tour, <span className="sans">one feed.</span></>
              )}
            </h2>
            <p className="tl-hub-desc">
              {vi
                ? "Trực tiếp, bracket và replay từ các tour pickleball hàng đầu thế giới. Một nơi duy nhất, 4K trên sân chính."
                : "Live broadcasts, brackets and replays from the world's pickleball tours. One subscription, 4K on flagship courts."}
            </p>
            <div className="tl-hub-stats">
              <div>
                <span className="n">{tournaments.length}</span>
                {vi ? "giải đấu" : "tournaments"}
              </div>
              <div>
                <span className="n">{liveProCount}</span>
                {vi ? "đang live" : "live now"}
              </div>
              <div>
                <span className="n">{liveStreams.length}</span>
                {vi ? "buổi phát" : "broadcasts"}
              </div>
            </div>
            <span className="tl-hub-arrow">{vi ? "Xem các tour pro →" : "Browse pro tours →"}</span>
          </button>

          <Link to="/tools" className="tl-hub-card accent">
            <div className="tl-hub-kicker">
              <span className="dot" />
              <span>{vi ? "Tự tổ chức" : "Run your own"}</span>
            </div>
            <h2 className="tl-hub-title">
              {vi ? (
                <>60 giây <span className="sans">có ngay bracket.</span></>
              ) : (
                <>60 seconds <span className="sans">to a bracket.</span></>
              )}
            </h2>
            <p className="tl-hub-desc">
              {vi
                ? "Quick Tables, Doubles Elim, Flex, Team Match. Miễn phí. Người xem không cần tài khoản. Bảng điểm, link chia sẻ, bracket in được."
                : "Quick Tables, Doubles Elim, Flex, Team Match. Free. No signup for viewers. Scoreboard, shareable link, printable bracket."}
            </p>
            <div className="tl-hub-stats">
              <div>
                <span className="n">{communityCount}</span>
                {vi ? "đang diễn ra" : "active now"}
              </div>
              <div>
                <span className="n">4</span>
                {vi ? "thể thức" : "formats"}
              </div>
              <div>
                <span className="n">60s</span>
                {vi ? "tạo giải" : "setup"}
              </div>
            </div>
            <span className="tl-hub-arrow">{vi ? "Mở Bracket Lab →" : "Open Bracket Lab →"}</span>
          </Link>
        </div>

        {/* Tabs */}
        <div className="tl-tabs">
          <button
            type="button"
            aria-pressed={tab === "featured"}
            className={`tl-tab featured ${tab === "featured" ? "active" : ""}`}
            onClick={() => setUserTab("featured")}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {vi ? "Giải nổi bật" : "Featured Tournaments"}
            <span className="count">{featuredParents.length + liveCommunityTournaments.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={tab === "watch"}
            className={`tl-tab ${tab === "watch" ? "active" : ""}`}
            onClick={() => setUserTab("watch")}
          >
            {vi ? "Xem Pro" : "Watch"}<span className="count">{tournaments.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={tab === "community"}
            className={`tl-tab ${tab === "community" ? "active" : ""}`}
            onClick={() => setUserTab("community")}
          >
            {vi ? "Cộng đồng" : "Community"}<span className="count">{communityCount}</span>
          </button>
        </div>

        {/* Tab panels */}
        <div style={{ paddingBottom: 80 }}>
          {tab === "featured" ? (
            <section
              className="space-y-6 pt-2"
              aria-labelledby="featured-tournaments-heading"
            >
              <div
                className="relative isolate overflow-hidden rounded-[var(--tl-radius-lg)] border px-5 py-7 sm:px-8 sm:py-9"
                style={{
                  borderColor: "rgba(233, 182, 73, 0.38)",
                  background:
                    "radial-gradient(circle at 85% 15%, rgba(233, 182, 73, 0.18), transparent 34%), linear-gradient(135deg, var(--tl-bg-elev), var(--tl-bg))",
                  boxShadow: "0 24px 70px rgba(0, 0, 0, 0.16)",
                }}
              >
                <div
                  className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border"
                  style={{ borderColor: "rgba(233, 182, 73, 0.22)" }}
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute right-5 top-5 h-24 w-24 rounded-full border"
                  style={{ borderColor: "rgba(233, 182, 73, 0.14)" }}
                  aria-hidden="true"
                />

                <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div className="max-w-3xl">
                    <div
                      className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{
                        borderColor: "rgba(233, 182, 73, 0.35)",
                        background: "rgba(233, 182, 73, 0.1)",
                        color: "var(--tl-gold)",
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      {vi ? "Tuyển chọn bởi ThePickleHub" : "Curated by ThePickleHub"}
                    </div>
                    <h2
                      id="featured-tournaments-heading"
                      className="max-w-2xl text-3xl leading-[1.05] sm:text-5xl"
                      style={{ color: "var(--tl-fg)", letterSpacing: "-0.035em" }}
                    >
                      {vi ? (
                        <>
                          Một giải tổng.{" "}
                          <em className="tl-serif" style={{ color: "var(--tl-gold)" }}>
                            Mọi nội dung.
                          </em>
                        </>
                      ) : (
                        <>
                          One tournament.{" "}
                          <em className="tl-serif" style={{ color: "var(--tl-gold)" }}>
                            Every event.
                          </em>
                        </>
                      )}
                    </h2>
                    <p
                      className="mt-4 max-w-2xl text-sm leading-6 sm:text-base"
                      style={{ color: "var(--tl-fg-2)" }}
                    >
                      {vi
                        ? "Theo dõi trọn bộ nội dung thi đấu, lịch đấu và kết quả từ những giải pickleball nhiều hạng mục được ban biên tập lựa chọn."
                        : "Follow every division, schedule, and result from selected multi-event pickleball tournaments in one place."}
                    </p>

                    <div className="mt-6 flex flex-wrap gap-5">
                      <div className="flex items-center gap-2">
                        <Trophy
                          className="h-4 w-4"
                          style={{ color: "var(--tl-gold)" }}
                          aria-hidden="true"
                        />
                        <span className="font-mono text-xs" style={{ color: "var(--tl-fg-2)" }}>
                          <strong style={{ color: "var(--tl-fg)" }}>{featuredParents.length}</strong>{" "}
                          {vi ? "giải tổng" : "tournaments"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Layers3
                          className="h-4 w-4"
                          style={{ color: "var(--tl-gold)" }}
                          aria-hidden="true"
                        />
                        <span className="font-mono text-xs" style={{ color: "var(--tl-fg-2)" }}>
                          <strong style={{ color: "var(--tl-fg)" }}>{featuredEventCount}</strong>{" "}
                          {vi ? "nội dung thi đấu" : "competition events"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Link
                    to="/tools/quick-tables"
                    className="tl-btn self-start lg:self-end"
                    style={{
                      borderColor: "rgba(233, 182, 73, 0.4)",
                      color: "var(--tl-gold)",
                    }}
                  >
                    {vi ? "Tạo giải tổng" : "Create multi-event tournament"} →
                  </Link>
                </div>
              </div>

              {featuredLoading ? (
                <div
                  className="grid gap-4 md:grid-cols-2"
                  aria-busy="true"
                  aria-label={vi ? "Đang tải giải nổi bật" : "Loading featured tournaments"}
                >
                  {[0, 1].map(item => (
                    <div
                      key={item}
                      className="h-[310px] animate-pulse rounded-[var(--tl-radius-lg)] border"
                      style={{
                        borderColor: "var(--tl-border)",
                        background: "var(--tl-surface)",
                      }}
                    />
                  ))}
                </div>
              ) : featuredError ? (
                <div className="tl-empty" role="status">
                  <h3>{vi ? "Không thể tải giải nổi bật." : "Featured tournaments are unavailable."}</h3>
                  <p>{vi ? "Kéo xuống để tải lại hoặc quay lại sau." : "Pull to refresh or check back shortly."}</p>
                </div>
              ) : featuredParents.length === 0 ? (
                null
              ) : (
                <div className={`grid gap-5 ${featuredParents.length > 1 ? "md:grid-cols-2" : ""}`}>
                  {featuredParents.map(parent => (
                    <ParentTournamentCard
                      key={parent.id}
                      parent={parent}
                      isOwner={parent.creator_user_id === user?.id}
                      variant="featured"
                    />
                  ))}
                </div>
              )}

              <section className="tl-format-section" aria-labelledby="live-community-heading">
                <div className="tl-format-section-head">
                  <div>
                    <h3 id="live-community-heading">{vi ? "Đang diễn ra" : "Live now"}</h3>
                    <p className="desc">
                      {vi
                        ? "Các giải cộng đồng đang thi đấu, cập nhật điểm và kết quả trực tiếp."
                        : "Community tournaments currently in play, with live scores and results."}
                    </p>
                  </div>
                  <div className="right">
                    <span className="count-pill">
                      {liveCommunityTournaments.length} {vi ? "đang live" : "live"}
                    </span>
                  </div>
                </div>

                {liveCommunityLoading ? (
                  <div className="tl-list" aria-busy="true" aria-label={vi ? "Đang tải giải đang diễn ra" : "Loading live tournaments"}>
                    {[0, 1].map((item) => (
                      <div
                        key={item}
                        className="h-[74px] animate-pulse border-b last:border-b-0"
                        style={{ borderColor: "var(--tl-border)", background: "var(--tl-surface)" }}
                      />
                    ))}
                  </div>
                ) : liveCommunityTournaments.length === 0 ? (
                  <div className="tl-empty">
                    <h3>{vi ? "Chưa có giải nào đang thi đấu." : "No tournaments are live right now."}</h3>
                    <p>{vi ? "Các giải sẽ xuất hiện ở đây ngay khi bắt đầu." : "Tournaments will appear here as soon as play begins."}</p>
                  </div>
                ) : (
                  <div className="tl-list">
                    {liveCommunityTournaments.map(({ tournament, format }) => (
                      <Link
                        key={`${format.fmt}:${tournament.id}`}
                        to={`${format.linkBase}/${tournament.share_id}`}
                        className="tl-bracket-row"
                        style={{ ["--fc-accent" as string]: format.accent } as React.CSSProperties}
                      >
                        <div className="tl-br-fmt" />
                        <div className="tl-br-body">
                          <h4 className="tl-br-name">{tournament.name}</h4>
                          <div className="tl-br-meta">
                            <span>{vi ? `${format.title} · ${format.titleVi}` : format.title}</span>
                            <span className="sep">·</span>
                            <span>{format.renderMeta(tournament, vi)}</span>
                            <span className="sep">·</span>
                            <span>{formatRelative(tournament.created_at)}</span>
                          </div>
                        </div>
                        <div className="tl-br-creator">{tournament.creator_display_name ?? "—"}</div>
                        <span className="tl-br-status active">{vi ? "Đang diễn ra" : "Live"}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </section>
          ) : tab === "watch" ? (
            tournamentsLoading ? (
              // Skeleton rows matching .tl-list-item geometry
              <div className="tl-list" aria-busy="true" aria-label={vi ? "Đang tải giải đấu" : "Loading tournaments"}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse"
                    style={{
                      height: 72,
                      borderRadius: "var(--tl-radius)",
                      background: "var(--tl-surface)",
                      marginBottom: 12,
                    }}
                  />
                ))}
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
                          <span>
                            {t.status === "ongoing" ? (vi ? "Đang diễn ra" : "Ongoing") :
                             t.status === "upcoming" ? (vi ? "Sắp diễn ra" : "Upcoming") :
                             t.status === "ended" ? (vi ? "Đã kết thúc" : "Ended") :
                             t.status}
                          </span>
                          {t.end_date && (
                            <>
                              <span className="sep">·</span>
                              <span>{vi ? "Kết thúc" : "Ends"} {endDate.d} {endDate.m}</span>
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
                          {(hasLive || t.status === "ongoing") && (
                            <span
                              aria-hidden="true"
                              style={{
                                display: "inline-block",
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: "currentColor",
                                marginRight: 6,
                                verticalAlign: "middle",
                              }}
                            />
                          )}
                          {hasLive ? (vi ? "Đang live" : "Live now") :
                           t.status === "ongoing" ? (vi ? "Đang diễn ra" : "Ongoing") :
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
                      <h3>{vi ? "Quick Table của bạn" : "Your Quick Tables"}</h3>
                      {/* Copy pinned to what the query actually returns:
                          useUserRegisteredTournaments/useUserCompletedTournaments
                          read quick_table_* only. Promising "your tournaments"
                          while showing 1 of 4 formats reads as data loss to the
                          3 other formats' players. Widening the query is P2. */}
                      <p className="desc">{vi
                        ? "Các giải Quick Table bạn đã đăng ký hoặc đã hoàn thành."
                        : "Quick Table brackets you've registered for or completed."}</p>
                    </div>
                    <div className="right">
                      <span className="count-pill">{userBrackets.length}</span>
                    </div>
                  </div>
                  <div className="tl-list" style={{ ["--fc-accent" as string]: "var(--tl-accent-qt)" } as React.CSSProperties}>
                    {userBrackets.slice(0, 8).map((b) => {
                      const status = STATUS_LABEL[b.status] ?? { cls: "active" as const, en: b.status, vi: b.status };
                      return (
                        <Link
                          key={b.id}
                          to={`/tools/quick-tables/${b.share_id}`}
                          className="tl-bracket-row"
                          style={{ ["--fc-accent" as string]: "var(--tl-accent-qt)" } as React.CSSProperties}
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

              {/* Format tabs — plain buttons with aria-pressed (no tablist:
                  the ARIA tab pattern requires roving-tabindex keyboard
                  support we don't implement) */}
              <div className="tl-subtabs" aria-label={vi ? "Thể thức" : "Format"}>
                {FORMATS.map((f) => (
                  <button
                    key={f.fmt}
                    type="button"
                    aria-pressed={fmtTab === f.fmt}
                    className={`tl-subtab ${fmtTab === f.fmt ? "active" : ""}`}
                    style={{ ["--fc-accent" as string]: f.accent } as React.CSSProperties}
                    onClick={() => setFmtTab(f.fmt)}
                  >
                    {vi ? `${f.title} · ${f.titleVi}` : f.title}
                    <span className="count">{formatData[f.fmt].ongoing.length}</span>
                  </button>
                ))}
              </div>

              {/* Status tabs within the selected format */}
              <div className="tl-subtabs status" aria-label={vi ? "Trạng thái" : "Status"}>
                {(["ongoing", "ended"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={fmtStatus === s}
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
                    <h3>{vi ? `${currentFormat.title} · ${currentFormat.titleVi}` : currentFormat.title}</h3>
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
                      // QuickTable "open registration" lives under status='setup'
                      // (the enum has no 'registration' value), so it renders the
                      // gold "Chuẩn bị" pill that reads as "not open yet". Override
                      // to the blue "Đang mở đăng ký" pill so the CTA surface stops
                      // signalling "not ready" — especially below the badge threshold.
                      const statusKey =
                        currentFormat.fmt === "quick-tables" && t.requires_registration && t.status === "setup"
                          ? "registration"
                          : t.status;
                      const status = STATUS_LABEL[statusKey] ?? { cls: "active" as const, en: t.status, vi: t.status };
                      // Champion là KẾT QUẢ, không phải metadata: element riêng
                      // (không nhét vào chuỗi ·), và thay thế pill trạng thái —
                      // "Đã kết thúc" + tên vô địch là thừa một cái.
                      const champion = displayChampionName(t.champion_name);
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
                            {champion && (
                              <div className="tl-br-result">
                                <span className="tl-br-result-label">{vi ? "Vô địch:" : "Champion:"}</span>
                                <span className="tl-br-result-name">{champion}</span>
                              </div>
                            )}
                            <div className="tl-br-meta">
                              <span>{currentFormat.renderMeta(t, vi)}</span>
                              <span className="sep">·</span>
                              <span>{formatRelative(t.created_at)}</span>
                            </div>
                          </div>
                          <div className="tl-br-creator">
                            {t.creator_display_name ?? "—"}
                          </div>
                          {!champion && fmtStatus !== "ended" && (
                            <span className={`tl-br-status ${status.cls}`}>{vi ? status.vi : status.en}</span>
                          )}
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
