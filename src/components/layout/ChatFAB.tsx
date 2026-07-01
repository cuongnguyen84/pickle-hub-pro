import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { isNativeApp, isIOS, isAndroid } from "@/lib/capacitor-utils";

/**
 * Floating chat-with-admin buttons (Messenger + Zalo) anchored to the
 * bottom-right of the viewport. Visible on all public pages; hidden on
 * admin/creator/preview/embed/onboarding surfaces.
 *
 * Design — editorial restraint matching the rest of the site:
 *   - Same dark fill (var(--tl-bg)) and hairline border (var(--tl-border))
 *     used by BottomNav, so the buttons feel like part of the chrome
 *     rather than vendor widgets.
 *   - Brand color appears ONLY in the icon glyph (Messenger blue,
 *     Zalo blue) — small accent dots in an otherwise calm panel.
 *   - Hover/focus surfaces the site's green accent via a 1px ring,
 *     same primitive as the stats-strip bar and BottomNav active tab.
 *   - 44px touch target (mobile) / 48px (desktop) — large enough to
 *     tap, small enough to not block content.
 *
 * Positioning: sits ABOVE the mobile BottomNav by adding nav height +
 * iOS/Android safe-area inset to the `bottom` offset. Desktop sits a
 * flat 24px from the bottom edge. z-index 9990 keeps it under BottomNav
 * (z-9999) so the nav always wins overlap.
 *
 * Tooltip uses Geist Mono CAPS to match the editorial kicker style.
 */

const MESSENGER_URL = "https://m.me/thepicklehubnet";
const ZALO_URL = "https://zalo.me/2932845421782592643";

const HIDDEN_PREFIXES = [
  "/admin",
  "/creator",
  "/preview",
  "/embed",
  "/onboarding",
  "/tools/quick-tables/referee", // full-screen live-scoring tool
  "/tools/team-match/match/", // team-match referee scoring (matchId)/score
];

const DESKTOP_BREAKPOINT = "(min-width: 768px)";

const ChatFAB = () => {
  const location = useLocation();
  const { language } = useI18n();
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(DESKTOP_BREAKPOINT).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(DESKTOP_BREAKPOINT);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const shouldHide = HIDDEN_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix),
  );

  if (shouldHide) {
    return null;
  }

  const isVi = language === "vi";
  const messengerLabel = "MESSENGER";
  const zaloLabel = "ZALO";
  const messengerAria = isVi ? "Chat qua Messenger" : "Chat on Messenger";
  const zaloAria = isVi ? "Chat qua Zalo" : "Chat on Zalo";

  // Clear BottomNav on mobile — match the height logic used by BottomNav.
  const isIOSDevice = isIOS();
  const isAndroidDevice = isAndroid();
  const isNative = isNativeApp();

  const getBottomOffset = (): string => {
    if (isDesktop) return "24px";
    if (isAndroidDevice && isNative) {
      return "calc(72px + max(env(safe-area-inset-bottom, 14px), 14px) + 12px)";
    }
    if (isIOSDevice) {
      return "calc(68px + env(safe-area-inset-bottom, 0px) + 12px)";
    }
    return "calc(56px + 12px)";
  };

  const buttonBase: React.CSSProperties = {
    background: "var(--tl-bg, #08090a)",
    border: "1px solid var(--tl-border, #22252a)",
    color: "var(--tl-fg, #f5f3ee)",
    boxShadow:
      "0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 0 rgba(0, 185, 107, 0)",
    transition:
      "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
  };

  return (
    <div
      aria-label={isVi ? "Liên hệ admin" : "Contact admin"}
      className="fixed right-4 flex flex-col items-end gap-2.5 md:right-6 md:gap-3"
      style={{
        bottom: getBottomOffset(),
        zIndex: 9990,
      }}
    >
      <a
        href={MESSENGER_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={messengerAria}
        title={messengerAria}
        className="tl-chat-fab group relative inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none md:h-12 md:w-12"
        style={buttonBase}
      >
        <MessengerIcon />
        <Tooltip label={messengerLabel} />
      </a>

      <a
        href={ZALO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={zaloAria}
        title={zaloAria}
        className="tl-chat-fab group relative inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none md:h-12 md:w-12"
        style={buttonBase}
      >
        <ZaloIcon />
        <Tooltip label={zaloLabel} />
      </a>

      <style>{`
        .tl-chat-fab:hover,
        .tl-chat-fab:focus-visible {
          transform: scale(1.06);
          border-color: var(--tl-green, #00b96b) !important;
          box-shadow:
            0 6px 16px rgba(0, 0, 0, 0.5),
            0 0 0 3px rgba(0, 185, 107, 0.18) !important;
        }
        .tl-chat-fab:active {
          transform: scale(0.96);
        }
      `}</style>
    </div>
  );
};

/**
 * Editorial-style tooltip: Geist Mono CAPS with the same letterspacing
 * used in pills, news source tags, and BottomNav labels. Fades in on
 * hover/focus of the parent group. Desktop only (md:flex).
 */
const Tooltip = ({ label }: { label: string }) => (
  <span
    className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 items-center whitespace-nowrap rounded border opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 md:flex"
    role="tooltip"
    style={{
      background: "var(--tl-bg, #08090a)",
      borderColor: "var(--tl-border, #22252a)",
      color: "var(--tl-fg, #f5f3ee)",
      fontFamily:
        '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
      fontSize: 10,
      letterSpacing: "0.14em",
      fontWeight: 500,
      padding: "4px 8px",
    }}
  >
    {label}
  </span>
);

/**
 * Messenger lightning-bolt glyph in Messenger brand blue. The brand
 * color is the ONLY chromatic accent on the button.
 */
const MessengerIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="#0084FF"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M12 2C6.477 2 2 6.145 2 11.259c0 2.913 1.454 5.512 3.726 7.21V22l3.405-1.869c.909.252 1.872.388 2.869.388 5.523 0 10-4.145 10-9.26C22 6.145 17.523 2 12 2Zm.993 12.466-2.545-2.713-4.962 2.713 5.46-5.793 2.608 2.713 4.9-2.713-5.46 5.793Z" />
  </svg>
);

/**
 * Zalo glyph: clean uppercase "Z" inside a rounded square in Zalo brand
 * blue. Drawn as a single path so it scales cleanly. (The previous
 * version had a stray second path that rendered as "!" after the Z —
 * fixed here.)
 */
const ZaloIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="4" fill="#0068FF" />
    <path
      d="M8 8.5h7.6c.45 0 .7.52.42.87L9.9 16.1h6.1c.39 0 .7.31.7.7s-.31.7-.7.7H8.3c-.45 0-.7-.52-.42-.87l6.13-6.73H8c-.39 0-.7-.31-.7-.7s.31-.7.7-.7Z"
      fill="#ffffff"
    />
  </svg>
);

export default ChatFAB;
