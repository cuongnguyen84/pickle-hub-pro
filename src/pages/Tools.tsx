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
  const isVi = language === "vi";
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
        fmtLabel: isVi ? "Bảng đấu nhanh" : "Quick Table",
        meta: `${t.is_doubles ? (isVi ? "Đôi" : "Doubles") : (isVi ? "Đơn" : "Singles")} · ${t.player_count} ${isVi ? "người" : "players"}`,
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
        fmtLabel: isVi ? "Loại trực tiếp Đôi" : "Doubles Elim",
        meta: `${t.team_count} ${isVi ? "đội" : "teams"}`,
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
        fmtLabel: isVi ? "Linh hoạt" : "Flex",
        meta: isVi ? "Định dạng tùy chỉnh" : "Custom format",
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
        fmtLabel: isVi ? "Đấu đồng đội" : "Team Match",
        meta: `${t.team_count} ${isVi ? "đội" : "teams"} · ${t.team_roster_size}/${isVi ? "đội" : "team"}`,
        creator: t.creator_display_name,
        href: `/tools/team-match/${t.share_id}`,
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
  }, [activeQuickTables, openRegTables, activeDoublesElim, activeFlex, openTeamMatches, isVi]);

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
      title={isVi ? "Bracket Lab" : "Bracket Lab"}
      description={isVi
        ? "Công cụ tổ chức giải đấu pickleball miễn phí — round robin, loại trực tiếp đơn/đôi, đấu đồng đội MLP, định dạng linh hoạt. Không cần đăng ký."
        : "Free pickleball tournament tools — round robin, single/double elimination, MLP team match, Flex format. No signup. Shareable scoreboard."}
      active="lab"
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/">{isVi ? "Trang chủ" : "Home"}</Link>
          <span className="sep">/</span>
          <span className="current">Bracket Lab</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            {isVi
              ? "◆ Tính năng đỉnh · Miễn phí · Không cần đăng ký"
              : "◆ The killer feature · Free · No signup"}
          </div>
          <h1>
            {isVi ? (
              <>
                60 giây <span className="dim">để có</span> <br />
                <em className="tl-serif">bảng đấu</em> <span className="sans">pickleball.</span>
              </>
            ) : (
              <>
                60 seconds <span className="dim">to a</span> <br />
                <em className="tl-serif">pickleball</em> <span className="sans">bracket.</span>
              </>
            )}
          </h1>
          <p>
            {isVi
              ? "Trình tạo bảng đấu pickleball miễn phí — round robin, loại trực tiếp đơn và đôi, đấu đồng đội MLP, và định dạng linh hoạt. Chấm điểm trực tiếp trên điện thoại, link bảng điểm chia sẻ được, bracket in được. Không cần app, không đăng ký, không phụ phí."
              : "A free pickleball tournament bracket generator — round robin, single and double elimination, MLP team match, and flex format. Live scoring on your phone, shareable scoreboard URL, printable bracket. No apps, no signup, no catch."}
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
            <Link to="/tools/quick-tables" className="tl-btn green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {isVi ? "Tạo Bảng đấu nhanh →" : "Start a Quick Table →"}
            </Link>
            <Link to="/tools/doubles-elimination/new" className="tl-btn">
              {isVi ? "Hoặc Loại trực tiếp Đôi" : "Or Double Elimination"}
            </Link>
          </div>
        </header>

        {/* Social proof stats */}
        <section className="tl-stats-row" style={{ marginTop: 40 }}>
          <div className="tl-stat-box">
            <div className="lbl">{isVi ? "Đang diễn ra" : "Active right now"}</div>
            <div className="val"><span className="green">{activeCount}</span></div>
            <div className="sub">{isVi ? "Bảng đấu đang chạy" : "Brackets in progress"}</div>
          </div>
          <div className="tl-stat-box">
            <div className="lbl">{isVi ? "Tạo trong tuần" : "Created this week"}</div>
            <div className="val">{createdThisWeek}</div>
            <div className="sub">{isVi ? "7 ngày gần nhất" : "Last 7 days"}</div>
          </div>
          <div className="tl-stat-box">
            <div className="lbl">{isVi ? "Định dạng" : "Formats"}</div>
            <div className="val">4</div>
            <div className="sub">{isVi ? "Round robin · Loại · Linh hoạt · Đồng đội" : "Round robin · Elim · Flex · Team"}</div>
          </div>
          <div className="tl-stat-box">
            <div className="lbl">{isVi ? "Thời gian thiết lập" : "Setup time"}</div>
            <div className="val">~60s</div>
            <div className="sub">{isVi ? "Từ click đến trận đầu" : "From click to first match"}</div>
          </div>
        </section>

        {/* Format cards */}
        <section style={{ marginBottom: 48 }}>
          <div className="tl-sec-head">
            <h2>
              {isVi ? (
                <>
                  Chọn <em className="tl-serif">định dạng.</em>{" "}
                  <span className="sans">Bốn cách tạo bảng đấu.</span>
                </>
              ) : (
                <>
                  Pick a <em className="tl-serif">format.</em>{" "}
                  <span className="sans">Four ways to bracket.</span>
                </>
              )}
            </h2>
            <p>
              {isVi
                ? "Mọi định dạng đều miễn phí, chạy trực tiếp trên trình duyệt. Thiết lập, chia sẻ link, bắt đầu chấm điểm."
                : "Every format is free and runs in the browser. Start setup, share link, start scoring."}
            </p>
          </div>

          <div className="tl-format-grid">
            <Link to="/tools/quick-tables" className="tl-format-card" data-fmt="quick-tables">
              <div className="tl-format-head">
                <div className="tl-format-kicker">
                  {isVi ? "◆ Round robin · 4-32 người" : "◆ Round robin · 4-32 players"}
                </div>
                <span className="tl-format-badge">{isVi ? "Phổ biến nhất" : "Most popular"}</span>
              </div>
              <h3 className="tl-format-title">{isVi ? "Bảng đấu nhanh" : "Quick Tables"}</h3>
              <p className="tl-format-desc">
                {isVi
                  ? "Vòng bảng → tự động vào playoff. Đơn hoặc đôi. Định dạng chủ lực cho giải club, tournament cuối tuần và buổi tập."
                  : "Group stage → auto playoffs. Singles or doubles. The workhorse format for club events, weekend tournaments and practice sessions."}
              </p>
              <div className="tl-format-foot">
                <span>{activeQuickTables.length + openRegTables.length} {isVi ? "đang chạy" : "running"}</span>
                <span className="cta">{isVi ? "Tạo bảng đấu →" : "Start a table →"}</span>
              </div>
            </Link>

            <Link to="/tools/doubles-elimination/new" className="tl-format-card" data-fmt="doubles-elim">
              <div className="tl-format-head">
                <div className="tl-format-kicker">
                  {isVi ? "◆ Loại trực tiếp đôi · 4-32 đội" : "◆ Double elim · 4-32 teams"}
                </div>
                <span className="tl-format-badge">{isVi ? "Đỉnh cao" : "Best of"}</span>
              </div>
              <h3 className="tl-format-title">{isVi ? "Loại trực tiếp Đôi" : "Doubles Elimination"}</h3>
              <p className="tl-format-desc">
                {isVi
                  ? "Thua một lần rơi xuống nhánh thua. Đánh ngược lên chung kết. Hoàn hảo cho thứ Bảy với 16 đội và áp lực thật."
                  : "Lose once, drop to losers bracket. Fight back to the final. Perfect for a Saturday with 16 teams and stakes on the line."}
              </p>
              <div className="tl-format-foot">
                <span>{activeDoublesElim.length} {isVi ? "đang chạy" : "running"}</span>
                <span className="cta">{isVi ? "Tạo bảng đấu →" : "Create bracket →"}</span>
              </div>
            </Link>

            <Link to="/tools/flex-tournament/new" className="tl-format-card" data-fmt="flex">
              <div className="tl-format-head">
                <div className="tl-format-kicker">
                  {isVi ? "◆ Luật tùy chỉnh · Mọi quy mô" : "◆ Custom rules · Any size"}
                </div>
                <span className="tl-format-badge">{isVi ? "Nâng cao" : "Advanced"}</span>
              </div>
              <h3 className="tl-format-title">{isVi ? "Định dạng Linh hoạt" : "Flex Format"}</h3>
              <p className="tl-format-desc">
                {isVi
                  ? "Tự định nghĩa vòng, bảng và luật xếp hạt giống. Cho các sự kiện không tiêu chuẩn như king of the court, ladder challenge, hay festival nhiều ngày."
                  : "Define your own rounds, pools and seeding rules. For non-standard events like king of the court, ladder challenge, or multi-day festivals."}
              </p>
              <div className="tl-format-foot">
                <span>{activeFlex.length} {isVi ? "đang chạy" : "running"}</span>
                <span className="cta">{isVi ? "Mở trình tạo linh hoạt →" : "Open flex builder →"}</span>
              </div>
            </Link>

            <Link to="/tools/team-match/new" className="tl-format-card" data-fmt="team-match">
              <div className="tl-format-head">
                <div className="tl-format-kicker">
                  {isVi ? "◆ Định dạng MLP · 2 đội" : "◆ MLP format · 2 teams"}
                </div>
                <span className="tl-format-badge">{isVi ? "Cấp Pro" : "Pro-level"}</span>
              </div>
              <h3 className="tl-format-title">{isVi ? "Đấu đồng đội" : "Team Match"}</h3>
              <p className="tl-format-desc">
                {isVi
                  ? "Đội đấu đội kiểu MLP với tiebreak Dreambreaker. Đôi nữ, đôi nam, đôi hỗn hợp x2 — đúng cách Major League Pickleball vận hành."
                  : "MLP-style team vs team with Dreambreaker tiebreaker. Women's doubles, men's doubles, mixed x2 — exactly how Major League Pickleball runs it."}
              </p>
              <div className="tl-format-foot">
                <span>{openTeamMatches.length} {isVi ? "đang chạy" : "running"}</span>
                <span className="cta">{isVi ? "Thiết lập trận →" : "Set up match →"}</span>
              </div>
            </Link>
          </div>
        </section>

        {/* SEO pillar copy — explains what Bracket Lab is for crawlers + new visitors. */}
        <section style={{ marginBottom: 56 }}>
          <div className="tl-sec-head">
            <h2>
              {isVi ? (
                <>
                  <em className="tl-serif">Bracket Lab</em>{" "}
                  <span className="sans">làm gì.</span>
                </>
              ) : (
                <>
                  What <em className="tl-serif">Bracket Lab</em>{" "}
                  <span className="sans">actually does.</span>
                </>
              )}
            </h2>
          </div>
          <div
            style={{
              maxWidth: "68ch",
              margin: "0 auto",
              color: "var(--tl-fg-2)",
              fontSize: 16,
              lineHeight: 1.7,
            }}
          >
            <p style={{ marginBottom: 16 }}>
              {isVi
                ? "Bracket Lab là trình tạo bảng đấu pickleball miễn phí, dành cho câu lạc bộ, người tổ chức cuối tuần, và các sự kiện chuyên nghiệp khắp châu Á. Chọn định dạng — round robin, loại trực tiếp đơn, loại trực tiếp đôi, đấu đồng đội MLP, hay giải linh hoạt hoàn toàn tùy chỉnh — và công cụ sẽ dựng bảng đấu, sắp lịch trận, xoay sân, và theo dõi điểm trực tiếp. Chia sẻ một link duy nhất với người chơi và khán giả; in bracket treo tường nếu cần."
                : "Bracket Lab is a free pickleball tournament bracket generator built for clubs, weekend organizers, and pro events across Asia. Pick a format — round robin, single elimination, double elimination, MLP team match, or a fully custom flex tournament — and the tool builds the bracket, schedules matches, rotates courts, and tracks live scores. Share a single link with players and spectators; print a wall bracket if you need one."}
            </p>
            <p>
              {isVi ? (
                <>
                  Không cần đăng ký. Không cần tải về. Không có dùng thử 14 ngày rồi biến thành gói đăng ký $99/tháng. Xây dựng và duy trì bởi{" "}
                  <Link to="/blog/tournament-organizer-hub" style={{ color: "var(--tl-green)" }}>
                    ThePickleHub
                  </Link>
                  , nền tảng song ngữ Việt-Anh đưa tin về PPA Tour Asia, MLP, và giải pro khu vực.
                </>
              ) : (
                <>
                  No signup. No download. No 14-day trial that turns into a $99/month subscription. Built and maintained by{" "}
                  <Link to="/blog/tournament-organizer-hub" style={{ color: "var(--tl-green)" }}>
                    ThePickleHub
                  </Link>
                  , a bilingual Vietnamese-English platform reporting on PPA Tour Asia, MLP, and the regional pro circuit.
                </>
              )}
            </p>
          </div>
        </section>

        {/* Extra tools / utilities */}
        <section style={{ marginBottom: 56 }}>
          <div className="tl-sec-head">
            <h2>
              {isVi ? (
                <>
                  Thêm <em className="tl-serif">tiện ích.</em>{" "}
                </>
              ) : (
                <>
                  Plus <em className="tl-serif">utilities.</em>{" "}
                </>
              )}
            </h2>
          </div>
          <div className="tl-format-grid">
            <Link to="/tools/dashboard" className="tl-format-card" data-fmt="dashboard">
              <div className="tl-format-head">
                <div className="tl-format-kicker">
                  {isVi ? "◆ Phân tích · Mọi giải đấu" : "◆ Analytics · Any tournament"}
                </div>
              </div>
              <h3 className="tl-format-title">{isVi ? "Bảng điều khiển" : "Dashboard"}</h3>
              <p className="tl-format-desc">
                {isVi
                  ? "Xem thống kê thời gian thực cho mọi bảng đấu — ghim trên laptop bàn chấm điểm cho ban tổ chức. Hàng đợi trận, phân sân, bảng xếp hạng người chơi."
                  : "Real-time stats view for any bracket — pin it on a laptop at the scoring table for organizers. Match queue, court assignments, player standings."}
              </p>
              <div className="tl-format-foot">
                <span>{isVi ? "Cho BTC" : "For organizers"}</span>
                <span className="cta">{isVi ? "Mở dashboard →" : "Open dashboard →"}</span>
              </div>
            </Link>

            <Link to="/matches/new" className="tl-format-card" data-fmt="scoring">
              <div className="tl-format-head">
                <div className="tl-format-kicker">
                  {isVi ? "◆ Trận đơn lẻ · Không bracket" : "◆ Single match · No bracket"}
                </div>
              </div>
              <h3 className="tl-format-title">{isVi ? "Chấm điểm trận" : "Match Scoring"}</h3>
              <p className="tl-format-desc">
                {isVi
                  ? "Chỉ cần chấm điểm một trận? Mở bảng điểm trên điện thoại, ghi điểm tới 11 hoặc 15, lưu kết quả hoặc chia sẻ."
                  : "Just need to score one match? Open a scoreboard on your phone, track points to 11 or 15, save the result or share."}
              </p>
              <div className="tl-format-foot">
                <span>{isVi ? "Độc lập" : "Standalone"}</span>
                <span className="cta">{isVi ? "Chấm điểm →" : "Score a match →"}</span>
              </div>
            </Link>
          </div>
        </section>

        {/* Live activity feed */}
        <section style={{ marginBottom: 80 }}>
          <div className="tl-sec-head">
            <h2>
              {isVi ? (
                <>
                  Đang chạy <em className="tl-serif">ngay bây giờ.</em>{" "}
                  <span className="sans">{recentActivity.length}</span>
                </>
              ) : (
                <>
                  Running <em className="tl-serif">right now.</em>{" "}
                  <span className="sans">{recentActivity.length}</span>
                </>
              )}
            </h2>
            <p>
              {isVi
                ? "Các bảng đấu cộng đồng mới nhất — người thật, giải đấu thật, đang chạy ngay lúc này."
                : "Latest community brackets — real people, running real tournaments, right this minute."}
            </p>
          </div>

          {recentActivity.length === 0 ? (
            <div className="tl-empty">
              <h3>
                {isVi
                  ? "Hiện không có bảng đấu công khai nào đang chạy."
                  : "No public brackets running at the moment."}
              </h3>
              <p>
                {isVi
                  ? "Hãy là người đầu tiên. Tạo một Bảng đấu nhanh — thiết lập chỉ khoảng một phút."
                  : "Be the first. Spin up a Quick Table — setup takes about a minute."}
              </p>
              <Link to="/tools/quick-tables" className="tl-btn green">
                {isVi ? "Tạo Bảng đấu nhanh →" : "Start a Quick Table →"}
              </Link>
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
            {isVi ? "◆ Thêm một điều nữa" : "◆ One more thing"}
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
            {isVi
              ? "Bảng đấu trên điện thoại. Bảng điểm trên TV."
              : "Your bracket, on your phone. Your scoreboard, on a TV."}
          </h3>
          <p style={{ fontSize: 15.5, color: "var(--tl-fg-2)", maxWidth: "52ch", margin: "0 auto 24px", lineHeight: 1.55 }}>
            {isVi
              ? "Mọi bảng đấu tự sinh URL bảng điểm chỉ đọc, hoàn hảo để chiếu lên TV tại địa điểm. Người chơi chấm điểm trên điện thoại, khán giả xem trên màn hình lớn."
              : "Every bracket auto-generates a read-only scoreboard URL perfect for casting to a TV at the venue. Players score on phones, spectators watch on screens."}
          </p>
          <Link to="/tools/quick-tables" className="tl-btn green">
            {isVi ? "Dùng thử miễn phí →" : "Try it free →"}
          </Link>
        </section>
      </div>
    </TheLineLayout>
  );
};

export default Tools;
