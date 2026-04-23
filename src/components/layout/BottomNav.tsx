import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Home, Radio, Trophy, Wrench, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { isIOS, isNativeApp, isAndroid } from "@/lib/capacitor-utils";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";

const BottomNav = () => {
  const { t } = useI18n();
  const location = useLocation();
  const keyboardHeight = useKeyboardHeight();

  // Hide on admin, creator, preview, and embed routes (they have their own nav or no chrome)
  if (
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/creator") ||
    location.pathname.startsWith("/preview") ||
    location.pathname.startsWith("/embed")
  ) {
    return null;
  }

  // Hide when virtual keyboard is open on mobile
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

  // Detect platform for specific styling
  const isIOSDevice = isIOS();
  const isAndroidDevice = isAndroid();
  const isNative = isNativeApp();

  // Keep safe area inside nav instead of drawing a large overlay that can hide content
  const getBottomPadding = () => {
    if (isAndroidDevice && isNative) {
      return 'max(env(safe-area-inset-bottom, 14px), 14px)';
    }
    if (isIOSDevice) {
      return 'env(safe-area-inset-bottom, 0px)';
    }
    return '0px';
  };

  const getNavHeight = () => {
    if (isAndroidDevice && isNative) return '72px';
    if (isIOSDevice) return '68px';
    return '56px';
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[9999] md:hidden bg-background-elevated/80 backdrop-blur-xl border-t border-white/[0.06]"
      style={{
        paddingBottom: getBottomPadding(),
      }}
    >
      <div
        className="flex items-stretch justify-around"
        style={{ minHeight: getNavHeight() }}
      >
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 flex-1 py-3",
                "transition-colors duration-200 relative",
                isActive
                  ? "text-primary"
                  : "text-foreground-muted hover:text-foreground-secondary"
              )}
            >
              <Icon
                className="w-7 h-7"
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
