import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { isIOS } from "@/lib/platform";
import { assistantScreenFor, sitePageFor } from "@/lib/assistant-context";
import { chatFabVisible } from "@/components/layout/ChatFAB";

// Khung chat (và hook quick-table) chỉ tải khi người dùng bấm nút.
const AssistantPanel = lazy(() => import("./AssistantPanel"));

/**
 * Nút trợ lý AI nổi trên (gần) mọi trang. Route quanh giải → trợ lý giải
 * (tournament-assistant, như cũ); route khác → trợ lý chung (site-assistant);
 * sitePageFor() trả null → không hiện. Nút chỉ vẽ sau khi trình duyệt rảnh
 * (không đụng LCP, vị trí fixed nên không gây CLS); trên trang có ChatFAB
 * (Messenger/Zalo) thì xếp lên trên hai nút đó.
 */
const AssistantGate = () => {
  const { pathname } = useLocation();
  const { language } = useI18n();
  const screen = assistantScreenFor(pathname);
  const page = screen ? "tournament" : sitePageFor(pathname);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
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

  useEffect(() => {
    if (!open && reopenFocus.current) {
      reopenFocus.current = false;
      fabRef.current?.focus();
    }
  }, [open]);

  if (!page) return null;
  const vi = language !== "en";
  const label = screen ? (vi ? "Mở trợ lý giải đấu" : "Open tournament assistant") : (vi ? "Hỏi trợ lý AI" : "Ask the AI assistant");
  const base = isIOS() ? "calc(68px + env(safe-area-inset-bottom, 0px) + 12px)" : "calc(56px + 12px)";
  const stacked = chatFabVisible(pathname);
  // ChatFAB: 2 nút 44px + khe 10px (mobile), 2 × 48px + 12px (desktop).
  const bottom = stacked ? `calc(${base} + 108px)` : base;
  const bottomMd = stacked ? "144px" : "24px";

  return (
    <>
      {ready && !open && (
        <button
          ref={fabRef}
          type="button"
          className="tl-asst-fab fixed right-4 bottom-[var(--asst-b)] inline-flex h-11 w-11 items-center justify-center rounded-full md:right-6 md:bottom-[var(--asst-bmd)] md:h-12 md:w-12 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tl-green)]"
          style={{
            ["--asst-b" as string]: bottom,
            ["--asst-bmd" as string]: bottomMd,
            zIndex: 9990,
            background: "var(--tl-bg, #08090a)",
            color: "var(--tl-green, #00b96b)",
            border: "1px solid var(--tl-border, #22252a)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
          }}
          aria-label={label}
          title={label}
          aria-haspopup="dialog"
          onClick={() => { setLoaded(true); setOpen(true); }}
        >
          {/* sparkles — SVG nội tuyến để nút không kéo thêm module icon vào bundle đầu */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z" />
            <path d="M20 3v4M22 5h-4" />
          </svg>
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
