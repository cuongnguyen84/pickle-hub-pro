// Phần dùng chung client (web) ↔ edge function site-assistant: loại trang và
// danh sách link nội bộ được phép gợi ý. Không import gì — Deno, Vite và
// vitest đều nạp được file này. iOS giữ bản sao trong AssistantRoutes.swift.

export const PAGE_TYPES = [
  "home", "tournament", "tools", "live_video", "blog_news", "venues",
  "players", "shop", "community", "account", "general",
] as const;
export type PageType = typeof PAGE_TYPES[number];

export const isPageType = (v: unknown): v is PageType =>
  typeof v === "string" && (PAGE_TYPES as readonly string[]).includes(v);

/** Route nội bộ trợ lý được phép gợi ý (không tiền tố /vi — client tự thêm theo ngôn ngữ). */
export const SITE_LINKS = [
  "/", "/feed", "/tournaments", "/tools", "/tools/quick-tables", "/tools/quick-tables/chat",
  "/tools/team-match", "/tools/doubles-elimination", "/tools/flex-tournament", "/su-kien", "/social",
  "/live", "/videos", "/blog", "/news", "/san", "/san/them", "/rankings", "/rankings/ppa-tour", "/dupr",
  "/tim-ban-choi", "/clubs", "/forum", "/shop", "/account", "/account/my-tournaments", "/notifications",
  "/search", "/match/new", "/about", "/contact", "/login",
] as const;
const LINK_SET = new Set<string>(SITE_LINKS);

/**
 * Chuẩn hoá + kiểm link do model đề xuất. Chỉ nhận đường dẫn tương đối nằm
 * trong SITE_LINKS (bỏ tiền tố /vi, dấu / cuối); mọi thứ khác (URL tuyệt đối,
 * //host, query, hash, javascript:…) → null.
 */
export function safeLink(href: unknown): string | null {
  if (typeof href !== "string" || href.length > 80 || !href.startsWith("/") || href.startsWith("//")) return null;
  if (/[?#\\\s]/.test(href)) return null;
  let p = href === "/vi" ? "/" : href.startsWith("/vi/") ? href.slice(3) : href;
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return LINK_SET.has(p) ? p : null;
}
