import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Home, Radio, Trophy, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { isIOS, isNativeApp, isAndroid } from "@/lib/capacitor-utils";

const BottomNav = () => {
  const { t } = useI18n();
  const location = useLocation();

  const navItems = [
    { path: "/", label: t.nav.home, icon: Home },
    { path: "/live", label: t.nav.live, icon: Radio },
    { path: "/tools", label: t.nav.tools, icon: Wrench },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="glass-strong border-t border-border-subtle">
        <div 
          className="flex items-center justify-around"
          style={{ 
            height: getNavHeight(),
            paddingBottom: getBottomPadding()
          }}
        >
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            
            // Larger icons for Android native
            const iconSize = (isAndroidDevice && isNative) ? "w-6 h-6" : (isIOSDevice ? "w-6 h-6" : "w-[22px] h-[22px]");
            const textSize = (isAndroidDevice && isNative) ? "text-xs" : (isIOSDevice ? "text-[11px]" : "text-[11px]");
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-4 py-2 min-w-[76px]",
                  "transition-colors duration-200",
                  isActive 
                    ? "text-primary" 
                    : "text-foreground-muted hover:text-foreground-secondary"
                )}
              >
                <Icon 
                  className={iconSize} 
                  strokeWidth={isActive ? 2.5 : 1.8} 
                />
                <span className={cn(
                  "font-medium",
                  textSize
                )}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
