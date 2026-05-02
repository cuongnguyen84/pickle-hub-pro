import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import {
  DUPR_RANKINGS,
  DUPR_SCOPES,
  DUPR_FORMATS,
  DUPR_LAST_UPDATED,
  type DuprScope,
  type DuprFormat,
} from "@/content/dupr-rankings";

/**
 * Production /rankings page — DUPR snapshot.
 *
 * Static data sourced from www.dupr.com on 2026-05-02 (see
 * src/content/dupr-rankings.ts). Two top-level scopes: Open + Junior
 * (from /rankings) plus 5 continents (from /continental-rankings/*).
 * Within each scope, 4 sub-formats: men's/women's singles + doubles.
 *
 * Phase 2: replace static import with `useDuprRankings()` hook reading
 * from a Supabase table populated by an `dupr-ingest` edge function
 * running daily. Page chrome stays the same.
 */

const Rankings = () => {
  const { language } = useI18n();
  const [scope, setScope] = useState<DuprScope>("open");
  const [format, setFormat] = useState<DuprFormat>("mens-singles");

  const players = DUPR_RANKINGS[scope][format];
  const scopeMeta = DUPR_SCOPES.find((s) => s.key === scope)!;

  const lastUpdatedLabel = useMemo(() => {
    const d = new Date(DUPR_LAST_UPDATED);
    return d.toLocaleDateString(language === "vi" ? "vi-VN" : "en-GB", {
      year: "numeric", month: "short", day: "numeric",
    });
  }, [language]);

  const globalScopes = DUPR_SCOPES.filter((s) => s.group === "global");
  const continentScopes = DUPR_SCOPES.filter((s) => s.group === "continent");

  return (
    <TheLineLayout
      title={language === "vi" ? "Bảng xếp hạng DUPR" : "DUPR Rankings"}
      description={language === "vi"
        ? "Top vận động viên pickleball toàn cầu theo DUPR — Open, Junior, và 5 châu lục. Cập nhật từ DUPR."
        : "Top pickleball players worldwide by DUPR — Open, Junior, and 5 continents. Sourced from DUPR."}
      active="rankings"
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to={language === "vi" ? "/vi" : "/"}>{language === "vi" ? "Trang chủ" : "Home"}</Link>
          <span className="sep">/</span>
          <span className="current">{language === "vi" ? "Bảng xếp hạng" : "Rankings"}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            ◆ DUPR · {language === "vi" ? "Cập nhật" : "Updated"} {lastUpdatedLabel}
          </div>
          <h1>
            {language === "vi" ? (
              <>
                Ai đang <em className="tl-serif">đứng top.</em> <br />
                <span className="dim">Toàn cầu,</span> <span className="sans">tính theo DUPR.</span>
              </>
            ) : (
              <>
                Where <em className="tl-serif">everyone</em> <br />
                <span className="dim">actually</span> <span className="sans">stands.</span>
              </>
            )}
          </h1>
          <p>
            {language === "vi"
              ? "DUPR (Dynamic Universal Pickleball Rating) là chuẩn rating toàn cầu — cập nhật theo kết quả các giải đấu sanctioned. Snapshot này lấy từ trang chính thức DUPR."
              : "DUPR (Dynamic Universal Pickleball Rating) is the global rating standard — updated from sanctioned tournament results. This snapshot is sourced from DUPR's public pages."}
          </p>
        </header>

        {/* Scope tabs — global (Open / Junior) + continents */}
        <div className="tl-rank-scopes">
          <div className="tl-rank-scope-row">
            <span className="tl-rank-scope-label">
              {language === "vi" ? "TOÀN CẦU" : "GLOBAL"}
            </span>
            {globalScopes.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`tl-rank-scope ${scope === s.key ? "active" : ""}`}
                onClick={() => setScope(s.key)}
              >
                {language === "vi" ? s.labelVi : s.labelEn}
              </button>
            ))}
          </div>
          <div className="tl-rank-scope-row">
            <span className="tl-rank-scope-label">
              {language === "vi" ? "CHÂU LỤC" : "CONTINENT"}
            </span>
            {continentScopes.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`tl-rank-scope ${scope === s.key ? "active" : ""}`}
                onClick={() => setScope(s.key)}
              >
                {language === "vi" ? s.labelVi : s.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Format sub-tabs */}
        <div className="tl-filters" style={{ marginTop: 8 }}>
          {DUPR_FORMATS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`tl-filter ${format === f.key ? "active" : ""}`}
              onClick={() => setFormat(f.key)}
            >
              {language === "vi" ? f.labelVi : f.labelEn}
              <span className="count">{DUPR_RANKINGS[scope][f.key].length}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="tl-panel" style={{ marginBottom: 32 }}>
          <div className="tl-panel-head">
            <h3>
              {language === "vi" ? scopeMeta.labelVi : scopeMeta.labelEn}
              {" · "}
              {language === "vi"
                ? DUPR_FORMATS.find((f) => f.key === format)!.labelVi
                : DUPR_FORMATS.find((f) => f.key === format)!.labelEn}
              {" · "}
              {language === "vi" ? `Top ${players.length}` : `Top ${players.length}`}
            </h3>
            <span className="meta">
              {language === "vi" ? "Nguồn: DUPR" : "Source: DUPR"}
            </span>
          </div>

          {players.length === 0 ? (
            <div className="tl-empty-card" style={{ margin: 24 }}>
              <div className="tl-empty-card-mark" aria-hidden="true">◌</div>
              <div className="tl-empty-card-label">
                {language === "vi" ? "Chưa có dữ liệu" : "No data yet"}
              </div>
              <div className="tl-empty-card-hint">
                {language === "vi"
                  ? "Thử format hoặc khu vực khác."
                  : "Try a different format or region."}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="tl-rank-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{language === "vi" ? "Vận động viên" : "Player"}</th>
                    <th className="hide-mobile">{language === "vi" ? "Tuổi" : "Age"}</th>
                    <th>DUPR</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={`${scope}-${format}-${p.rank}`}>
                      <td className="tl-rank-pos">
                        {p.rank.toString().padStart(2, "0")}
                      </td>
                      <td>
                        <div className="tl-rank-name">
                          <span>{p.name}</span>
                        </div>
                      </td>
                      <td className="hide-mobile" style={{ color: "var(--tl-fg-3)", fontFamily: "Geist Mono", fontSize: 12 }}>
                        {p.age ?? "—"}
                      </td>
                      <td className="tl-rank-score">
                        {p.rating !== null ? p.rating.toFixed(3) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
            ◆ {language === "vi" ? "Về dữ liệu này" : "About this data"}
          </strong>
          {language === "vi" ? (
            <>
              Dữ liệu DUPR trên đây là snapshot từ <a href="https://www.dupr.com/rankings" target="_blank" rel="noopener noreferrer" style={{ color: "var(--tl-green)" }}>dupr.com/rankings</a> và{" "}
              <a href="https://www.dupr.com/continental-rankings/home" target="_blank" rel="noopener noreferrer" style={{ color: "var(--tl-green)" }}>dupr.com/continental-rankings</a>,
              cập nhật {lastUpdatedLabel}. Top 25 mỗi format. Để xem ranking đầy đủ và lịch sử trận đấu, truy cập trang DUPR chính thức.
            </>
          ) : (
            <>
              The DUPR data above is a snapshot from{" "}
              <a href="https://www.dupr.com/rankings" target="_blank" rel="noopener noreferrer" style={{ color: "var(--tl-green)" }}>dupr.com/rankings</a> and{" "}
              <a href="https://www.dupr.com/continental-rankings/home" target="_blank" rel="noopener noreferrer" style={{ color: "var(--tl-green)" }}>dupr.com/continental-rankings</a>,
              updated {lastUpdatedLabel}. Top 25 per format. For full rankings and per-player match histories, visit the official DUPR pages.
            </>
          )}
        </div>
      </div>
    </TheLineLayout>
  );
};

export default Rankings;
