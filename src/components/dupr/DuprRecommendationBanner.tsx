// ============================================================================
// DuprRecommendationBanner — soft recommendation banner (NOT a hard gate)
// ----------------------------------------------------------------------------
// DUPR Phase 3 (2026-05-29). Council 4-voice review explicitly warned that
// a "Yêu cầu DUPR" banner on public share pages would filter out the ~95%
// of Vietnamese audience that has no DUPR account. This banner deliberately
// uses SOFT language ("Khuyến nghị" / "Recommended") and includes a CTA to
// create a DUPR account for free.
//
// Visible ONLY when:
//   - rating_source != 'self'    (organizer opted in to DUPR)
//   - has either min OR max DUPR (a range to display)
// ============================================================================

import { Sparkles, ExternalLink } from "lucide-react";
import { useI18n } from "@/i18n";

interface Props {
  ratingSource: "self" | "dupr" | "either" | null | undefined;
  minDupr: number | null;
  maxDupr: number | null;
  /** Optional sign-up link override. */
  signupHref?: string;
}

const DEFAULT_SIGNUP = "https://mydupr.com/signup";

export function DuprRecommendationBanner({
  ratingSource,
  minDupr,
  maxDupr,
  signupHref = DEFAULT_SIGNUP,
}: Props) {
  const { language } = useI18n();
  const vi = language === "vi";

  if (!ratingSource || ratingSource === "self") return null;
  if (minDupr == null && maxDupr == null) return null;

  const range =
    minDupr != null && maxDupr != null
      ? `${minDupr.toFixed(2)} – ${maxDupr.toFixed(2)}`
      : minDupr != null
        ? `≥ ${minDupr.toFixed(2)}`
        : `≤ ${maxDupr!.toFixed(2)}`;

  const lead = ratingSource === "dupr"
    ? (vi ? "Khuyến nghị" : "Recommended")
    : (vi ? "Ưu tiên" : "Preferred");

  return (
    <div
      role="region"
      aria-label={vi ? "Khuyến nghị DUPR" : "DUPR recommendation"}
      style={{
        marginTop: 14,
        marginBottom: 4,
        padding: "10px 14px",
        borderRadius: "var(--tl-radius)",
        background: "rgba(34,197,94,0.06)",
        border: "1px solid rgba(34,197,94,0.25)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        fontSize: 13,
      }}
    >
      <Sparkles className="w-4 h-4" style={{ color: "var(--tl-green)", flexShrink: 0 }} />
      <span style={{ color: "var(--tl-fg-2)", lineHeight: 1.4 }}>
        <strong style={{ color: "var(--tl-fg)" }}>{lead} DUPR {range}</strong>
        {" — "}
        {vi
          ? "Liên kết DUPR để được seed tự động và lên điểm sau giải."
          : "Link DUPR for auto-seeding and post-tournament rating updates."}
      </span>
      <a
        href={signupHref}
        target="_blank"
        rel="noopener noreferrer"
        className="tl-btn"
        style={{ fontSize: 12, padding: "4px 10px", whiteSpace: "nowrap" }}
      >
        {vi ? "Tạo DUPR miễn phí" : "Create DUPR account"}
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
