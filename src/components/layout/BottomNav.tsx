import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Home, Radio, Trophy, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { isIOS } from "@/lib/capacitor-utils";

const BottomNav = () => {
  const { t } = useI18n();
  const location = useLocation();

  const navItems = [
    { path: "/", label: t.nav.home, icon: Home },
    { path: "/live", label: t.nav.live, icon: Radio },
    { path: "/tools", label: t.nav.tools, icon: Wrench },
    { path: "/tournaments", label: t.nav.tournaments, icon: Trophy },
  ];

  // Detect iOS for specific styling
  const isIOSDevice = isIOS();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="glass-strong border-t border-border-subtle">
        <div 
          className="flex items-center justify-around"
          style={{ 
            height: isIOSDevice ? '60px' : '56px',
            paddingBottom: isIOSDevice ? 'max(env(safe-area-inset-bottom, 0px), 8px)' : '0px'
          }}
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
                  "flex flex-col items-center justify-center gap-0.5 px-4 py-1.5 min-w-[72px]",
                  "transition-colors duration-200",
                  isActive 
                    ? "text-primary" 
                    : "text-foreground-muted hover:text-foreground-secondary"
                )}
              >
                <Icon 
                  className={cn(
                    isIOSDevice ? "w-5 h-5" : "w-[22px] h-[22px]"
                  )} 
                  strokeWidth={isActive ? 2.5 : 1.8} 
                />
                <span className={cn(
                  "font-medium",
                  isIOSDevice ? "text-[10px]" : "text-[11px]"
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
