// ============================================================================
// burn-alert — pure decision logic for OPS-04 inc3 (error-budget burn alerts)
// ----------------------------------------------------------------------------
// Two layers on top of the per-fingerprint spike alert (D2 converged spec,
// docs/proposals/auto-milestone-run-2026-07):
//
//   P1 "volume"  — total client_errors in the last 60 min, FINGERPRINT-
//                  INDEPENDENT. A multi-fingerprint outage (10 different
//                  errors × 2 each) previously produced ZERO alerts because
//                  the spike alert thresholds per fingerprint. Always sends,
//                  even during quiet hours.
//   P2 "budget"  — 24h detection window measured against the 30-day rolling
//                  error budget from docs/slo.md (budget ≠ detection — two
//                  separate windows by design). Suppressed during night
//                  quiet hours (22:00–07:00 ICT); if still burning at 07:00
//                  the next run sends it.
//
// State-transition dedup: alerts fire on ok→burning transitions only, and a
// recovery message is REQUIRED on burning→ok (an alert with no recovery
// leaves Cuong guessing whether it self-healed). Hysteresis so a value
// hovering at the threshold doesn't flap: P1 exits below half the enter
// threshold, P2 enters at ≥2× daily budget and exits below 1×.
//
// Pure module — no Deno/Supabase imports — so vitest can cover every branch
// (supabase/functions/_shared/__tests__/burn-alert.test.ts).
// ============================================================================

export interface BurnConfig {
  /** P1: total client errors in the last 60 min that mean "something is on fire". */
  volumeP1Threshold: number;
  /** 30-day rolling client-error budget (docs/slo.md §Error budget policy). */
  budget30d: number;
  /** P2 enters when count24h ≥ enterFactor × (budget30d / 30). */
  budgetEnterFactor: number;
  /** P2 recovers when count24h < exitFactor × (budget30d / 30). */
  budgetExitFactor: number;
}

export const DEFAULT_BURN_CONFIG: BurnConfig = {
  // ponytail: calibration knobs, not physics. Baseline measured 2026-08-03:
  // ~58 events/24h, busiest hour 23 events. Volume 25/h ≈ "worse than the
  // worst normal hour"; budget 3000/30d ≈ 100/day ≈ 1.7× baseline.
  volumeP1Threshold: 25,
  budget30d: 3000,
  budgetEnterFactor: 2,
  budgetExitFactor: 1,
};

export type BurnState = "ok" | "burning";

export interface BurnDecision {
  sloKey: "client_errors_volume" | "client_errors_budget";
  prevState: BurnState;
  newState: BurnState;
  /** null = no message this run (steady state, or quiet-hours hold). */
  alert: "p1" | "p2" | "recovery" | null;
  /** true when a P2 transition happened but quiet hours held the message —
   * caller must NOT persist the transition, so the next daytime run re-fires. */
  heldByQuietHours: boolean;
  value: number;
  threshold: number;
  burnRate: number;
}

/** 22:00–07:00 Asia/Ho_Chi_Minh (UTC+7, no DST). */
export function isQuietHoursICT(now: Date): boolean {
  const hourICT = (now.getUTCHours() + 7) % 24;
  return hourICT >= 22 || hourICT < 7;
}

export function evalBurn(
  count60m: number,
  count24h: number,
  prev: { volume: BurnState; budget: BurnState },
  now: Date,
  cfg: BurnConfig = DEFAULT_BURN_CONFIG,
): BurnDecision[] {
  const quiet = isQuietHoursICT(now);
  const dailyBudget = cfg.budget30d / 30;
  const burnRate = dailyBudget > 0 ? count24h / dailyBudget : 0;

  // P1 volume — hysteresis: enter ≥ threshold, exit < threshold/2.
  let volumeState: BurnState = prev.volume;
  if (prev.volume === "ok" && count60m >= cfg.volumeP1Threshold) volumeState = "burning";
  else if (prev.volume === "burning" && count60m < cfg.volumeP1Threshold / 2) volumeState = "ok";
  const volumeAlert: BurnDecision["alert"] =
    volumeState !== prev.volume ? (volumeState === "burning" ? "p1" : "recovery") : null;

  // P2 budget — enter ≥ enterFactor×daily, exit < exitFactor×daily.
  let budgetState: BurnState = prev.budget;
  if (prev.budget === "ok" && burnRate >= cfg.budgetEnterFactor) budgetState = "burning";
  else if (prev.budget === "burning" && burnRate < cfg.budgetExitFactor) budgetState = "ok";
  let budgetAlert: BurnDecision["alert"] =
    budgetState !== prev.budget ? (budgetState === "burning" ? "p2" : "recovery") : null;

  // Night quiet applies to P2 ENTRY only. P1 always sends; recovery always
  // sends (it closes an already-noisy incident, silence would be worse).
  let heldBudget = false;
  if (budgetAlert === "p2" && quiet) {
    heldBudget = true;
    budgetAlert = null;
    budgetState = prev.budget; // don't persist — re-evaluate (and fire) after 07:00
  }

  return [
    {
      sloKey: "client_errors_volume",
      prevState: prev.volume,
      newState: volumeState,
      alert: volumeAlert,
      heldByQuietHours: false,
      value: count60m,
      threshold: cfg.volumeP1Threshold,
      burnRate,
    },
    {
      sloKey: "client_errors_budget",
      prevState: prev.budget,
      newState: budgetState,
      alert: budgetAlert,
      heldByQuietHours: heldBudget,
      value: count24h,
      threshold: Math.round(cfg.budgetEnterFactor * dailyBudget),
      burnRate,
    },
  ];
}

/**
 * First line must carry the full meaning on a lock screen (D2: "copy VI
 * dòng-đầu-tải-đủ-nghĩa, P1/P2 bằng chữ"). Returns plain text lines —
 * caller escapes for MarkdownV2.
 */
export function burnMessageLines(d: BurnDecision, cfg: BurnConfig = DEFAULT_BURN_CONFIG): string[] {
  if (d.alert === "p1") {
    return [
      `🔥 P1 — Lỗi client tăng vọt: ${d.value} lỗi/60 phút (đa fingerprint, ngưỡng ${d.threshold})`,
      ``,
      `Khác spike theo fingerprint: đây là TỔNG mọi loại lỗi — hình dạng của outage nhiều lỗi khác nhau.`,
      `Burn-rate 24h hiện tại: ${d.burnRate.toFixed(1)}× ngân sách ngày.`,
    ];
  }
  if (d.alert === "p2") {
    return [
      `🟠 P2 — Đốt error budget: ${d.value} lỗi/24h = ${d.burnRate.toFixed(1)}× ngân sách ngày (budget 30 ngày: ${cfg.budget30d})`,
      ``,
      `Giữ nhịp này thì cháy budget tháng trong ~${d.burnRate > 0 ? Math.round(30 / d.burnRate) : "—"} ngày.`,
      `Theo docs/slo.md: cháy budget = dừng feature work domain đó tới khi chẩn đoán xong.`,
    ];
  }
  if (d.alert === "recovery") {
    const label = d.sloKey === "client_errors_volume" ? "volume 60 phút" : "burn-rate 24h";
    return [
      `✅ Hồi phục — ${label} về dưới ngưỡng: ${d.value} (burn-rate ${d.burnRate.toFixed(1)}×)`,
    ];
  }
  return [];
}
