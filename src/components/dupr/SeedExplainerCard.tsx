// ============================================================================
// SeedExplainerCard — coverage + freshness summary after Auto-seed by DUPR
// ----------------------------------------------------------------------------
// Sprint B2.3 (2026-05-27). Mounted inside BracketSetupDialog right after the
// organizer clicks "Auto-seed by DUPR". Shows three numbers and a banner if
// coverage is poor or many ratings are stale.
// ============================================================================

import { Info, AlertTriangle, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n";

interface SeedExplainerCardProps {
  total: number;
  withDupr: number;
  stale: number;
  /** Sprint B2 follow-up — number of players whose rating came from
   *  the fallback bucket (doubles when format=singles). */
  approx?: number;
  /** Which format the bracket is — drives copy clarity. */
  format?: "singles" | "doubles";
}

export function SeedExplainerCard({
  total,
  withDupr,
  stale,
  approx = 0,
  format = "doubles",
}: SeedExplainerCardProps) {
  const { language } = useI18n();
  const vi = language === "vi";

  if (total === 0) return null;

  const withoutDupr = total - withDupr;
  const direct = withDupr - approx;
  const coveragePct = Math.round((withDupr / total) * 100);
  const stalePct = withDupr === 0 ? 0 : Math.round((stale / withDupr) * 100);

  const lowCoverage = coveragePct < 50;
  const highStale = stalePct > 30 && stale > 0;
  const hasApprox = approx > 0;

  const formatLabel = vi
    ? format === "singles" ? "đơn" : "đôi"
    : format;

  return (
    <div
      role="region"
      aria-label={vi ? "Tóm tắt seed DUPR" : "DUPR seed summary"}
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: "var(--tl-radius-lg)",
        background: "rgba(34,197,94,0.06)",
        border: "1px solid rgba(34,197,94,0.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Sparkles className="w-4 h-4" style={{ color: "var(--tl-green)" }} />
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--tl-green)" }}>
          {vi ? `Đã seed theo DUPR ${formatLabel}` : `Seeded by DUPR ${formatLabel}`}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
        <Stat
          label={vi ? `DUPR ${formatLabel} chính xác` : `Exact ${formatLabel}`}
          value={`${direct}/${total}`}
          accent="green"
        />
        <Stat
          label={vi ? "Ước tính" : "Approx"}
          value={String(approx)}
          accent={hasApprox ? "info" : undefined}
        />
        <Stat
          label={vi ? "Không DUPR" : "No DUPR"}
          value={String(withoutDupr)}
          accent={withoutDupr > 0 ? "warn" : undefined}
        />
      </div>

      {hasApprox && format === "singles" && (
        <Banner
          icon={<Info className="w-4 h-4" />}
          tone="info"
          text={
            vi
              ? `${approx} VĐV chưa có DUPR đơn — em dùng DUPR đôi để ước tính (hiển thị Δ "ước tính" cạnh seed).`
              : `${approx} player(s) have no singles DUPR — using doubles DUPR as an approximation.`
          }
        />
      )}
      {lowCoverage && (
        <Banner
          icon={<Info className="w-4 h-4" />}
          tone="info"
          text={
            vi
              ? `Chỉ ${coveragePct}% VĐV có DUPR — ${withoutDupr} người sẽ seed cuối nhóm theo alphabetical.`
              : `Only ${coveragePct}% have DUPR — ${withoutDupr} player(s) will seed at the bottom by name.`
          }
        />
      )}
      {highStale && (
        <Banner
          icon={<AlertTriangle className="w-4 h-4" />}
          tone="warn"
          text={
            vi
              ? `${stale} VĐV có DUPR đã cũ (>30 ngày). Seed có thể không phản ánh skill hiện tại.`
              : `${stale} player(s) have stale DUPR (>30 days). Seeding may not reflect current skill.`
          }
        />
      )}
      {stale === 0 && !lowCoverage && !hasApprox && (
        <p style={{ fontSize: 12, color: "var(--tl-fg-3)", margin: 0, lineHeight: 1.5 }}>
          {vi
            ? `Tất cả ${total} VĐV đều có DUPR ${formatLabel}. Seed chính xác, sẵn sàng tạo bảng.`
            : `All ${total} players have ${formatLabel} DUPR. Seeds are accurate, ready to create groups.`}
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "warn" | "info";
}) {
  const color =
    accent === "green"
      ? "var(--tl-green)"
      : accent === "warn"
        ? "var(--tl-live)"
        : accent === "info"
          ? "rgb(96,165,250)"
          : "var(--tl-fg)";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 18, fontFamily: "'Geist Mono', monospace", fontVariantNumeric: "tabular-nums", color }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: "var(--tl-fg-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function Banner({
  icon,
  text,
  tone,
}: {
  icon: React.ReactNode;
  text: string;
  tone: "info" | "warn";
}) {
  const background = tone === "warn" ? "rgba(239,68,68,0.06)" : "rgba(59,130,246,0.06)";
  const border = tone === "warn" ? "rgba(239,68,68,0.3)" : "rgba(59,130,246,0.3)";
  const color = tone === "warn" ? "var(--tl-live)" : "var(--tl-fg-2)";
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "8px 10px",
        borderRadius: "var(--tl-radius)",
        background,
        border: `1px solid ${border}`,
        color,
        fontSize: 12,
        lineHeight: 1.5,
        marginTop: 8,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}
