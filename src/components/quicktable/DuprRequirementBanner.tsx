// ============================================================================
// DuprRequirementBanner — public-facing DUPR requirement notice
// ----------------------------------------------------------------------------
// Sprint B1.5 (2026-05-27). Mounted on QuickTableView above the registration
// form. Hidden when rating_source='self' (legacy behavior — no banner).
// ============================================================================

import { ShieldCheck, Info } from "lucide-react";
import { useI18n } from "@/i18n";

interface DuprRequirementBannerProps {
  ratingSource?: "self" | "dupr" | "either";
  minDupr?: number | null;
  maxDupr?: number | null;
}

export function DuprRequirementBanner({
  ratingSource = "self",
  minDupr,
  maxDupr,
}: DuprRequirementBannerProps) {
  const { language } = useI18n();
  const vi = language === "vi";

  if (ratingSource === "self") return null;

  const rangeLabel =
    minDupr != null && maxDupr != null
      ? `${minDupr.toFixed(1)} – ${maxDupr.toFixed(1)}`
      : minDupr != null
        ? `≥ ${minDupr.toFixed(1)}`
        : maxDupr != null
          ? `≤ ${maxDupr.toFixed(1)}`
          : null;

  const isStrict = ratingSource === "dupr";
  const Icon = isStrict ? ShieldCheck : Info;
  const accent = isStrict ? "var(--tl-green)" : "var(--tl-fg-2)";

  return (
    <div
      role="region"
      aria-label={vi ? "Yêu cầu rating DUPR" : "DUPR rating requirement"}
      style={{
        display: "flex",
        gap: 12,
        padding: 14,
        borderRadius: "var(--tl-radius-lg)",
        background: isStrict ? "rgba(34,197,94,0.06)" : "var(--tl-bg-elev)",
        border: `1px solid ${isStrict ? "rgba(34,197,94,0.35)" : "var(--tl-border)"}`,
      }}
    >
      <Icon className="w-5 h-5 flex-shrink-0" style={{ color: accent, marginTop: 2 }} />
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 500, color: "var(--tl-fg)" }}>
          {isStrict
            ? vi
              ? rangeLabel
                ? `Yêu cầu DUPR ${rangeLabel}`
                : "Yêu cầu kết nối DUPR"
              : rangeLabel
                ? `DUPR ${rangeLabel} required`
                : "DUPR connection required"
            : vi
              ? rangeLabel
                ? `Ưu tiên DUPR (${rangeLabel}) — tự kê khai vẫn được chấp nhận`
                : "Ưu tiên DUPR — tự kê khai vẫn được chấp nhận"
              : rangeLabel
                ? `DUPR preferred (${rangeLabel}) — self-reported also accepted`
                : "DUPR preferred — self-reported also accepted"}
        </div>
        <div style={{ color: "var(--tl-fg-3)", marginTop: 4 }}>
          {isStrict
            ? vi
              ? "Chỉ nhận đăng ký từ VĐV đã kết nối DUPR. Rating sẽ tự đồng bộ từ profile."
              : "Only players with DUPR linked can register. Rating auto-syncs from your profile."
            : vi
              ? "Kết nối DUPR để rating tự fill, hoặc tự kê khai như cũ."
              : "Connect DUPR for auto-fill, or self-report as usual."}
        </div>
      </div>
    </div>
  );
}
