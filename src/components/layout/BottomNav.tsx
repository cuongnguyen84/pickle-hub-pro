import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Home, Radio, Trophy, Wrench, MessageSquare } from "lucide-react";
import { isIOS, isNativeApp, isAndroid } from "@/lib/capacitor-utils";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";

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

  const navItems = [
    { path: "/", label: t.nav.home, icon: Home },
    { path: "/live", label: t.nav.live, icon: Radio },
    { path: "/tools", label: t.nav.tools, icon: Wrench },
    { path: "/forum", label: t.forum.navLabel, icon: MessageSquare },
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
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
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
              <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
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
