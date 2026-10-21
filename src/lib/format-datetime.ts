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

export type RelativeLang = "vi" | "en";

/**
 * Relative timestamp for a moment in the past or the future.
 *
 * The Vietnamese strings were missing entirely until 2026-08-19: this returned
 * "10h ago" on every Vietnamese page, across nine surfaces, for an audience
 * that is ~95% Vietnamese. Vietnamese puts the unit before the marker and does
 * not abbreviate it the way English does, so "5m ago" is "5 phút trước" and
 * "in 5m" is "trong 5 phút" — so the strings differ in shape, not just in
 * vocabulary, and cannot be produced by swapping two words.
 *
 * The Vietnamese wording is taken verbatim from the private copy that used to
 * live in Index.tsx, which has been serving the homepage for months. Adopting
 * it rather than inventing a second phrasing means folding that copy into this
 * one changes nothing a reader sees.
 *
 * `lang` defaults to "en" so existing callers keep their exact output until
 * they pass a locale; every caller in this repo now does.
 */
export const formatRelative = (
  iso: string | null | undefined,
  lang: RelativeLang = "en",
): string => {
  if (!iso) return "";
  const dt = new Date(iso).getTime();
  if (Number.isNaN(dt)) return "";
  const diff = dt - Date.now();
  const vi = lang === "vi";
  const absMin = Math.abs(Math.round(diff / 60000));
  if (absMin < 1) return vi ? "vừa xong" : "now";
  const unit = (n: number, viWord: string, enLetter: string) =>
    vi
      ? diff > 0
        ? `trong ${n} ${viWord}`
        : `${n} ${viWord} trước`
      : diff > 0
        ? `in ${n}${enLetter}`
        : `${n}${enLetter} ago`;
  if (absMin < 60) return unit(absMin, "phút", "m");
  const hrs = Math.round(absMin / 60);
  if (hrs < 24) return unit(hrs, "giờ", "h");
  const days = Math.round(hrs / 24);
  return unit(days, "ngày", "d");
};
