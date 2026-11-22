import { isVietnamesePath } from "@/i18n/loader";

/** /feed is English. /vi/feed is Vietnamese. The URL wins over geo and storage. */
export function feedRouteLanguage(pathname: string): "en" | "vi" {
  return isVietnamesePath(pathname) ? "vi" : "en";
}

/**
 * The timeline query is fresh for 5 minutes (staleTime), not a live socket.
 * Posts and videos older than 14 days are hidden. Finished results can stay
 * longer when the 14-day window has none.
 */
export function feedFooterCopy(language: "en" | "vi"): string {
  if (language === "vi") {
    return "Làm mới mỗi 5 phút · Bài viết và video ẩn sau 14 ngày · Kết quả có thể cũ hơn";
  }
  return "Refreshes every 5 minutes · Posts and videos older than 14 days are hidden · Results can be older";
}
