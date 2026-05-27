import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import {
  DUPR_RANKINGS,
  DUPR_SCOPES,
  DUPR_FORMATS,
  DUPR_LAST_UPDATED,
  defaultFormatForScope,
  getAvailableFormats,
  type DuprScope,
  type DuprFormat,
} from "@/content/dupr-rankings";
import {
  useVietnamRankings,
  type VietnamRankingFormat,
} from "@/hooks/dupr/useVietnamRankings";

/**
 * Production /rankings page — DUPR snapshot.
 *
 * Static data sourced from www.dupr.com on 2026-05-02 (see
 * src/content/dupr-rankings.ts). Two top-level scopes: Open + Junior
 * (from /rankings) plus 5 continents (from /continental-rankings/*).
 * Within each scope, 4 sub-formats: men's/women's singles + doubles.
 *
 * Sprint A6 (2026-05-27) — added "vietnam" scope that reads
 * public.profiles via dupr_leaderboard_vietnam RPC. Two formats only
 * (singles, doubles) until profiles.gender ships. Branches on
 * `scope === "vietnam"` for table + format tabs + attribution copy.
 */

const Rankings = () => {
  const { language } = useI18n();
  const [scope, setScope] = useState<DuprScope>("vietnam");
  const [format, setFormat] = useState<DuprFormat>(defaultFormatForScope("vietnam"));

  // Switching scope might leave `format` invalid for the new scope's
  // available formats (e.g. vietnam → europe). Reset to a sensible
  // default whenever scope changes.
  useEffect(() => {
    const available = getAvailableFormats(scope);
    if (!available.includes(format)) {
      setFormat(defaultFormatForScope(scope));
    }
  }, [scope, format]);

  const isVietnamScope = scope === "vietnam";
  const availableFormats = useMemo(() => getAvailableFormats(scope), [scope]);

  // Vietnam scope reads live data from Supabase; static const for the rest.
  const vietnamQuery = useVietnamRankings({
    format: format as VietnamRankingFormat,
    limit: 100,
    enabled: isVietnamScope && (format === "singles" || format === "doubles"),
  });

  // Resolve the player rows for the active scope+format combo. Vietnam
  // returns hook rows; everything else falls back to the static snapshot.
  const staticPlayers = !isVietnamScope
    ? DUPR_RANKINGS[scope as Exclude<DuprScope, "vietnam">][
        format as Exclude<DuprFormat, "singles" | "doubles">
      ] ?? []
    : [];

  const scopeMeta = DUPR_SCOPES.find((s) => s.key === scope)!;

  const lastUpdatedLabel = useMemo(() => {
    const d = new Date(DUPR_LAST_UPDATED);
    return d.toLocaleDateString(language === "vi" ? "vi-VN" : "en-GB", {
      year: "numeric", month: "short", day: "numeric",
    });
  }, [language]);

  const nationalScopes = DUPR_SCOPES.filter((s) => s.group === "national");
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

        {/* Scope tabs — national + global + continents */}
        <div className="tl-rank-scopes">
          <div className="tl-rank-scope-row">
            <span className="tl-rank-scope-label">
              {language === "vi" ? "QUỐC GIA" : "NATIONAL"}
            </span>
            {nationalScopes.map((s) => (
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
          {availableFormats.map((fKey) => {
            const f = DUPR_FORMATS.find((meta) => meta.key === fKey)!;
            const count = isVietnamScope
              ? (vietnamQuery.data?.length ?? 0)
              : (DUPR_RANKINGS[scope as Exclude<DuprScope, "vietnam">][
                  fKey as Exclude<DuprFormat, "singles" | "doubles">
                ]?.length ?? 0);
            return (
              <button
                key={f.key}
                type="button"
                className={`tl-filter ${format === f.key ? "active" : ""}`}
                onClick={() => setFormat(f.key)}
              >
                {language === "vi" ? f.labelVi : f.labelEn}
                <span className="count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Table — branches on vietnam (live RPC) vs static snapshot */}
        {isVietnamScope ? (
          <VietnamRankingsTable
            language={language}
            scopeLabel={language === "vi" ? scopeMeta.labelVi : scopeMeta.labelEn}
            formatLabel={
              language === "vi"
                ? DUPR_FORMATS.find((f) => f.key === format)?.labelVi ?? ""
                : DUPR_FORMATS.find((f) => f.key === format)?.labelEn ?? ""
            }
            isLoading={vietnamQuery.isLoading}
            isError={vietnamQuery.isError}
            rows={vietnamQuery.data ?? []}
          />
        ) : (
          <div className="tl-panel" style={{ marginBottom: 32 }}>
            <div className="tl-panel-head">
              <h3>
                {language === "vi" ? scopeMeta.labelVi : scopeMeta.labelEn}
                {" · "}
                {language === "vi"
                  ? DUPR_FORMATS.find((f) => f.key === format)!.labelVi
                  : DUPR_FORMATS.find((f) => f.key === format)!.labelEn}
                {" · "}
                {`Top ${staticPlayers.length}`}
              </h3>
              <span className="meta">
                {language === "vi" ? "Nguồn: DUPR" : "Source: DUPR"}
              </span>
            </div>

            {staticPlayers.length === 0 ? (
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
                    {staticPlayers.map((p) => (
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
            ◆ {language === "vi" ? "Về dữ liệu này" : "About this data"}
          </strong>
          {isVietnamScope ? (
            language === "vi" ? (
              <>
                Bảng xếp hạng Việt Nam đọc trực tiếp từ profile của VĐV đã kết nối DUPR
                và bật chế độ công khai trên ThePickleHub. Cập nhật theo thời gian thực
                qua webhook DUPR. Chưa có hồ sơ? <Link to="/auth" style={{ color: "var(--tl-green)" }}>Tạo tài khoản</Link> rồi kết nối DUPR trong Account.
              </>
            ) : (
              <>
                The Vietnam leaderboard reads directly from profiles of players who
                have linked DUPR and opted their profile public on ThePickleHub.
                Real-time updates via DUPR webhook. No profile yet?{" "}
                <Link to="/auth" style={{ color: "var(--tl-green)" }}>Sign up</Link> and link DUPR in Account.
              </>
            )
          ) : language === "vi" ? (
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

// ─── Vietnam sub-table ──────────────────────────────────────────────────────
// Live-data variant of the rank table. Differences vs static snapshot:
//   * Loading / error states (Supabase RPC backed)
//   * Player cell links to /nguoi-choi/:username
//   * "City" column replaces "Age" (we don't store birthdate yet)
//   * "Synced" badge when dupr_synced_at is > 30 days old
// ----------------------------------------------------------------------------

interface VietnamRankingsTableProps {
  language: "vi" | "en";
  scopeLabel: string;
  formatLabel: string;
  isLoading: boolean;
  isError: boolean;
  rows: import("@/hooks/dupr/useVietnamRankings").VietnamRankingRow[];
}

function VietnamRankingsTable({
  language,
  scopeLabel,
  formatLabel,
  isLoading,
  isError,
  rows,
}: VietnamRankingsTableProps) {
  return (
    <div className="tl-panel" style={{ marginBottom: 32 }}>
      <div className="tl-panel-head">
        <h3>
          {scopeLabel}
          {" · "}
          {formatLabel}
          {" · "}
          {language === "vi" ? `Top ${rows.length}` : `Top ${rows.length}`}
        </h3>
        <span className="meta">
          {language === "vi" ? "Nguồn: ThePickleHub · DUPR" : "Source: ThePickleHub · DUPR"}
        </span>
      </div>

      {isLoading ? (
        <div className="tl-empty-card" style={{ margin: 24 }}>
          <div className="tl-empty-card-mark" aria-hidden="true">◌</div>
          <div className="tl-empty-card-label">
            {language === "vi" ? "Đang tải bảng xếp hạng…" : "Loading rankings…"}
          </div>
        </div>
      ) : isError ? (
        <div className="tl-empty-card" style={{ margin: 24 }}>
          <div className="tl-empty-card-mark" aria-hidden="true">⚠</div>
          <div className="tl-empty-card-label">
            {language === "vi" ? "Không tải được dữ liệu" : "Couldn't load data"}
          </div>
          <div className="tl-empty-card-hint">
            {language === "vi" ? "Vui lòng tải lại trang." : "Please refresh the page."}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="tl-empty-card" style={{ margin: 24 }}>
          <div className="tl-empty-card-mark" aria-hidden="true">◌</div>
          <div className="tl-empty-card-label">
            {language === "vi"
              ? "Chưa có VĐV Việt Nam nào kết nối DUPR công khai"
              : "No Vietnamese players have connected DUPR publicly yet"}
          </div>
          <div className="tl-empty-card-hint">
            {language === "vi"
              ? "Hãy là người đầu tiên — kết nối DUPR trong Account và bật profile công khai."
              : "Be the first — connect DUPR in Account and make your profile public."}
          </div>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="tl-rank-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{language === "vi" ? "Vận động viên" : "Player"}</th>
                <th className="hide-mobile">{language === "vi" ? "Thành phố" : "City"}</th>
                <th>DUPR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isStale =
                  row.dupr_synced_at != null &&
                  Date.now() - new Date(row.dupr_synced_at).getTime() >
                    30 * 24 * 60 * 60 * 1000;
                return (
                  <tr key={`vn-${row.user_id}`}>
                    <td className="tl-rank-pos">
                      {row.rank.toString().padStart(2, "0")}
                    </td>
                    <td>
                      <div className="tl-rank-name">
                        <Link
                          to={`/nguoi-choi/${row.username}`}
                          style={{ color: "inherit", textDecoration: "none" }}
                        >
                          {row.display_name ?? row.username}
                        </Link>
                      </div>
                    </td>
                    <td
                      className="hide-mobile"
                      style={{
                        color: "var(--tl-fg-3)",
                        fontFamily: "Geist Mono",
                        fontSize: 12,
                      }}
                    >
                      {row.city ?? "—"}
                    </td>
                    <td className="tl-rank-score">
                      {row.dupr_rating.toFixed(3)}
                      {isStale && (
                        <span
                          aria-label={
                            language === "vi"
                              ? "Rating chưa đồng bộ trong 30 ngày"
                              : "Rating not synced in 30 days"
                          }
                          title={
                            language === "vi"
                              ? "Chưa đồng bộ trong 30 ngày"
                              : "Not synced in 30 days"
                          }
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            color: "var(--tl-fg-3)",
                          }}
                        >
                          ◐
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
