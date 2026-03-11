import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Home, Radio, Trophy, Wrench, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { isIOS, isNativeApp, isAndroid } from "@/lib/capacitor-utils";

const BottomNav = () => {
  const { t } = useI18n();
  const location = useLocation();

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

  // Calculate safe bottom padding based on platform
  // Android navigation bar needs extra space to avoid overlap
  const getBottomPadding = () => {
    if (isAndroidDevice && isNative) {
      return 'max(env(safe-area-inset-bottom, 16px), 16px)';
    }
    if (isIOSDevice) {
      return 'max(env(safe-area-inset-bottom, 0px), 8px)';
    }
    return '0px';
  };

  // Calculate nav height - make it larger to avoid overlap with system nav
  const getNavHeight = () => {
    if (isAndroidDevice && isNative) return '72px'; // Taller for Android
    if (isIOSDevice) return '68px';
    return '56px';
  };

  return (
    <>
      {/* 
        Fixed spacer that fills the entire bottom of the screen behind everything.
        This prevents ANY gap from showing regardless of scroll/bounce behavior.
        Uses the same color as the nav bar so it's seamless.
      */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-[9998] md:hidden bg-background-elevated pointer-events-none"
        style={{ 
          height: '50vh',
          transform: 'translateY(50%)',
        }}
        aria-hidden="true"
      />
      <nav 
        className="fixed bottom-0 left-0 right-0 z-[9999] md:hidden bg-background-elevated border-t border-border-subtle"
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
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
    </>
  );
};

export default BottomNav;
