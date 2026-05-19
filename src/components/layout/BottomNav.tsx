import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Home, Radio, Trophy, Wrench, Newspaper } from "lucide-react";
import { isIOS, isNativeApp, isAndroid } from "@/lib/capacitor-utils";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { useLivestreams } from "@/hooks/useSupabaseData";

/**
 * Mobile bottom nav, redesigned to match The Line editorial system used
 * across homepage, stats strip, kickers, footer:
 *
 *   - Solid editorial bg (no backdrop blur — content shouldn't see through
 *     to varied photos; calm panel beats glass).
 *   - 28×3px green accent bar at top of active cell — exact primitive from
 *     the homepage stats strip. The signature editorial move.
 *   - Lucide icons at 20px stroke 1.5 — slimmer, refined, identical
 *     weight in both states (no stroke swap on active; too app-y).
 *   - Mono CAPS labels (Geist Mono 9px / 0.14em tracking) matching the
 *     kicker style used in pills, news source tags, etc.
 *   - Color discipline: muted by default, full white when active. Green
 *     only appears as the accent bar — same restraint as the rest of the
 *     site (one accent, never flooded).
 *   - Hairline 1px vertical dividers between cells.
 *
 * Design constraints kept from previous version:
 *   - Mobile only (md:hidden)
 *   - Hide on /admin, /creator, /preview, /embed
 *   - Hide when virtual keyboard is open
 *   - iOS / Android Capacitor safe-area padding helpers
 *   - i18n labels unchanged
 */
const BottomNav = () => {
  const { t } = useI18n();
  const location = useLocation();
  const keyboardHeight = useKeyboardHeight();
  // Live count for the Live tab badge. Must be called BEFORE any early
  // returns or React detects a hook-count mismatch when the component
  // toggles between "render normally" and "return null" (e.g. keyboard
  // opens after the drawer search input autofocuses) and crashes the
  // whole tree — that was the "menu button freezes the page" regression.
  const { data: liveStreams = [] } = useLivestreams("live");
  const liveCount = liveStreams.length;

  if (
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/creator") ||
    location.pathname.startsWith("/preview") ||
    location.pathname.startsWith("/embed")
  ) {
    return null;
  }

  if (keyboardHeight > 0) {
    return null;
  }

  // Sprint 5 PR-A: replaced /forum slot with /feed. Forum still reachable
  // via the burger drawer; Feed is the entry point for the Bet #1 social
  // loop and should sit in the 5-slot mobile primary nav.
  const navItems = [
    { path: "/", label: t.nav.home, icon: Home },
    { path: "/live", label: t.nav.live, icon: Radio, liveBadge: liveCount > 0 },
    { path: "/feed", label: t.nav.feed, icon: Newspaper },
    { path: "/tools", label: t.nav.tools, icon: Wrench },
    { path: "/tournaments", label: t.nav.tournaments, icon: Trophy },
  ];

  const isIOSDevice = isIOS();
  const isAndroidDevice = isAndroid();
  const isNative = isNativeApp();

  const getBottomPadding = () => {
    if (isAndroidDevice && isNative) {
      return "max(env(safe-area-inset-bottom, 14px), 14px)";
    }
    if (isIOSDevice) {
      return "env(safe-area-inset-bottom, 0px)";
    }
    return "0px";
  };

  const getNavHeight = () => {
    if (isAndroidDevice && isNative) return "72px";
    if (isIOSDevice) return "68px";
    return "56px";
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[9999] md:hidden"
      style={{
        paddingBottom: getBottomPadding(),
        background: "var(--tl-bg, #08090a)",
        borderTop: "1px solid var(--tl-border, #22252a)",
      }}
      role="navigation"
      aria-label="Primary mobile navigation"
    >
      <div
        className="flex items-stretch justify-around"
        style={{ minHeight: getNavHeight() }}
      >
        {navItems.map((item, idx) => {
          // Match /<path> AND /vi/<path>. The slot links to the English
          // path; light up when the user is on either language variant
          // of the same surface (Phase 4A shipped /feed + /vi/feed).
          const path = location.pathname;
          const viPath = item.path === "/" ? "/vi" : `/vi${item.path}`;
          const isActive =
            path === item.path ||
            path === viPath ||
            (item.path !== "/" &&
              (path.startsWith(`${item.path}/`) ||
                path.startsWith(`${viPath}/`)));
          const Icon = item.icon;
          const isLast = idx === navItems.length - 1;

          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className="relative flex flex-col items-center justify-center flex-1 py-2.5 px-1 focus-visible:outline-none focus-visible:bg-white/[0.04]"
              style={{
                borderRight: isLast ? "none" : "1px solid var(--tl-border, #22252a)",
                color: isActive ? "var(--tl-fg, #f5f3ee)" : "var(--tl-fg-3, #86837d)",
                transition: "color 0.18s ease",
              }}
            >
              {/* Active accent bar — 28×3 green, same primitive as stats strip.
                  Sits at top of cell, slightly overlapping the hairline border
                  so it reads as a "tab marker" rather than a stripe inside the cell. */}
              {isActive && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: -1,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 28,
                    height: 3,
                    background: "var(--tl-green, #00b96b)",
                  }}
                />
              )}
              <span style={{ position: "relative", display: "inline-flex" }}>
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                {item.liveBadge && (
                  <span
                    aria-hidden="true"
                    className="tl-bn-live-dot"
                    style={{
                      position: "absolute",
                      top: -3,
                      right: -5,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--tl-live, #ff4136)",
                      boxShadow: "0 0 0 2px var(--tl-bg, #08090a)",
                    }}
                  />
                )}
              </span>
              <span
                style={{
                  fontFamily:
                    '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                  fontSize: 9,
                  fontWeight: 500,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  marginTop: 6,
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
