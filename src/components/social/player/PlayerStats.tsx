import { Link } from "react-router-dom";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useI18n } from "@/i18n";
import type { PlayerStatsRow } from "@/hooks/social/usePlayerStats";

interface PlayerStatsProps {
  stats: PlayerStatsRow | null | undefined;
  loading: boolean;
}

/**
 * Editorial stats panel — italic green numbers, uppercase mono labels,
 * hairline divider top. Replaces the 4-card grid with an inline layout
 * matching the Rankings + Tournaments aesthetic.
 */
export function PlayerStats({ stats, loading }: PlayerStatsProps) {
  const { language } = useI18n();
  if (loading) {
    return (
      <section style={{ padding: "32px 0" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
          <Loader2
            className="h-5 w-5 animate-spin"
            style={{ color: "var(--tl-fg-3)" }}
          />
        </div>
      </section>
    );
  }

  if (!stats || stats.total_matches === 0) {
    return (
      <section style={{ padding: "32px 0", borderTop: "1px solid var(--tl-border)" }}>
        <div className="tl-eyebrow" aria-hidden="true">
          <span className="pip" />
          <span>{language === "vi" ? "THÀNH TÍCH" : "STATS"}</span>
        </div>
        <div className="tl-empty-card" style={{ marginTop: 12 }}>
          <div className="tl-empty-card-mark" aria-hidden="true">◌</div>
          <div className="tl-empty-card-label">
            {language === "vi" ? "Chưa có trận đấu" : "No matches yet"}
          </div>
          <div className="tl-empty-card-hint">
            {language === "vi"
              ? "Log trận đầu tiên để theo dõi tiến triển trên ThePickleHub."
              : "Log your first match to track progress on ThePickleHub."}
          </div>
          <Link to="/tran-dau/moi" className="tl-empty-card-cta">
            {language === "vi" ? "+ Log trận đầu" : "+ Log first match"}
          </Link>
        </div>
      </section>
    );
  }

  const winRateNum = Number(stats.win_rate ?? 0);
  const streak = stats.current_streak ?? 0;
  const StreakIcon =
    streak > 0 ? TrendingUp : streak < 0 ? TrendingDown : Minus;
  const streakColor =
    streak > 0
      ? "var(--tl-green)"
      : streak < 0
        ? "var(--tl-red, #ef4444)"
        : "var(--tl-fg-3)";

  return (
    <section
      style={{
        padding: "32px 0",
        borderTop: "1px solid var(--tl-border)",
      }}
    >
      <div className="tl-eyebrow" aria-hidden="true">
        <span className="pip" />
        <span>{language === "vi" ? "THÀNH TÍCH" : "STATS"}</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 24,
          marginTop: 8,
        }}
      >
        <StatCell
          label="WIN RATE"
          value={`${winRateNum.toFixed(1)}%`}
          sub={`${stats.wins ?? 0}W — ${stats.losses ?? 0}L`}
        />
        <StatCell
          label={language === "vi" ? "TỔNG TRẬN" : "MATCHES"}
          value={`${stats.total_matches ?? 0}`}
          sub={language === "vi" ? "đã verified" : "verified"}
        />
        <StatCell
          label={language === "vi" ? "PHONG ĐỘ" : "FORM"}
          value={<FormSparkline form={stats.last_5_form ?? ""} />}
          sub={language === "vi" ? "5 trận gần nhất" : "Last 5 matches"}
        />
        <StatCell
          label="STREAK"
          value={
            <span
              style={{
                color: streakColor,
                display: "inline-flex",
                alignItems: "baseline",
                gap: 4,
              }}
            >
              <StreakIcon className="h-5 w-5" style={{ alignSelf: "center" }} />
              {Math.abs(streak)}
            </span>
          }
          sub={
            streak > 0
              ? language === "vi"
                ? "thắng liên tiếp"
                : "wins in a row"
              : streak < 0
                ? language === "vi"
                  ? "thua liên tiếp"
                  : "losses in a row"
                : language === "vi"
                  ? "không liên tiếp"
                  : "no streak"
          }
        />
        <StatCell
          label={language === "vi" ? "NGƯỜI THEO DÕI" : "FOLLOWERS"}
          value={`${stats.followers_count ?? 0}`}
          sub={
            language === "vi" ? "đang theo dõi" : "people following"
          }
        />
        <StatCell
          label={language === "vi" ? "ĐANG THEO DÕI" : "FOLLOWING"}
          value={`${stats.following_count ?? 0}`}
          sub={language === "vi" ? "người chơi" : "players"}
        />
      </div>
    </section>
  );
}

interface StatCellProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
}
function StatCell({ label, value, sub }: StatCellProps) {
  return (
    <div>
      <div
        className="tl-caps"
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.08em",
          color: "var(--tl-fg-3)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        className="tl-tnum"
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontSize: 40,
          lineHeight: 1,
          color: "var(--tl-green)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "var(--tl-fg-3)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/** 5-cell sparkline; W=green pip, L=muted pip. Newest match leftmost. */
function FormSparkline({ form }: { form: string }) {
  const cells = form.padEnd(5, "·").slice(0, 5).split("");
  return (
    <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {cells.map((c, i) => (
        <span
          key={i}
          aria-label={c === "W" ? "Win" : c === "L" ? "Loss" : "no game"}
          style={{
            display: "inline-block",
            width: 12,
            height: 28,
            borderRadius: 2,
            background:
              c === "W"
                ? "var(--tl-green)"
                : c === "L"
                  ? "var(--tl-red, #ef4444)"
                  : "var(--tl-border)",
          }}
        />
      ))}
    </div>
  );
}
