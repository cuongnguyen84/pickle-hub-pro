// ============================================================================
// DuprChip — small reusable chip showing a player's DUPR rating
// ----------------------------------------------------------------------------
// Sprint A14 (2026-05-27). Extracted from HeaderDuprBadge's connected-state
// pill so PlayerProfile, FeedBlogCard, FeedNewsCard, PlayersNearRating and
// any future surface can drop in the same visual.
//
// Differences vs HeaderDuprBadge:
//   - Pure presentational (no auth / hook dependency)
//   - Accepts singles + doubles separately, or a single combined rating
//   - Optional `stale` prop renders a "◐" marker (rating not synced > 30d)
//   - Optional `size` prop ("xs" | "sm") for inline vs prominent placement
//   - No onClick — caller wraps in <Link> / <button> when needed
// ============================================================================

import { useI18n } from "@/i18n";

export type DuprChipFormat = "singles" | "doubles" | "both";
export type DuprChipSize = "xs" | "sm";

interface DuprChipProps {
  /** Singles rating. Required when format is "singles" or "both". */
  singles?: number | null;
  /** Doubles rating. Required when format is "doubles" or "both". */
  doubles?: number | null;
  /** Which rating(s) to show. Default "doubles". */
  format?: DuprChipFormat;
  /** When true, append a ◐ marker indicating the rating is stale (>30d). */
  stale?: boolean;
  /** Visual size. "xs" (default) for inline, "sm" for emphasis. */
  size?: DuprChipSize;
  /** Optional className passthrough. */
  className?: string;
  /** When provided, override the default tooltip. */
  title?: string;
}

export function DuprChip({
  singles,
  doubles,
  format = "doubles",
  stale = false,
  size = "xs",
  className,
  title,
}: DuprChipProps) {
  const { language } = useI18n();
  const vi = language === "vi";

  // Resolve the visible rating string per format. Skip render entirely when
  // the required value is missing — saves callers an `&&` guard.
  let display: string | null = null;
  if (format === "singles" && singles != null) display = singles.toFixed(2);
  else if (format === "doubles" && doubles != null) display = doubles.toFixed(2);
  else if (format === "both" && (singles != null || doubles != null)) {
    const s = singles != null ? singles.toFixed(2) : "—";
    const d = doubles != null ? doubles.toFixed(2) : "—";
    display = `${s} / ${d}`;
  }
  if (display === null) return null;

  const fontSize = size === "sm" ? 12 : 11;
  const padY = size === "sm" ? 3 : 2;
  const padX = size === "sm" ? 8 : 6;

  const ariaLabel =
    format === "both"
      ? `DUPR ${vi ? "đơn / đôi" : "singles / doubles"} ${display}`
      : `DUPR ${format === "singles" ? (vi ? "đơn" : "singles") : vi ? "đôi" : "doubles"} ${display}`;

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      title={title ?? (stale ? (vi ? "Chưa đồng bộ trong 30 ngày" : "Not synced in 30 days") : ariaLabel)}
      className={`inline-flex items-center gap-1 rounded-full border ${className ?? ""}`}
      style={{
        borderColor: "rgba(34,197,94,0.4)",
        background: "rgba(34,197,94,0.08)",
        color: "rgb(34,197,94)",
        fontFamily: "'Geist Mono', monospace",
        letterSpacing: "0.02em",
        fontSize,
        padding: `${padY}px ${padX}px`,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}
    >
      <span style={{ color: "var(--tl-fg-3)" }}>DUPR</span>
      <span>{display}</span>
      {stale && (
        <span aria-hidden="true" style={{ color: "var(--tl-fg-3)", fontSize: fontSize - 2 }}>
          ◐
        </span>
      )}
    </span>
  );
}

// NOTE — isDuprStale helper lives at src/lib/dupr/staleness.ts. Kept
// separate from this file so DuprChip stays component-only for Vite
// fast-refresh.
