// ============================================================================
// RoundFairnessCard — per-round + overall combined-DUPR balance display
// ----------------------------------------------------------------------------
// Sprint C4 (2026-05-27). Mounted on the SocialEventMatchmaking page once
// the organizer hits "Generate". Hidden when balanced pairing wasn't applied
// (coverage too low — caller still shows a banner explaining the fallback).
// ============================================================================

import { Sparkles } from "lucide-react";
import { useI18n } from "@/i18n";
import type { MMSchedule } from "@/lib/matchmaking";

interface RoundFairnessCardProps {
  schedule: MMSchedule;
}

export function RoundFairnessCard({ schedule }: RoundFairnessCardProps) {
  const { language } = useI18n();
  const vi = language === "vi";

  if (!schedule.balancedPairingApplied) return null;

  const fairnessValues = schedule.rounds
    .map((r) => r.fairness)
    .filter((v): v is number => typeof v === "number");
  if (fairnessValues.length === 0) return null;

  const avg = fairnessValues.reduce((s, v) => s + v, 0) / fairnessValues.length;
  const avgPct = Math.round(avg * 100);
  const coveragePct = Math.round((schedule.duprCoverage ?? 0) * 100);

  return (
    <div
      role="region"
      aria-label={vi ? "Độ cân bằng pairing" : "Pairing fairness"}
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
        <span
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--tl-green)",
          }}
        >
          {vi ? "Cân bằng theo DUPR" : "DUPR-balanced pairing"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 10 }}>
        <Stat
          label={vi ? "Độ cân bằng TB" : "Avg fairness"}
          value={`${avgPct}%`}
          accent={avgPct >= 80 ? "green" : avgPct >= 60 ? undefined : "warn"}
        />
        <Stat
          label={vi ? "Phủ DUPR" : "DUPR coverage"}
          value={`${coveragePct}%`}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          marginTop: 8,
        }}
      >
        {schedule.rounds.map((r) => {
          const f = r.fairness;
          if (f == null) return null;
          const pct = Math.round(f * 100);
          const color =
            pct >= 80
              ? "var(--tl-green)"
              : pct >= 60
                ? "var(--tl-fg-2)"
                : "var(--tl-live)";
          return (
            <span
              key={r.round}
              title={
                vi
                  ? `Vòng ${r.round}: ${pct}% cân bằng`
                  : `Round ${r.round}: ${pct}% balanced`
              }
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.04em",
                padding: "3px 7px",
                borderRadius: 999,
                border: `1px solid ${color}`,
                color,
                background: "transparent",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              R{r.round} {pct}%
            </span>
          );
        })}
      </div>
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
  accent?: "green" | "warn";
}) {
  const color =
    accent === "green"
      ? "var(--tl-green)"
      : accent === "warn"
        ? "var(--tl-live)"
        : "var(--tl-fg)";
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: 18,
          fontFamily: "'Geist Mono', monospace",
          fontVariantNumeric: "tabular-nums",
          color,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--tl-fg-3)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

interface CoverageBannerProps {
  schedule: MMSchedule;
  /** When true, balanced pairing was requested but coverage too low. */
  requestedButFallback: boolean;
}

export function MexicanoCoverageBanner({
  schedule,
  requestedButFallback,
}: CoverageBannerProps) {
  const { language } = useI18n();
  const vi = language === "vi";

  if (!requestedButFallback) return null;
  const coveragePct = Math.round((schedule.duprCoverage ?? 0) * 100);

  return (
    <div
      role="status"
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: "var(--tl-radius-lg)",
        background: "rgba(59,130,246,0.06)",
        border: "1px solid rgba(59,130,246,0.3)",
        fontSize: 12,
        color: "var(--tl-fg-2)",
        lineHeight: 1.5,
      }}
    >
      {vi
        ? `Chỉ ${coveragePct}% người chơi có DUPR — pairing tự động chuyển về random shuffle để tránh bias. Mời nhiều người connect DUPR để có pairing cân bằng hơn.`
        : `Only ${coveragePct}% of players have DUPR — pairing fell back to random shuffle to avoid bias. Invite more players to connect DUPR for balanced pairings.`}
    </div>
  );
}
