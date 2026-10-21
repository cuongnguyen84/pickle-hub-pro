import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { RankingsTabs } from "@/components/rankings/RankingsTabs";
import {
  PPA_WPR_BOARDS,
  PPA_WPR_FETCHED_AT,
  PPA_WPR_SOURCE_URL,
  PPA_WPR_VIET_HIGHLIGHTS,
  type PpaBoardKey,
} from "@/content/ppa-rankings";
import { filterWpr, WPR_SEARCH_INDEX, type WprSearchRow } from "@/lib/wpr-search";
import { useUrlBackedState } from "@/hooks/useUrlBackedState";
import { trackEvent } from "@/utils/ga";

/**
 * /rankings/ppa-tour (+/vi twin) — PPA Tour World Pickleball Rankings (WPR).
 *
 * Editorial excerpt (top 25/board + every VN-flag player, hand-curated) from
 * ppatour.com/rankings — NOT a full mirror; PPA's ToS forbids commercial
 * scraping without written permission (proposal rankings-dupr-wpr-tabs, D1).
 * Search runs over the UNION of everything we publish and hands off honestly
 * to the source (which has its own full-board name search) when a name is
 * outside the excerpt. SSR twin: functions/_lib/render/ppa-rankings.ts.
 */

const BOARD_KEYS: PpaBoardKey[] = ["men", "women"];

const boardLabel = (key: PpaBoardKey, vi: boolean) =>
  key === "men" ? (vi ? "Nam" : "Men") : vi ? "Nữ" : "Women";

const VIET_VISIBLE_DEFAULT = 8;

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

  // ── Search state ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasQuery = query.trim().length > 0;

  const rawResults = useMemo(() => (hasQuery ? filterWpr(query) : []), [query, hasQuery]);

  // IME guard (ui-ux #11): while a Telex/VNI composition is in flight, an
  // intermediate string ("nguyeenx") matching nothing must not flash the
  // empty state — keep the previous non-empty results on screen.
  const lastResultsRef = useRef<WprSearchRow[]>([]);
  if (!(isComposing && rawResults.length === 0)) {
    lastResultsRef.current = rawResults;
  }
  const results = isComposing && rawResults.length === 0 ? lastResultsRef.current : rawResults;
  const showEmpty = hasQuery && !isComposing && results.length === 0;

  // Result-count announcement: filtering is instant, the announcement is
  // debounced (~400ms) so screen readers don't hear every keystroke.
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      if (!hasQuery) setAnnounce("");
      else if (isComposing) return;
      else {
        setAnnounce(
          vi
            ? `${results.length} kết quả cho "${query.trim()}"`
            : `${results.length} results for "${query.trim()}"`,
        );
      }
    }, 400);
    return () => clearTimeout(t);
  }, [hasQuery, isComposing, results.length, query, vi]);

  // GA4 no-match counter (only query length, never content) — fires after
  // 800ms idle on a confirmed no-match. This is the number that decides
  // whether a second permission email to PPA is worth sending.
  useEffect(() => {
    if (!showEmpty) return;
    const t = setTimeout(() => {
      trackEvent("wpr_search_no_result", { q_len: query.trim().length, lang: language });
    }, 800);
    return () => clearTimeout(t);
  }, [showEmpty, query, language]);

  const numberFmt = useMemo(
    () => new Intl.NumberFormat(vi ? "vi-VN" : "en-GB", { maximumFractionDigits: 1 }),
    [vi],
  );

  const regionNames = useMemo(
    () => new Intl.DisplayNames([vi ? "vi" : "en"], { type: "region" }),
    [vi],
  );
  const countryName = (code: string, fallback: string) => {
    try {
      return regionNames.of(code.toUpperCase()) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const fetchedLabel = useMemo(() => {
    const d = new Date(PPA_WPR_FETCHED_AT);
    return d.toLocaleDateString(vi ? "vi-VN" : "en-GB", {
      year: "numeric", month: "short", day: "numeric",
    });
  }, [vi]);

  const trackSourceClick = (ctx: string) => trackEvent("wpr_source_click", { ctx, lang: language });

  const vietSorted = PPA_WPR_VIET_HIGHLIGHTS;
  const vietHead = vietSorted.slice(0, VIET_VISIBLE_DEFAULT);
  const vietTail = vietSorted.slice(VIET_VISIBLE_DEFAULT);

  const sourceLink = (ctx: string, label?: string) => (
    <a
      href={PPA_WPR_SOURCE_URL}
      target="_blank"
      rel="nofollow noopener noreferrer"
      style={{ color: "var(--tl-green)" }}
      onClick={() => trackSourceClick(ctx)}
    >
      {label ?? "ppatour.com/rankings ↗"}
    </a>
  );

  const resultRow = (p: WprSearchRow) => (
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
      <td style={{ color: "var(--tl-fg-3)", fontFamily: "Geist Mono", fontSize: 12, textTransform: "uppercase" }}>
        {boardLabel(p.board, vi)}
      </td>
      <td className="tl-rank-score">{numberFmt.format(p.points)}</td>
    </tr>
  );

  // CTR-01 (2026-08-27) — kept byte-identical to the SSR strings in
  // functions/_lib/render/ppa-rankings.ts. DynamicMeta appends the brand.
  return (
    <TheLineLayout
      title={vi ? "Bảng xếp hạng PPA Tour: Top 25 WPR" : "PPA Tour Rankings — Top 25 WPR"}
      description={vi
        ? "Xếp hạng PPA Tour: top 25 nam và top 25 nữ theo điểm World Pickleball Ranking, kèm các VĐV Việt Nam và gốc Việt."
        : "PPA Tour world rankings: top 25 men and top 25 women by World Pickleball Ranking points, plus every Vietnamese pro on the board."}
      active="rankings"
    >
      <div className="tl-shell">
        {/* Breadcrumb drops the trailing "PPA Tour" segment — the active tab
            below already says where we are (ui-ux nit #14). */}
        <nav className="tl-breadcrumb">
          <Link to={vi ? "/vi" : "/"}>{vi ? "Trang chủ" : "Home"}</Link>
          <span className="sep">/</span>
          <Link to={vi ? "/vi/rankings" : "/rankings"}>{vi ? "Bảng xếp hạng" : "Rankings"}</Link>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            ◆ PPA TOUR · WPR · {vi ? "Số liệu lấy ngày" : "Data pulled"} {fetchedLabel}
          </div>
          {/* No hard <br/> — height budget (ui-ux KPI): let it wrap naturally. */}
          <h1>
            {vi ? (
              <>
                Ai đang <em className="tl-serif">đứng đầu</em> <span className="dim">thế giới</span>{" "}
                <span className="sans">nhà nghề.</span>
              </>
            ) : (
              <>
                Who <em className="tl-serif">leads</em> <span className="dim">the pro</span>{" "}
                <span className="sans">tour.</span>
              </>
            )}
          </h1>
          <p>
            {vi
              ? "WPR xếp hạng VĐV nhà nghề PPA Tour theo điểm 52 tuần gần nhất."
              : "WPR ranks PPA Tour pros on their trailing 52 weeks of points."}
          </p>
        </header>

        <RankingsTabs active="wpr" language={language} />

        {/* ── Search ─────────────────────────────────────────────────────── */}
        <div style={{ position: "sticky", top: 59, zIndex: 5, background: "var(--tl-bg)", scrollMarginTop: 72, paddingTop: 8, paddingBottom: 6, borderBottom: "1px solid var(--tl-border)" }}>
          <label
            htmlFor="wpr-search"
            style={{ display: "block", fontFamily: "Geist Mono", fontSize: 11, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--tl-fg-3)", margin: "12px 0 0" }}
          >
            {vi ? "TÌM VĐV" : "FIND A PLAYER"}
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              inputRef.current?.blur();
            }}
          >
            <div className="tl-search-input" style={{ margin: "8px 0 6px" }}>
              <input
                id="wpr-search"
                ref={inputRef}
                type="search"
                enterKeyHint="search"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={vi ? "Tìm trong top 25 + VĐV Việt" : "Search the top 25 + Vietnamese pros"}
                value={query}
                aria-describedby="wpr-search-scope"
                onChange={(e) => setQuery(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
              />
              {hasQuery && (
                <button
                  type="button"
                  aria-label={vi ? "Xoá tìm kiếm" : "Clear search"}
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  style={{ background: "transparent", border: 0, color: "var(--tl-fg-2)", cursor: "pointer", fontSize: 16, minWidth: 44, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "-12px -8px" }}
                >
                  ✕
                </button>
              )}
            </div>
          </form>
          <p id="wpr-search-scope" style={{ fontSize: 12, color: "var(--tl-fg-3)", margin: "0 0 12px", lineHeight: 1.5 }}>
            {vi ? (
              <>Chỉ tìm trong {WPR_SEARCH_INDEX.length} VĐV ThePickleHub trích dẫn. Bảng WPR đầy đủ có hơn 2.000 VĐV — {sourceLink("helper", "tra trên trang gốc ↗")}</>
            ) : (
              <>Searches only the {WPR_SEARCH_INDEX.length} players excerpted here. The full WPR board has 2,000+ players — {sourceLink("helper", "look them up at the source ↗")}</>
            )}
          </p>
          <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announce}</p>
        </div>

        {hasQuery ? (
          /* ── Search results (union of both boards + VN block) ──────────── */
          <div className="tl-panel" style={{ marginBottom: 32 }}>
            <div className="tl-panel-head">
              <h3>{vi ? "Kết quả tìm kiếm" : "Search results"}</h3>
              <span className="meta">{vi ? "Nguồn: PPA Tour · WPR" : "Source: PPA Tour · WPR"}</span>
            </div>
            {showEmpty ? (
              <div className="tl-empty-card" style={{ margin: 24 }}>
                <div className="tl-empty-card-mark" aria-hidden="true">◌</div>
                <div className="tl-empty-card-label">
                  {vi ? `Không có "${query.trim()}" trong phần trích dẫn` : `No "${query.trim()}" in this excerpt`}
                </div>
                <div className="tl-empty-card-hint">
                  {vi ? (
                    <>Tay vợt này có thể đang có mặt trên bảng WPR đầy đủ (hơn 2.000 người) — ThePickleHub chỉ đăng top 25 mỗi bảng và các VĐV Việt. Trang gốc có ô tìm theo tên trên toàn bộ bảng: {sourceLink("empty", vi ? "Xem trên PPA Tour ↗" : undefined)}</>
                  ) : (
                    <>This player may be on the full WPR board (2,000+ players) — ThePickleHub only publishes the top 25 per board plus Vietnamese pros. The source has a full-board name search: {sourceLink("empty", "See it on PPA Tour ↗")}</>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tl-rank-table">
                  <caption className="sr-only">
                    {vi ? "Kết quả tìm kiếm bảng WPR" : "WPR search results"}
                  </caption>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{vi ? "VĐV" : "Player"}</th>
                      <th>{vi ? "Bảng" : "Board"}</th>
                      <th>{vi ? "Điểm WPR" : "WPR pts"}</th>
                    </tr>
                  </thead>
                  <tbody>{results.map(resultRow)}</tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ── Board pills + top-25 table ─────────────────────────────── */}
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
                          {countryName(p.countryCode, p.country)}
                        </td>
                        <td className="tl-rank-score">{numberFmt.format(p.points)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Vietnam & Vietnamese-origin — every VN-flag player on the
                   full board (editorial rule printed below), collapsed to 8
                   rows by default (ui-ux R2: don't pour 1,700px of mostly
                   unknown names into the page; <details> keeps all 42 in the
                   DOM for bots and find-in-page). ─────────────────────────── */}
            <div className="tl-panel" style={{ marginBottom: 32 }}>
              <div className="tl-panel-head">
                <h3>{vi ? "Việt Nam & gốc Việt trên bảng WPR" : "Vietnam & Vietnamese-origin on the WPR board"}</h3>
                <span className="meta">{vietSorted.length} {vi ? "VĐV" : "players"}</span>
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
                  <tbody>{vietHead.map(resultRow)}</tbody>
                </table>
                {vietTail.length > 0 && (
                  <details>
                    <summary
                      style={{ cursor: "pointer", padding: "12px 18px", fontFamily: "Geist Mono", fontSize: 12, letterSpacing: "0.04em", color: "var(--tl-green)", listStyle: "none" }}
                    >
                      {vi
                        ? `→ Xem tất cả ${vietSorted.length} VĐV Việt / gốc Việt`
                        : `→ Show all ${vietSorted.length} Vietnamese / Viet-origin players`}
                    </summary>
                    <table className="tl-rank-table" aria-label={vi ? "Phần còn lại của danh sách" : "Rest of the list"}>
                      <tbody>{vietTail.map(resultRow)}</tbody>
                    </table>
                  </details>
                )}
              </div>
              <div style={{ padding: "10px 18px 14px", fontSize: 12, color: "var(--tl-fg-3)", borderTop: "1px solid var(--tl-border)", lineHeight: 1.5 }}>
                {vi
                  ? `Quy tắc chọn: mọi VĐV mang cờ Việt Nam trên bảng WPR + 3 VĐV Mỹ gốc Việt nổi bật · Số liệu lấy ngày ${fetchedLabel}`
                  : `Selection rule: every Vietnam-flag player on the WPR board + 3 notable Viet-origin US pros · Data pulled ${fetchedLabel}`}
              </div>
            </div>
          </>
        )}

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
              WPR là bảng tổng hợp: đôi 50%, đôi nam nữ 35%, đơn 15%, tính trên điểm 52 tuần gần nhất — mỗi VĐV một
              hạng duy nhất. Điểm do PPA Tour công bố tại {sourceLink("attribution")}.
              ThePickleHub trích top 25 mỗi bảng + các VĐV Việt làm tư liệu tham khảo (số liệu lấy ngày {fetchedLabel}) và
              hiển thị theo định dạng số tiếng Việt. ThePickleHub không phải kênh chính thức hay đối tác của
              PPA Tour. Xem bảng đầy đủ hơn 2.000 VĐV tại trang gốc. Muốn hiểu cách tính điểm?{" "}
              <Link to="/vi/blog/bang-xep-hang-pickleball-the-gioi-wpr" style={{ color: "var(--tl-green)" }}>
                Đọc bài giải thích WPR
              </Link>.
            </>
          ) : (
            <>
              The WPR is a composite board: doubles 50%, mixed 35%, singles 15%, over the trailing 52 weeks — one rank
              per player. Points are published by PPA Tour at {sourceLink("attribution")}.
              ThePickleHub excerpts the top 25 per board plus Vietnamese pros for reference (data pulled {fetchedLabel}).
              ThePickleHub is not an official PPA Tour channel or partner.
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
