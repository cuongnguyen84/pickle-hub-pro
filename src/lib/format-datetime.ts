// Date/time display helpers for The Line pages.
// Moved verbatim from src/pages/preview/_shell.tsx when the retired
// /preview/the-line/* pages were deleted (CLOSE-01).

export const formatDate = (iso: string | null | undefined): { d: string; m: string; full: string } => {
  if (!iso) return { d: "—", m: "—", full: "" };
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { d: "—", m: "—", full: "" };
  return {
    d: dt.getDate().toString().padStart(2, "0"),
    m: dt.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    full: dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  };
};

export const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

export const formatRelative = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const dt = new Date(iso).getTime();
  if (Number.isNaN(dt)) return "";
  const diff = dt - Date.now();
  const absMin = Math.abs(Math.round(diff / 60000));
  if (absMin < 1) return "now";
  if (absMin < 60) return diff > 0 ? `in ${absMin}m` : `${absMin}m ago`;
  const hrs = Math.round(absMin / 60);
  if (hrs < 24) return diff > 0 ? `in ${hrs}h` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return diff > 0 ? `in ${days}d` : `${days}d ago`;
};
