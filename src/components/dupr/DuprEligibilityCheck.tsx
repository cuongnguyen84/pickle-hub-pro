// ============================================================================
// DuprEligibilityCheck — pre-form eligibility status panel
// ----------------------------------------------------------------------------
// Sprint B1.4 fix (2026-05-27). Renders 1 of 4 states above the registration
// form (works for both singles RegistrationForm and DoublesRegistrationForm):
//
//   1. LOADING — DUPR connection status not yet known
//   2. NO_DUPR — user has no SSO link AND table needs DUPR
//                → shows [Connect DUPR] button + explanation
//   3. ELIGIBLE — user has DUPR + rating is in range
//                → green "✓ Bạn đủ điều kiện — DUPR 3.39 ∈ [3.0, 4.5]"
//   4. NOT_ELIGIBLE — user has DUPR but rating is out of range
//                → red "✗ Không đủ điều kiện — DUPR 5.2 vượt giới hạn ≤ 4.5"
//
// Hidden entirely when ratingSource === 'self' (legacy behavior).
// Hidden also for non-authenticated users (parent shows login CTA).
// ============================================================================

import { CheckCircle2, XCircle, ShieldAlert, Loader2, Plug } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDuprConnection } from "@/hooks/useDuprConnection";
import { useI18n } from "@/i18n";
import { DuprChip } from "@/components/dupr/DuprChip";

interface DuprEligibilityCheckProps {
  /** Table's enforcement mode. Skip render when 'self'. */
  ratingSource?: "self" | "dupr" | "either";
  /** Doubles tournament reads dupr_doubles; singles reads dupr_singles. */
  isDoubles?: boolean;
  /** Lower bound (inclusive). Null = no lower bound. */
  minDupr?: number | null;
  /** Upper bound (inclusive). Null = no upper bound. */
  maxDupr?: number | null;
  /** When user has no DUPR + table requires it, this opens the SSO modal. */
  onConnectDupr?: () => void;
}

export function DuprEligibilityCheck({
  ratingSource = "self",
  isDoubles = true,
  minDupr = null,
  maxDupr = null,
  onConnectDupr,
}: DuprEligibilityCheckProps) {
  const { user } = useAuth();
  const { language } = useI18n();
  const { data: conn, isLoading } = useDuprConnection();
  const vi = language === "vi";

  // Legacy self-report tables → nothing to check.
  if (ratingSource === "self") return null;
  // Non-logged-in users see the login CTA in the parent — no card needed.
  if (!user) return null;
  if (isLoading) {
    return (
      <Frame tone="neutral">
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--tl-fg-3)" }} />
        <span>{vi ? "Đang kiểm tra DUPR…" : "Checking DUPR…"}</span>
      </Frame>
    );
  }

  // Sprint B fix (2026-05-27 v2) — singles fallback. If table is singles
  // and the player has no dupr_singles, fall back to dupr_doubles + mark
  // as approximation. Matches the seedFromDupr logic: most VN players
  // only have doubles ratings (singles tournaments rare). Doubles tables
  // stay strict — no fallback to singles.
  const primary = isDoubles ? conn?.doubles ?? null : conn?.singles ?? null;
  const fallback = isDoubles ? null : conn?.doubles ?? null;
  const rating = primary ?? fallback ?? null;
  const isApprox = primary == null && fallback != null;
  const hasSso = !!conn?.ssoConnected && rating != null;

  const rangeLabel =
    minDupr != null && maxDupr != null
      ? `${minDupr.toFixed(1)} – ${maxDupr.toFixed(1)}`
      : minDupr != null
        ? `≥ ${minDupr.toFixed(1)}`
        : maxDupr != null
          ? `≤ ${maxDupr.toFixed(1)}`
          : null;

  // ─── State 2: NO_DUPR ────────────────────────────────────────────────────
  if (!hasSso) {
    // For 'either' mode, no SSO is fine — user can self-report. Show a
    // soft nudge instead of a blocking gate.
    if (ratingSource === "either") {
      return (
        <Frame tone="info">
          <Plug className="h-4 w-4" style={{ color: "var(--tl-fg-2)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, marginBottom: 2 }}>
              {vi ? "Kết nối DUPR để rating tự fill" : "Connect DUPR for auto-fill"}
            </div>
            <div style={{ fontSize: 12, color: "var(--tl-fg-3)", lineHeight: 1.4 }}>
              {vi
                ? rangeLabel
                  ? `Giải này ưu tiên DUPR ${rangeLabel}. Bạn vẫn có thể tự kê khai bên dưới.`
                  : "Giải này ưu tiên DUPR. Bạn vẫn có thể tự kê khai bên dưới."
                : rangeLabel
                  ? `This tournament prefers DUPR ${rangeLabel}. You can still self-report below.`
                  : "This tournament prefers DUPR. You can still self-report below."}
            </div>
          </div>
          {onConnectDupr && (
            <button
              type="button"
              onClick={onConnectDupr}
              className="tl-btn"
              style={{ padding: "5px 10px", fontSize: 12, flexShrink: 0 }}
            >
              <Plug className="w-3 h-3" />
              {vi ? "Kết nối" : "Connect"}
            </button>
          )}
        </Frame>
      );
    }
    // 'dupr' mode — hard gate.
    return (
      <Frame tone="warn">
        <ShieldAlert className="h-5 w-5" style={{ color: "var(--tl-green)", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {vi ? "Cần kết nối DUPR" : "DUPR connection required"}
          </div>
          <div style={{ fontSize: 13, color: "var(--tl-fg-2)", lineHeight: 1.5, marginBottom: 10 }}>
            {vi
              ? rangeLabel
                ? `Giải này yêu cầu DUPR ${rangeLabel}. Kết nối để rating tự đồng bộ + xác nhận đủ điều kiện ngay.`
                : "Giải này yêu cầu DUPR đã xác thực. Kết nối để rating tự đồng bộ."
              : rangeLabel
                ? `This tournament requires DUPR ${rangeLabel}. Connect to sync your rating + verify eligibility instantly.`
                : "This tournament requires verified DUPR. Connect to sync your rating."}
          </div>
          {onConnectDupr && (
            <button
              type="button"
              onClick={onConnectDupr}
              className="tl-btn green"
              style={{ padding: "8px 14px", fontSize: 13 }}
            >
              <Plug className="w-4 h-4" />
              {vi ? "Kết nối DUPR" : "Connect DUPR"}
            </button>
          )}
        </div>
      </Frame>
    );
  }

  // ─── State 3 + 4: has SSO, check range ───────────────────────────────────
  const outOfRange =
    (minDupr != null && rating! < minDupr) || (maxDupr != null && rating! > maxDupr);

  if (outOfRange) {
    return (
      <Frame tone="error">
        <XCircle className="h-5 w-5" style={{ color: "var(--tl-live, #ef4444)", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>
              {vi ? "Bạn không đủ điều kiện" : "You're not eligible"}
            </span>
            <DuprChip
              doubles={isDoubles ? rating : null}
              singles={isDoubles ? null : rating}
              format={isDoubles ? "doubles" : "singles"}
            />
          </div>
          <div style={{ fontSize: 13, color: "var(--tl-fg-2)", lineHeight: 1.5 }}>
            {vi
              ? `DUPR của bạn (${rating!.toFixed(2)}) ngoài giới hạn của giải (yêu cầu ${rangeLabel}). Bạn không thể đăng ký.`
              : `Your DUPR (${rating!.toFixed(2)}) is outside this tournament's range (${rangeLabel}). You can't register.`}
          </div>
        </div>
      </Frame>
    );
  }

  // Sprint B fix — show DUPR doubles in chip when fallback applied
  // (otherwise the chip would say "DUPR singles 3.57" while the rating
  // actually came from doubles).
  const chipDoubles = isApprox || isDoubles ? rating : null;
  const chipSingles = !isApprox && !isDoubles ? rating : null;
  const chipFormat: "doubles" | "singles" = isApprox || isDoubles ? "doubles" : "singles";

  return (
    <Frame tone="success">
      <CheckCircle2
        className="h-5 w-5"
        style={{ color: "var(--tl-green)", flexShrink: 0 }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, color: "var(--tl-green)" }}>
            {vi ? "Bạn đủ điều kiện tham dự" : "You're eligible"}
          </span>
          <DuprChip doubles={chipDoubles} singles={chipSingles} format={chipFormat} />
          {isApprox && (
            <span
              style={{
                fontSize: 10,
                fontFamily: "'Geist Mono', monospace",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgb(96,165,250)",
                padding: "2px 6px",
                border: "1px solid rgba(96,165,250,0.4)",
                borderRadius: 4,
              }}
            >
              {vi ? "Ước tính" : "Approx"}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "var(--tl-fg-2)", lineHeight: 1.5 }}>
          {isApprox
            ? vi
              ? `Em dùng DUPR đôi ${rating!.toFixed(2)} làm ước tính (bạn chưa có DUPR đơn).${rangeLabel ? ` Nằm trong khoảng ${rangeLabel}.` : ""} Rating sẽ tự fill khi đăng ký.`
              : `Using doubles DUPR ${rating!.toFixed(2)} as an approximation (no singles rating yet).${rangeLabel ? ` Within ${rangeLabel}.` : ""} Rating auto-fills on registration.`
            : vi
              ? rangeLabel
                ? `DUPR ${rating!.toFixed(2)} nằm trong khoảng ${rangeLabel}. Rating sẽ tự fill khi đăng ký.`
                : `DUPR ${rating!.toFixed(2)} đã xác thực. Rating sẽ tự fill khi đăng ký.`
              : rangeLabel
                ? `DUPR ${rating!.toFixed(2)} is within ${rangeLabel}. Rating auto-fills on registration.`
                : `DUPR ${rating!.toFixed(2)} verified. Rating auto-fills on registration.`}
        </div>
      </div>
    </Frame>
  );
}

type Tone = "neutral" | "info" | "warn" | "success" | "error";

function Frame({ children, tone }: { children: React.ReactNode; tone: Tone }) {
  const styles: Record<Tone, { bg: string; border: string }> = {
    neutral: { bg: "var(--tl-bg-elev)", border: "var(--tl-border)" },
    info: { bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.3)" },
    warn: { bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.35)" },
    success: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.4)" },
    error: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.35)" },
  };
  const s = styles[tone];
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 14,
        borderRadius: "var(--tl-radius-lg)",
        background: s.bg,
        border: `1px solid ${s.border}`,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}
