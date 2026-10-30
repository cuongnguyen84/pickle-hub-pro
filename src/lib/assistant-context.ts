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
