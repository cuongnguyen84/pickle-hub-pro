import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import {
  PPA_WPR_BOARDS,
  PPA_WPR_FETCHED_AT,
  PPA_WPR_SOURCE_URL,
  PPA_WPR_VIET_HIGHLIGHTS,
  type PpaBoardKey,
} from "@/content/ppa-rankings";
import { useUrlBackedState } from "@/hooks/useUrlBackedState";

/**
 * /rankings/ppa-tour (+/vi twin) — PPA Tour World Pickleball Rankings (WPR).
 *
 * Editorial excerpt (top 25/board) from ppatour.com/rankings — NOT a full
 * mirror; PPA's ToS forbids commercial scraping without written permission
 * (proposal ppa-rankings-tab, risk #1). Separate route on purpose: /rankings
 * keeps its "DUPR Việt Nam" title/default; this page owns the WPR topic.
 * SSR twin: functions/_lib/render/ppa-rankings.ts reads the same content file.
 */

const BOARD_KEYS: PpaBoardKey[] = ["men", "women"];

const boardLabel = (key: PpaBoardKey, vi: boolean) =>
  key === "men" ? (vi ? "Nam" : "Men") : vi ? "Nữ" : "Women";

const PpaRankings = () => {
  const { language } = useI18n();
  const vi = language === "vi";

  // UX-08 — board is URL-backed (?board=) so deep-links survive back/refresh.
  const [board, setBoard] = useUrlBackedState<PpaBoardKey>({
    param: "board",
    parse: (raw) => (BOARD_KEYS.includes(raw as PpaBoardKey) ? (raw as PpaBoardKey) : null),
    fallback: "men",
  });

  const rows = PPA_WPR_BOARDS[board];

  const numberFmt = useMemo(
    () => new Intl.NumberFormat(vi ? "vi-VN" : "en-GB", { maximumFractionDigits: 1 }),
    [vi],
  );

  const fetchedLabel = useMemo(() => {
    const d = new Date(PPA_WPR_FETCHED_AT);
    return d.toLocaleDateString(vi ? "vi-VN" : "en-GB", {
      year: "numeric", month: "short", day: "numeric",
    });
  }, [vi]);

  return (
    <TheLineLayout
      title={vi ? "Bảng xếp hạng PPA Tour (WPR)" : "PPA Tour Rankings (WPR)"}
      description={vi
        ? "Top VĐV pickleball nhà nghề thế giới theo World Pickleball Ranking (WPR) của PPA Tour — bảng Nam và Nữ, kèm các VĐV Việt Nam và gốc Việt."
        : "Top professional pickleball players by PPA Tour's World Pickleball Ranking (WPR) — men's and women's boards, with Vietnamese and Vietnamese-origin pros."}
      active="rankings"
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to={vi ? "/vi" : "/"}>{vi ? "Trang chủ" : "Home"}</Link>
          <span className="sep">/</span>
          <Link to={vi ? "/vi/rankings" : "/rankings"}>{vi ? "Bảng xếp hạng" : "Rankings"}</Link>
          <span className="sep">/</span>
          <span className="current">PPA Tour</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            ◆ PPA TOUR · WPR · {vi ? "Số liệu lấy ngày" : "Data pulled"} {fetchedLabel}
          </div>
          <h1>
            {vi ? (
              <>
                Ai đang <em className="tl-serif">đứng đầu</em> <br />
                <span className="dim">thế giới</span> <span className="sans">nhà nghề.</span>
              </>
            ) : (
              <>
                Who <em className="tl-serif">leads</em> <br />
                <span className="dim">the pro</span> <span className="sans">tour.</span>
              </>
            )}
          </h1>
          <p>
            {vi
              ? "World Pickleball Ranking (WPR) là bảng xếp hạng tổng hợp của PPA Tour: đôi 50%, đôi nam nữ 35%, đơn 15%, tính trên điểm 52 tuần gần nhất. Không chia theo nội dung — mỗi VĐV có một hạng duy nhất."
              : "The World Pickleball Ranking (WPR) is PPA Tour's composite board: doubles 50%, mixed 35%, singles 15%, over the trailing 52 weeks. There is no per-discipline split — each player holds a single rank."}
          </p>
        </header>

        {/* Board pills — men / women */}
        <div className="tl-filters" role="group" aria-label={vi ? "Bảng" : "Board"}>
          {BOARD_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`tl-filter ${board === key ? "active" : ""}`}
              aria-pressed={board === key}
              onClick={() => setBoard(key)}
            >
              {boardLabel(key, vi)}
              <span className="count">{PPA_WPR_BOARDS[key].length}</span>
            </button>
          ))}
        </div>

        <div className="tl-panel" style={{ marginBottom: 32 }}>
          <div className="tl-panel-head">
            <h3>
              PPA Tour · {boardLabel(board, vi)} · Top {rows.length}
            </h3>
            <span className="meta">
              {vi ? "Nguồn: PPA Tour · WPR" : "Source: PPA Tour · WPR"}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="tl-rank-table">
              <caption className="sr-only">
                {vi
                  ? `Bảng xếp hạng PPA Tour WPR — ${boardLabel(board, vi)}`
                  : `PPA Tour WPR rankings — ${boardLabel(board, vi)}`}
              </caption>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{vi ? "VĐV" : "Player"}</th>
                  <th className="hide-mobile">{vi ? "Quốc gia" : "Country"}</th>
                  <th>{vi ? "Điểm WPR" : "WPR pts"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={`${board}-${p.rank}-${p.name}`}>
                    <td className="tl-rank-pos">
                      {p.rank.toString().padStart(2, "0")}
                      {p.isTied ? "=" : ""}
                    </td>
                    <td>
                      <div className="tl-rank-name">
                        <span>{p.name}</span>
                      </div>
                    </td>
                    <td className="hide-mobile" style={{ color: "var(--tl-fg-3)", fontFamily: "Geist Mono", fontSize: 12 }}>
                      {p.country}
                    </td>
                    <td className="tl-rank-score">{numberFmt.format(p.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vietnamese / Vietnamese-origin pros on the full WPR board */}
        <div className="tl-panel" style={{ marginBottom: 32 }}>
          <div className="tl-panel-head">
            <h3>{vi ? "Việt Nam & gốc Việt trên bảng WPR" : "Vietnam & Vietnamese-origin on the WPR board"}</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tl-rank-table">
              <caption className="sr-only">
                {vi
                  ? "VĐV Việt Nam và gốc Việt trên bảng WPR đầy đủ"
                  : "Vietnamese and Vietnamese-origin players on the full WPR board"}
              </caption>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{vi ? "VĐV" : "Player"}</th>
                  <th>{vi ? "Bảng" : "Board"}</th>
                  <th>{vi ? "Điểm WPR" : "WPR pts"}</th>
                </tr>
              </thead>
              <tbody>
                {PPA_WPR_VIET_HIGHLIGHTS.map((p) => (
                  <tr key={`${p.board}-${p.rank}`}>
                    <td className="tl-rank-pos">{p.rank.toString().padStart(2, "0")}</td>
                    <td>
                      <div className="tl-rank-name">
                        <span>
                          {p.name}
                          {p.countryCode === "vn" && (
                            <span style={{ marginLeft: 6 }} role="img" aria-label={vi ? "Việt Nam" : "Vietnam"}>🇻🇳</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: "var(--tl-fg-3)", fontFamily: "Geist Mono", fontSize: 12 }}>
                      {boardLabel(p.board, vi)}
                    </td>
                    <td className="tl-rank-score">{numberFmt.format(p.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Attribution / disclaimer */}
        <div
          className="tl-mono"
          style={{
            padding: "20px 24px",
            background: "var(--tl-surface)",
            border: "1px solid var(--tl-border)",
            borderRadius: "var(--tl-radius-lg)",
            fontSize: 12,
            color: "var(--tl-fg-3)",
            letterSpacing: "-0.005em",
            lineHeight: 1.6,
            marginBottom: 80,
            fontFamily: "Geist",
          }}
        >
          <strong style={{ color: "var(--tl-fg-2)", display: "block", marginBottom: 8, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "Geist Mono", fontWeight: 500 }}>
            ◆ {vi ? "Về dữ liệu này" : "About this data"}
          </strong>
          {vi ? (
            <>
              Điểm WPR do PPA Tour công bố tại{" "}
              <a href={PPA_WPR_SOURCE_URL} target="_blank" rel="nofollow noopener noreferrer" style={{ color: "var(--tl-green)" }}>ppatour.com/rankings</a>.
              ThePickleHub trích top 25 mỗi bảng làm tư liệu tham khảo (số liệu lấy ngày {fetchedLabel}) và
              hiển thị theo định dạng số tiếng Việt. ThePickleHub không phải kênh chính thức hay đối tác của
              PPA Tour. Xem bảng đầy đủ hơn 2.000 VĐV tại trang gốc. Muốn hiểu cách tính điểm?{" "}
              <Link to="/vi/blog/bang-xep-hang-pickleball-the-gioi-wpr" style={{ color: "var(--tl-green)" }}>
                Đọc bài giải thích WPR
              </Link>.
            </>
          ) : (
            <>
              WPR points are published by PPA Tour at{" "}
              <a href={PPA_WPR_SOURCE_URL} target="_blank" rel="nofollow noopener noreferrer" style={{ color: "var(--tl-green)" }}>ppatour.com/rankings</a>.
              ThePickleHub excerpts the top 25 per board for reference (data pulled {fetchedLabel}) with
              Vietnamese number formatting. ThePickleHub is not an official PPA Tour channel or partner.
              See the full 2,000+ player board on the source site. Curious how the points work?{" "}
              <Link to="/blog/world-pickleball-rankings-wpr-explained" style={{ color: "var(--tl-green)" }}>
                Read the WPR explainer
              </Link>.
            </>
          )}
        </div>
      </div>
    </TheLineLayout>
  );
};

export default PpaRankings;
