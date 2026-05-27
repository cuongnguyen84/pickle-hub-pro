import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { isNativeApp, isIOS, isAndroid } from "@/lib/capacitor-utils";

/**
 * Floating chat-with-admin buttons (Messenger + Zalo) anchored to the
 * bottom-right of the viewport. Visible on all public pages; hidden on
 * admin/creator/preview/embed surfaces and on /onboarding so the FAB
 * doesn't overlap admin tooling or block the onboarding wizard.
 *
 * Sits ABOVE the mobile BottomNav by adding the nav height + iOS/Android
 * safe-area inset to the `bottom` offset. Desktop sits a flat 24px from
 * the bottom edge. z-index 9990 keeps it under BottomNav (z-9999) so the
 * nav always wins overlap, but above page content.
 *
 * Icons are inline SVG (no extra deps). Tooltips render as a CSS pseudo
 * label that fades in on hover/focus.
 *
 * Links open in a new tab. m.me + zalo.me deep-link into the Messenger /
 * Zalo native apps if installed, otherwise web fallback.
 */

const MESSENGER_URL = "https://m.me/thepicklehubnet";
const ZALO_URL = "https://zalo.me/2932845421782592643";

const HIDDEN_PREFIXES = [
  "/admin",
  "/creator",
  "/preview",
  "/embed",
  "/onboarding",
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
  const messengerLabel = isVi ? "Chat qua Messenger" : "Chat on Messenger";
  const zaloLabel = isVi ? "Chat qua Zalo" : "Chat on Zalo";

  // Clear BottomNav on mobile — match the height logic used by BottomNav
  // itself so we slide above it instead of getting covered. Desktop has
  // no bottom nav (md:hidden), so we sit 24px from the bottom edge.
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

  return (
    <div
      aria-label={isVi ? "Liên hệ admin" : "Contact admin"}
      className="fixed right-4 flex flex-col items-end gap-2 md:right-6 md:gap-3"
      style={{
        bottom: getBottomOffset(),
        zIndex: 9990,
      }}
    >
      <a
        href={MESSENGER_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={messengerLabel}
        title={messengerLabel}
        className="group relative inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:h-14 md:w-14"
        style={{
          background:
            "linear-gradient(135deg, #00B2FF 0%, #006AFF 50%, #FF006E 100%)",
          color: "#ffffff",
        }}
      >
        <MessengerIcon />
        <span
          className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-black/85 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 md:block"
          role="tooltip"
        >
          {messengerLabel}
        </span>
      </a>

      <a
        href={ZALO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={zaloLabel}
        title={zaloLabel}
        className="group relative inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:h-14 md:w-14"
        style={{
          background: "#0068FF",
          color: "#ffffff",
        }}
      >
        <ZaloIcon />
        <span
          className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-black/85 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 md:block"
          role="tooltip"
        >
          {zaloLabel}
        </span>
      </a>
    </div>
  );
};

/**
 * Messenger lightning-bolt glyph. Simplified single-path version of the
 * Messenger logo silhouette — fits in 24px and reads cleanly at FAB size.
 */
const MessengerIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M12 2C6.477 2 2 6.145 2 11.259c0 2.913 1.454 5.512 3.726 7.21V22l3.405-1.869c.909.252 1.872.388 2.869.388 5.523 0 10-4.145 10-9.26C22 6.145 17.523 2 12 2Zm.993 12.466-2.545-2.713-4.962 2.713 5.46-5.793 2.608 2.713 4.9-2.713-5.46 5.793Z" />
  </svg>
);

/**
 * Zalo "Z" wordmark glyph. White Z inside the brand-blue circle. Kept
 * inline so we don't add an asset dependency.
 */
const ZaloIcon = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M9 11.5h11.2c.4 0 .6.4.4.7l-7.1 8.6h6.7c.4 0 .7.3.7.7s-.3.7-.7.7H9.4c-.4 0-.6-.4-.4-.7l7.1-8.6H9.7c-.4 0-.7-.3-.7-.7s.3-.7.7-.7Zm14.7 0c.4 0 .7.3.7.7v7.6c0 .4-.3.7-.7.7s-.7-.3-.7-.7v-7.6c0-.4.3-.7.7-.7Z"
      fill="#ffffff"
    />
  </svg>
);

export default ChatFAB;
