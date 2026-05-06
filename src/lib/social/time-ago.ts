// ============================================================================
// time-ago.ts — Vietnamese relative time formatter
// ----------------------------------------------------------------------------
// Returns strings like "5 phút trước", "2 giờ trước", "Hôm qua".
// Used by social notification list. Pure function, no deps.
// ============================================================================

const MIN_S = 60;
const HR_S = 60 * 60;
const DAY_S = 24 * 60 * 60;

export function formatVietnameseTimeAgo(input: string | Date | number): string {
  const date = input instanceof Date
    ? input
    : typeof input === "number" ? new Date(input) : new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);

  if (diffSec < 0) {
    // Future date — degrade gracefully
    return "vừa xong";
  }
  if (diffSec < 30) return "vừa xong";
  if (diffSec < MIN_S) return `${diffSec} giây trước`;
  if (diffSec < HR_S) {
    const m = Math.floor(diffSec / MIN_S);
    return `${m} phút trước`;
  }
  if (diffSec < DAY_S) {
    const h = Math.floor(diffSec / HR_S);
    return `${h} giờ trước`;
  }
  if (diffSec < 2 * DAY_S) return "Hôm qua";
  if (diffSec < 7 * DAY_S) {
    const d = Math.floor(diffSec / DAY_S);
    return `${d} ngày trước`;
  }
  // > 1 week — show date
  return date.toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}
