import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { isIOS } from "@/lib/platform";
import { assistantScreenFor, sitePageFor } from "@/lib/assistant-context";

// Khung chat (và hook quick-table) chỉ tải khi người dùng bấm nút.
const AssistantPanel = lazy(() => import("./AssistantPanel"));

/**
 * Nút trợ lý AI nổi trên (gần) mọi trang. Route quanh giải → trợ lý giải
 * (tournament-assistant, như cũ); route khác → trợ lý chung (site-assistant);
 * sitePageFor() trả null → không hiện. Nút chỉ vẽ sau khi trình duyệt rảnh
 * (không đụng LCP, vị trí fixed nên không gây CLS).
 *
 * Nút là viên thuốc "✦ Trợ lý AI" để người dùng biết đây là AI hỗ trợ (thay
 * 2 nút Messenger/Zalo cũ — liên hệ admin giờ đi qua chính trợ lý). Chữ thu
 * lại thành icon khi người dùng cuộn xuống hoặc sau lần mở đầu tiên (nhớ ở
 * localStorage); desktop di chuột / focus thì bung lại.
 */
export const OPENED_KEY = "tl-asst-opened";

/** Nhãn thu thành icon khi đã từng mở hoặc đã cuộn quá ngưỡng. */
export const COLLAPSE_SCROLL_PX = 80;
export function labelCollapsed(openedBefore: boolean, scrollTop: number): boolean {
  return openedBefore || scrollTop > COLLAPSE_SCROLL_PX;
}

const openedBefore = () => {
  try { return localStorage.getItem(OPENED_KEY) === "1"; } catch { return false; }
};

const AssistantGate = () => {
  const { pathname } = useLocation();
  const { language } = useI18n();
  const screen = assistantScreenFor(pathname);
  const page = screen ? "tournament" : sitePageFor(pathname);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(openedBefore);
  const fabRef = useRef<HTMLButtonElement>(null);
  const reopenFocus = useRef(false);

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) {
      w.requestIdleCallback(() => setReady(true), { timeout: 4000 });
      return undefined;
    }
    const t = setTimeout(() => setReady(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Cuộn trong bất kỳ khung nào (The Line cuộn trong .tl-scroll, không phải window) → thu nhãn, một lần.
  useEffect(() => {
    if (collapsed) return undefined;
    const onScroll = (e: Event) => {
      const t = e.target;
      const y = t === document ? window.scrollY : (t as HTMLElement | null)?.scrollTop ?? 0;
      if (labelCollapsed(false, y)) setCollapsed(true);
    };
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [collapsed]);

  useEffect(() => {
    if (!open && reopenFocus.current) {
      reopenFocus.current = false;
      fabRef.current?.focus();
    }
  }, [open]);

  if (!page) return null;
  const vi = language !== "en";
  const text = vi ? "Trợ lý AI" : "AI assistant";
  const label = screen ? (vi ? "Mở Trợ lý AI giải đấu" : "Open the AI assistant for this tournament") : (vi ? "Hỏi Trợ lý AI" : "Ask the AI assistant");
  const bottom = isIOS() ? "calc(68px + env(safe-area-inset-bottom, 0px) + 12px)" : "calc(56px + 12px)";

  return (
    <>
      {ready && !open && (
        <button
          ref={fabRef}
          type="button"
          className="tl-asst-fab group fixed right-4 bottom-[var(--asst-b)] inline-flex h-11 items-center justify-center rounded-full px-3 md:right-6 md:bottom-6 md:h-12 md:px-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tl-green)]"
          data-collapsed={collapsed ? "true" : "false"}
          style={{
            ["--asst-b" as string]: bottom,
            zIndex: 9990,
            background: "var(--tl-bg, #08090a)",
            color: "var(--tl-green, #00b96b)",
            border: "1px solid var(--tl-border, #22252a)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
          }}
          aria-label={label}
          title={label}
          aria-haspopup="dialog"
          onClick={() => {
            setLoaded(true);
            setOpen(true);
            setCollapsed(true);
            try { localStorage.setItem(OPENED_KEY, "1"); } catch { /* private mode */ }
          }}
        >
          {/* sparkles — SVG nội tuyến để nút không kéo thêm module icon vào bundle đầu */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z" />
            <path d="M20 3v4M22 5h-4" />
          </svg>
          <span
            className={`overflow-hidden whitespace-nowrap text-[13px] font-semibold transition-[max-width,opacity,margin] duration-200 ${
              collapsed
                ? "ml-0 max-w-0 opacity-0 group-hover:ml-1.5 group-hover:max-w-[9rem] group-hover:opacity-100 group-focus-visible:ml-1.5 group-focus-visible:max-w-[9rem] group-focus-visible:opacity-100"
                : "ml-1.5 max-w-[9rem] opacity-100"
            }`}
            style={{ color: "var(--tl-fg, #f5f3ee)" }}
            aria-hidden="true"
          >
            {text}
          </span>
        </button>
      )}
      {loaded && (
        <Suspense fallback={null}>
          <AssistantPanel
            key={screen ? "tournament" : "site"}
            mode={screen ? "tournament" : "site"}
            routeScreen={screen}
            page={page}
            open={open}
            onClose={() => { reopenFocus.current = true; setOpen(false); }}
          />
        </Suspense>
      )}
    </>
  );
};

export default AssistantGate;
