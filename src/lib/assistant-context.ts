/**
 * Context registry cho trợ lý AI nổi quanh giải (brief 27/10/2026).
 *
 * Mỗi màn hình trong phạm vi tự khai báo ngữ cảnh của nó bằng
 * useAssistantContext(); nút float đọc lại bằng useCurrentAssistantContext().
 * Tầng chat không tự suy đoán từ DOM. Server chỉ tin share_id: dữ liệu giải và
 * vai trò người dùng do edge function tournament-assistant tự đọc từ DB.
 */
import { useEffect, useSyncExternalStore } from "react";
import { withoutLocale } from "@/lib/locale-path";
import { cleanCtx, MAX_CTX_CHARS, type PageType as SitePage } from "../../supabase/functions/site-assistant/shared";

export type { SitePage };

export type AssistantScreen =
  | "tournament_hub"
  | "tournament_detail"
  | "quick_table_hub"
  | "quick_table_detail"
  | "quick_table_groups"
  | "quick_table_results"
  | "quick_table_registration"
  | "quick_table_setup"
  | "quick_table_parent";

export interface AssistantContext {
  screen?: AssistantScreen;
  /** nhãn ngắn hiện trên tin nhắn, vd "Giải X — Bảng B" */
  label?: string;
  tournament?: { kind: "quick_table"; share_id: string; name?: string } | { kind: "tournament"; slug: string; name?: string };
  entity?: { kind: "group" | "match" | "team"; id: string; name: string };
  /** tóm tắt trang không có dữ liệu ở server (giải livestream, danh sách giải) */
  summary?: string;
  /** chỉ để chọn chip gợi ý: giải chưa chia bảng / đã chia */
  stage?: "setup" | "drawn";
  /**
   * Dữ kiện ĐANG HIỂN THỊ trên màn hình (key → giá trị ngắn), chỉ lấy từ dữ liệu
   * trang đã tải — không gọi mạng thêm, không email/SĐT người khác, không token.
   */
  facts?: Facts;
}

export type Facts = Record<string, string | number | boolean | null | undefined>;

/**
 * facts → "key: value" từng dòng: bỏ giá trị rỗng, làm sạch (ký tự điều khiển,
 * < >, khoảng trắng), mỗi giá trị ≤ 300 ký tự, tổng ≤ max — cắt ở ranh giới
 * dòng theo đúng thứ tự khai báo nên cùng input luôn ra cùng chuỗi.
 */
export function serializeFacts(facts: Facts | undefined, max = MAX_CTX_CHARS): string {
  const out: string[] = [];
  let len = 0;
  for (const [k, v] of Object.entries(facts ?? {})) {
    if (v == null || v === "") continue;
    const val = cleanCtx(String(v), 300).replace(/\s+/g, " ").trim();
    if (!val) continue;
    const line = `${cleanCtx(k, 40).trim().replace(/\s+/g, "_")}: ${val}`;
    if (len + line.length + 1 > max) break;
    out.push(line);
    len += line.length + 1;
  }
  return out.join("\n");
}

/** Ngữ cảnh chung cho MỌI route (kể cả trang chưa khai báo): đọc từ trang đang hiển thị. */
export function genericFacts(loggedIn: boolean): Facts {
  const h1 = typeof document !== "undefined" ? document.querySelector("main h1, h1")?.textContent ?? "" : "";
  return {
    route: typeof window !== "undefined" ? window.location.pathname : "",
    title: typeof document !== "undefined" ? document.title : "",
    h1: h1.trim().slice(0, 160),
    logged_in: loggedIn ? "yes" : "no",
  };
}

/** Chuỗi facts gửi server: dữ kiện màn hình khai báo trước, dữ kiện chung sau; tổng ≤ trần trừ phần summary. */
export function assistantFacts(ctx: AssistantContext | null, loggedIn: boolean): string {
  const budget = MAX_CTX_CHARS - Math.min(ctx?.summary?.length ?? 0, 600);
  return serializeFacts({ ...ctx?.facts, ...genericFacts(loggedIn) }, budget);
}

/**
 * Màn hình theo route — ngoài các route này nút không hiện. Chat tạo giải
 * (/tools/quick-tables/chat) chính là khung chat nên không đặt nút đè lên;
 * màn trọng tài và /live/* toàn màn hình nên cũng không.
 */
export function assistantScreenFor(pathname: string): AssistantScreen | null {
  const p = withoutLocale(pathname).replace(/\/+$/, "") || "/";
  if (p === "/tournaments") return "tournament_hub";
  if (/^\/tournament\/[^/]+$/.test(p)) return "tournament_detail";
  if (p === "/tools/quick-tables") return "quick_table_hub";
  if (p === "/tools/quick-tables/chat" || p.startsWith("/tools/quick-tables/referee/")) return null;
  if (/^\/tools\/quick-tables\/parent\/[^/]+$/.test(p)) return "quick_table_parent";
  if (/^\/tools\/quick-tables\/[^/]+\/setup$/.test(p)) return "quick_table_setup";
  if (/^\/tools\/quick-tables\/[^/]+$/.test(p)) return "quick_table_detail";
  return null;
}

// Trang không đặt nút trợ lý chung: tự là khung chat / toàn màn hình / có
// thanh hành động dính đáy / embed / admin / luồng đăng nhập.
const SITE_HIDDEN = [
  /^\/tools\/quick-tables\/(chat|referee)(\/|$)/, /\/score$/, /^\/live\/./, /^\/(su-kien|social)\/[^/]+\/live$/,
  /^\/(embed|share|admin|creator|seller|proto|auth|onboarding|login|dang-ky|khoi-phuc-dang-ky|tin-nhan)(\/|$)/,
  /^\/shop\/(product|cart|checkout|order|orders|sell)(\/|$)/,
];

const SITE_PAGES: [RegExp, SitePage][] = [
  [/^\/(feed)?$/, "home"],
  [/^\/(tools|quick-tables|tournaments?)(\/|$)/, "tools"],
  [/^\/(live|videos|watch|livestream)(\/|$)/, "live_video"],
  [/^\/(blog|news|authors)(\/|$)/, "blog_news"],
  [/^\/san(\/|$)/, "venues"],
  [/^\/(rankings|dupr|nguoi-choi|u|tim-ban-choi)(\/|$)/, "players"],
  [/^\/shop(\/|$)/, "shop"],
  [/^\/(clubs|clb|org|forum|social|su-kien|match|matches|tran-dau|join)(\/|$)/, "community"],
  [/^\/(account|notifications|thong-bao)(\/|$)/, "account"],
];

/**
 * Trợ lý chung (edge fn site-assistant) theo route. null = không đặt nút.
 * Route quanh giải vẫn đi assistantScreenFor() → trợ lý giải như cũ.
 */
export function sitePageFor(pathname: string): SitePage | null {
  const p = withoutLocale(pathname).replace(/\/+$/, "") || "/";
  if (SITE_HIDDEN.some((r) => r.test(p))) return null;
  return SITE_PAGES.find(([r]) => r.test(p))?.[1] ?? "general";
}

let current: AssistantContext | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Màn hình khai báo ngữ cảnh. Truyền null khi chưa tải xong. */
export function useAssistantContext(ctx: AssistantContext | null): void {
  const key = ctx ? JSON.stringify(ctx) : "";
  useEffect(() => {
    if (!key) return undefined;
    const mine = JSON.parse(key) as AssistantContext;
    current = mine;
    emit();
    return () => {
      if (current === mine) {
        current = null;
        emit();
      }
    };
  }, [key]);
}

export function useCurrentAssistantContext(): AssistantContext | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => current,
    () => null,
  );
}

/** Trang giải nghe sự kiện này để tải lại sau khi trợ lý ghi thay đổi. */
export const ASSISTANT_APPLIED_EVENT = "picklehub:assistant-applied";

export interface Suggestion { vi: string; en: string; href?: string }

export function suggestionsFor(screen: AssistantScreen | null | undefined, phase: "setup" | "drawn" | null): Suggestion[] {
  switch (screen) {
    case "quick_table_detail":
    case "quick_table_registration":
    case "quick_table_setup":
      return phase === "setup"
        ? [{ vi: "Chia bảng cho giải này", en: "Draw groups for this tournament" }, { vi: "Tóm tắt giải", en: "Summarize this tournament" }]
        : [{ vi: "Tóm tắt giải", en: "Summarize this tournament" }, { vi: "Gán sân cho các bảng", en: "Assign courts to the groups" }];
    case "quick_table_groups":
      return [{ vi: "Gán sân cho các bảng", en: "Assign courts to the groups" }, { vi: "Kiểm tra lại bảng", en: "Check the groups" }];
    case "quick_table_results":
      return [{ vi: "Tóm tắt ngày đấu", en: "Summarize today's play" }];
    case "tournament_detail":
    case "quick_table_parent":
      return [{ vi: "Tóm tắt giải", en: "Summarize this tournament" }];
    case "quick_table_hub":
    case "tournament_hub":
      return [{ vi: "Tạo giải mới bằng chat", en: "Create a tournament by chat", href: "/tools/quick-tables/chat" }];
    default:
      return [];
  }
}
