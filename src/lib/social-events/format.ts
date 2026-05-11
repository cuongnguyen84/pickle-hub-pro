// ============================================================================
// social-events/format.ts — VN-friendly date/time + price helpers
// ----------------------------------------------------------------------------
// Renders "Thứ Bảy, 17/05/2026 — 19:00 đến 21:30" for event detail page
// + countdown helpers ("Còn 2 ngày", "Còn 3 giờ", "Đã bắt đầu").
//
// All Date arithmetic uses Asia/Ho_Chi_Minh implicitly via the locale
// option `timeZone: "Asia/Ho_Chi_Minh"` on Intl.DateTime calls. Internally
// JS Date is UTC-based.
// ============================================================================

const TZ = "Asia/Ho_Chi_Minh";

/**
 * "Thứ Bảy, 17/05/2026 — 19:00 đến 21:30"  (vi)
 * "Sat, 17/05/2026 — 19:00 to 21:30"        (en)
 */
export function formatEventDateRange(
  startIso: string,
  endIso: string,
  lang: "vi" | "en",
): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startIso} — ${endIso}`;
  }
  const locale = lang === "vi" ? "vi-VN" : "en-GB";
  const weekday = start.toLocaleDateString(locale, {
    weekday: "long",
    timeZone: TZ,
  });
  const date = start.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  });
  const startTime = start.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });
  const endTime = end.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });
  const sep = lang === "vi" ? "đến" : "to";
  // Title-case the Vietnamese weekday so "thứ bảy" → "Thứ Bảy" (vi-VN
  // returns lowercase from toLocaleDateString as of Intl spec).
  const niceWeekday = lang === "vi" ? titleCaseVi(weekday) : capitalize(weekday);
  return `${niceWeekday}, ${date} — ${startTime} ${sep} ${endTime}`;
}

function titleCaseVi(s: string): string {
  return s
    .split(" ")
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}
function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/**
 * Countdown phrase relative to "now". Returns one of:
 *   started   — event start_at <= now <= end_at
 *   ended     — end_at < now
 *   "{n} ngày" / "{n} giờ" / "{n} phút"
 *
 * Pure: takes `now` as arg so tests can pin time.
 */
export interface CountdownResult {
  state: "upcoming" | "started" | "ended";
  /** Display text, or null when state ≠ upcoming. */
  text: string | null;
  /** Whole-day count when >= 1 day; otherwise null. */
  days: number | null;
  /** Whole-hour count when 1 <= hours < 24; otherwise null. */
  hours: number | null;
  /** Minute count when < 1 hour and upcoming; otherwise null. */
  minutes: number | null;
}

export function computeCountdown(
  startIso: string,
  endIso: string,
  lang: "vi" | "en",
  now: Date = new Date(),
): CountdownResult {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const n = now.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { state: "ended", text: null, days: null, hours: null, minutes: null };
  }
  if (n >= end) {
    return { state: "ended", text: null, days: null, hours: null, minutes: null };
  }
  if (n >= start) {
    return { state: "started", text: null, days: null, hours: null, minutes: null };
  }
  const diffMs = start - n;
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) {
    return {
      state: "upcoming",
      text: lang === "vi" ? `${days} ngày` : `${days} day${days === 1 ? "" : "s"}`,
      days,
      hours: null,
      minutes: null,
    };
  }
  if (hours >= 1) {
    return {
      state: "upcoming",
      text: lang === "vi" ? `${hours} giờ` : `${hours} hour${hours === 1 ? "" : "s"}`,
      days: null,
      hours,
      minutes: null,
    };
  }
  const m = Math.max(1, minutes);
  return {
    state: "upcoming",
    text: lang === "vi" ? `${m} phút` : `${m} minute${m === 1 ? "" : "s"}`,
    days: null,
    hours: null,
    minutes: m,
  };
}

/** "120.000₫", "50.000₫", or the localized "Free" string when 0. */
export function formatPriceVnd(amount: number, lang: "vi" | "en", freeLabel: string): string {
  if (!amount || amount <= 0) return freeLabel;
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  return `${amount.toLocaleString(locale)}₫`;
}

/** "3.5 — 4.0" or just "3.5+" or null when both bounds null. */
export function formatLevelRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min.toFixed(1)} — ${max.toFixed(1)}`;
  if (min != null) return `${min.toFixed(1)}+`;
  // Only max provided
  return `≤ ${max!.toFixed(1)}`;
}

/** Replace {key} placeholders in a translation string with values. */
export function interp(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? `{${k}}` : String(v);
  });
}
