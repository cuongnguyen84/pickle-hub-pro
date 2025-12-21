import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Home, Radio, PlaySquare, Trophy, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";

const BottomNav = () => {
  const { t } = useI18n();
  const location = useLocation();

  const navItems = [
    { path: "/", label: t.nav.home, icon: Home },
    { path: "/live", label: t.nav.live, icon: Radio },
    { path: "/videos", label: t.nav.videos, icon: PlaySquare },
    { path: "/tournaments", label: t.nav.tournaments, icon: Trophy },
    { path: "/profile", label: t.nav.profile, icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="glass-strong border-t border-border-subtle pb-safe">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[64px]",
                  "transition-colors duration-200",
                  isActive 
                    ? "text-primary" 
                    : "text-foreground-muted hover:text-foreground-secondary"
                )}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
