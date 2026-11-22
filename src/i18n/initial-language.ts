import { isVietnamesePath } from "./loader";

// Same keys as I18nProvider. Kept here so the feed can restore a preference
// without exporting a helper from the component module.
const STORAGE_KEY = "pickleball-hub-language";
const GEO_LANG_KEY = "geo_detected_language";

/** English twin of /vi/feed. Geo and a stored "vi" preference must not paint it. */
export function isEnglishFeedPath(pathname: string): boolean {
  return pathname === "/feed" || pathname.startsWith("/feed/");
}

export function initialLanguageForPath(
  pathname: string,
  stored: string | null,
  geoCached: string | null,
): "en" | "vi" {
  if (isVietnamesePath(pathname)) return "vi";
  if (isEnglishFeedPath(pathname)) return "en";
  if (stored === "vi" || stored === "en") return stored;
  if (geoCached === "vi" || geoCached === "en") return geoCached;
  return "en";
}

/** Language to restore after leaving /feed. Does not write storage. */
export function languageChosenOutsideFeed(): "en" | "vi" | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "vi") return stored;
    const geo = sessionStorage.getItem(GEO_LANG_KEY);
    if (geo === "en" || geo === "vi") return geo;
  } catch {
    return null;
  }
  return null;
}
